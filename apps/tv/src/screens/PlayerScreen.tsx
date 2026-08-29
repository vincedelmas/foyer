import type { MediaPart } from "@ploux/contracts"
import { useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import { ActivityIndicator, StyleSheet, Text, View } from "react-native"

import {
  playNativeMedia,
  type PlouxPlayerPart,
} from "../../modules/ploux-player"
import { tvApi } from "../api"
import { FocusButton } from "../components/FocusButton"
import { colors } from "../theme"

export function PlayerScreen({
  server,
  mediaId,
  mediaTitle,
  part,
  parts,
  onBack,
}: {
  server: string
  mediaId: string
  mediaTitle: string
  part: MediaPart
  parts: MediaPart[]
  onBack: () => void
}) {
  const launched = useRef(false)
  const onBackRef = useRef(onBack)
  const [launchError, setLaunchError] = useState<string | null>(null)
  const queryClient = useQueryClient()
  onBackRef.current = onBack

  useEffect(() => {
    if (launched.current) return
    launched.current = true

    const nativeParts: PlouxPlayerPart[] = parts.map((candidate) => {
      const streamUrl = new URL(
        tvApi.absoluteUrl(server, candidate.streamUrl)
      )
      streamUrl.searchParams.set("compat", "android-tv")

      return {
        id: candidate.id,
        title: partTitle(candidate),
        fileName: candidate.fileName,
        streamUrl: streamUrl.toString(),
        resumePositionSeconds:
          candidate.progress && !candidate.progress.completed
            ? candidate.progress.positionSeconds
            : 0,
        subtitles: candidate.subtitles.map((subtitle) => {
          const subtitleUrl = new URL(
            tvApi.absoluteUrl(server, subtitle.url)
          )
          subtitleUrl.searchParams.set("compat", "android-tv")
          return {
            id: subtitle.id,
            label: subtitle.label,
            language: subtitle.language,
            format: subtitle.format,
            url: subtitleUrl.toString(),
            isDefault: subtitle.isDefault,
          }
        }),
      }
    })

    void playNativeMedia({
      serverUrl: server,
      mediaTitle,
      startPartId: part.id,
      parts: nativeParts,
    })
      .then(async () => {
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: ["tv-media", server, mediaId],
          }),
          queryClient.invalidateQueries({ queryKey: ["tv-library", server] }),
          queryClient.invalidateQueries({ queryKey: ["tv-watching", server] }),
        ])
        onBackRef.current()
      })
      .catch((error: unknown) => {
        setLaunchError(
          error instanceof Error
            ? error.message
            : "The native Android TV player could not be opened."
        )
      })
  }, [mediaId, mediaTitle, part.id, parts, queryClient, server])

  return (
    <View style={styles.screen}>
      {launchError ? (
        <>
          <Text style={styles.title}>Could not open the player</Text>
          <Text style={styles.description}>{launchError}</Text>
          <FocusButton
            label="Back"
            hasTVPreferredFocus
            onPress={() => onBackRef.current()}
          />
        </>
      ) : (
        <>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.description}>Opening native player…</Text>
        </>
      )}
    </View>
  )
}

function partTitle(part: MediaPart) {
  if (part.title) return part.title
  if (part.seasonNumber !== null && part.episodeNumber !== null) {
    return `S${String(part.seasonNumber).padStart(2, "0")}E${String(
      part.episodeNumber
    ).padStart(2, "0")}`
  }
  return part.fileName
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    padding: 48,
    backgroundColor: colors.black,
  },
  title: { color: colors.text, fontSize: 24, fontWeight: "800" },
  description: {
    maxWidth: 720,
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
})
