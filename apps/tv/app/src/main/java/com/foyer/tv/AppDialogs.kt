package com.foyer.tv

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.material3.*
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch

sealed interface Overlay {
    data class MediaMenu(val item: Media) : Overlay

    data class Identify(val item: Media) : Overlay

    data class Info(val item: Media) : Overlay

    data class CollectionMenu(val folder: Collection) : Overlay

    data class EditCollection(val folder: Collection?) : Overlay

    data class Confirm(
        val title: String,
        val description: String,
        val label: String,
        val operation: suspend () -> Unit,
        val after: () -> Unit,
    ) : Overlay
}

@Stable
class DialogController {
    var current by mutableStateOf<Overlay?>(null)
}

@Composable
fun AppDialogs(
    model: AppModel,
    controller: DialogController,
    onMediaDeleted: () -> Unit = {},
    onCollectionDeleted: () -> Unit = {},
) {
    val close = { controller.current = null }
    when (val overlay = controller.current) {
        null -> Unit
        is Overlay.MediaMenu -> {
            val item = overlay.item
            TvDialog(
                "Media options",
                close,
                model.busy,
                menu = true,
                sidebar = {
                    Artwork(
                        item.posterPath,
                        Modifier.width(120.dp).height(180.dp).clip(RoundedCornerShape(8.dp)),
                    )
                    Text(
                        item.title,
                        fontSize = 20.sp,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 3,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Note(
                        listOfNotNull(
                                item.year?.toString(),
                                if (item.kind == "movie") "Movie" else "TV show",
                                item.runtimeLabel,
                            )
                            .joinToString(" · ")
                    )
                },
            ) {
                TvMenuItem(
                    if (item.watched) "Mark as unwatched" else "Mark as watched",
                    Modifier.preferredFocus(),
                    icon = Icons.Outlined.CheckCircle,
                    enabled = !model.busy,
                ) {
                    model.action(close) { model.api.watchMedia(item.id, !item.watched) }
                }
                if (item.progress?.let { it.positionSeconds > 0 && !it.completed } == true) {
                    val episode = item.kind != "movie" && item.nextPartId != null
                    TvMenuItem(
                        if (episode) "Remove episode progress" else "Remove watch progress",
                        icon = Icons.Outlined.Clear,
                        enabled = !model.busy,
                    ) {
                        model.action(close) {
                            model.api.clearProgress(
                                if (episode) item.nextPartId!! else item.id,
                                part = episode,
                            )
                        }
                    }
                }
                TvMenuItem(
                    "Identify",
                    icon = Icons.Outlined.Search,
                    enabled = !model.busy,
                    onClick = { controller.current = Overlay.Identify(item) },
                )
                TvMenuItem(
                    "Media info",
                    icon = Icons.Outlined.Info,
                    enabled = !model.busy,
                    onClick = { controller.current = Overlay.Info(item) },
                )
                TvMenuItem(
                    "Refresh metadata",
                    icon = Icons.Outlined.Refresh,
                    enabled = !model.busy && item.metadataStatus != "unmatched",
                ) {
                    model.action(close) { model.api.refresh(item.id) }
                }
                Box(
                    Modifier.fillMaxWidth()
                        .padding(vertical = 6.dp)
                        .height(1.dp)
                        .background(Palette.border)
                )
                TvMenuItem(
                    "Delete media from server",
                    icon = Icons.Outlined.Delete,
                    danger = true,
                    enabled = !model.busy,
                ) {
                    controller.current =
                        Overlay.Confirm(
                            "Delete “${item.title}” permanently?",
                            "This permanently deletes ${item.partCount} media files and indexed external subtitles from the server. This cannot be undone.",
                            "Delete files permanently",
                            { model.api.deleteMedia(item.id) },
                            onMediaDeleted,
                        )
                }
            }
        }
        is Overlay.CollectionMenu -> {
            val folder = overlay.folder
            TvDialog(
                "Collection options",
                close,
                model.busy,
                menu = true,
                sidebar = {
                    Row(Modifier.fillMaxWidth().height(124.dp).clip(RoundedCornerShape(8.dp))) {
                        folder.posterPaths.take(3).forEach {
                            Artwork(it, Modifier.weight(1f).fillMaxHeight())
                        }
                    }
                    Text(
                        folder.name,
                        fontSize = 22.sp,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 3,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Note(
                        "${folder.titleCount} titles · ${if (folder.kind == "movies") "Movies" else "TV shows"}"
                    )
                    Text(
                        folder.path,
                        color = Palette.muted,
                        fontSize = 12.sp,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                    )
                },
            ) {
                TvMenuItem(
                    "Edit collection",
                    Modifier.preferredFocus(),
                    icon = Icons.Outlined.Edit,
                    enabled = !model.busy,
                    onClick = { controller.current = Overlay.EditCollection(folder) },
                )
                TvMenuItem(
                    "Rescan media folder",
                    icon = Icons.Outlined.Refresh,
                    enabled = !model.busy,
                    onClick = { model.scanCollection(folder.id, close) },
                )
                TvMenuItem(
                    "Refresh all metadata",
                    icon = Icons.Outlined.Refresh,
                    enabled = !model.busy,
                ) {
                    model.action(close) { model.api.refresh(folder.id, collection = true) }
                }
                Box(
                    Modifier.fillMaxWidth()
                        .padding(vertical = 6.dp)
                        .height(1.dp)
                        .background(Palette.border)
                )
                TvMenuItem(
                    "Delete collection",
                    icon = Icons.Outlined.Delete,
                    danger = true,
                    enabled = !model.busy,
                ) {
                    controller.current =
                        Overlay.Confirm(
                            "Delete “${folder.name}”?",
                            "This removes the collection, its metadata, and watch progress from Foyer. The media files on the server will not be changed.",
                            "Delete collection",
                            { model.api.deleteCollection(folder.id) },
                            onCollectionDeleted,
                        )
                }
            }
        }
        is Overlay.EditCollection -> EditCollectionDialog(model, overlay.folder, close)
        is Overlay.Identify -> IdentifyDialog(model, overlay.item, close)
        is Overlay.Info -> MediaInfoDialog(model, overlay.item, close)
        is Overlay.Confirm ->
            TvDialog(overlay.title, close, model.busy) {
                Note(overlay.description)
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    TvButton(
                        "Cancel",
                        Modifier.preferredFocus(),
                        enabled = !model.busy,
                        onClick = close,
                    )
                    TvButton(
                        if (model.busy) "Working…" else overlay.label,
                        danger = true,
                        enabled = !model.busy,
                    ) {
                        model.action(
                            after = {
                                close()
                                overlay.after()
                            },
                            block = overlay.operation,
                        )
                    }
                }
            }
    }
}

@Composable
private fun EditCollectionDialog(model: AppModel, folder: Collection?, close: () -> Unit) {
    var name by rememberSaveable(folder?.id) { mutableStateOf(folder?.name ?: "") }
    var path by rememberSaveable(folder?.id) { mutableStateOf(folder?.path ?: "") }
    var kind by rememberSaveable(folder?.id) { mutableStateOf(folder?.kind ?: "movies") }
    TvDialog(if (folder == null) "Create collection" else "Edit collection", close, model.busy) {
        Note("Choose a display name, an absolute folder on the server, and the media layout.")
        Field("Collection name", name, { name = it.take(80) }, Modifier.preferredFocus())
        Field("Folder on the server", path, { path = it })
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            TvButton("Movies", selected = kind == "movies", onClick = { kind = "movies" })
            TvButton(
                "TV shows with episodes",
                selected = kind == "series",
                onClick = { kind = "series" },
            )
        }
        TvButton(
            if (model.busy) "Saving…" else "Save collection",
            primary = true,
            icon = Icons.Outlined.Check,
            enabled = name.isNotBlank() && path.isNotBlank() && !model.busy,
        ) {
            model.action(close) {
                model.api.saveCollection(folder?.id, name.trim(), path.trim(), kind)
            }
        }
    }
}

