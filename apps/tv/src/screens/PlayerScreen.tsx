import type { MediaPart } from "@ploux/contracts"
import VLCPlayer, {
  VLCHardwareDecoder,
  type VLCPlayerRef,
  type VLCPlayerTracks,
  type VLCProgressEvent,
} from "@lunarr/vlc-player"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  AudioLinesIcon,
  CaptionsIcon,
  PauseIcon,
  PlayIcon,
  RotateCcwIcon,
  RotateCwIcon,
} from "lucide-react-native"
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import {
  ActivityIndicator,
  BackHandler,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native"
import * as ReactNative from "react-native"

import { tvApi } from "../api"
import { FocusButton } from "../components/FocusButton"
import { TvModal } from "../components/TvModal"
import { colors } from "../theme"

const controlsTimeoutMs = 4_500
const seekSeconds = 10

type TrackDialog = "audio" | "subtitle" | null
type TVEvent = { eventType: string; eventKeyAction?: number }

const useTVEventHandler = (
  ReactNative as typeof ReactNative & {
    useTVEventHandler: (handler: (event: TVEvent) => void) => void
  }
).useTVEventHandler

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
  const playerRef = useRef<VLCPlayerRef>(null)
  const lastProgress = useRef({ currentTime: 0, duration: 0 })
  const lastSaved = useRef(0)
  const resumeApplied = useRef(false)
  const preferredSubtitleApplied = useRef(false)
  const playingRef = useRef(false)
  const controlsVisible = useRef(true)
  const controlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [playerKey, setPlayerKey] = useState(0)
  const [controls, setControls] = useState(true)
  const [playing, setPlaying] = useState(false)
  const [buffering, setBuffering] = useState(true)
  const [position, setPosition] = useState(0)
  const [duration, setDuration] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [trackDialog, setTrackDialog] = useState<TrackDialog>(null)
  const [tracks, setTracks] = useState<VLCPlayerTracks>({
    audio: [],
    audioIndex: -1,
    subtitle: [],
    subtitleIndex: -1,
  })
  const defaultExternalSubtitle =
    part.subtitles.find((subtitle) => subtitle.isDefault) ?? null
  const [selectedSubtitle, setSelectedSubtitle] = useState(
    defaultExternalSubtitle ? `external:${defaultExternalSubtitle.id}` : "vlc:-1"
  )
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
  const saveMutation = useRef(save.mutate)
  saveMutation.current = save.mutate

  const source = useMemo(
    () => {
      const streamUrl = new URL(tvApi.absoluteUrl(server, part.streamUrl))
      if (part.mimeType === "video/x-msvideo") {
        streamUrl.searchParams.set("compat", "android-tv")
      }

      return {
        uri: streamUrl.toString(),
        isNetwork: true,
        autoplay: true,
        hwDecoderEnabled: VLCHardwareDecoder.Automatic,
        mediaOptions: [
          ":network-caching=500",
          ":http-reconnect",
          ":deinterlace=auto",
        ],
      }
    },
    [part.mimeType, part.streamUrl, server]
  )

  const clearControlsTimer = useCallback(() => {
    if (!controlsTimer.current) return
    clearTimeout(controlsTimer.current)
    controlsTimer.current = null
  }, [])

  const hideControls = useCallback(() => {
    clearControlsTimer()
    controlsVisible.current = false
    setControls(false)
  }, [clearControlsTimer])

  const scheduleControlsHide = useCallback(() => {
    clearControlsTimer()
    if (!playingRef.current || trackDialog) return
    controlsTimer.current = setTimeout(hideControls, controlsTimeoutMs)
  }, [clearControlsTimer, hideControls, trackDialog])

  const showControls = useCallback(() => {
    controlsVisible.current = true
    setControls(true)
    scheduleControlsHide()
  }, [scheduleControlsHide])

  const updatePlaying = useCallback(
    (value: boolean) => {
      playingRef.current = value
      setPlaying(value)
      if (value) scheduleControlsHide()
      else clearControlsTimer()
    },
    [clearControlsTimer, scheduleControlsHide]
  )

  const saveProgress = useCallback(() => {
    const current = lastProgress.current
    if (current.duration > 0) {
      saveMutation.current({
        positionSeconds: current.currentTime,
        durationSeconds: current.duration,
      })
    }
  }, [])

  const seekTo = useCallback(
    (nextPosition: number) => {
      const maximum = Math.max(0, lastProgress.current.duration - 1)
      const next = Math.max(0, Math.min(maximum, nextPosition))
      playerRef.current?.seek(next)
      lastProgress.current.currentTime = next
      setPosition(next)
      showControls()
    },
    [showControls]
  )

  const seekBy = useCallback(
    (offset: number) => seekTo(lastProgress.current.currentTime + offset),
    [seekTo]
  )

  const togglePlayback = useCallback(() => {
    if (playingRef.current) playerRef.current?.pause()
    else playerRef.current?.play()
    showControls()
  }, [showControls])

  const retryPlayback = useCallback(() => {
    resumeApplied.current = false
    preferredSubtitleApplied.current = false
    lastProgress.current = { currentTime: 0, duration: 0 }
    setPosition(0)
    setDuration(0)
    setError(null)
    setBuffering(true)
    setPlayerKey((value) => value + 1)
    showControls()
  }, [showControls])

  useTVEventHandler(
    useCallback(
      (event) => {
        if (event.eventKeyAction === 1 || trackDialog) return

        const wasHidden = !controlsVisible.current
        if (
          event.eventType === "playPause" ||
          (event.eventType === "play" && !playingRef.current) ||
          (event.eventType === "pause" && playingRef.current)
        ) {
          togglePlayback()
          return
        }
        if (["rewind", "longRewind"].includes(event.eventType)) {
          seekBy(-seekSeconds)
          return
        }
        if (["fastForward", "longFastForward"].includes(event.eventType)) {
          seekBy(seekSeconds)
          return
        }
        if (wasHidden && event.eventType === "select") {
          showControls()
          return
        }
        if (wasHidden && ["left", "longLeft"].includes(event.eventType)) {
          seekBy(-seekSeconds)
          return
        }
        if (wasHidden && ["right", "longRight"].includes(event.eventType)) {
          seekBy(seekSeconds)
          return
        }
        if (["up", "down", "left", "right", "select"].includes(event.eventType)) {
          showControls()
        }
      },
      [seekBy, showControls, togglePlayback, trackDialog]
    )
  )

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (trackDialog) return false
        if (controlsVisible.current) {
          hideControls()
          return true
        }
        saveProgress()
        onBack()
        return true
      }
    )
    return () => subscription.remove()
  }, [hideControls, onBack, saveProgress, trackDialog])

  useEffect(
    () => () => {
      clearControlsTimer()
      saveProgress()
    },
    [clearControlsTimer, saveProgress]
  )

  useEffect(() => {
    if (trackDialog) clearControlsTimer()
    else if (playingRef.current) scheduleControlsHide()
  }, [clearControlsTimer, scheduleControlsHide, trackDialog])

  const handleProgress = useCallback(
    (event: VLCProgressEvent) => {
      const nextDuration =
        event.duration > 0 ? event.duration : lastProgress.current.duration
      lastProgress.current = {
        currentTime: Math.max(0, event.currentTime),
        duration: Math.max(0, nextDuration),
      }
      setPosition(lastProgress.current.currentTime)
      if (nextDuration > 0) setDuration(nextDuration)
      if (Date.now() - lastSaved.current >= 10_000) {
        lastSaved.current = Date.now()
        saveProgress()
      }
    },
    [saveProgress]
  )

  const handlePlaying = useCallback(() => {
    setBuffering(false)
    setError(null)
    updatePlaying(true)

    if (!resumeApplied.current) {
      resumeApplied.current = true
      if (
        part.progress &&
        !part.progress.completed &&
        part.progress.positionSeconds > 0
      ) {
        playerRef.current?.seek(part.progress.positionSeconds)
      }
    }

    playerRef.current?.getTracks()
    if (!preferredSubtitleApplied.current && defaultExternalSubtitle) {
      preferredSubtitleApplied.current = true
      playerRef.current?.setSubtitleFile(
        tvApi.absoluteUrl(server, defaultExternalSubtitle.url)
      )
    }
  }, [defaultExternalSubtitle, part.progress, server, updatePlaying])

  const handleEnd = useCallback(() => {
    const finalDuration = lastProgress.current.duration
    lastProgress.current.currentTime = finalDuration
    setPosition(finalDuration)
    updatePlaying(false)
    saveProgress()
  }, [saveProgress, updatePlaying])

  const handleTracks = useCallback((nextTracks: VLCPlayerTracks) => {
    setTracks(nextTracks)
    setSelectedSubtitle((current) =>
      current.startsWith("external:")
        ? current
        : `vlc:${nextTracks.subtitleIndex}`
    )
  }, [])

  const selectAudioTrack = (trackId: number) => {
    playerRef.current?.selectAudioTrack(trackId)
    setTracks((current) => ({ ...current, audioIndex: trackId }))
    setTrackDialog(null)
    showControls()
  }

  const selectEmbeddedSubtitle = (trackId: number) => {
    playerRef.current?.selectSubtitleTrack(trackId)
    setSelectedSubtitle(`vlc:${trackId}`)
    setTrackDialog(null)
    showControls()
  }

  const selectExternalSubtitle = (subtitleId: string, url: string) => {
    playerRef.current?.setSubtitleFile(tvApi.absoluteUrl(server, url))
    setSelectedSubtitle(`external:${subtitleId}`)
    setTrackDialog(null)
    showControls()
  }

  const progress = duration > 0 ? Math.min(1, position / duration) : 0
  const selectedAudio = tracks.audio.find(
    (track) => track.id === tracks.audioIndex
  )

  return (
    <View style={styles.screen}>
      <VLCPlayer
        key={playerKey}
        ref={playerRef}
        source={source}
        style={styles.video}
        autoplay
        resizeMode="contain"
        volume={100}
        progressUpdateInterval={1_000}
        continueAudioInBackground={false}
        showNowPlaying={false}
        nowPlayingMetadata={{ title: mediaTitle, album: part.title ?? undefined }}
        onLoadStart={() => setBuffering(true)}
        onLoad={(event) => {
          if (event.duration > 0) {
            lastProgress.current.duration = event.duration
            setDuration(event.duration)
          }
        }}
        onBuffer={(event) => setBuffering((event.bufferRate ?? 0) < 100)}
        onPlaying={handlePlaying}
        onPaused={() => updatePlaying(false)}
        onProgress={handleProgress}
        onSeek={handleProgress}
        onTracks={handleTracks}
        onEnd={handleEnd}
        onError={() => {
          setBuffering(false)
          updatePlaying(false)
          setError(
            "LibVLC could not open or decode this file while direct-playing it."
          )
          showControls()
        }}
      />

      {buffering && !error ? (
        <View pointerEvents="none" style={styles.loading}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : null}

      {!controls && !error && !trackDialog ? (
        <Pressable
          accessibilityLabel="Show playback controls"
          accessibilityRole="button"
          android_disableSound
          focusable
          hasTVPreferredFocus
          onPress={showControls}
          style={styles.remoteCapture}
        />
      ) : null}

      {controls && !error ? (
        <View style={styles.controls}>
          <View style={styles.heading}>
            <Text numberOfLines={1} style={styles.title}>
              {mediaTitle}
            </Text>
            {part.title ? (
              <Text numberOfLines={1} style={styles.partTitle}>
                {part.title}
              </Text>
            ) : null}
          </View>

          <View style={styles.timeline}>
            <View style={styles.progressTrack}>
              <View
                style={[styles.progressFill, { width: `${progress * 100}%` }]}
              />
            </View>
            <View style={styles.timeRow}>
              <Text style={styles.time}>{formatTime(position)}</Text>
              <Text style={styles.time}>{formatTime(duration)}</Text>
            </View>
          </View>

          <View style={styles.actions}>
            <FocusButton
              label="Back 10s"
              icon={RotateCcwIcon}
              variant="secondary"
              size="small"
              onFocus={showControls}
              onPress={() => seekBy(-seekSeconds)}
            />
            <FocusButton
              label={playing ? "Pause" : "Play"}
              icon={playing ? PauseIcon : PlayIcon}
              size="small"
              hasTVPreferredFocus
              onFocus={showControls}
              onPress={togglePlayback}
            />
            <FocusButton
              label="Forward 10s"
              icon={RotateCwIcon}
              variant="secondary"
              size="small"
              onFocus={showControls}
              onPress={() => seekBy(seekSeconds)}
            />
            <FocusButton
              label="Audio"
              icon={AudioLinesIcon}
              variant="secondary"
              size="small"
              disabled={!tracks.audio.length}
              onFocus={showControls}
              onPress={() => setTrackDialog("audio")}
            />
            <FocusButton
              label="Subtitles"
              icon={CaptionsIcon}
              variant="secondary"
              size="small"
              disabled={!tracks.subtitle.length && !part.subtitles.length}
              onFocus={showControls}
              onPress={() => setTrackDialog("subtitle")}
            />
          </View>

          <Text numberOfLines={1} style={styles.trackSummary}>
            Direct play · VLC hardware decoding
            {selectedAudio ? ` · ${selectedAudio.name}` : ""}
          </Text>
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorPanel}>
          <Text style={styles.errorTitle}>Playback failed</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.errorHint}>
            {part.fileName} · {part.mimeType}. The server sent the original media
            without transcoding.
          </Text>
          <View style={styles.errorActions}>
            <FocusButton
              label="Try again"
              icon={PlayIcon}
              hasTVPreferredFocus
              onPress={retryPlayback}
            />
            <FocusButton
              label="Back"
              variant="secondary"
              onPress={onBack}
            />
          </View>
        </View>
      ) : null}

      <TrackPicker
        visible={trackDialog === "audio"}
        tracks={tracks.audio}
        selectedId={tracks.audioIndex}
        onSelect={selectAudioTrack}
        onClose={() => {
          setTrackDialog(null)
          showControls()
        }}
      />

      <SubtitlePicker
        visible={trackDialog === "subtitle"}
        tracks={tracks.subtitle}
        externalTracks={part.subtitles}
        selected={selectedSubtitle}
        onSelectEmbedded={selectEmbeddedSubtitle}
        onSelectExternal={selectExternalSubtitle}
        onClose={() => {
          setTrackDialog(null)
          showControls()
        }}
      />
    </View>
  )
}

