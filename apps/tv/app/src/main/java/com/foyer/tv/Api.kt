package com.foyer.tv

import java.io.IOException
import java.util.concurrent.TimeUnit
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

class Api(val server: String, private val nowNanos: () -> Long = System::nanoTime) {
    private val cache = mutableMapOf<String, Pair<Long, String>>()
    private var generation = 0

    private fun url(path: String, query: Map<String, String>) =
        (server + path)
            .toHttpUrl()
            .newBuilder()
            .apply {
                query.toSortedMap().forEach { (key, value) -> addQueryParameter(key, value) }
            }
            .build()

    // Seed returning screens from the last response, even while it is being revalidated.
    fun cached(path: String, query: Map<String, String> = emptyMap()): String? =
        synchronized(cache) {
            cache[url(path, query).toString()]
                ?.takeIf { nowNanos() - it.first < RETENTION_NANOS }
                ?.second
        }

    suspend fun request(
        path: String,
        method: String = "GET",
        body: JsonObject? = null,
        query: Map<String, String> = emptyMap(),
        mutates: Boolean = method != "GET",
    ): String {
        val url = url(path, query)
        val key = url.toString()
        val requestGeneration =
            synchronized(cache) {
                val now = nowNanos()
                cache.entries.removeAll { now - it.value.first >= RETENTION_NANOS }
                if (method == "GET")
                    cache[key]
                        ?.takeIf { now - it.first < FRESH_NANOS }
                        ?.let {
                            return it.second
                        }
                generation
            }
        val request =
            Request.Builder()
                .url(url)
                .header("Accept", "application/json")
                .header("User-Agent", "Foyer-TV/${BuildConfig.VERSION_NAME}")
                .method(
                    method,
                    if (method == "GET") null
                    else
                        (body ?: JsonObject(emptyMap()))
                            .toString()
                            .toRequestBody("application/json".toMediaType()),
                )
                .build()
        return request.fetch { response ->
            val value = response.body!!.string()
            if (!response.isSuccessful) {
                val message = runCatching {
                    json.decodeFromString<Map<String, String>>(value)["error"]
                }
                    .getOrNull()
                throw IOException(message ?: "Request failed (${response.code})")
            }
            synchronized(cache) {
                if (mutates) {
                    cache.clear()
                    generation++
                } else if (method == "GET" && generation == requestGeneration) {
                    cache[key] = nowNanos() to value
                }
            }
            value
        }
    }

    fun invalidate() =
        synchronized(cache) {
            cache.clear()
            generation++
        }

    suspend inline fun <reified T> get(path: String, query: Map<String, String> = emptyMap()): T =
        json.decodeFromString(request(path, query = query))

    suspend fun health(): Health {
        val health = get<Health>("/api/v1/")
        require(health.name == "Foyer" && health.status == "ok") {
            "This address does not appear to be a Foyer server."
        }
        return health
    }

    suspend fun folders(): List<Collection> = get("/api/v1/libraries")

    suspend fun watching(): List<Media> = get("/api/v1/progress", mapOf("limit" to "20"))

    suspend fun library(query: Map<String, String>): Library = get("/api/v1/library", query)

    fun mediaQuery(
        season: Int? = null,
        page: Int? = null,
        pageSize: Int? = null,
    ): Map<String, String> = buildMap {
        season?.let { put("season", it.toString()) }
        page?.let { put("page", it.toString()) }
        pageSize?.let { put("pageSize", it.toString()) }
    }

    suspend fun media(
        id: String,
        season: Int? = null,
        page: Int? = null,
        pageSize: Int? = null,
    ): Media = get("/api/v1/media/$id", mediaQuery(season, page, pageSize))

    suspend fun watchMedia(id: String, watched: Boolean, season: Int? = null) =
        request(
            "/api/v1/media/$id",
            "PUT",
            buildJsonObject {
                put("watched", watched)
                season?.let { put("seasonNumber", it) }
            },
        )

    suspend fun watchPart(id: String, watched: Boolean) =
        request(
            "/api/v1/progress",
            "PUT",
            buildJsonObject {
                put("partId", id)
                put("watched", watched)
            },
        )

    suspend fun saveProgress(id: String, position: Double, duration: Double) =
        request(
            "/api/v1/progress",
            "POST",
            buildJsonObject {
                put("partId", id)
                put("positionSeconds", position)
                put("durationSeconds", duration)
            },
        )