@Composable
private fun IdentifyDialog(model: AppModel, item: Media, close: () -> Unit) {
    var query by rememberSaveable(item.id) { mutableStateOf(item.title) }
    var year by rememberSaveable(item.id) { mutableStateOf(item.year?.toString() ?: "") }
    var candidates by remember { mutableStateOf<List<Candidate>>(emptyList()) }
    var searching by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var searched by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    TvDialog("Identify “${item.title}”", close, model.busy) {
        Note("Search TMDB and choose the correct match. Your files are never changed.")
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Field("Title", query, { query = it.take(160) }, Modifier.weight(1f).preferredFocus())
            Field(
                "Year (optional)",
                year,
                { year = it.filter(Char::isDigit).take(4) },
                Modifier.width(140.dp),
                keyboardType = KeyboardType.Number,
            )
        }
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            TvButton("Clear title", onClick = { query = "" })
            TvButton(
                if (searching) "Searching…" else "Search",
                enabled = query.isNotBlank() && !searching && !model.busy,
            ) {
                searching = true
                error = null
                scope.launch {
                    try {
                        candidates =
                            model.api
                                .searchMetadata(item.id, query.trim(), year.toIntOrNull())
                                .candidates
                        searched = true
                    } catch (caught: CancellationException) {
                        throw caught
                    } catch (caught: Exception) {
                        error = caught.message
                    } finally {
                        searching = false
                    }
                }
            }
        }
        error?.let { Note(it, error = true) }
        candidates.forEach { candidate ->
            Surface(
                onClick = { model.action(close) { model.api.identify(item.id, candidate.id) } },
                enabled = !model.busy,
                modifier = Modifier.fillMaxWidth(),
                shape = ClickableSurfaceDefaults.shape(shape = RoundedCornerShape(12.dp)),
                colors =
                    ClickableSurfaceDefaults.colors(
                        containerColor = Palette.raised,
                        contentColor = Palette.text,
                        focusedContainerColor = Palette.raised,
                        focusedContentColor = Palette.text,
                    ),
                scale = ClickableSurfaceDefaults.scale(focusedScale = 1.02f),
                border =
                    ClickableSurfaceDefaults.border(
                        focusedBorder =
                            Border(
                                BorderStroke(2.dp, Palette.primary),
                                shape = RoundedCornerShape(12.dp),
                            )
                    ),
            ) {
                Row(Modifier.padding(12.dp), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                    Artwork(candidate.posterPath, Modifier.width(75.dp).height(112.dp))
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(candidate.title, fontWeight = FontWeight.Bold)
                        Note(
                            "${candidate.year ?: "Year unknown"} · ${if (candidate.kind == "movie") "Movie" else "TV"}"
                        )
                        Text(
                            candidate.overview.ifBlank { "No synopsis available." },
                            fontSize = 13.sp,
                            maxLines = 3,
                        )
                        Note("Choose match")
                    }
                }
            }
        }
        if (candidates.isEmpty())
            Note(if (searched) "No matches found." else "Search results will appear here.")
    }
}

