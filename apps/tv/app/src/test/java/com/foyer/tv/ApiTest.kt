package com.foyer.tv

import java.util.concurrent.TimeUnit
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import kotlinx.serialization.json.*
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okhttp3.mockwebserver.SocketPolicy
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test

class ApiTest {
    private val server = MockWebServer()
    private lateinit var api: Api

    @Before
    fun setUp() {
        server.start()
        api = Api(server.url("/").toString().trimEnd('/'))
    }

    @After
    fun tearDown() {
        server.shutdown()
    }

    @Test
    fun `playback loads every season without browsing pagination and preserves native options`() =
        runBlocking {
            server.enqueue(
                MockResponse().setBody(javaClass.getResource("/media-detail.json")!!.readText())
            )
            val options =
                Api.json.parseToJsonElement(api.playbackOptions("show", "episode-2")).jsonObject
            assertEquals("/api/v1/media/show", server.takeRequest().path)
            assertEquals("episode-2", options.getValue("startPartId").jsonPrimitive.content)
            val parts = options.getValue("parts").jsonArray
            assertEquals(3, parts.size)
            assertEquals(
                91.5,
                parts[1].jsonObject.getValue("resumePositionSeconds").jsonPrimitive.double,
                0.0,
            )
            assertEquals(
                0.0,
                parts[0].jsonObject.getValue("resumePositionSeconds").jsonPrimitive.double,
                0.0,
            )
            assertEquals("S02E01", parts[2].jsonObject.getValue("title").jsonPrimitive.content)
            assertTrue(
                parts[2]
                    .jsonObject
                    .getValue("streamUrl")
                    .jsonPrimitive
                    .content
                    .endsWith("/api/v1/stream/episode-3?compat=android-tv")
            )
            val subtitle = parts[1].jsonObject.getValue("subtitles").jsonArray.single().jsonObject
            assertEquals("ass", subtitle.getValue("format").jsonPrimitive.content)
            assertTrue(subtitle.getValue("isDefault").jsonPrimitive.boolean)
            assertTrue(
                subtitle
                    .getValue("url")
                    .jsonPrimitive
                    .content
                    .endsWith("/api/v1/subtitles/styled?compat=android-tv")
            )
        }

    @Test
    fun `watched mutation invalidates cached collections and preserves season zero`() =
        runBlocking {
            server.enqueue(MockResponse().setBody("[]"))
            assertTrue(api.folders().isEmpty())
            assertTrue(api.folders().isEmpty())
            assertEquals(1, server.requestCount)
            server.takeRequest()
            server.enqueue(MockResponse().setBody("{\"watched\":true,\"updatedParts\":1}"))
            api.watchMedia("show", true, 0)
            val mutation = server.takeRequest()
            assertEquals("PUT", mutation.method)
            assertEquals("/api/v1/media/show", mutation.path)
            assertEquals(
                buildJsonObject {
                    put("watched", true)
                    put("seasonNumber", 0)
                },
                Api.json.parseToJsonElement(mutation.body.readUtf8()),
            )
            server.enqueue(MockResponse().setBody("[]"))
            api.folders()
            assertEquals(3, server.requestCount)
        }

    @Test
    fun `collection removal and source file deletion use distinct request contracts`() =
        runBlocking {
            server.enqueue(MockResponse().setBody("{}"))
            api.deleteCollection("collection")
            val collection = server.takeRequest()
            assertEquals("/api/v1/settings/libraries", collection.path)
            assertEquals("DELETE", collection.method)
            assertEquals("{\"id\":\"collection\"}", collection.body.readUtf8())
            server.enqueue(MockResponse().setBody("{}"))
            api.deleteMedia("show")
            val media = server.takeRequest()
            assertEquals("/api/v1/media/show", media.path)
            assertEquals("DELETE", media.method)
            assertEquals("{\"deleteFiles\":true}", media.body.readUtf8())
        }

    @Test
    fun `final playback position uses the same progress contract as periodic reports`() =
        runBlocking {
            server.enqueue(MockResponse().setBody("{}"))
            api.saveProgress("episode-2", 91.5, 915.0)
            val progress = server.takeRequest()
            assertEquals("POST", progress.method)
            assertEquals("/api/v1/progress", progress.path)
            assertEquals(
                buildJsonObject {
                    put("partId", "episode-2")
                    put("positionSeconds", 91.5)
                    put("durationSeconds", 915.0)
                },
                Api.json.parseToJsonElement(progress.body.readUtf8()),
            )
        }

    @Test
    fun `leaving a screen cancels its HTTP request instead of waiting for the read timeout`() =
        runBlocking {
            server.enqueue(MockResponse().setSocketPolicy(SocketPolicy.NO_RESPONSE))
            val pending = launch(Dispatchers.Default) { api.folders() }
            assertNotNull(server.takeRequest(3, TimeUnit.SECONDS))
            withTimeout(3_000) {
                pending.cancelAndJoin()
                while (Api.http.dispatcher.runningCallsCount() > 0) delay(10)
            }
            assertTrue(pending.isCancelled)
        }

    @Test
    fun `server errors reach the TV interface`() = runBlocking {
        server.enqueue(
            MockResponse().setResponseCode(409).setBody("{\"error\":\"Scan already running\"}")
        )
        val failure = runCatching { api.scan() }.exceptionOrNull()
        assertEquals("Scan already running", failure?.message)
    }
}
