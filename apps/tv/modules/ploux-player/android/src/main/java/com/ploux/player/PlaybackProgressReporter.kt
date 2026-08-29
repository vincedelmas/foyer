package com.ploux.player

import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

internal class PlaybackProgressReporter(serverUrl: String) {
  private val endpoint = URL("${serverUrl.trimEnd('/')}/api/v1/progress")
  private val executor: ExecutorService = Executors.newSingleThreadExecutor { runnable ->
    Thread(runnable, "ploux-playback-progress").apply { isDaemon = true }
  }

  fun save(partId: String, positionMs: Long, durationMs: Long) {
    if (durationMs <= 0 || executor.isShutdown) return

    val payload = JSONObject()
      .put("partId", partId)
      .put("positionSeconds", positionMs.coerceAtLeast(0) / 1_000.0)
      .put("durationSeconds", durationMs.coerceAtLeast(0) / 1_000.0)
      .toString()

    executor.execute {
      var connection: HttpURLConnection? = null
      try {
        connection = endpoint.openConnection() as HttpURLConnection
        connection.requestMethod = "POST"
        connection.connectTimeout = 5_000
        connection.readTimeout = 5_000
        connection.doOutput = true
        connection.setRequestProperty("Content-Type", "application/json")
        connection.setRequestProperty("Accept", "application/json")
        connection.setRequestProperty("User-Agent", "Ploux-TV/Media3")
        connection.outputStream.use { stream ->
          stream.write(payload.toByteArray(Charsets.UTF_8))
        }

        val responseStream = if (connection.responseCode in 200..299) {
          connection.inputStream
        } else {
          connection.errorStream
        }
        responseStream?.use { it.readBytes() }
      } catch (_: Exception) {
        // Progress is best-effort. The next periodic update or activity exit
        // will retry without interrupting playback.
      } finally {
        connection?.disconnect()
      }
    }
  }

  fun close() {
    executor.shutdown()
    try {
      executor.awaitTermination(750, TimeUnit.MILLISECONDS)
    } catch (_: InterruptedException) {
      Thread.currentThread().interrupt()
    }
  }
}