@Composable
private fun MediaInfoDialog(model: AppModel, item: Media, close: () -> Unit) {
    val info =
        load(model.api, item.id) {
            model.api.get<MediaInfo>("/api/v1/media/${item.id}", mapOf("view" to "info"))
        }
    TvDialog("Media info · ${item.title}", close) {
        LoadNotice(info)
        info.value?.let { details ->
            Note("${details.files.size} files · ${formatBytes(details.totalSize)} total")
            details.files.forEach { file -> key(file.id) { FileInfo(model, item.id, file) } }
        }
    }
}

@Composable
private fun FileInfo(model: AppModel, mediaId: String, file: MediaFile) {
    var details by remember { mutableStateOf(file) }
    var inspecting by remember { mutableStateOf(false) }
    var inspected by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    TvPanel {
        Text(
            file.fileName,
            fontWeight = FontWeight.SemiBold,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
        )
        Note(file.path)
        Note("${file.container.uppercase()} · ${file.mimeType} · ${formatBytes(file.size)}")
        Note("Format: ${details.formatName ?: file.container}")
        details.durationSeconds?.let {
            Note("Duration: ${it.toInt() / 3600}h ${it.toInt() / 60 % 60}m ${it.toInt() % 60}s")
        }
        details.bitRate?.let { Note("Bit rate: %.2f Mbps".format(it / 1_000_000.0)) }
        TvButton(
            if (inspecting) "Inspecting streams…"
            else if (inspected) "Inspect again" else "Inspect embedded streams",
            enabled = !inspecting,
        ) {
            inspecting = true
            error = null
            scope.launch {
                try {
                    // Inspection is explicitly requested; retry must bypass cached probe errors.
                    model.api.invalidate()
                    details =
                        model.api.get(
                            "/api/v1/media/$mediaId",
                            mapOf("view" to "info", "partId" to file.id),
                        )
                    inspected = true
                } catch (caught: CancellationException) {
                    throw caught
                } catch (caught: Exception) {
                    error = caught.message
                } finally {
                    inspecting = false
                }
            }
        }
        (error ?: details.probeError)?.let { Note(it, error = true) }
        details.streams.forEach { stream ->
            val facts =
                listOfNotNull(
                    stream.type.uppercase(),
                    stream.codec,
                    stream.codecDescription,
                    stream.profile,
                    if (stream.width != null && stream.height != null)
                        "${stream.width}×${stream.height}"
                    else null,
                    stream.frameRate?.let { "$it fps" },
                    stream.channels?.let { "$it channels" },
                    stream.channelLayout,
                    stream.sampleRate?.let { "${it / 1000} kHz" },
                    stream.language,
                    stream.title,
                )
            Note(facts.joinToString(" · "))
        }
        file.externalSubtitles.forEach { subtitle ->
            Note(
                "${subtitle.label} · ${subtitle.format.uppercase()} · ${subtitle.language}${if (subtitle.isDefault) " · Default" else ""} · ${subtitle.path}"
            )
        }
    }
}
