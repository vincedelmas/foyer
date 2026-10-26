package com.foyer.tv

import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.net.Uri
import android.provider.Settings
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.core.content.FileProvider
import androidx.tv.material3.Text
import java.io.File
import java.net.URI
import java.security.MessageDigest
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import okhttp3.Request

@Serializable
data class TvUpdate(
    val schemaVersion: Int,
    val version: String,
    val versionCode: Int,
    val apkUrl: String,
    val sha256: String,
    val size: Long,
    val publishedAt: String,
) {
    fun validate(repository: String, tag: String) {
        require(
            schemaVersion == 1 && version.matches(Regex("\\d+\\.\\d+\\.\\d+")) && tag == "v$version"
        ) {
            "Invalid update version"
        }
        require(versionCode > 0 && size > 0 && sha256.matches(Regex("[a-fA-F0-9]{64}"))) {
            "Invalid update manifest"
        }
        val uri = URI(apkUrl)
        require(
            uri.scheme == "https" &&
                uri.host == "github.com" &&
                uri.port == -1 &&
                uri.userInfo == null &&
                uri.rawPath == "/$repository/releases/download/$tag/foyer-tv.apk" &&
                uri.query == null &&
                uri.fragment == null
        ) {
            "The update APK does not belong to its release"
        }
    }
}

@Serializable private data class ReleaseAsset(val name: String, val browser_download_url: String)

@Serializable
private data class Release(
    val tag_name: String,
    val draft: Boolean,
    val prerelease: Boolean,
    val assets: List<ReleaseAsset>,
)

enum class UpdateStatus {
    Idle,
    Checking,
    Available,
    Downloading,
    Verifying,
    Permission,
    Installing,
    UpToDate,
    Error,
}

