package com.foyer.tv

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.focusable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.*
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.material3.*
import coil.compose.AsyncImage
import coil.imageLoader
import coil.request.ImageRequest
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.delay

@Composable
fun Artwork(path: String?, modifier: Modifier, size: String = "w342") {
    AsyncImage(
        model = path?.let { "https://image.tmdb.org/t/p/$size$it" },
        contentDescription = null,
        contentScale = ContentScale.Crop,
        modifier = modifier.background(Palette.raised),
    )
}

@Composable
fun MediaTile(item: Media, modifier: Modifier, onOpen: () -> Unit, onActions: () -> Unit) {
    Card(onClick = onOpen, onLongClick = onActions, modifier = modifier) {
        Box {
            Artwork(item.posterPath, Modifier.fillMaxWidth().aspectRatio(2f / 3f))
            if (item.watched)
                Text(
                    "✓",
                    Modifier.align(Alignment.TopEnd)
                        .padding(7.dp)
                        .background(Palette.background)
                        .padding(4.dp),
                    color = Palette.primary,
                )
            else if (item.kind != "movie" && item.unwatchedPartCount != null) {
                Text(
                    "${item.unwatchedPartCount} left",
                    Modifier.align(Alignment.TopEnd)
                        .padding(7.dp)
                        .background(Palette.background)
                        .padding(4.dp),
                    fontSize = 11.sp,
                )
            }
        }
        Column(Modifier.padding(10.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
            Text(
                item.title,
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
            Note(
                listOfNotNull(
                        item.year?.toString(),
                        item.runtimeLabel,
                        item.tmdbVoteAverage?.let { "★ %.1f".format(it) },
                    )
                    .joinToString(" · ")
            )
            item.progress
                ?.takeUnless { it.completed }
                ?.let { progress ->
                    Note(
                        "Resume · ${progress.percentage.toInt()}%${item.nextPartTitle?.let { " · $it" } ?: ""}"
                    )
                    Box(Modifier.fillMaxWidth().height(3.dp).background(Palette.border)) {
                        Box(
                            Modifier.fillMaxWidth(
                                    (progress.percentage / 100).toFloat().coerceIn(0f, 1f)
                                )
                                .fillMaxHeight()
                                .background(Palette.primary)
                        )
                    }
                }
        }
    }
}

@Composable
fun HomeScreen(model: AppModel) {
    val folders = load(model.api, model.revision) { model.api.folders() }
    val watching = load(model.api, model.revision) { model.api.watching() }
    val dialogs = remember { DialogController() }
    var focused by rememberSaveable { mutableStateOf<String?>(null) }
    var restoring by remember { mutableStateOf(true) }
    val ready = !watching.loading && !folders.loading
    val first = watching.value?.firstOrNull()?.id ?: folders.value?.firstOrNull()?.id
    val target =
        focused?.takeIf { id ->
            watching.value.orEmpty().any { it.id == id } ||
                folders.value.orEmpty().any { it.id == id }
        } ?: first
    LazyVerticalGrid(
        columns = GridCells.Adaptive(145.dp),
        state = rememberLazyGridState(),
        contentPadding = PaddingValues(start = 32.dp, end = 32.dp, top = 12.dp, bottom = 36.dp),
        horizontalArrangement = Arrangement.spacedBy(18.dp),
        verticalArrangement = Arrangement.spacedBy(20.dp),
    ) {
        item(span = { GridItemSpan(maxLineSpan) }) {
            Heading("Currently watching", "PICK UP WHERE YOU LEFT OFF")
        }
        item(span = { GridItemSpan(maxLineSpan) }) { LoadNotice(watching) }
        if (watching.value?.isEmpty() == true)
            item(span = { GridItemSpan(maxLineSpan) }) {
                Note("Nothing in progress. Start a title and it will appear here automatically.")
            }
        items(watching.value.orEmpty(), key = { "watch-${it.id}" }) { item ->
            MediaTile(
                item,
                Modifier.preferredFocus(restoring && ready && item.id == target).onFocusChanged {
                    if (it.hasFocus) {
                        focused = item.id
                        restoring = false
                    }
                },
                onOpen = { model.navigate("detail/${item.id}") },
                onActions = { dialogs.current = Overlay.MediaMenu(item) },
            )
        }
        item(span = { GridItemSpan(maxLineSpan) }) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Heading("My media", "YOUR SHELVES")
                Note("Hold Select on a title or collection for options.")
                LoadNotice(folders)
            }
        }
        items(folders.value.orEmpty(), key = { "folder-${it.id}" }) { folder ->
            Card(
                onClick = { model.navigate("collection/${folder.id}") },
                onLongClick = { dialogs.current = Overlay.CollectionMenu(folder) },
                modifier =
                    Modifier.preferredFocus(restoring && ready && folder.id == target)
                        .onFocusChanged {
                            if (it.hasFocus) {
                                focused = folder.id
                                restoring = false
                            }
                        },
            ) {
                Row(Modifier.fillMaxWidth().height(100.dp)) {
                    folder.posterPaths.take(3).forEach {
                        Artwork(it, Modifier.weight(1f).fillMaxHeight())
                    }
                }
                Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                    Text(folder.name, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                    Note(
                        "${folder.titleCount} titles · ${if (folder.kind == "movies") "Movies" else "TV shows"}"
                    )
                }
            }
        }
        if (folders.value?.isEmpty() == true)
            item(span = { GridItemSpan(maxLineSpan) }) {
                TvButton(
                    "Create your first collection",
                    Modifier.preferredFocus(),
                    onClick = { dialogs.current = Overlay.EditCollection(null) },
                )
            }
    }
    AppDialogs(model, dialogs)
}

