package com.foyer.player

import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

internal class PlaybackProgressReporter(serverUrl: String) {
  private val endpoint = URL("${serverUrl.trimEnd('/')}/api/v1/progress")
  private val executor: ExecutorService = Executors.newSingleThreadExecutor { runnable ->
    Thread(runnable, "foyer-playback-progress").apply { isDaemon = true }
  }
  private val pendingLock = Any()
  private var pendingPayload: String? = null
  private var workerRunning = false

  fun save(partId: String, positionMs: Long, durationMs: Long) {
    if (durationMs <= 0 || executor.isShutdown) return

    val payload = JSONObject()
      .put("partId", partId)
      .put("positionSeconds", positionMs.coerceAtLeast(0) / 1_000.0)
      .put("durationSeconds", durationMs.coerceAtLeast(0) / 1_000.0)
      .toString()

    val startWorker = synchronized(pendingLock) {
      pendingPayload = payload
      if (workerRunning) {
        false
      } else {
        workerRunning = true
        true
      }
    }
    if (!startWorker) return

    executor.execute {
      while (true) {
        val currentPayload = synchronized(pendingLock) {
          pendingPayload?.also { pendingPayload = null } ?: run {
            workerRunning = false
            null
          }
        } ?: return@execute

        var connection: HttpURLConnection? = null
        try {
          connection = endpoint.openConnection() as HttpURLConnection
          connection.requestMethod = "POST"
          connection.connectTimeout = 5_000
          connection.readTimeout = 5_000
          connection.doOutput = true
          connection.setRequestProperty("Content-Type", "application/json")
          connection.setRequestProperty("Accept", "application/json")
          connection.setRequestProperty("User-Agent", "Foyer-TV/Media3")
          connection.outputStream.use { stream ->
            stream.write(currentPayload.toByteArray(Charsets.UTF_8))
          }

          val responseStream = if (connection.responseCode in 200..299) {
            connection.inputStream
          } else {
            connection.errorStream
          }
          responseStream?.use { it.readBytes() }
        } catch (_: Exception) {
          // Progress is best-effort. A newer pending update replaces stale work.
        } finally {
          connection?.disconnect()
        }
      }
    }
  }

  fun saveCompleted(partId: String, durationMs: Long) {
    val completedDuration = durationMs.coerceAtLeast(1_000)
    save(partId, completedDuration, completedDuration)
  }

  fun close() {
    executor.shutdown()
  }
}
