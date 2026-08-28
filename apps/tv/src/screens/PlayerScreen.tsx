import type { MediaPart } from "@ploux/contracts"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { ArrowLeftIcon } from "lucide-react-native"
import { useEffect, useRef, useState } from "react"
import { BackHandler, StyleSheet, Text, View } from "react-native"
import Video, {
  SelectedTrackType,
  TextTrackType,
  type ISO639_1,
  type TextTracks,
  type VideoRef,
} from "react-native-video"

import { tvApi } from "../api"
import { FocusButton } from "../components/FocusButton"
import { colors } from "../theme"

export function PlayerScreen({
  server,
  mediaId,
  mediaTitle,
  part,
  onBack,
}: {
  server: string
  mediaId: string
  mediaTitle: string
  part: MediaPart
  onBack: () => void
}) {
  const videoRef = useRef<VideoRef>(null)
  const lastProgress = useRef({ currentTime: 0, duration: 0 })
  const lastSaved = useRef(0)
  const [error, setError] = useState<string | null>(null)
  const queryClient = useQueryClient()
  const save = useMutation({
    mutationFn: (value: { positionSeconds: number; durationSeconds: number }) =>
      tvApi.progress(server, { partId: part.id, ...value }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["tv-media", server, mediaId],
      })
      void queryClient.invalidateQueries({ queryKey: ["tv-library", server] })
      void queryClient.invalidateQueries({ queryKey: ["tv-watching", server] })
    },
  })

  const saveProgress = () => {
    const { currentTime, duration } = lastProgress.current
    if (duration > 0)
      save.mutate({ positionSeconds: currentTime, durationSeconds: duration })
  }

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        saveProgress()
        onBack()
        return true
      }
    )
    return () => {
      subscription.remove()
      saveProgress()
    }
  }, [onBack])

  const textTracks: TextTracks = part.subtitles.map((subtitle) => ({
    title: subtitle.label,
    language: subtitle.language as ISO639_1,
    type: TextTrackType.VTT,
    uri: tvApi.absoluteUrl(server, subtitle.url),
  }))

  return (
    <View style={styles.screen}>
      <Video
        ref={videoRef}
        source={{
          uri: tvApi.absoluteUrl(server, part.streamUrl),
          type: part.mimeType,
          textTracks,
          textTracksAllowChunklessPreparation: true,
          metadata: { title: mediaTitle, subtitle: part.title ?? undefined },
        }}
        style={styles.video}
        resizeMode="contain"
        controls
        controlsStyles={{ seekIncrementMS: 10_000, hideSettingButton: false }}
        selectedTextTrack={{ type: SelectedTrackType.SYSTEM }}
        progressUpdateInterval={1_000}
        onLoad={(event) => {
          lastProgress.current.duration = event.duration
          if (
            part.progress &&
            !part.progress.completed &&
            part.progress.positionSeconds > 0
          ) {
            videoRef.current?.seek(
              Math.min(
                part.progress.positionSeconds,
                Math.max(0, event.duration - 1)
              )
            )
          }
        }}
        onProgress={(event) => {
          lastProgress.current = {
            currentTime: event.currentTime,
            duration: lastProgress.current.duration,
          }
          if (Date.now() - lastSaved.current >= 10_000) {
            lastSaved.current = Date.now()
            saveProgress()
          }
        }}
        onEnd={saveProgress}
        onError={(event) =>
          setError(
            event.error?.errorString ??
              "This file could not be played directly."
          )
        }
      />
      <View style={styles.overlay} pointerEvents="box-none">
        <FocusButton
          label="Back"
          icon={ArrowLeftIcon}
          variant="ghost"
          onPress={() => {
            saveProgress()
            onBack()
          }}
        />
        <View style={styles.titleBlock}>
          <Text style={styles.title}>{mediaTitle}</Text>
          {part.episodeNumber ? (
            <Text style={styles.subtitle}>
              S{part.seasonNumber ?? 1} E{part.episodeNumber}
              {part.title ? ` · ${part.title}` : ""}
            </Text>
          ) : null}
        </View>
        <Text style={styles.direct}>DIRECT PLAY</Text>
      </View>
      {error ? (
        <View style={styles.errorPanel}>
          <Text style={styles.errorTitle}>Playback failed</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.errorHint}>
            Ploux never transcodes. Check that this TV supports the file&apos;s
            container, video codec, and audio codec.
          </Text>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.black },
  video: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 95,
    paddingHorizontal: 28,
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
    backgroundColor: "rgba(0,0,0,0.56)",
  },
  titleBlock: { flex: 1, gap: 4 },
  title: { color: colors.white, fontSize: 22, fontWeight: "800" },
  subtitle: { color: "#c4beb6", fontSize: 13 },
  direct: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.8,
  },
  errorPanel: {
    position: "absolute",
    width: 620,
    alignSelf: "center",
    top: "34%",
    padding: 34,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  errorTitle: { color: colors.text, fontSize: 26, fontWeight: "800" },
  errorText: { color: colors.danger, fontSize: 15 },
  errorHint: { color: colors.muted, fontSize: 14, lineHeight: 21 },
})