private val sorts =
    linkedMapOf(
        "recent" to "Recently added",
        "title" to "Title A–Z",
        "release-desc" to "Release date · newest",
        "release-asc" to "Release date · oldest",
        "runtime-desc" to "Length · longest",
        "runtime-asc" to "Length · shortest",
        "rating-desc" to "TMDB score · highest",
        "rating-asc" to "TMDB score · lowest",
    )
private val watches =
    linkedMapOf("all" to "All titles", "watched" to "Watched", "unwatched" to "Unwatched")

@Composable
fun CollectionScreen(model: AppModel, collectionId: String) {
    val folders = load(model.api, model.revision) { model.api.folders() }
    val folder = folders.value?.firstOrNull { it.id == collectionId }
    val dialogs = remember { DialogController() }
    var page by rememberSaveable { mutableIntStateOf(1) }
    var searchInput by rememberSaveable { mutableStateOf("") }
    var search by rememberSaveable { mutableStateOf("") }
    var searchOpen by rememberSaveable { mutableStateOf(false) }
    var sort by rememberSaveable { mutableStateOf("recent") }
    var watch by rememberSaveable {
        mutableStateOf(model.preferences.getString("foyer.tv.watch-filter.$collectionId", "all")!!)
    }
    var focused by rememberSaveable { mutableStateOf<String?>(null) }
    var restoring by remember { mutableStateOf(true) }
    var picker by remember { mutableStateOf<String?>(null) }
    val grid = rememberLazyGridState()
    val context = LocalContext.current
    val query =
        mapOf(
            "page" to "$page",
            "pageSize" to "50",
            "libraryId" to collectionId,
            "search" to search,
            "sort" to sort,
            "watch" to watch,
        )
    val library = load(model.api, model.revision, query) { model.api.library(query) }
    val queryKey = "$page|$sort|$watch|$search"
    var displayedQuery by rememberSaveable { mutableStateOf(queryKey) }
    LaunchedEffect(queryKey) {
        if (displayedQuery != queryKey) {
            grid.scrollToItem(0)
            focused = null
            restoring = true
            displayedQuery = queryKey
        }
    }
    LaunchedEffect(searchInput) {
        if (searchInput.trim() != search) {
            delay(350)
            search = searchInput.trim()
            page = 1
        }
    }
    LaunchedEffect(library.value, library.loading, query) {
        if (library.loading || library.error != null) return@LaunchedEffect
        val data = library.value ?: return@LaunchedEffect
        if (data.pagination.page < data.pagination.totalPages) {
            try {
                model.api.library(query + ("page" to "${data.pagination.page + 1}")).items.forEach {
                    it.posterPath?.let { path ->
                        context.imageLoader.enqueue(
                            ImageRequest.Builder(context)
                                .data("https://image.tmdb.org/t/p/w342$path")
                                .build()
                        )
                    }
                }
            } catch (error: CancellationException) {
                throw error
            } catch (_: Exception) {
                /* Prefetch failures do not replace the visible page. */
            }
        }
    }
    val items = library.value?.items.orEmpty()
    val focusTarget = focused?.takeIf { id -> items.any { it.id == id } } ?: items.firstOrNull()?.id
    BackHandler(searchOpen) {
        searchInput = ""
        searchOpen = false
    }
    Column(Modifier.fillMaxSize()) {
        Column(
            Modifier.padding(horizontal = 32.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Heading(folder?.name ?: "Collection")
                folder?.let {
                    TvButton(
                        "Collection options",
                        onClick = { dialogs.current = Overlay.CollectionMenu(it) },
                    )
                }
            }
            Row(
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                TvButton("Search", onClick = { searchOpen = !searchOpen })
                TvButton(watches.getValue(watch), onClick = { picker = "watch" })
                TvButton(sorts.getValue(sort), onClick = { picker = "sort" })
                library.value?.let { Note("${it.pagination.totalItems} titles") }
            }
            if (searchOpen)
                Row(
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalAlignment = Alignment.Bottom,
                ) {
                    Field(
                        "Search titles",
                        searchInput,
                        { searchInput = it },
                        Modifier.weight(1f).preferredFocus(),
                    )
                    TvButton("Clear", onClick = { searchInput = "" })
                }
            LoadNotice(library)
        }
        LazyVerticalGrid(
            columns = GridCells.Adaptive(145.dp),
            state = grid,
            modifier = Modifier.weight(1f),
            contentPadding = PaddingValues(32.dp),
            horizontalArrangement = Arrangement.spacedBy(18.dp),
            verticalArrangement = Arrangement.spacedBy(20.dp),
        ) {
            items(items, key = { it.id }) { item ->
                MediaTile(
                    item,
                    Modifier.preferredFocus(
                            restoring && !searchOpen && !library.loading && item.id == focusTarget
                        )
                        .onFocusChanged {
                            if (it.hasFocus) {
                                focused = item.id
                                restoring = false
                            }
                        },
                    onOpen = { model.navigate("detail/${item.id}") },
                    onActions = { dialogs.current = Overlay.MediaMenu(item) },
                )
            }
            if (library.value?.items?.isEmpty() == true)
                item(span = { GridItemSpan(maxLineSpan) }) { Note("No titles found.") }
            library.value?.pagination?.let { pagination ->
                if (pagination.totalPages > 1)
                    item(span = { GridItemSpan(maxLineSpan) }) {
                        PaginationControls(pagination) { page = it }
                    }
            }
        }
    }
    picker?.let { type ->
        TvDialog(
            if (type == "sort") "Sort titles" else "Watch status",
            onClose = { picker = null },
        ) {
            (if (type == "sort") sorts else watches).entries.forEachIndexed { index, (value, label)
                ->
                TvButton(
                    label,
                    Modifier.fillMaxWidth().preferredFocus(index == 0),
                    selected = value == if (type == "sort") sort else watch,
                ) {
                    if (type == "sort") sort = value
                    else {
                        watch = value
                        model.preferences
                            .edit()
                            .putString("foyer.tv.watch-filter.$collectionId", value)
                            .apply()
                    }
                    page = 1
                    picker = null
                }
            }
        }
    }
    AppDialogs(model, dialogs, onCollectionDeleted = { model.navigate("home") })
}

