import type { MediaPart } from "@ploux/contracts"
import { useMutation, useQueryClient } from "@tanstack/react-query"
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
  const controlsVisible = useRef(false)
  const controlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [controls, setControls] = useState(false)
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

  const dismissControls = () => {
    controlsVisible.current = false
    setControls(false)
    if (controlsTimer.current) clearTimeout(controlsTimer.current)
    controlsTimer.current = setTimeout(() => setControls(true), 120)
  }

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (controlsVisible.current) {
          dismissControls()
          return true
        }
        saveProgress()
        onBack()
        return true
      }
    )
    return () => {
      subscription.remove()
      if (controlsTimer.current) clearTimeout(controlsTimer.current)
      saveProgress()
    }
  }, [onBack])

  const textTracks: TextTracks = part.subtitles.map((subtitle) => ({
    title: subtitle.label,
    language: subtitle.language as ISO639_1,
    type: TextTrackType.VTT,
    uri: tvApi.absoluteUrl(server, subtitle.url),
  }))
  const streamUrl = new URL(tvApi.absoluteUrl(server, part.streamUrl))
  if (part.mimeType === "video/x-msvideo")
    streamUrl.searchParams.set("compat", "android-tv")

  return (
    <View style={styles.screen}>
      <Video
        ref={videoRef}
        source={{
          uri: streamUrl.toString(),
          type:
            part.mimeType === "video/x-msvideo"
              ? undefined
              : part.mimeType,
          textTracks,
          textTracksAllowChunklessPreparation: true,
          metadata: { title: mediaTitle, subtitle: part.title ?? undefined },
        }}
        style={styles.video}
        resizeMode="contain"
        controls={controls}
        controlsStyles={{
          seekIncrementMS: 10_000,
          hideSettingButton: false,
          hideNavigationBarOnFullScreenMode: true,
          hideNotificationBarOnFullScreenMode: true,
        }}
        muted={false}
        volume={1}
        selectedAudioTrack={{ type: SelectedTrackType.INDEX, value: 0 }}
        selectedTextTrack={{ type: SelectedTrackType.SYSTEM }}
        progressUpdateInterval={1_000}
        onLoad={(event) => {
          lastProgress.current.duration = event.duration
          if (!event.audioTracks.length) {
            setError("Android could not find a compatible audio track in this file.")
          }
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
          controlsTimer.current = setTimeout(() => setControls(true), 120)
        }}
        onControlsVisibilityChange={(event) => {
          controlsVisible.current = event.isVisible
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
