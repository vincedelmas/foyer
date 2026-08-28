import type { MediaSummary } from "@ploux/contracts"
import { formatRuntime, tmdbImage } from "@ploux/contracts"
import { CheckIcon, FilmIcon } from "lucide-react-native"
import { Image, Pressable, StyleSheet, Text, View } from "react-native"
import { useRef, useState } from "react"

import { colors } from "../theme"

export function MediaTile({
  item,
  onOpen,
  onOpenActions,
  hasTVPreferredFocus = false,
}: {
  item: MediaSummary
  onOpen: () => void
  onOpenActions: () => void
  hasTVPreferredFocus?: boolean
}) {
  const poster = tmdbImage(item.posterPath, "w500")
  const [focused, setFocused] = useState(false)
  const longPressed = useRef(false)
  return (
    <View style={styles.container}>
      <Pressable
        accessibilityLabel={`Open ${item.title}`}
        accessibilityHint="Hold Select for title options"
        hasTVPreferredFocus={hasTVPreferredFocus}
        delayLongPress={550}
        onLongPress={() => {
          longPressed.current = true
          onOpenActions()
        }}
        onPress={() => {
          if (longPressed.current) {
            longPressed.current = false
            return
          }
          onOpen()
        }}
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
        {item.watched ? (
          <View style={styles.watchedBadge}>
            <CheckIcon color={colors.primaryText} size={13} strokeWidth={3} />
          </View>
        ) : null}
        {focused ? (
          <View style={styles.hintBadge}>
            <Text style={styles.hintText}>Hold Select for options</Text>
          </View>
        ) : null}
      </Pressable>
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

const tileWidth = 132

const styles = StyleSheet.create({
  container: {
    width: tileWidth,
    marginRight: 14,
    marginBottom: 22,
    position: "relative",
  },
  focused: {
    borderColor: colors.white,
    transform: [{ scale: 1.04 }],
    elevation: 10,
  },
  pressed: { opacity: 0.75 },
  poster: {
    height: 192,
    borderRadius: 7,
    overflow: "hidden",
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
  },
  image: { width: "100%", height: "100%" },
  placeholder: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: { color: colors.text, fontSize: 12, fontWeight: "700", marginTop: 8 },
  meta: { color: colors.muted, fontSize: 9, marginTop: 3 },
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
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  hintBadge: {
    position: "absolute",
    left: 7,
    right: 7,
    bottom: 14,
    paddingHorizontal: 6,
    paddingVertical: 5,
    borderRadius: 5,
    backgroundColor: "rgba(18,17,15,0.9)",
  },
  hintText: { color: colors.text, fontSize: 8, fontWeight: "800", textAlign: "center" },
  unmatchedBadge: {
    position: "absolute",
    right: 7,
    top: 7,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 5,
    backgroundColor: "rgba(40,36,31,0.94)",
  },
  unmatchedText: { color: colors.text, fontSize: 8, fontWeight: "800" },
})