    suspend fun clearProgress(id: String, part: Boolean = false) =
        request(
            "/api/v1/progress",
            "DELETE",
            buildJsonObject {
                put(if (part) "partId" else "mediaId", id)
            },
        )

    suspend fun deleteMedia(id: String) =
        request("/api/v1/media/$id", "DELETE", buildJsonObject { put("deleteFiles", true) })

    suspend fun scan(id: String? = null): ScanResult =
        json.decodeFromString(
            request(
                "/api/v1/settings/scan",
                "POST",
                buildJsonObject { id?.let { put("libraryId", it) } },
            )
        )

    suspend fun refresh(id: String, collection: Boolean = false) =
        request(
            "/api/v1/settings/metadata/refresh",
            "POST",
            buildJsonObject { put(if (collection) "libraryId" else "mediaId", id) },
        )

    suspend fun saveCollection(id: String?, name: String, path: String, kind: String) =
        request(
            "/api/v1/settings/libraries",
            if (id == null) "POST" else "PUT",
            buildJsonObject {
                id?.let { put("id", it) }
                put("name", name)
                put("path", path)
                put("kind", kind)
            },
        )

    suspend fun deleteCollection(id: String) =
        request("/api/v1/settings/libraries", "DELETE", buildJsonObject { put("id", id) })

    suspend fun searchMetadata(id: String, query: String, year: Int?): Candidates =
        json.decodeFromString(
            request(
                "/api/v1/settings/metadata/search",
                "POST",
                buildJsonObject {
                    put("mediaId", id)
                    put("query", query)
                    year?.let { put("year", it) }
                },
                mutates = false,
            )
        )

    suspend fun identify(id: String, tmdbId: Int) =
        request(
            "/api/v1/settings/metadata/identify",
            "POST",
            buildJsonObject {
                put("mediaId", id)
                put("tmdbId", tmdbId)
            },
        )

    suspend fun playbackOptions(id: String, partId: String): String {
        // No page/season filter: playback must include every episode, across browsing pages.
        val media = media(id)
        return buildJsonObject {
            put("serverUrl", server)
            put("mediaTitle", media.title)
            put("startPartId", partId)
            put(
                "parts",
                kotlinx.serialization.json.buildJsonArray {
                    media.parts.forEach { part ->
                        add(
                            buildJsonObject {
                                put("id", part.id)
                                put("title", part.displayTitle)
                                put("fileName", part.fileName)
                                put(
                                    "streamUrl",
                                    (server + part.streamUrl)
                                        .toHttpUrl()
                                        .newBuilder()
                                        .setQueryParameter("compat", "android-tv")
                                        .build()
                                        .toString(),
                                )
                                put(
                                    "resumePositionSeconds",
                                    part.progress?.takeUnless { it.completed }?.positionSeconds
                                        ?: 0.0,
                                )
                                put(
                                    "subtitles",
                                    kotlinx.serialization.json.buildJsonArray {
                                        part.subtitles.forEach { subtitle ->
                                            add(
                                                buildJsonObject {
                                                    put("id", subtitle.id)
                                                    put("label", subtitle.label)
                                                    put("language", subtitle.language)
                                                    put("format", subtitle.format)
                                                    put("isDefault", subtitle.isDefault)
                                                    put(
                                                        "url",
                                                        (server + subtitle.url)
                                                            .toHttpUrl()
                                                            .newBuilder()
                                                            .setQueryParameter(
                                                                "compat",
                                                                "android-tv",
                                                            )
                                                            .build()
                                                            .toString(),
                                                    )
                                                }
                                            )
                                        }
                                    },
                                )
                            }
                        )
                    }
                },
            )
        }
            .toString()
    }

    companion object {
        private val FRESH_NANOS = TimeUnit.MINUTES.toNanos(2)
        private val RETENTION_NANOS = TimeUnit.MINUTES.toNanos(10)
        val json = Json { ignoreUnknownKeys = true }
        val http =
            OkHttpClient.Builder()
                .connectTimeout(10, TimeUnit.SECONDS)
                // Library scans and metadata refreshes can take a while on a home server.
                .readTimeout(5, TimeUnit.MINUTES)
                .build()
    }
}
