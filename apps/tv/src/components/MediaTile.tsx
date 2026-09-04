import type { MediaDetail, MediaSummary } from "@foyer/contracts"
import { formatRuntime, tmdbImage } from "@foyer/contracts"
import { useQueryClient } from "@tanstack/react-query"
import { Image } from "expo-image"
import { CheckIcon, FilmIcon } from "lucide-react-native"
import { memo, useEffect, useRef, useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"

import { mediaOptions } from "../query-options"
import { colors } from "../theme"

export const MEDIA_TILE_WIDTH = 130
export const MEDIA_TILE_ROW_HEIGHT = 254

export const MediaTile = memo(function MediaTile({
  server,
  item,
  onOpen,
  onOpenActions,
  onFocusItem,
  hasTVPreferredFocus = false,
}: {
  server: string
  item: MediaSummary
  onOpen: (item: MediaSummary) => void
  onOpenActions: (item: MediaSummary) => void
  onFocusItem?: (item: MediaSummary) => void
  hasTVPreferredFocus?: boolean
}) {
  const poster = tmdbImage(item.posterPath, "w342")
  const posterRef = useRef<View & { requestTVFocus: () => void }>(null)
  const prefetchTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const queryClient = useQueryClient()
  const episodeProgress =
    item.kind !== "movie" && item.progress?.positionSeconds && !item.progress.completed
      ? [
          item.nextPartSeasonNumber === null
            ? null
            : `S${item.nextPartSeasonNumber}`,
          item.nextPartEpisodeNumber === null
            ? item.nextPartTitle
            : `E${item.nextPartEpisodeNumber}`,
        ]
          .filter(Boolean)
          .join(" · ")
      : null
  const episodeStatus =
    item.kind === "movie"
      ? null
      : typeof item.unwatchedPartCount === "number"
        ? item.unwatchedPartCount === 0
          ? "All watched"
          : `${item.unwatchedPartCount} ${item.unwatchedPartCount === 1 ? "episode" : "episodes"} left`
        : `${item.partCount} ${item.partCount === 1 ? "episode" : "episodes"}`
  const [focused, setFocused] = useState(false)
  const longPressed = useRef(false)

  useEffect(() => {
    if (hasTVPreferredFocus) posterRef.current?.requestTVFocus()
  }, [hasTVPreferredFocus])

  useEffect(
    () => () => {
      clearTimeout(prefetchTimer.current)
    },
    []
  )

  return (
    <View style={styles.container}>
      <Pressable
        ref={posterRef}
        accessibilityLabel={`Open ${item.title}`}
        accessibilityHint="Hold Select for title options"
        android_disableSound
        hasTVPreferredFocus={hasTVPreferredFocus}
        delayLongPress={550}
        onLongPress={() => {
          longPressed.current = true
          onOpenActions(item)
        }}
        onPress={() => {
          if (longPressed.current) {
            longPressed.current = false
            return
          }
          onOpen(item)
        }}
        onFocus={() => {
          setFocused(true)
          onFocusItem?.(item)
          clearTimeout(prefetchTimer.current)
          prefetchTimer.current = setTimeout(() => {
            const options = mediaOptions(server, item.id, {
              season: item.nextPartSeasonNumber ?? undefined,
              pageSize: 50,
            })
            void queryClient.prefetchQuery(options).then(() => {
              const detail = queryClient.getQueryData<MediaDetail>(
                options.queryKey
              )
              const artwork = [
                tmdbImage(detail?.posterPath, "w500"),
                tmdbImage(detail?.backdropPath, "w1280"),
              ].filter((uri): uri is string => Boolean(uri))
              if (artwork.length) void Image.prefetch(artwork, "memory-disk")
            })
          }, 220)
        }}
        onBlur={() => {
          setFocused(false)
          clearTimeout(prefetchTimer.current)
        }}
        style={({ pressed }) => [
          styles.poster,
          focused && styles.focused,
          pressed && styles.pressed,
        ]}
      >
        {poster ? (
          <Image
            source={{ uri: poster }}
            style={styles.image}
            contentFit="cover"
            cachePolicy="memory-disk"
            recyclingKey={item.id}
          />
        ) : (
          <View style={styles.placeholder}>
            <FilmIcon color={colors.muted} size={36} />
          </View>
        )}
        {item.progress &&
        item.progress.positionSeconds > 0 &&
        !item.progress.completed ? (
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progress,
                { width: `${item.progress.percentage}%` },
              ]}
            />
          </View>
        ) : null}
        {item.metadataStatus === "unmatched" ? (
          <View style={styles.unmatchedBadge}>
            <Text style={styles.unmatchedText}>Unmatched</Text>
          </View>
        ) : null}
        {item.watched ? (
          <View style={styles.watchedBadge}>
            <CheckIcon color={colors.primaryText} size={11} strokeWidth={3} />
          </View>
        ) : null}
      </Pressable>
      <Text numberOfLines={1} style={styles.title}>
        {item.title}
      </Text>
      <Text numberOfLines={2} style={styles.meta}>
        {[
          item.year ?? "Unknown year",
          item.kind === "movie" ? formatRuntime(item.runtimeMinutes) : null,
          episodeProgress ? `${episodeProgress} · ${item.progress?.percentage}%` : null,
          episodeStatus,
        ]
          .filter(Boolean)
          .join(" · ")}
      </Text>
    </View>
  )
})

const styles = StyleSheet.create({
  container: {
    width: MEDIA_TILE_WIDTH,
    height: MEDIA_TILE_ROW_HEIGHT,
    position: "relative",
  },
  focused: {
    borderColor: colors.white,
    transform: [{ scale: 1.035 }],
    elevation: 10,
  },
  pressed: { opacity: 0.75 },
  poster: {
    height: 190,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  image: { width: "100%", height: "100%" },
  placeholder: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: { color: colors.text, fontSize: 14, lineHeight: 18, fontWeight: "700", marginTop: 8 },
  meta: { color: colors.muted, fontSize: 11, lineHeight: 15, marginTop: 3 },
  progressTrack: {
    position: "absolute",
    left: 6,
    right: 6,
    bottom: 6,
    height: 3,
    borderRadius: 2,
    backgroundColor: "#4d463d",
  },
  progress: { height: 3, borderRadius: 2, backgroundColor: colors.primary },
  watchedBadge: {
    position: "absolute",
    top: 7,
    left: 7,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  unmatchedBadge: {
    position: "absolute",
    right: 7,
    top: 7,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 5,
    backgroundColor: "rgba(40,36,31,0.94)",
  },
  unmatchedText: { color: colors.text, fontSize: 10, fontWeight: "800" },
})
