package com.foyer.tv

import android.content.Intent
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

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [30], qualifiers = "w960dp-h540dp-land")
@LooperMode(LooperMode.Mode.PAUSED)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class TvNavigationTest {
    @get:Rule val compose = createAndroidComposeRule<MainActivity>()
    private val server = MockWebServer()
    private val paths = CopyOnWriteArrayList<String>()

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
                                request.path!!.startsWith("/api/v1/progress") -> "[]"
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
            compose.onAllNodesWithText("S02E01").fetchSemanticsNodes().isNotEmpty()
        }
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
