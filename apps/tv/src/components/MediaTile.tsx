import type { MediaSummary } from "@ploux/contracts"
import { formatRuntime, tmdbImage } from "@ploux/contracts"
import {
  CheckIcon,
  FilmIcon,
  MoreVerticalIcon,
} from "lucide-react-native"
import { Image, Pressable, StyleSheet, Text, View } from "react-native"
import { useState } from "react"

import { colors } from "../theme"
import { FocusIconButton } from "./FocusIconButton"

export function MediaTile({
  item,
  onOpen,
  onToggleWatched,
  onOpenActions,
  busy = false,
}: {
  item: MediaSummary
  onOpen: () => void
  onToggleWatched: () => void
  onOpenActions: () => void
  busy?: boolean
}) {
  const poster = tmdbImage(item.posterPath, "w500")
  const [focused, setFocused] = useState(false)
  return (
    <View style={styles.container}>
      <Pressable
        accessibilityLabel={`Open ${item.title}`}
        onPress={onOpen}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
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
            resizeMode="cover"
          />
        ) : (
          <View style={styles.placeholder}>
            <FilmIcon color={colors.muted} size={42} />
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
      </Pressable>
      <View style={styles.watchedAction}>
        <FocusIconButton
          icon={CheckIcon}
          active={item.watched}
          label={item.watched ? "Mark as unwatched" : "Mark as watched"}
          disabled={busy}
          onPress={onToggleWatched}
        />
      </View>
      <View style={styles.moreAction}>
        <FocusIconButton
          icon={MoreVerticalIcon}
          label={`More options for ${item.title}`}
          disabled={busy}
          onPress={onOpenActions}
        />
      </View>
      <Text numberOfLines={1} style={styles.title}>
        {item.title}
      </Text>
      <Text style={styles.meta}>
        {[
          item.year ?? "Unknown year",
          item.kind === "movie" ? formatRuntime(item.runtimeMinutes) : null,
          item.kind === "movie" ? "Movie" : "TV show",
          item.kind !== "movie"
            ? `${item.partCount} ${item.partCount === 1 ? "ep." : "eps."}`
            : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      </Text>
    </View>
  )
}

const tileWidth = 184

const styles = StyleSheet.create({
  container: {
    width: tileWidth,
    marginRight: 22,
    marginBottom: 32,
    position: "relative",
  },
  focused: {
    borderColor: colors.white,
    transform: [{ scale: 1.04 }],
    elevation: 10,
  },
  pressed: { opacity: 0.75 },
  poster: {
    height: 267,
    borderRadius: 9,
    overflow: "hidden",
    backgroundColor: colors.surface,
    borderWidth: 3,
    borderColor: colors.border,
  },
  image: { width: "100%", height: "100%" },
  placeholder: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: { color: colors.text, fontSize: 15, fontWeight: "700", marginTop: 12 },
  meta: { color: colors.muted, fontSize: 12, marginTop: 4 },
  progressTrack: {
    position: "absolute",
    left: 8,
    right: 8,
    bottom: 8,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#4d463d",
  },
  progress: { height: 4, borderRadius: 2, backgroundColor: colors.primary },
  watchedAction: { position: "absolute", top: 9, left: 9 },
  moreAction: { position: "absolute", top: 9, right: 9 },
  unmatchedBadge: {
    position: "absolute",
    left: 9,
    top: 60,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: "rgba(40,36,31,0.94)",
  },
  unmatchedText: { color: colors.text, fontSize: 10, fontWeight: "800" },
})
