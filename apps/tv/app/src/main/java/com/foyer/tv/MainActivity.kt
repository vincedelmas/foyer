package com.foyer.tv

import android.app.Application
import android.content.Intent
import android.os.Bundle
import android.view.WindowInsets
import android.view.WindowInsetsController
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveableStateHolder
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.compose.LifecycleResumeEffect
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import com.foyer.player.FoyerPlayerActivity
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import okhttp3.HttpUrl.Companion.toHttpUrl

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { FoyerTheme { FoyerApp() } }
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus)
            window.decorView.windowInsetsController?.apply {
                hide(WindowInsets.Type.systemBars())
                systemBarsBehavior = WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            }
    }
}

class AppModel(application: Application, private val saved: SavedStateHandle) :
    AndroidViewModel(application) {
    val preferences = (application as FoyerApplication).preferences
    var server by mutableStateOf(preferences.getString("foyer.server-url", "")!!)
        private set

    var api by mutableStateOf(Api(server))
        private set

    var stack by mutableStateOf(saved.get<ArrayList<String>>("routes")?.toList() ?: listOf("home"))
        private set

    val route
        get() = stack.last()

    var revision by mutableIntStateOf(0)
        private set

    var busy by mutableStateOf(false)
        private set

    var error by mutableStateOf<String?>(null)
    val updater = TvUpdater(application, preferences, viewModelScope)

    fun navigate(route: String) {
        if (route == this.route) return
        stack = if (route == "home") listOf("home") else stack + route
        saved["routes"] = ArrayList(stack)
    }

    fun back() {
        if (stack.size > 1) {
            stack = stack.dropLast(1)
            saved["routes"] = ArrayList(stack)
        }
    }

    fun saveServer(value: String) {
        val normalized = value.trim().trimEnd('/')
        normalized.toHttpUrl()
        preferences.edit().putString("foyer.server-url", normalized).apply()
        server = normalized
        api = Api(normalized)
        stack = listOf("home")
        saved["routes"] = arrayListOf("home")
        refresh()
    }

    fun refresh() {
        api.invalidate()
        revision++
    }

    fun scanCollection(id: String? = null, after: () -> Unit = {}) =
        action(after) {
            val failed = api.scan(id).scans.filter { it.status == "failed" }
            check(failed.isEmpty()) {
                "${failed.size} collections failed to scan: ${failed.joinToString { it.error ?: "Unknown error" }}"
            }
        }

    // Mutations live above screens so leaving a dialog cannot cancel a server operation.
    fun action(after: () -> Unit = {}, block: suspend () -> Unit) {
        if (busy) return
        busy = true
        error = null
        viewModelScope.launch {
            try {
                block()
                after()
            } catch (error: CancellationException) {
                throw error
            } catch (caught: Exception) {
                error = caught.message ?: "Request failed"
            } finally {
                refresh()
                busy = false
            }
        }
    }
}

@Composable
fun FoyerApp(model: AppModel = viewModel()) {
    val context = androidx.compose.ui.platform.LocalContext.current
    val scope = rememberCoroutineScope()
    val holder = rememberSaveableStateHolder()
    var launching by remember { mutableStateOf(false) }
    val player =
        rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) { result
            ->
            val data = result.data
            data?.getStringExtra(FoyerPlayerActivity.RESULT_ERROR)?.let { model.error = it }
            scope.launch {
                try {
                    val partId = data?.getStringExtra(FoyerPlayerActivity.RESULT_PART_ID)
                    val duration =
                        data?.getDoubleExtra(FoyerPlayerActivity.RESULT_DURATION, 0.0) ?: 0.0
                    if (partId != null && duration > 0) {
                        model.api.saveProgress(
                            partId,
                            data!!.getDoubleExtra(FoyerPlayerActivity.RESULT_POSITION, 0.0),
                            duration,
                        )
                    }
                } catch (caught: CancellationException) {
                    throw caught
                } catch (_: Exception) {
                    // Final progress is best-effort, as are the player's periodic reports.
                } finally {
                    model.refresh()
                    launching = false
                }
            }
        }
    val play: (String, String) -> Unit = { mediaId, partId ->
        if (!launching) {
            launching = true
            scope.launch {
                try {
                    val options = model.api.playbackOptions(mediaId, partId)
                    player.launch(
                        Intent(context, FoyerPlayerActivity::class.java)
                            .putExtra(FoyerPlayerActivity.EXTRA_OPTIONS, options)
                    )
                } catch (error: CancellationException) {
                    throw error
                } catch (error: Exception) {
                    launching = false
                    model.error = error.message
                }
            }
        }
    }
    BackHandler(enabled = model.server.isNotEmpty() && model.stack.size > 1) { model.back() }
    LifecycleResumeEffect(Unit) {
        model.refresh()
        onPauseOrDispose {}
    }
    LaunchedEffect(model.route, model.server, model.revision) {
        if (model.server.isNotEmpty() && model.route == "home") model.updater.checkAutomatically()
    }
    Column(
        Modifier.fillMaxSize()
            .background(
                Brush.verticalGradient(
                    listOf(Palette.surface, Palette.background, Palette.background)
                )
            )
    ) {
        if (model.server.isEmpty()) {
            ConnectionScreen(model)
        } else {
            Row(
                Modifier.fillMaxWidth().padding(horizontal = 32.dp, vertical = 18.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    androidx.tv.material3.Text(
                        "foyer",
                        fontSize = 30.sp,
                        fontFamily = FontFamily.Serif,
                        fontWeight = FontWeight.Bold,
                        color = Palette.primary,
                    )
                    androidx.tv.material3.Text(
                        "YOUR HOME CINEMA",
                        color = Palette.muted,
                        fontSize = 9.sp,
                        letterSpacing = 2.sp,
                    )
                }
                TvButton(
                    "Home",
                    selected = model.route == "home",
                    onClick = { model.navigate("home") },
                )
                if (model.stack.size > 1) TvButton("Back", onClick = model::back)
                TvButton(
                    "Settings",
                    selected = model.route == "settings",
                    onClick = { model.navigate("settings") },
                )
            }
            key(model.server, model.route) {
                holder.SaveableStateProvider(model.server + ":" + model.route) {
                    when {
                        model.route == "home" -> HomeScreen(model)
                        model.route == "settings" -> SettingsScreen(model)
                        model.route.startsWith("collection/") ->
                            CollectionScreen(model, model.route.removePrefix("collection/"))
                        model.route.startsWith("detail/") ->
                            DetailScreen(model, model.route.removePrefix("detail/"), play)
                    }
                }
            }
        }
    }
    if (launching && !model.busy) {
        // The player activity takes over once its complete playlist has loaded.
        androidx.compose.ui.window.Dialog(onDismissRequest = {}) {
            androidx.tv.material3.Text(
                "Opening player…",
                modifier = Modifier.background(Palette.surface).padding(24.dp),
            )
        }
    }
    model.error?.let { message ->
        TvDialog("Could not complete the action", onClose = { model.error = null }) {
            Note(message, error = true)
            TvButton("OK", Modifier.preferredFocus(), onClick = { model.error = null })
        }
    }
    UpdateDialog(model.updater)
}
