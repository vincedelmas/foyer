import type { MediaKind, MediaSummary } from "@ploux/contracts"
import { tmdbImage } from "@ploux/contracts"
import { useQuery } from "@tanstack/react-query"
import { FilmIcon, PlayIcon, SettingsIcon } from "lucide-react-native"
import {
  FlatList,
  Image,
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native"
import { useState } from "react"

import { FocusButton } from "../components/FocusButton"
import { MediaTile } from "../components/MediaTile"
import { tvApi } from "../api"
import { colors, spacing } from "../theme"

const categories: Array<{ label: string; value?: MediaKind }> = [
  { label: "Home" },
  { label: "Movies", value: "movie" },
  { label: "Series", value: "series" },
  { label: "Anime", value: "anime" },
]

export function LibraryScreen({
  server,
  onOpenMedia,
  onOpenSettings,
}: {
  server: string
  onOpenMedia: (item: MediaSummary) => void
  onOpenSettings: () => void
}) {
  const [kind, setKind] = useState<MediaKind | undefined>()
  const [focusedCategory, setFocusedCategory] = useState<string | null>(null)
  const library = useQuery({
    queryKey: ["tv-library", server, kind],
    queryFn: () => tvApi.library(server, kind),
  })
  const featured =
    library.data?.items.find((item) => item.backdropPath) ??
    library.data?.items[0]

  return (
    <View style={styles.screen}>
      <FlatList
        data={library.data?.items ?? []}
        numColumns={6}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        columnWrapperStyle={styles.row}
        ListHeaderComponent={
          <View>
            <View style={styles.header}>
              <View style={styles.brand}>
                <Image
                  source={require("../../assets/icon.png")}
                  style={styles.logo}
                />
                <Text style={styles.brandText}>Ploux</Text>
              </View>
              <View style={styles.navigation}>
                {categories.map((category) => (
                  <Pressable
                    key={category.label}
                    onPress={() => setKind(category.value)}
                    onFocus={() => setFocusedCategory(category.label)}
                    onBlur={() => setFocusedCategory(null)}
                    style={[
                      styles.navItem,
                      kind === category.value && styles.navActive,
                      focusedCategory === category.label && styles.navFocused,
                    ]}
                  >
                    <Text style={styles.navLabel}>{category.label}</Text>
                  </Pressable>
                ))}
              </View>
              <FocusButton
                label="Settings"
                icon={SettingsIcon}
                variant="ghost"
                onPress={onOpenSettings}
              />
            </View>

            {featured && !kind ? (
              <Hero item={featured} onPress={() => onOpenMedia(featured)} />
            ) : null}

            <View style={styles.libraryHeading}>
              <View>
                <Text style={styles.eyebrow}>
                  {library.data
                    ? `${library.data.stats.titles} TITLES AT HOME`
                    : "OPENING THE ARCHIVE"}
                </Text>
                <Text style={styles.heading}>
                  {kind === "movie"
                    ? "Movies"
                    : kind === "series"
                      ? "Series"
                      : kind === "anime"
                        ? "Anime"
                        : "The archive"}
                </Text>
              </View>
              {library.isFetching ? (
                <Text style={styles.loading}>Refreshing…</Text>
              ) : null}
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <MediaTile item={item} onPress={() => onOpenMedia(item)} />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <FilmIcon color={colors.muted} size={52} />
            <Text style={styles.emptyTitle}>
              {library.isError
                ? "Could not reach Ploux"
                : library.isPending
                  ? "Reading your shelves…"
                  : "No titles here yet"}
            </Text>
            <Text style={styles.emptyDescription}>
              {library.isError
                ? library.error.message
                : "Add and scan a media folder from the web dashboard."}
            </Text>
          </View>
        }
      />
    </View>
  )
}

function Hero({ item, onPress }: { item: MediaSummary; onPress: () => void }) {
  const backdrop = tmdbImage(item.backdropPath, "w1280")
  return (
    <ImageBackground
      source={backdrop ? { uri: backdrop } : undefined}
      style={styles.hero}
      imageStyle={styles.heroImage}
    >
      <View style={styles.heroOverlay}>
        <View style={styles.heroCopy}>
          <Text style={styles.heroEyebrow}>FEATURED FROM YOUR ARCHIVE</Text>
          <Text numberOfLines={2} style={styles.heroTitle}>
            {item.title}
          </Text>
          <Text style={styles.heroMeta}>
            {item.year ?? "Unknown year"} ·{" "}
            {item.kind === "movie"
              ? "Movie"
              : item.kind === "anime"
                ? "Anime"
                : "Series"}
          </Text>
          {item.overview ? (
            <Text numberOfLines={3} style={styles.overview}>
              {item.overview}
            </Text>
          ) : null}
          <View style={styles.heroActions}>
            <FocusButton
              label={item.progress?.positionSeconds ? "Resume" : "Open"}
              icon={PlayIcon}
              hasTVPreferredFocus
              onPress={onPress}
            />
          </View>
        </View>
      </View>
    </ImageBackground>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.page, paddingBottom: 70 },
  row: { justifyContent: "flex-start" },
  header: { height: 90, flexDirection: "row", alignItems: "center", gap: 36 },
  brand: { flexDirection: "row", alignItems: "center", gap: 12 },
  logo: { width: 42, height: 42, borderRadius: 10 },
  brandText: {
    color: colors.text,
    fontSize: 27,
    fontWeight: "800",
    letterSpacing: -1,
  },
  navigation: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6 },
  navItem: {
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: "transparent",
  },
  navActive: { backgroundColor: colors.surfaceRaised },
  navFocused: { borderColor: colors.white, transform: [{ scale: 1.06 }] },
  navLabel: { color: colors.text, fontWeight: "700", fontSize: 15 },
  hero: {
    height: 480,
    marginHorizontal: -spacing.page,
    marginBottom: 50,
    backgroundColor: colors.surface,
  },
  heroImage: { opacity: 0.75 },
  heroOverlay: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.page,
    backgroundColor: "rgba(18,17,15,0.46)",
  },
  heroCopy: { width: "52%", gap: 14 },
  heroEyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 2.2,
  },
  heroTitle: {
    color: colors.text,
    fontSize: 56,
    lineHeight: 59,
    fontWeight: "800",
    letterSpacing: -1.5,
  },
  heroMeta: { color: colors.muted, fontSize: 15, fontWeight: "600" },
  overview: { color: colors.text, opacity: 0.82, fontSize: 16, lineHeight: 25 },
  heroActions: { flexDirection: "row", marginTop: 8 },
  libraryHeading: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginBottom: 26,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 2,
  },
  heading: {
    color: colors.text,
    fontSize: 40,
    fontWeight: "800",
    letterSpacing: -1.2,
    marginTop: 7,
  },
  loading: { color: colors.muted, marginBottom: 8 },
  empty: {
    height: 330,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  emptyTitle: { color: colors.text, fontSize: 25, fontWeight: "700" },
  emptyDescription: { color: colors.muted, fontSize: 15 },
})
