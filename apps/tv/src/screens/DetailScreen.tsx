import type { MediaPart, MediaSummary } from "@ploux/contracts"
import { formatRuntime, tmdbImage } from "@ploux/contracts"
import { useQuery } from "@tanstack/react-query"
import { ArrowLeftIcon, CheckCircle2Icon, PlayIcon } from "lucide-react-native"
import { useEffect, useState } from "react"
import {
  BackHandler,
  Image,
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native"

import { tvApi } from "../api"
import { FocusButton } from "../components/FocusButton"
import { colors, spacing } from "../theme"

export function DetailScreen({
  server,
  summary,
  onBack,
  onPlay,
}: {
  server: string
  summary: MediaSummary
  onBack: () => void
  onPlay: (part: MediaPart) => void
}) {
  const media = useQuery({
    queryKey: ["tv-media", server, summary.id],
    queryFn: () => tvApi.media(server, summary.id),
  })
  const [focusedPart, setFocusedPart] = useState<string | null>(null)

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        onBack()
        return true
      }
    )
    return () => subscription.remove()
  }, [onBack])

  if (media.isPending) return <CenteredMessage title="Opening title…" />
  if (media.isError)
    return (
      <CenteredMessage
        title="Could not open title"
        description={media.error.message}
        onBack={onBack}
      />
    )

  const item = media.data
  const backdrop = tmdbImage(item.backdropPath, "w1280")
  const poster = tmdbImage(item.posterPath, "w500")
  const nextPart =
    item.parts.find((part) => part.id === item.nextPartId) ?? item.parts[0]

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <ImageBackground
        source={backdrop ? { uri: backdrop } : undefined}
        style={styles.hero}
        imageStyle={styles.heroImage}
      >
        <View style={styles.overlay}>
          <View style={styles.topBar}>
            <FocusButton
              label="Library"
              icon={ArrowLeftIcon}
              variant="ghost"
              onPress={onBack}
            />
          </View>
          <View style={styles.heroContent}>
            <View style={styles.poster}>
              {poster ? (
                <Image source={{ uri: poster }} style={styles.posterImage} />
              ) : null}
            </View>
            <View style={styles.copy}>
              <Text style={styles.eyebrow}>
                {item.kind === "movie"
                  ? "MOVIE"
                  : item.kind === "anime"
                    ? "ANIME"
                    : "SERIES"}
              </Text>
              <Text numberOfLines={2} style={styles.title}>
                {item.title}
              </Text>
              <Text style={styles.meta}>
                {[
                  item.year,
                  formatRuntime(item.runtimeMinutes),
                  item.contentRating,
                ]
                  .filter(Boolean)
                  .join("  ·  ")}
              </Text>
              {item.overview ? (
                <Text numberOfLines={4} style={styles.overview}>
                  {item.overview}
                </Text>
              ) : null}
              <View style={styles.actions}>
                {nextPart ? (
                  <FocusButton
                    label={
                      nextPart.progress?.positionSeconds &&
                      !nextPart.progress.completed
                        ? `Resume · ${nextPart.progress.percentage}%`
                        : "Play"
                    }
                    icon={PlayIcon}
                    hasTVPreferredFocus
                    onPress={() => onPlay(nextPart)}
                  />
                ) : null}
              </View>
            </View>
          </View>
        </View>
      </ImageBackground>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {item.kind === "movie" ? "Playback" : "Episodes"}
        </Text>
        <View style={styles.episodes}>
          {item.parts.map((part, index) => (
            <Pressable
              key={part.id}
              onPress={() => onPlay(part)}
              onFocus={() => setFocusedPart(part.id)}
              onBlur={() => setFocusedPart(null)}
              style={[
                styles.episode,
                focusedPart === part.id && styles.episodeFocused,
              ]}
            >
              <View style={styles.episodeNumber}>
                <Text style={styles.episodeNumberText}>
                  {part.episodeNumber ?? index + 1}
                </Text>
              </View>
              <View style={styles.episodeCopy}>
                <Text numberOfLines={1} style={styles.episodeTitle}>
                  {part.title ||
                    (part.episodeNumber
                      ? `Episode ${part.episodeNumber}`
                      : "Feature")}
                </Text>
                <Text numberOfLines={1} style={styles.episodeMeta}>
                  {part.fileName}
                </Text>
              </View>
              {part.subtitles.length ? (
                <Text style={styles.subtitleCount}>
                  CC · {part.subtitles.length}
                </Text>
              ) : null}
              {part.progress?.completed ? (
                <CheckCircle2Icon color={colors.primary} size={24} />
              ) : null}
              <PlayIcon color={colors.text} size={24} />
            </Pressable>
          ))}
        </View>
      </View>

      {item.cast.length ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cast</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {item.cast.map((person) => {
              const profile = tmdbImage(person.profilePath, "w342")
              return (
                <View key={person.id} style={styles.person}>
                  <View style={styles.avatar}>
                    {profile ? (
                      <Image
                        source={{ uri: profile }}
                        style={styles.avatarImage}
                      />
                    ) : null}
                  </View>
                  <Text numberOfLines={1} style={styles.personName}>
                    {person.name}
                  </Text>
                  <Text numberOfLines={1} style={styles.character}>
                    {person.character || "Cast"}
                  </Text>
                </View>
              )
            })}
          </ScrollView>
        </View>
      ) : null}
    </ScrollView>
  )
}

