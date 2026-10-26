package com.foyer.tv

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.tv.material3.Text
import java.text.DateFormat
import java.util.Date
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch

@Composable
fun ConnectionScreen(model: AppModel) {
    Column(
        Modifier.fillMaxSize().padding(horizontal = 100.dp, vertical = 60.dp),
        verticalArrangement = Arrangement.spacedBy(22.dp),
    ) {
        Heading("Find your home server", "WELCOME TO FOYER TV", large = true)
        Note(
            "Enter the LAN address of the computer running Foyer, for example http://192.168.1.10:3000."
        )
        ConnectionForm(model)
    }
}

@Composable
private fun ConnectionForm(model: AppModel) {
    var server by rememberSaveable {
        mutableStateOf(model.server.ifEmpty { "http://192.168.1.10:3000" })
    }
    var testing by remember { mutableStateOf(false) }
    var message by remember { mutableStateOf<String?>(null) }
    var failed by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Field(
            "Server URL",
            server,
            {
                server = it
                message = null
            },
            Modifier.preferredFocus(model.server.isEmpty()),
            keyboardType = KeyboardType.Uri,
        )
        message?.let { Note(it, error = failed) }
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            TvButton(
                if (testing) "Testing…" else "Test connection",
                enabled = !testing,
                onClick = {
                    testing = true
                    scope.launch {
                        try {
                            Api(server.trim().trimEnd('/')).health()
                            failed = false
                            message = "Connected to Foyer."
                        } catch (caught: CancellationException) {
                            throw caught
                        } catch (caught: Exception) {
                            failed = true
                            message = caught.message
                        } finally {
                            testing = false
                        }
                    }
                },
            )
            TvButton(
                "Save server",
                enabled = server.isNotBlank() && !testing,
                onClick = {
                    try {
                        model.saveServer(server)
                    } catch (caught: IllegalArgumentException) {
                        failed = true
                        message = caught.message
                    }
                },
            )
        }
    }
}

@Composable
fun SettingsScreen(model: AppModel) {
    val settings =
        load(model.api, model.revision) { model.api.get<Settings>("/api/v1/settings/overview") }
    val library =
        load(model.api, model.revision) {
            model.api.library(mapOf("page" to "1", "pageSize" to "1"))
        }
    val dialogs = remember { DialogController() }
    LazyColumn(
        contentPadding = PaddingValues(start = 48.dp, end = 48.dp, top = 12.dp, bottom = 36.dp),
        verticalArrangement = Arrangement.spacedBy(22.dp),
    ) {
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Heading("Settings", large = true)
                TvButton(
                    "Scan all collections",
                    Modifier.preferredFocus(),
                    enabled = !model.busy,
                    onClick = { model.scanCollection() },
                )
            }
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(30.dp)) {
                library.value?.stats?.let { stats ->
                    Text("${stats.titles} titles")
                    Text("${stats.unmatched} unmatched")
                    Text("${stats.inProgress} in progress")
                }
                settings.value?.let { Text("${it.libraries.size} collections") }
            }
            LoadNotice(library)
        }
        item {
            Column(
                Modifier.fillMaxWidth()
                    .border(1.dp, Palette.border, RoundedCornerShape(14.dp))
                    .background(Palette.surface, RoundedCornerShape(14.dp))
                    .padding(24.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Heading("App updates")
                Note("Foyer TV ${BuildConfig.VERSION_NAME} · build ${BuildConfig.VERSION_CODE}")
                Note(model.updater.description, error = model.updater.status == UpdateStatus.Error)
                TvButton(
                    if (model.updater.update == null) "Check for updates" else "View update",
                    enabled = model.updater.supported && !model.updater.busy,
                    onClick = {
                        if (model.updater.update == null) model.updater.check()
                        else model.updater.visible = true
                    },
                )
            }
        }
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Heading("Collections")
                TvButton(
                    "Create collection",
                    onClick = { dialogs.current = Overlay.EditCollection(null) },
                )
            }
            LoadNotice(settings)
        }
        items(settings.value?.libraries.orEmpty(), key = { it.id }) { folder ->
            TvMenuItem(
                folder.name,
                description =
                    "${if (folder.kind == "movies") "Movies" else "TV shows"} · ${folder.path}",
                onClick = { dialogs.current = Overlay.CollectionMenu(folder) },
            )
        }
        item {
            Column(
                Modifier.fillMaxWidth()
                    .border(1.dp, Palette.border, RoundedCornerShape(14.dp))
                    .background(Palette.surface, RoundedCornerShape(14.dp))
                    .padding(24.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                Heading("Server connection")
                ConnectionForm(model)
            }
        }
        item { Heading("Recent scans") }
        items(settings.value?.scans.orEmpty(), key = { "scan-${it.id}" }) { scan ->
            Column(
                Modifier.fillMaxWidth()
                    .border(1.dp, Palette.border, RoundedCornerShape(12.dp))
                    .background(Palette.surface, RoundedCornerShape(12.dp))
                    .padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Text(
                    when (scan.status) {
                        "completed" -> "${scan.filesSeen} files indexed"
                        "running" -> "Scan in progress"
                        else -> "Scan failed"
                    }
                )
                Note(
                    "${DateFormat.getDateTimeInstance().format(Date(scan.startedAt))} · ${scan.titlesAdded} new titles · ${scan.subtitlesFound} subtitles · ${scan.status}"
                )
                scan.error?.let { Note(it, error = true) }
            }
        }
        if (settings.value?.scans?.isEmpty() == true) item { Note("No scans have run yet.") }
    }
    AppDialogs(model, dialogs)
}
