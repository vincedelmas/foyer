package com.foyer.tv

import androidx.compose.foundation.background
import androidx.compose.foundation.focusGroup
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.saveable.rememberSaveableStateHolder
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.material3.Text
import java.text.DateFormat
import java.util.Date
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch

@Composable
fun ConnectionScreen(model: AppModel) {
    Row(
        Modifier.fillMaxSize().padding(horizontal = 72.dp, vertical = 48.dp),
        horizontalArrangement = Arrangement.spacedBy(48.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(20.dp)) {
            Text(
                "foyer",
                fontFamily = FontFamily.Serif,
                fontSize = 40.sp,
                fontWeight = FontWeight.Bold,
                color = Palette.primary,
            )
            Heading("Your library.\nOn the big screen.", large = true)
            Note(
                "Films and shows from your home server. Save your place and pick up where you left off."
            )
        }
        TvPanel(Modifier.weight(1.2f)) {
            Heading("Find your home server")
            Note("Enter its LAN address. For example: http://192.168.1.10:3000")
            ConnectionForm(model)
        }
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
                primary = true,
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

private enum class SettingsSection(val label: String) {
    Overview("Overview"),
    Collections("Collections"),
    Server("Server connection"),
    Updates("App updates"),
    Scans("Recent scans"),
}

@Composable
fun SettingsScreen(model: AppModel) {
    val settings = load<Settings>(model.api, "/api/v1/settings/overview", revision = model.revision)
    val library =
        load<Library>(
            model.api,
            "/api/v1/library",
            mapOf("page" to "1", "pageSize" to "1"),
            model.revision,
        )
    val dialogs = remember { DialogController() }
    var section by rememberSaveable { mutableStateOf(SettingsSection.Overview) }
    val panels = rememberSaveableStateHolder()
    Row(
        Modifier.fillMaxSize().padding(start = 48.dp, end = 48.dp, top = 12.dp, bottom = 28.dp),
        horizontalArrangement = Arrangement.spacedBy(32.dp),
    ) {
        Column(
            Modifier.width(200.dp).fillMaxHeight().focusGroup(),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Heading("Settings", large = true)
            Spacer(Modifier.height(12.dp))
            SettingsSection.entries.forEach { tab ->
                TvMenuItem(
                    tab.label,
                    Modifier.preferredFocus(section == tab),
                    selected = section == tab,
                    onClick = { section = tab },
                )
            }
            Spacer(Modifier.weight(1f))
            Text("Foyer TV ${BuildConfig.VERSION_NAME}", color = Palette.muted, fontSize = 12.sp)
            Text(
                model.server,
                color = Palette.muted,
                fontSize = 12.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
        Box(Modifier.width(1.dp).fillMaxHeight().background(Palette.border))
        Box(Modifier.weight(1f).fillMaxHeight().focusGroup()) {
            // Keep outgoing lazy content on its own tab until its state is saved.
            val currentSection = section
            panels.SaveableStateProvider(currentSection) {
                LazyColumn(
                    state = rememberLazyListState(),
                    contentPadding = PaddingValues(start = 4.dp, end = 4.dp, bottom = 12.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    when (currentSection) {
                        SettingsSection.Overview -> {
                            item {
                                Heading("Your library")
                                Note("All your films and shows, in one place.")
                                LoadNotice(library)
                                LoadNotice(settings)
                            }
                            library.value?.stats?.let { stats ->
                                val counts =
                                    listOf(
                                        stats.titles to "Titles",
                                        stats.inProgress to "In progress",
                                        stats.unmatched to "Need identification",
                                        settings.value?.libraries?.size to "Collections",
                                    )
                                counts.chunked(2).forEach { pair ->
                                    item {
                                        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                            pair.forEach { (count, label) ->
                                                TvPanel(Modifier.weight(1f)) {
                                                    Text(
                                                        count?.toString() ?: "—",
                                                        fontSize = 30.sp,
                                                        fontWeight = FontWeight.SemiBold,
                                                        color = Palette.primary,
                                                    )
                                                    Note(label)
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                            item {
                                TvButton(
                                    "Scan all collections",
                                    enabled = !model.busy,
                                    primary = true,
                                    icon = Icons.Outlined.Refresh,
                                    onClick = { model.scanCollection() },
                                )
                            }
                        }
                        SettingsSection.Collections -> {
                            item {
                                Row(
                                    Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    Heading("Collections")
                                    TvButton(
                                        "Create collection",
                                        primary = true,
                                        icon = Icons.Outlined.Add,
                                        onClick = {
                                            dialogs.current = Overlay.EditCollection(null)
                                        },
                                    )
                                }
                                Note("Choose a collection to edit its folder or refresh its media.")
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
                            if (settings.value?.libraries?.isEmpty() == true)
                                item {
                                    TvPanel {
                                        Heading("No collections yet")
                                        Note("Add a folder from your server to start your library.")
                                    }
                                }
                        }
                        SettingsSection.Server -> {
                            item {
                                Heading("Server connection")
                                Note(
                                    "The computer that holds your media. Use its address on your home network."
                                )
                            }
                            item { TvPanel { ConnectionForm(model) } }
                        }
                        SettingsSection.Updates -> {
                            item { Heading("App updates") }
                            item {
                                TvPanel {
                                    Note("INSTALLED VERSION")
                                    Text(
                                        BuildConfig.VERSION_NAME,
                                        fontSize = 32.sp,
                                        fontWeight = FontWeight.SemiBold,
                                    )
                                    Note(
                                        model.updater.description,
                                        error = model.updater.status == UpdateStatus.Error,
                                    )
                                    if (model.updater.status == UpdateStatus.Downloading)
                                        ProgressTrack(model.updater.progress)
                                    TvButton(
                                        if (model.updater.update == null) "Check for updates"
                                        else "View update",
                                        enabled = model.updater.supported && !model.updater.busy,
                                        primary = true,
                                        onClick = {
                                            if (model.updater.update == null) model.updater.check()
                                            else model.updater.visible = true
                                        },
                                    )
                                }
                            }
                        }
                        SettingsSection.Scans -> {
                            item {
                                Heading("Recent scans")
                                LoadNotice(settings)
                            }
                            items(settings.value?.scans.orEmpty(), key = { it.id }) { scan ->
                                TvPanel {
                                    Text(
                                        when (scan.status) {
                                            "completed" -> "${scan.filesSeen} files indexed"
                                            "running" -> "Scan in progress"
                                            else -> "Scan failed"
                                        },
                                        fontSize = 18.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        color =
                                            if (scan.status == "failed") Palette.danger
                                            else Palette.text,
                                    )
                                    Note(
                                        DateFormat.getDateTimeInstance()
                                            .format(Date(scan.startedAt))
                                    )
                                    Note(
                                        "${scan.titlesAdded} new titles · ${scan.subtitlesFound} subtitles"
                                    )
                                    scan.error?.let { Note(it, error = true) }
                                }
                            }
                            if (settings.value?.scans?.isEmpty() == true)
                                item {
                                    TvPanel {
                                        Note("No scans yet. Scan a collection to find its media.")
                                    }
                                }
                        }
                    }
                }
            }
        }
    }
    AppDialogs(model, dialogs)
}