function CenteredMessage({
  title,
  description,
  onBack,
}: {
  title: string
  description?: string
  onBack?: () => void
}) {
  return (
    <View style={styles.centered}>
      <Text style={styles.centeredTitle}>{title}</Text>
      {description ? (
        <Text style={styles.centeredDescription}>{description}</Text>
      ) : null}
      {onBack ? <FocusButton label="Back to library" onPress={onBack} /> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 80 },
  hero: { height: 630, backgroundColor: colors.surface },
  heroImage: { opacity: 0.58 },
  overlay: { flex: 1, backgroundColor: "rgba(18,17,15,0.46)" },
  topBar: {
    height: 86,
    paddingHorizontal: spacing.page,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  heroContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 36,
    paddingHorizontal: spacing.page,
    paddingBottom: 56,
  },
  poster: {
    width: 210,
    height: 315,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: colors.surfaceRaised,
    elevation: 12,
  },
  posterImage: { width: "100%", height: "100%" },
  copy: { flex: 1, maxWidth: 850, gap: 13 },
  eyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 2.2,
  },
  title: {
    color: colors.text,
    fontSize: 57,
    lineHeight: 60,
    fontWeight: "800",
    letterSpacing: -1.4,
  },
  meta: { color: colors.muted, fontSize: 16, fontWeight: "700" },
  overview: {
    color: colors.text,
    opacity: 0.82,
    fontSize: 16,
    lineHeight: 25,
    maxWidth: 800,
  },
  actions: { flexDirection: "row", marginTop: 10 },
  section: { paddingHorizontal: spacing.page, marginTop: 48 },
  sectionTitle: {
    color: colors.text,
    fontSize: 33,
    fontWeight: "800",
    letterSpacing: -0.7,
    marginBottom: 22,
  },
  episodes: {
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
  },
  episode: {
    minHeight: 82,
    paddingHorizontal: 22,
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  episodeFocused: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 3,
    borderColor: colors.white,
    transform: [{ scale: 1.008 }],
  },
  episodeNumber: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceRaised,
  },
  episodeNumberText: { color: colors.text, fontSize: 14, fontWeight: "800" },
  episodeCopy: { flex: 1, gap: 5 },
  episodeTitle: { color: colors.text, fontSize: 17, fontWeight: "700" },
  episodeMeta: { color: colors.muted, fontSize: 12 },
  subtitleCount: { color: colors.muted, fontSize: 13, fontWeight: "700" },
  person: { width: 150, marginRight: 24 },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    overflow: "hidden",
    backgroundColor: colors.surfaceRaised,
    marginBottom: 12,
  },
  avatarImage: { width: "100%", height: "100%" },
  personName: { color: colors.text, fontSize: 14, fontWeight: "700" },
  character: { color: colors.muted, fontSize: 12, marginTop: 4 },
  centered: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    gap: 18,
    padding: 60,
  },
  centeredTitle: { color: colors.text, fontSize: 36, fontWeight: "800" },
  centeredDescription: { color: colors.muted, fontSize: 16 },
})
