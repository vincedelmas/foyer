import type { MediaSummary } from "@ploux/contracts"
import { tmdbImage } from "@ploux/contracts"
import { FilmIcon } from "lucide-react-native"
import { Image, Pressable, StyleSheet, Text, View } from "react-native"
import { useState } from "react"

import { colors } from "../theme"

export function MediaTile({
  item,
  onPress,
}: {
  item: MediaSummary
  onPress: () => void
}) {
  const poster = tmdbImage(item.posterPath, "w500")
  const [focused, setFocused] = useState(false)
  return (
    <Pressable
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => [
        styles.container,
        focused && styles.focused,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.poster}>
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
        {item.progress && item.progress.positionSeconds > 0 ? (
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progress,
                { width: `${item.progress.percentage}%` },
              ]}
            />
          </View>
        ) : null}
      </View>
      <Text numberOfLines={1} style={styles.title}>
        {item.title}
      </Text>
      <Text style={styles.meta}>
        {item.year ?? "—"} ·{" "}
        {item.kind === "movie"
          ? "Movie"
          : item.kind === "anime"
            ? "Anime"
            : "Series"}
      </Text>
    </Pressable>
  )
}

const tileWidth = 184

const styles = StyleSheet.create({
  container: {
    width: tileWidth,
    marginRight: 22,
    marginBottom: 32,
    borderRadius: 13,
    borderWidth: 3,
    borderColor: "transparent",
    padding: 5,
  },
  focused: {
    borderColor: colors.white,
    backgroundColor: colors.surfaceRaised,
    transform: [{ scale: 1.055 }],
    elevation: 10,
  },
  pressed: { opacity: 0.75 },
  poster: {
    height: 267,
    borderRadius: 9,
    overflow: "hidden",
    backgroundColor: colors.surface,
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
})
