package com.foyer.tv

import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.os.SystemClock
import android.view.KeyEvent as AndroidKeyEvent
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.test.core.app.ApplicationProvider
import com.foyer.player.FoyerPlayerActivity
import java.util.concurrent.CopyOnWriteArrayList
import kotlinx.serialization.json.*
import okhttp3.mockwebserver.Dispatcher
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okhttp3.mockwebserver.RecordedRequest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import org.robolectric.annotation.LooperMode
import org.robolectric.shadows.ShadowDialog

@OptIn(ExperimentalTestApi::class)
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [30], qualifiers = "w960dp-h540dp-land")
@LooperMode(LooperMode.Mode.PAUSED)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class TvNavigationTest {
    @get:Rule val compose = createAndroidComposeRule<MainActivity>()
    private val server = MockWebServer()
    private val paths = CopyOnWriteArrayList<String>()
    private val mutations = CopyOnWriteArrayList<String>()
    private val continueWatching = CopyOnWriteArrayList<Media>()
    private var detailOverride: Media? = null
    private var libraryOverride: List<Media>? = null

    @Before
    fun startServer() {
        Shadows.shadowOf(compose.activity.packageManager)
            .setSystemFeature(android.content.pm.PackageManager.FEATURE_LEANBACK, true)
        // Keep UI tests independent of the public release feed in both build variants.
        ApplicationProvider.getApplicationContext<FoyerApplication>()
            .preferences
            .edit()
            .putString("foyer.tv-updates.last-check", System.currentTimeMillis().toString())
            .apply()
        val media = javaClass.getResource("/media-detail.json")!!.readText()
        val folders =
            """[{"id":"movies","name":"My collection","path":"/media","kind":"movies","titleCount":1,"posterPaths":[]}]"""
        server.dispatcher =
            object : Dispatcher() {
                override fun dispatch(request: RecordedRequest): MockResponse {
                    paths.add(request.path!!)
                    if (request.method != "GET") mutations.add("${request.method} ${request.path}")
                    return MockResponse()
                        .setBody(
                            when {
                                request.path == "/api/v1/libraries" -> folders
                                request.path == "/api/v1/settings/overview" ->
                                    """{"libraries":$folders,"scans":[]}"""
                                request.path!!.startsWith("/api/v1/library?") -> {
                                    val items =
                                        libraryOverride
                                            ?: listOf(Api.json.decodeFromString<Media>(media))
                                    val pages = if (libraryOverride == null) 1 else 2
                                    Api.json.encodeToString(
                                        Library(
                                            Stats(0, items.size, 0, items.size, 0, 1),
                                            items,
                                            Pagination(
                                                request.requestUrl!!
                                                    .queryParameter("page")!!
                                                    .toInt(),
                                                50,
                                                items.size * pages,
                                                pages,
                                            ),
                                        )
                                    )
                                }
                                request.path!!.startsWith("/api/v1/media/show") -> {
                                    val detail =
                                        detailOverride?.let {
                                            Api.json.encodeToJsonElement(it).jsonObject
                                        } ?: Api.json.parseToJsonElement(media).jsonObject
                                    val season =
                                        request.requestUrl!!.queryParameter("season")?.toInt() ?: 1
                                    if (request.requestUrl!!.queryParameter("pageSize") == null)
                                        detail.toString()
                                    else
                                        JsonObject(
                                                detail +
                                                    mapOf(
                                                        "selectedPartSeason" to
                                                            JsonPrimitive(season),
                                                        "parts" to
                                                            JsonArray(
                                                                detail
                                                                    .getValue("parts")
                                                                    .jsonArray
                                                                    .filter {
                                                                        it.jsonObject
                                                                            .getValue(
                                                                                "seasonNumber"
                                                                            )
                                                                            .jsonPrimitive
                                                                            .int == season
                                                                    }
                                                            ),
                                                        "partsPagination" to
                                                            buildJsonObject {
                                                                put("page", 1)
                                                                put("pageSize", 50)
                                                                put("totalItems", 1)
                                                                put("totalPages", 1)
                                                            },
                                                    )
                                            )
                                            .toString()
                                }
                                request.path!!.startsWith("/api/v1/progress") ->
                                    Api.json.encodeToString(continueWatching.toList())
                                else -> "{}"
                            }
                        )
                }
            }
        server.start()
    }

    @After
    fun stopServer() {
        server.shutdown()
    }

    @Test
    fun `first run browsing filters and return focus work on Android 11`() {
        connect()
        compose.onNodeWithText("My collection").select()
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("A show").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Search").select()
        compose.onNodeWithContentDescription("Search titles").performTextReplacement("A")
        compose.waitUntil(10_000) {
            paths.any { it.contains("search=A") } &&
                compose.onAllNodesWithText("Loading…").fetchSemanticsNodes().isEmpty()
        }
        compose.onNodeWithContentDescription("Search titles").assertIsFocused()
        compose.onNodeWithText("Search").select()
        compose.onNodeWithText("All titles").select()
        compose.onNodeWithContentDescription("Selected").assertExists()
        compose.onNodeWithText("Unwatched", useUnmergedTree = false).select()
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Unwatched").fetchSemanticsNodes().size == 1
        }
        val app = ApplicationProvider.getApplicationContext<FoyerApplication>()
        assertEquals("unwatched", app.preferences.getString("foyer.tv.watch-filter.movies", null))
        compose.onNodeWithText("A show").select()
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Episodes").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Back").select()
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("All titles").fetchSemanticsNodes().isEmpty() &&
                compose.onAllNodesWithText("A show").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Unwatched").assertExists()
        compose.onNodeWithText("A show").assertIsFocused()
    }

    @Test
    fun `home shelves support horizontal navigation and restore collection focus`() {
        val first =
            Api.json.decodeFromString<Media>(
                javaClass.getResource("/media-detail.json")!!.readText()
            )
        continueWatching.addAll(
            listOf(first, first.copy(id = "another-show", title = "Another show"))
        )
        connect()
        compose.onNodeWithText("A show").assertIsFocused()
        compose.onNodeWithText("A show").performKeyInput { pressKey(Key.DirectionRight) }
        compose.onNodeWithText("Another show").assertIsFocused()
        compose.onNodeWithText("Another show").performKeyInput { pressKey(Key.DirectionDown) }
        compose.onNodeWithText("My collection").assertIsFocused()
        compose.onNodeWithText("My collection").select()
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("All titles").fetchSemanticsNodes().isNotEmpty()
        }
        compose.waitUntil(10_000) {
            compose.onAllNodes(hasText("A show") and isFocused()).fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Back").select()
        compose.waitUntil(10_000) {
            compose
                .onAllNodes(hasText("My collection") and isFocused())
                .fetchSemanticsNodes()
                .isNotEmpty()
        }
        compose.onNodeWithText("My collection").assertIsFocused()
    }

    @Test
    fun `switching between settings and home reuses data without loading placeholders`() {
        connect()
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Loading…").fetchSemanticsNodes().isEmpty()
        }
        val homeCalls = paths.count {
            it == "/api/v1/libraries" || it.startsWith("/api/v1/progress")
        }
        compose.onNodeWithText("Settings").select()
        compose.waitUntil(10_000) {
            paths.any { it.startsWith("/api/v1/settings/overview") } &&
                compose.onAllNodesWithText("Loading…").fetchSemanticsNodes().isEmpty()
        }
        compose.onNodeWithText("Home").select()
        compose.onNodeWithText("My collection").assertExists()
        compose.onNodeWithText("Loading…").assertDoesNotExist()
        assertEquals(
            homeCalls,
            paths.count { it == "/api/v1/libraries" || it.startsWith("/api/v1/progress") },
        )
    }

    @Test
    fun `long media details stay below navigation when resume receives focus`() {
        detailOverride =
            Api.json
                .decodeFromString<Media>(javaClass.getResource("/media-detail.json")!!.readText())
                .copy(
                    title = "The Lord of the Rings: The Fellowship of the Ring — Extended Edition",
                    overview =
                        "An unlikely fellowship travels across a vast world to keep a dangerous relic out of the wrong hands. Along the way, old friendships are tested and new allies join the journey through mountains, forests, and distant cities.",
                    runtimeMinutes = 228,
                    contentRating = "PG-13",
                    tmdbVoteAverage = 8.8,
                    tmdbVoteCount = 25000,
                )
        connect()
        compose.onNodeWithText("My collection").select()
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("A show").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("A show").select()
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Resume · 10%").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Resume · 10%").assertIsFocused()
        val title = compose.onAllNodesWithText(detailOverride!!.title)[0].getUnclippedBoundsInRoot()
        val navigation = compose.onNodeWithText("Home").getUnclippedBoundsInRoot()
        assertTrue("The title must stay below the navigation bar", title.top > navigation.bottom)
        val scroll =
            compose
                .onNode(hasScrollToNodeAction())
                .fetchSemanticsNode()
                .config[androidx.compose.ui.semantics.SemanticsProperties.VerticalScrollAxisRange]
        assertEquals(
            "Initial focus must not scroll the hero under navigation",
            0f,
            scroll.value(),
            1f,
        )
    }

    @Test
    fun `episode rows play directly and keep watched and clear progress actions in their menu`() {
        connect()
        compose.onNodeWithText("My collection").select()
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("A show").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("A show").select()
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Episodes").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNode(hasScrollToNodeAction()).performScrollToNode(hasText("S01E02"))
        compose.onNodeWithText("S01E02").performSemanticsAction(SemanticsActions.OnLongClick) {
            it()
        }
        compose.onNode(hasText("Mark watched") and hasAnyAncestor(isDialog())).assertIsFocused()
        compose.onNodeWithText("Remove progress").select()
        compose.waitUntil(10_000) { mutations.contains("DELETE /api/v1/progress") }
        compose.onNodeWithText("Episode options").assertDoesNotExist()
        compose.onNodeWithText("S01E02").select()
        compose.waitUntil(10_000) {
            Shadows.shadowOf(compose.activity).nextStartedActivityForResult != null
        }
    }

    @Test
    fun `sidebar labels and selection marks are vertically centered in their row`() {
        connect()
        compose.onNodeWithText("Settings").select()
        compose.onNodeWithText("Overview").assertIsFocused()
        val row =
            compose.onNode(hasText("Overview") and hasClickAction()).getUnclippedBoundsInRoot()
        val text =
            compose
                .onNode(hasText("Overview") and !hasClickAction(), useUnmergedTree = true)
                .getUnclippedBoundsInRoot()
        val tick =
            compose
                .onNodeWithContentDescription("Selected", useUnmergedTree = true)
                .getUnclippedBoundsInRoot()
        assertEquals(
            (row.top.value + row.bottom.value) / 2,
            (text.top.value + text.bottom.value) / 2,
            1f,
        )
        assertEquals(
            (row.top.value + row.bottom.value) / 2,
            (tick.top.value + tick.bottom.value) / 2,
            1f,
        )
    }

    @Test
    fun `the next collection page is prefetched only when focus reaches the last row`() {
        val base =
            Api.json.decodeFromString<Media>(
                javaClass.getResource("/media-detail.json")!!.readText()
            )
        libraryOverride = (1..50).map { base.copy(id = "show-$it", title = "Title $it") }
        connect()
        compose.onNodeWithText("My collection").select()
        compose.waitUntil(10_000) {
            compose
                .onAllNodes(hasText("Title 1") and isFocused())
                .fetchSemanticsNodes()
                .isNotEmpty()
        }
        assertEquals(0, paths.count { it.contains("page=2") })
        compose.onNode(hasScrollToNodeAction()).performScrollToNode(hasText("Title 46"))
        compose.onNodeWithText("Title 46").performSemanticsAction(SemanticsActions.RequestFocus) {
            it()
        }
        compose.waitUntil(10_000) { paths.any { it.contains("page=2") } }
        compose.onNodeWithText("Title 47").performSemanticsAction(SemanticsActions.RequestFocus) {
            it()
        }
        assertEquals(1, paths.count { it.contains("page=2") })
    }

    @Test
    fun `new collections initially focus their name instead of the disabled save button`() {
        connect()
        compose.onNodeWithText("Settings").select()
        compose.onNode(hasText("Collections") and hasClickAction()).select()
        compose.onNodeWithText("Create collection").select()
        compose.onNodeWithContentDescription("Collection name").assertIsFocused()
        compose.onNodeWithText("Save collection").assertIsNotEnabled()
    }

    @Test
    fun `settings keep server edits when switching panels and restore focus after a dialog`() {
        connect()
        compose.onNodeWithText("Settings").select()
        compose.onNodeWithText("Overview").assertIsFocused()
        compose.onNode(hasText("Server connection") and hasClickAction()).select()
        val draft = server.url("/draft").toString()
        compose.onNodeWithContentDescription("Server URL").performTextReplacement(draft)
        compose.onNode(hasText("App updates") and hasClickAction()).select()
        compose.onNodeWithText("Check for updates").assertExists()
        compose.onNode(hasText("Server connection") and hasClickAction()).select()
        compose.onNodeWithContentDescription("Server URL").assertTextEquals(draft)
        compose.onNode(hasText("Recent scans") and hasClickAction()).select()
        compose.onNodeWithText("No scans yet. Scan a collection to find its media.").assertExists()
        compose.onNode(hasText("Collections") and hasClickAction()).select()
        compose.onNodeWithText("Create collection").select()
        compose.onNodeWithText("Close").select()
        compose.onNodeWithText("Create collection").assertIsFocused()
        assertTrue(mutations.isEmpty())
    }

    @Test
    fun `resume targets the continuation episode even while browsing another season`() {
        connect()
        compose.onNodeWithText("My collection").select()
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("A show").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("A show").select()
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Episodes").fetchSemanticsNodes().isNotEmpty()
        }
        assertEquals(1, paths.count { it.startsWith("/api/v1/media/show") })
        compose.onNode(hasScrollToNodeAction()).performScrollToNode(hasText("Season 2"))
        compose.onNodeWithText("Season 2").select()
        compose.waitUntil(10_000) {
            paths.any { it.contains("season=2") } &&
                compose.onAllNodesWithText("Loading episodes…").fetchSemanticsNodes().isEmpty()
        }
        compose.onNode(hasScrollToNodeAction()).performScrollToNode(hasText("S02E01"))
        compose.onNodeWithText("S02E01").assertExists()
        compose.onNode(hasScrollToNodeAction()).performScrollToNode(hasText("Resume · 10%"))
        compose.onNodeWithText("Resume · 10%").select()
        var playback: Intent? = null
        compose.waitUntil(10_000) {
            playback = Shadows.shadowOf(compose.activity).nextStartedActivityForResult?.intent
            playback != null
        }
        val options =
            Api.json
                .parseToJsonElement(playback!!.getStringExtra(FoyerPlayerActivity.EXTRA_OPTIONS)!!)
                .jsonObject
        assertEquals("episode-2", options.getValue("startPartId").jsonPrimitive.content)
        assertEquals(3, options.getValue("parts").jsonArray.size)
        assertTrue(paths.contains("/api/v1/media/show"))
    }

    @Test
    fun `screen headings render light text on the dark background`() {
        connect()
        val heading = compose.onNodeWithText("My media").fetchSemanticsNode().boundsInWindow
        lateinit var bitmap: Bitmap
        compose.runOnIdle {
            val view = compose.activity.window.decorView
            bitmap = Bitmap.createBitmap(view.width, view.height, Bitmap.Config.ARGB_8888)
            view.draw(Canvas(bitmap))
        }
        assertTrue(
            (heading.left.toInt() until heading.right.toInt()).any { x ->
                (heading.top.toInt() until heading.bottom.toInt()).any { y ->
                    val color = bitmap.getPixel(x, y)
                    Color.red(color) > 200 && Color.green(color) > 200 && Color.blue(color) > 180
                }
            }
        )
    }

    @Test
    fun `holding Select opens options before release and does not activate the first action`() {
        connect()
        compose.onNodeWithText("My collection").select()
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("A show").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("A show").performSemanticsAction(SemanticsActions.RequestFocus) {
            it()
        }
        val downTime = SystemClock.uptimeMillis()
        compose.runOnIdle {
            compose.activity.dispatchKeyEvent(
                AndroidKeyEvent(
                    downTime,
                    downTime,
                    AndroidKeyEvent.ACTION_DOWN,
                    AndroidKeyEvent.KEYCODE_DPAD_CENTER,
                    0,
                )
            )
        }
        compose.onNodeWithText("Mark as watched").assertDoesNotExist()
        // Open from the timer alone: remotes do not need to send repeats or key-up.
        compose.mainClock.advanceTimeBy(
            android.view.ViewConfiguration.getLongPressTimeout().toLong() + 100
        )
        compose.onNodeWithText("Mark as watched").assertIsFocused()
        val dialog = ShadowDialog.getLatestDialog()
        // Some remotes send more repeats or an extra release after focus changes.
        compose.runOnIdle {
            dialog.dispatchKeyEvent(
                AndroidKeyEvent(
                    downTime,
                    downTime + 750,
                    AndroidKeyEvent.ACTION_DOWN,
                    AndroidKeyEvent.KEYCODE_DPAD_CENTER,
                    2,
                )
            )
            dialog.dispatchKeyEvent(
                AndroidKeyEvent(
                    downTime,
                    downTime + 800,
                    AndroidKeyEvent.ACTION_UP,
                    AndroidKeyEvent.KEYCODE_DPAD_CENTER,
                    0,
                )
            )
        }
        compose.onNodeWithText("Mark as watched").assertIsFocused()
        assertTrue(mutations.isEmpty())
        compose.onNodeWithText("Mark as watched").performKeyInput { pressKey(Key.DirectionDown) }
        compose.onNodeWithText("Remove episode progress").assertIsFocused()
        compose.onNodeWithText("Remove episode progress").performKeyInput {
            pressKey(Key.DirectionDown)
        }
        compose.onNodeWithText("Identify").assertIsFocused()
        compose.onNodeWithText("Mark as watched").select()
        compose.waitUntil(10_000) { mutations.contains("PUT /api/v1/media/show") }
        compose.onNodeWithText("Mark as watched").assertDoesNotExist()
        // A second short press on the card must still open the detail screen.
        compose.onNodeWithText("A show").select()
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Episodes").fetchSemanticsNodes().isNotEmpty()
        }
    }

    private fun connect() {
        compose
            .onNode(hasSetTextAction())
            .performTextReplacement(server.url("/").toString().trimEnd('/'))
        compose.onNodeWithText("Save server").select()
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("My collection").fetchSemanticsNodes().isNotEmpty()
        }
    }
}

@OptIn(ExperimentalTestApi::class)
private fun SemanticsNodeInteraction.select(): SemanticsNodeInteraction =
    performSemanticsAction(SemanticsActions.RequestFocus) { it() }
        .performKeyInput { pressKey(Key.DirectionCenter) }
