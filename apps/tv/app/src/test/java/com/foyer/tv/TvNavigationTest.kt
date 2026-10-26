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

    @Before
    fun startServer() {
        // Keep UI tests independent of the public release feed in both build variants.
        ApplicationProvider.getApplicationContext<FoyerApplication>()
            .preferences
            .edit()
            .putString("foyer.tv-updates.last-check", System.currentTimeMillis().toString())
            .apply()
        val media = javaClass.getResource("/media-detail.json")!!.readText()
        server.dispatcher =
            object : Dispatcher() {
                override fun dispatch(request: RecordedRequest): MockResponse {
                    paths.add(request.path!!)
                    if (request.method != "GET") mutations.add("${request.method} ${request.path}")
                    return MockResponse()
                        .setBody(
                            when {
                                request.path == "/api/v1/libraries" ->
                                    """[{"id":"movies","name":"My collection","path":"/media","kind":"movies","titleCount":1,"posterPaths":[]}]"""
                                request.path!!.startsWith("/api/v1/library?") ->
                                    """{"stats":{"anime":0,"titles":1,"movies":0,"series":1,"unmatched":0,"inProgress":1},"items":[$media],"pagination":{"page":1,"pageSize":50,"totalItems":1,"totalPages":1}}"""
                                request.path!!.startsWith("/api/v1/media/show") -> {
                                    val detail = Api.json.parseToJsonElement(media).jsonObject
                                    val season =
                                        request.requestUrl!!.queryParameter("season")?.toInt() ?: 1
                                    if (request.requestUrl!!.queryParameter("pageSize") == null)
                                        media
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
        compose.onNodeWithText("Back").select()
        compose.onNodeWithText("My collection").assertIsFocused()
    }

    @Test
    fun `new collections initially focus their name instead of the disabled save button`() {
        connect()
        compose.onNodeWithText("Settings").select()
        compose.onNode(hasScrollToNodeAction()).performScrollToNode(hasText("Create collection"))
        compose.onNodeWithText("Create collection").select()
        compose.onNodeWithContentDescription("Collection name").assertIsFocused()
        compose.onNodeWithText("Save collection").assertIsNotEnabled()
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
                compose.onAllNodesWithText("Loading…").fetchSemanticsNodes().isEmpty()
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
    fun `holding Select opens options on release and does not activate the first action`() {
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
            compose.activity.dispatchKeyEvent(
                AndroidKeyEvent(
                    downTime,
                    downTime + 600,
                    AndroidKeyEvent.ACTION_DOWN,
                    AndroidKeyEvent.KEYCODE_DPAD_CENTER,
                    1,
                )
            )
        }
        compose.onNodeWithText("Mark as watched").assertDoesNotExist()
        compose.runOnIdle {
            compose.activity.dispatchKeyEvent(
                AndroidKeyEvent(
                    downTime,
                    downTime + 700,
                    AndroidKeyEvent.ACTION_UP,
                    AndroidKeyEvent.KEYCODE_DPAD_CENTER,
                    0,
                )
            )
        }
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
