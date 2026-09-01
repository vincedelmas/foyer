import type { MediaFolderSummary } from "@foyer/contracts"
import { tmdbImage } from "@foyer/contracts"
import { FilmIcon, TvIcon } from "lucide-react-native"
import { Image, Pressable, StyleSheet, Text, View } from "react-native"
import { useRef, useState } from "react"

import { colors } from "../theme"

export function CollectionTile({
  folder,
  onOpen,
  onOpenActions,
  hasTVPreferredFocus = false,
}: {
  folder: MediaFolderSummary
  onOpen: () => void
  onOpenActions: () => void
  hasTVPreferredFocus?: boolean
}) {
  const [focused, setFocused] = useState(false)
  const longPressed = useRef(false)
  const TypeIcon = folder.kind === "movies" ? FilmIcon : TvIcon
  const artwork = Array.from({ length: 5 }, (_, index) =>
    tmdbImage(folder.posterPaths[index], "w500")
  )

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityLabel={`Open ${folder.name}`}
        accessibilityHint="Hold Select for collection options"
        android_disableSound
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
          styles.card,
          focused && styles.focused,
          pressed && styles.pressed,
        ]}
      >
        <View style={styles.mosaic}>
          {artwork.map((uri, index) => (
            <View
              key={index}
              style={[
                styles.artwork,
                index === 0 ? styles.artworkLead : styles.artworkSmall,
                index === 1 && styles.artworkOne,
                index === 2 && styles.artworkTwo,
                index === 3 && styles.artworkThree,
                index === 4 && styles.artworkFour,
              ]}
            >
              {uri ? (
                <Image source={{ uri }} style={styles.image} resizeMode="cover" />
              ) : (
                <View style={styles.placeholder}>
                  <TypeIcon color={colors.muted} size={25} />
                </View>
              )}
            </View>
          ))}
        </View>
        <View style={styles.gradient} />
        <View style={styles.copy}>
          <View style={styles.badge}>
            <TypeIcon color={colors.text} size={15} />
            <Text style={styles.badgeText}>
              {folder.kind === "movies" ? "Movies" : "TV shows"}
            </Text>
          </View>
          <Text numberOfLines={1} style={styles.title}>
            {folder.name}
          </Text>
          <Text style={styles.meta}>
            {folder.titleCount} {folder.titleCount === 1 ? "title" : "titles"}
          </Text>
        </View>
        {focused ? (
          <View style={styles.hintBadge}>
            <Text style={styles.hint}>Hold Select for options</Text>
          </View>
        ) : null}
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { width: 244, height: 143, position: "relative" },
  card: {
    flex: 1,
    overflow: "hidden",
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  focused: { borderColor: colors.white, elevation: 12 },
  pressed: { opacity: 0.78 },
  mosaic: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.border,
  },
  artwork: { position: "absolute", overflow: "hidden" },
  artworkLead: { left: 0, top: 0, bottom: 0, width: "45%" },
  artworkSmall: { width: "27.5%", height: "50%" },
  artworkOne: { left: "45%", top: 0 },
  artworkTwo: { right: 0, top: 0 },
  artworkThree: { left: "45%", bottom: 0 },
  artworkFour: { right: 0, bottom: 0 },
  image: { width: "100%", height: "100%" },
  placeholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceRaised,
  },
  gradient: {
    position: "absolute",
    right: 0,
    bottom: 0,
    left: 0,
    top: "30%",
    backgroundColor: "rgba(18,17,15,0.66)",
  },
  copy: { position: "absolute", left: 13, right: 13, bottom: 11, gap: 2 },
  badge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 7,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(40,36,31,0.94)",
  },
  badgeText: { color: colors.text, fontSize: 8, fontWeight: "800" },
  title: { color: colors.text, fontSize: 19, lineHeight: 22, fontWeight: "800" },
  meta: { color: colors.muted, fontSize: 9, fontWeight: "600" },
  hintBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderRadius: 5,
    backgroundColor: "rgba(18,17,15,0.9)",
  },
  hint: { color: colors.primary, fontSize: 8, fontWeight: "800" },
})