class TvUpdater(
    private val context: Context,
    private val preferences: SharedPreferences,
    private val scope: CoroutineScope,
) {
    var status by mutableStateOf(UpdateStatus.Idle)
        private set

    var update by mutableStateOf<TvUpdate?>(null)
        private set

    var progress by mutableFloatStateOf(0f)
        private set

    var error by mutableStateOf<String?>(null)
        private set

    var visible by mutableStateOf(false)
    private var downloadedVersion: Int? = null
    val busy
        get() =
            status in
                listOf(UpdateStatus.Checking, UpdateStatus.Downloading, UpdateStatus.Verifying)

    val supported
        get() = !BuildConfig.DEBUG

    private val needsInstallPermission
        get() = !context.packageManager.canRequestPackageInstalls()

    private val apk
        get() = File(context.cacheDir, "updates/foyer-tv-update.apk")

    suspend fun checkAutomatically() {
        if (!supported) return
        delay(2500)
        val lastCheck = preferences.getString("foyer.tv-updates.last-check", "0")!!.toLong()
        if (System.currentTimeMillis() - lastCheck >= 24 * 60 * 60 * 1000L) check(false)
    }

    fun check(manual: Boolean = true) {
        if (!supported || busy) return
        status = UpdateStatus.Checking
        error = null
        scope.launch {
            try {
                val releasesRequest =
                    Request.Builder()
                        .url(
                            "https://api.github.com/repos/${BuildConfig.UPDATE_REPOSITORY}/releases?per_page=20"
                        )
                        .header("Accept", "application/vnd.github+json")
                        .header("X-GitHub-Api-Version", "2022-11-28")
                        .build()
                val releases = releasesRequest.fetch { response ->
                    check(response.isSuccessful) { "Update check failed (${response.code})" }
                    Api.json.decodeFromString<List<Release>>(response.body!!.string())
                }
                val release = releases.firstOrNull {
                    !it.draft &&
                        !it.prerelease &&
                        it.tag_name.matches(Regex("v\\d+\\.\\d+\\.\\d+")) &&
                        it.assets.any { asset -> asset.name == "update.json" }
                }
                val latest =
                    release
                        ?.let {
                            val manifestUrl =
                                it.assets
                                    .first { asset -> asset.name == "update.json" }
                                    .browser_download_url
                            Request.Builder().url(manifestUrl).build().fetch { response ->
                                check(response.isSuccessful) {
                                    "Update manifest download failed (${response.code})"
                                }
                                Api.json
                                    .decodeFromString<TvUpdate>(response.body!!.string())
                                    .apply {
                                        validate(BuildConfig.UPDATE_REPOSITORY, release.tag_name)
                                    }
                            }
                        }
                        ?.takeIf { it.versionCode > BuildConfig.VERSION_CODE }
                preferences
                    .edit()
                    .putString("foyer.tv-updates.last-check", System.currentTimeMillis().toString())
                    .apply()
                update = latest
                status = if (latest == null) UpdateStatus.UpToDate else UpdateStatus.Available
                if (
                    latest != null &&
                        (manual ||
                            preferences.getString("foyer.tv-updates.dismissed-version", null) !=
                                latest.versionCode.toString())
                ) {
                    visible = true
                }
            } catch (caught: CancellationException) {
                throw caught
            } catch (caught: Exception) {
                status = UpdateStatus.Error
                error = caught.message
            }
        }
    }

    fun dismiss() {
        if (busy) return
        update?.let {
            preferences
                .edit()
                .putString("foyer.tv-updates.dismissed-version", it.versionCode.toString())
                .apply()
        }
        visible = false
    }

    fun install() {
        val selected = update ?: return
        if (busy) return
        visible = true
        error = null
        scope.launch {
            try {
                if (downloadedVersion != selected.versionCode || !apk.exists()) {
                    status = UpdateStatus.Downloading
                    progress = 0f
                    val sha256 =
                        Request.Builder().url(selected.apkUrl).build().fetch { response ->
                            apk.parentFile!!.mkdirs()
                            try {
                                check(response.isSuccessful) {
                                    "APK download failed (${response.code})"
                                }
                                val digest = MessageDigest.getInstance("SHA-256")
                                var count = 0L
                                var reportedPercent = -1
                                response.body!!.byteStream().use { input ->
                                    apk.outputStream().use { output ->
                                        val buffer = ByteArray(64 * 1024)
                                        while (true) {
                                            val length = input.read(buffer)
                                            if (length == -1) break
                                            output.write(buffer, 0, length)
                                            digest.update(buffer, 0, length)
                                            count += length
                                            val percent =
                                                (count * 100 / selected.size)
                                                    .toInt()
                                                    .coerceAtMost(100)
                                            if (percent != reportedPercent) {
                                                reportedPercent = percent
                                                scope.launch { progress = percent / 100f }
                                            }
                                        }
                                    }
                                }
                                check(count == selected.size) {
                                    "The downloaded APK has an unexpected size"
                                }
                                digest.digest().joinToString("") { "%02x".format(it) }
                            } catch (caught: Exception) {
                                apk.delete()
                                throw caught
                            }
                        }
                    status = UpdateStatus.Verifying
                    if (!sha256.equals(selected.sha256, ignoreCase = true)) {
                        withContext(Dispatchers.IO) { apk.delete() }
                        error("The downloaded APK failed its SHA-256 check")
                    }
                    downloadedVersion = selected.versionCode
                }
                if (needsInstallPermission) {
                    status = UpdateStatus.Permission
                    context.startActivity(
                        Intent(
                                Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                                Uri.parse("package:${context.packageName}"),
                            )
                            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    )
                } else {
                    val uri =
                        FileProvider.getUriForFile(context, "${context.packageName}.updates", apk)
                    status = UpdateStatus.Installing
                    context.startActivity(
                        Intent(Intent.ACTION_VIEW)
                            .setDataAndType(uri, "application/vnd.android.package-archive")
                            .addFlags(
                                Intent.FLAG_ACTIVITY_NEW_TASK or
                                    Intent.FLAG_GRANT_READ_URI_PERMISSION
                            )
                    )
                }
            } catch (caught: CancellationException) {
                throw caught
            } catch (caught: Exception) {
                status = UpdateStatus.Error
                error = caught.message
            }
        }
    }

    val description: String
        get() =
            when {
                !supported -> "Update checks are enabled in signed release builds."
                status == UpdateStatus.Checking -> "Checking the public release feed…"
                status == UpdateStatus.Downloading -> "Downloading… ${(progress * 100).toInt()}%"
                status == UpdateStatus.Verifying -> "Verifying the downloaded APK…"
                status == UpdateStatus.Permission ->
                    "Allow Foyer TV to install updates, return here, then choose Install update."
                status == UpdateStatus.Installing -> "Waiting for Android’s installer…"
                status == UpdateStatus.UpToDate -> "This TV is up to date."
                status == UpdateStatus.Error -> error ?: "The update check failed."
                update != null -> "Version ${update!!.version} is ready to install."
                else -> "Checks automatically once a day when Foyer starts."
            }
}

@Composable
fun UpdateDialog(updater: TvUpdater) {
    if (!updater.visible) return
    TvDialog("Foyer TV update", onClose = updater::dismiss, busy = updater.busy) {
        updater.update?.let { Text("Foyer TV ${BuildConfig.VERSION_NAME} → ${it.version}") }
        Note(updater.description, error = updater.status == UpdateStatus.Error)
        if (updater.status == UpdateStatus.Downloading) ProgressTrack(updater.progress)
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            TvButton("Later", enabled = !updater.busy, onClick = updater::dismiss)
            TvButton(
                if (updater.status == UpdateStatus.Error) "Try again" else "Install update",
                Modifier.preferredFocus(),
                primary = true,
                enabled = !updater.busy,
                onClick = updater::install,
            )
        }
    }
}