@Composable
fun PaginationControls(pagination: Pagination, onPage: (Int) -> Unit) {
    Row(
        horizontalArrangement = Arrangement.spacedBy(16.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        TvButton(
            "Previous",
            enabled = pagination.page > 1,
            onClick = { onPage(pagination.page - 1) },
        )
        Text("Page ${pagination.page} of ${pagination.totalPages}", fontSize = 13.sp)
        TvButton(
            "Next",
            enabled = pagination.page < pagination.totalPages,
            onClick = { onPage(pagination.page + 1) },
        )
    }
}

@Composable
fun DetailScreen(model: AppModel, mediaId: String, play: (String, String) -> Unit) {
    val dialogs = remember { DialogController() }
    var season by rememberSaveable { mutableStateOf<Int?>(null) }
    var page by rememberSaveable { mutableStateOf<Int?>(null) }
    val detail =
        load(model.api, model.revision, mediaId, season, page) {
            model.api.media(mediaId, season, page, 50)
        }
    val item = detail.value
    if (item == null) {
        Column(Modifier.padding(32.dp)) { LoadNotice(detail) }
        return
    }
    val nextPartId = item.nextPartId ?: item.parts.firstOrNull()?.id
    val selectedSeason = season ?: item.selectedPartSeason
    LazyColumn(
        contentPadding = PaddingValues(start = 32.dp, end = 32.dp, top = 12.dp, bottom = 36.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        item {
            Box(Modifier.fillMaxWidth()) {
                item.backdropPath?.let {
                    Artwork(it, Modifier.fillMaxWidth().height(285.dp), "w1280")
                }
                Row(
                    Modifier.fillMaxWidth()
                        .background(Palette.background.copy(alpha = .88f))
                        .padding(22.dp),
                    horizontalArrangement = Arrangement.spacedBy(24.dp),
                ) {
                    Artwork(item.posterPath, Modifier.width(135.dp).height(202.dp), "w500")
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        Heading(item.title, if (item.kind == "movie") "MOVIE" else "TV SHOW")
                        Note(
                            listOfNotNull(
                                    item.year?.toString(),
                                    item.runtimeLabel,
                                    "${item.partCount} ${if (item.kind == "movie") "files" else "episodes"}",
                                    item.contentRating,
                                    item.tmdbVoteAverage?.let {
                                        "★ %.1f/10 · ${item.tmdbVoteCount ?: 0} votes".format(it)
                                    },
                                )
                                .joinToString(" · ")
                        )
                        if (item.metadataStatus == "unmatched") Note("Needs identification")
                        item.overview?.let {
                            Text(
                                it,
                                fontSize = 14.sp,
                                maxLines = 4,
                                overflow = TextOverflow.Ellipsis,
                            )
                        }
                        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            nextPartId?.let { partId ->
                                TvButton(
                                    if (
                                        item.progress != null &&
                                            !item.progress.completed &&
                                            !item.watched
                                    )
                                        "Resume · ${item.progress.percentage.toInt()}%"
                                    else "Play",
                                    Modifier.preferredFocus(),
                                    onClick = { play(item.id, partId) },
                                )
                            }
                            TvButton(
                                if (item.watched) "Mark unwatched" else "Mark watched",
                                enabled = !model.busy,
                                onClick = {
                                    model.action { model.api.watchMedia(item.id, !item.watched) }
                                },
                            )
                            TvButton(
                                "More options",
                                onClick = { dialogs.current = Overlay.MediaMenu(item) },
                            )
                        }
                    }
                }
            }
            LoadNotice(detail)
        }
        if (item.kind != "movie" || item.partCount > 1) {
            item {
                Heading(if (item.kind == "movie") "Files" else "Episodes")
                if (item.kind != "movie") {
                    Row(
                        Modifier.horizontalScroll(rememberScrollState()).padding(vertical = 12.dp),
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        item.partSeasons.forEach { number ->
                            TvButton(
                                "Season $number",
                                selected = selectedSeason == number,
                                onClick = {
                                    season = number
                                    page = null
                                },
                            )
                        }
                    }
                    selectedSeason?.let { number ->
                        val watched = item.watchedSeasons.contains(number)
                        TvButton(
                            if (watched) "Mark season unwatched" else "Mark season watched",
                            enabled = !model.busy,
                            onClick = {
                                model.action { model.api.watchMedia(item.id, !watched, number) }
                            },
                        )
                    }
                }
            }
            items(item.parts, key = { it.id }) { part ->
                Column(
                    Modifier.fillMaxWidth().background(Palette.surface).padding(14.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Text(part.displayTitle, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                    Note(
                        "${part.fileName} · ${formatBytes(part.size)}${part.progress?.let { " · ${if (it.completed) "Watched" else "${it.percentage.toInt()}%"}" } ?: ""}"
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        TvButton("Play", onClick = { play(item.id, part.id) })
                        TvButton(
                            if (part.progress?.completed == true) "Mark unwatched"
                            else "Mark watched",
                            enabled = !model.busy,
                            onClick = {
                                model.action {
                                    model.api.watchPart(part.id, part.progress?.completed != true)
                                }
                            },
                        )
                        if (part.progress != null)
                            TvButton(
                                "Remove progress",
                                enabled = !model.busy,
                                onClick = {
                                    model.action { model.api.clearProgress(part.id, part = true) }
                                },
                            )
                    }
                }
            }
            item.partsPagination
                ?.takeIf { it.totalPages > 1 }
                ?.let { pagination ->
                    item { PaginationControls(pagination) { page = it } }
                }
        }
        item {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Heading("Details")
                Note("Original title: ${item.originalTitle ?: item.title}")
                Note("Language: ${item.originalLanguage?.uppercase() ?: "Unknown"}")
                Note("Genres: ${item.genres.joinToString(", ")}")
                Note("TMDB: ${item.tmdbId?.let { "#$it" } ?: "Not matched"}")
            }
        }
        if (item.cast.isNotEmpty())
            item {
                Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                    Heading("Cast")
                    Row(
                        Modifier.horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(14.dp),
                    ) {
                        item.cast.forEach { person ->
                            var focused by remember { mutableStateOf(false) }
                            Surface(
                                modifier =
                                    Modifier.width(100.dp)
                                        .onFocusChanged { focused = it.hasFocus }
                                        .border(
                                            2.dp,
                                            if (focused) Palette.primary else Color.Transparent,
                                            RoundedCornerShape(8.dp),
                                        )
                                        .focusable()
                            ) {
                                Column {
                                    Artwork(
                                        person.profilePath,
                                        Modifier.fillMaxWidth().height(120.dp),
                                    )
                                    Text(person.name, fontSize = 13.sp, maxLines = 2)
                                    Note(person.character.ifBlank { "Cast" })
                                }
                            }
                        }
                    }
                }
            }
    }
    AppDialogs(model, dialogs, onMediaDeleted = { model.back() })
}
