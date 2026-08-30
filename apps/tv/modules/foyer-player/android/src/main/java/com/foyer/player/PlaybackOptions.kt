package com.foyer.player

import org.json.JSONObject

internal data class PlaybackSubtitle(
  val id: String,
  val label: String,
  val language: String,
  val format: String,
  val url: String,
  val isDefault: Boolean,
)

internal data class PlaybackPart(
  val id: String,
  val title: String,
  val fileName: String,
  val streamUrl: String,
  val resumePositionMs: Long,
  val subtitles: List<PlaybackSubtitle>,
)

internal data class PlaybackOptions(
  val serverUrl: String,
  val mediaTitle: String,
  val startPartId: String,
  val parts: List<PlaybackPart>,
) {
  val startIndex: Int
    get() = parts.indexOfFirst { it.id == startPartId }.coerceAtLeast(0)

  companion object {
    fun parse(source: String): PlaybackOptions {
      val root = JSONObject(source)
      val partsJson = root.getJSONArray("parts")
      val parts = buildList {
        for (partIndex in 0 until partsJson.length()) {
          val partJson = partsJson.getJSONObject(partIndex)
          val subtitlesJson = partJson.optJSONArray("subtitles")
          val subtitles = buildList {
            if (subtitlesJson != null) {
              for (subtitleIndex in 0 until subtitlesJson.length()) {
                val subtitle = subtitlesJson.getJSONObject(subtitleIndex)
                add(
                  PlaybackSubtitle(
                    id = subtitle.getString("id"),
                    label = subtitle.optString("label", "Subtitles"),
                    language = subtitle.optString("language", "und"),
                    format = subtitle.optString("format", "vtt"),
                    url = subtitle.getString("url"),
                    isDefault = subtitle.optBoolean("isDefault", false),
                  )
                )
              }
            }
          }

          add(
            PlaybackPart(
              id = partJson.getString("id"),
              title = partJson.optString("title", ""),
              fileName = partJson.getString("fileName"),
              streamUrl = partJson.getString("streamUrl"),
              resumePositionMs = (partJson.optDouble("resumePositionSeconds", 0.0) * 1_000).toLong(),
              subtitles = subtitles,
            )
          )
        }
      }

      require(parts.isNotEmpty()) { "Playback requires at least one media part." }

      return PlaybackOptions(
        serverUrl = root.getString("serverUrl").trimEnd('/'),
        mediaTitle = root.getString("mediaTitle"),
        startPartId = root.getString("startPartId"),
        parts = parts,
      )
    }
  }
}