function TrackPicker({
  visible,
  tracks,
  selectedId,
  onSelect,
  onClose,
}: {
  visible: boolean
  tracks: VLCPlayerTracks["audio"]
  selectedId: number
  onSelect: (trackId: number) => void
  onClose: () => void
}) {
  return (
    <TvModal
      visible={visible}
      title="Audio track"
      description="Audio is decoded on the Shield; the server keeps direct-playing the original file."
      onClose={onClose}
      width={560}
      scroll
    >
      <View style={styles.trackList}>
        {tracks.map((track, index) => (
          <FocusButton
            key={track.id}
            label={track.name || `Audio track ${index + 1}`}
            variant={track.id === selectedId ? "primary" : "secondary"}
            hasTVPreferredFocus={
              track.id === selectedId || (selectedId < 0 && index === 0)
            }
            onPress={() => onSelect(track.id)}
          />
        ))}
      </View>
    </TvModal>
  )
}

function SubtitlePicker({
  visible,
  tracks,
  externalTracks,
  selected,
  onSelectEmbedded,
  onSelectExternal,
  onClose,
}: {
  visible: boolean
  tracks: VLCPlayerTracks["subtitle"]
  externalTracks: MediaPart["subtitles"]
  selected: string
  onSelectEmbedded: (trackId: number) => void
  onSelectExternal: (subtitleId: string, url: string) => void
  onClose: () => void
}) {
  return (
    <TvModal
      visible={visible}
      title="Subtitles"
      description="Choose an embedded or external subtitle track."
      onClose={onClose}
      width={620}
      scroll
    >
      <View style={styles.trackList}>
        <FocusButton
          label="Off"
          variant={selected === "vlc:-1" ? "primary" : "secondary"}
          hasTVPreferredFocus={selected === "vlc:-1"}
          onPress={() => onSelectEmbedded(-1)}
        />
        {tracks.map((track) => (
          <FocusButton
            key={`vlc:${track.id}`}
            label={track.name || "Embedded subtitle"}
            variant={selected === `vlc:${track.id}` ? "primary" : "secondary"}
            hasTVPreferredFocus={selected === `vlc:${track.id}`}
            onPress={() => onSelectEmbedded(track.id)}
          />
        ))}
        {externalTracks.map((track) => (
          <FocusButton
            key={`external:${track.id}`}
            label={`${track.label} · ${track.format.toUpperCase()}`}
            variant={
              selected === `external:${track.id}` ? "primary" : "secondary"
            }
            hasTVPreferredFocus={selected === `external:${track.id}`}
            onPress={() => onSelectExternal(track.id, track.url)}
          />
        ))}
      </View>
    </TvModal>
  )
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00"
  const total = Math.floor(seconds)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const rest = total % 60
  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`
    : `${minutes}:${String(rest).padStart(2, "0")}`
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.black },
  video: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
  loading: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  remoteCapture: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  controls: {
    position: "absolute",
    right: 0,
    bottom: 0,
    left: 0,
    paddingHorizontal: 42,
    paddingTop: 34,
    paddingBottom: 28,
    gap: 14,
    backgroundColor: "rgba(0,0,0,0.84)",
  },
  heading: { gap: 3 },
  title: { color: colors.text, fontSize: 22, fontWeight: "800" },
  partTitle: { color: colors.muted, fontSize: 12 },
  timeline: { gap: 7 },
  progressTrack: {
    height: 5,
    overflow: "hidden",
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.24)",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  time: { color: colors.muted, fontSize: 11, fontVariant: ["tabular-nums"] },
  actions: { flexDirection: "row", alignItems: "center", gap: 10 },
  trackSummary: { color: colors.muted, fontSize: 10 },
  trackList: { gap: 9 },
  errorPanel: {
    position: "absolute",
    width: 650,
    alignSelf: "center",
    top: "31%",
    padding: 30,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  errorTitle: { color: colors.text, fontSize: 24, fontWeight: "800" },
  errorText: { color: colors.danger, fontSize: 14, lineHeight: 20 },
  errorHint: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  errorActions: { flexDirection: "row", gap: 10, marginTop: 5 },
})
