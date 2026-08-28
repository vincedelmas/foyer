import type { MediaPart, MediaSummary } from "@ploux/contracts"
import { formatRuntime, tmdbImage } from "@ploux/contracts"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowLeftIcon,
  CheckIcon,
  MoreVerticalIcon,
  PlayIcon,
  StarIcon,
} from "lucide-react-native"
import { useEffect, useMemo, useState } from "react"
import {
  ActivityIndicator,
  BackHandler,
  Image,
  ImageBackground,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native"

import { tvApi } from "../api"
import { FocusButton } from "../components/FocusButton"
import { FocusIconButton } from "../components/FocusIconButton"
import { IdentifyDialog } from "../components/IdentifyDialog"
import { MediaActionsDialog } from "../components/MediaActionsDialog"
import { MediaInfoDialog } from "../components/MediaInfoDialog"
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
  onPlay: (part: MediaPart, media: MediaSummary) => void
}) {
  const queryClient = useQueryClient()
  const media = useQuery({
    queryKey: ["tv-media", server, summary.id],
    queryFn: () => tvApi.media(server, summary.id),
  })
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null)
  const [actionsOpen, setActionsOpen] = useState(false)
  const [identifyOpen, setIdentifyOpen] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)

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

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["tv-media", server, summary.id],
      }),
      queryClient.invalidateQueries({ queryKey: ["tv-library", server] }),
      queryClient.invalidateQueries({ queryKey: ["tv-watching", server] }),
    ])
  }
  const watchMedia = useMutation({
    mutationFn: (watched: boolean) =>
      tvApi.setMediaWatched(server, summary.id, watched),
    onSuccess: invalidate,
  })
  const watchPart = useMutation({
    mutationFn: (input: { partId: string; watched: boolean }) =>
      tvApi.setMediaPartWatched(server, input.partId, input.watched),
    onSuccess: invalidate,
  })

  const seasons = useMemo(() => {
    const grouped = new Map<number, MediaPart[]>()
    for (const part of media.data?.parts ?? []) {
      const season = part.seasonNumber ?? 1
      const bucket = grouped.get(season) ?? []
      bucket.push(part)
      grouped.set(season, bucket)
    }
    return grouped
  }, [media.data?.parts])

  useEffect(() => {
    if (!seasons.size) return
    if (selectedSeason === null || !seasons.has(selectedSeason))
      setSelectedSeason(seasons.keys().next().value ?? 1)
  }, [seasons, selectedSeason])

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
  const showPartList = item.kind !== "movie" || item.parts.length > 1
  const selectedParts = seasons.get(selectedSeason ?? 1) ?? []
  const rating =
    item.tmdbVoteAverage === null
      ? null
      : `${item.tmdbVoteAverage.toFixed(1)}/10${
          item.tmdbVoteCount === null
            ? ""
            : ` · ${item.tmdbVoteCount.toLocaleString()} votes`
        }`

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <ImageBackground
          source={backdrop ? { uri: backdrop } : undefined}
          style={styles.hero}
          imageStyle={styles.heroImage}
        >
          <View style={styles.overlay}>
            <View style={styles.topBar}>
              <FocusButton
                label="Back"
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
                <View style={styles.badges}>
                  <Text style={styles.badge}>
                    {item.kind === "movie" ? "MOVIE" : "TV SHOW"}
                  </Text>
                  {item.contentRating ? (
                    <Text style={styles.badgeOutline}>PEGI {item.contentRating}</Text>
                  ) : null}
                  {item.metadataStatus === "unmatched" ? (
                    <Text style={styles.badgeOutline}>NEEDS IDENTIFICATION</Text>
                  ) : null}
                </View>
                <Text numberOfLines={2} style={styles.title}>{item.title}</Text>
                <View style={styles.metaRow}>
                  {item.year ? <Text style={styles.meta}>{item.year}</Text> : null}
                  {item.runtimeMinutes ? <Text style={styles.meta}>{formatRuntime(item.runtimeMinutes)}</Text> : null}
                  <Text style={styles.meta}>
                    {item.parts.length} {item.kind === "movie" ? (item.parts.length === 1 ? "file" : "files") : (item.parts.length === 1 ? "episode" : "episodes")}
                  </Text>
                  {rating ? (
                    <View style={styles.rating}>
                      <StarIcon color={colors.rating} fill={colors.rating} size={18} />
                      <Text style={styles.ratingText}>{rating}</Text>
                    </View>
                  ) : null}
                </View>
                {item.overview ? <Text numberOfLines={4} style={styles.overview}>{item.overview}</Text> : null}
                <View style={styles.actions}>
                  {nextPart ? (
                    <FocusButton
                      label={
                        nextPart.progress?.positionSeconds &&
                        !nextPart.progress.completed &&
                        !item.watched
                          ? `Resume · ${nextPart.progress.percentage}%`
                          : "Play"
                      }
                      icon={PlayIcon}
                      hasTVPreferredFocus
                      onPress={() => onPlay(nextPart, item)}
                    />
                  ) : null}
                  <FocusIconButton
                    icon={CheckIcon}
                    active={item.watched}
                    label={item.watched ? "Mark as unwatched" : "Mark as watched"}
                    disabled={watchMedia.isPending}
                    onPress={() => watchMedia.mutate(!item.watched)}
                  />
                  <FocusButton
                    label="More options"
                    icon={MoreVerticalIcon}
                    variant="secondary"
                    onPress={() => setActionsOpen(true)}
                  />
                </View>
                {watchMedia.isError || watchPart.isError ? (
                  <Text style={styles.errorText}>
                    {(watchMedia.error ?? watchPart.error)?.message}
                  </Text>
                ) : null}
              </View>
            </View>
          </View>
        </ImageBackground>

        <View style={styles.lowerContent}>
          {showPartList ? (
            <View style={styles.partsSection}>
              <Text style={styles.sectionTitle}>{item.kind === "movie" ? "Files" : "Episodes"}</Text>
              {item.kind !== "movie" ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.seasons}>
                  {[...seasons.keys()].map((season) => (
                    <FocusButton
                      key={season}
                      label={`Season ${season}`}
                      size="small"
                      variant={selectedSeason === season ? "primary" : "ghost"}
                      onPress={() => setSelectedSeason(season)}
                    />
                  ))}
                </ScrollView>
              ) : null}
              <ScrollView
                style={styles.episodeScroller}
                contentContainerStyle={styles.episodes}
                nestedScrollEnabled
              >
                {(item.kind === "movie" ? item.parts : selectedParts).map((part, index) => (
                  <EpisodeRow
                    key={part.id}
                    part={part}
                    index={index}
                    pending={watchPart.isPending && watchPart.variables?.partId === part.id}
                    onToggleWatched={() =>
                      watchPart.mutate({
                        partId: part.id,
                        watched: part.progress?.completed !== true,
                      })
                    }
                    onPlay={() => onPlay(part, item)}
                  />
                ))}
              </ScrollView>
            </View>
          ) : null}

          <View style={styles.detailsSection}>
            <Text style={styles.sectionTitle}>Details</Text>
            <View style={styles.detailsCard}>
              <DetailRow label="Original title" value={item.originalTitle} />
              <DetailRow label="Language" value={item.originalLanguage?.toUpperCase()} />
              <DetailRow label="Genres" value={item.genres.join(", ")} />
              <DetailRow label="TMDB" value={item.tmdbId ? `#${item.tmdbId}` : "Not matched"} />
            </View>
          </View>

          {item.cast.length ? (
            <View style={styles.castSection}>
              <Text style={styles.sectionTitle}>Cast</Text>
              <View style={styles.castGrid}>
                {item.cast.map((person) => {
                  const profile = tmdbImage(person.profilePath, "w342")
                  return (
                    <View key={person.id} style={styles.person}>
                      <View style={styles.avatar}>
                        {profile ? <Image source={{ uri: profile }} style={styles.avatarImage} /> : null}
                      </View>
                      <Text numberOfLines={1} style={styles.personName}>{person.name}</Text>
                      <Text numberOfLines={1} style={styles.character}>{person.character || "Cast"}</Text>
                    </View>
                  )
                })}
              </View>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <MediaActionsDialog
        server={server}
        item={item}
        visible={actionsOpen}
        onClose={() => setActionsOpen(false)}
        onIdentify={() => setIdentifyOpen(true)}
        onInfo={() => setInfoOpen(true)}
        onDeleted={onBack}
      />
      <IdentifyDialog
        server={server}
        media={item}
        visible={identifyOpen}
        onClose={() => setIdentifyOpen(false)}
      />
      <MediaInfoDialog
        server={server}
        mediaId={item.id}
        title={item.title}
        visible={infoOpen}
        onClose={() => setInfoOpen(false)}
      />
    </View>
  )
}

function EpisodeRow({
  part,
  index,
  pending,
  onToggleWatched,
  onPlay,
}: {
  part: MediaPart
  index: number
  pending: boolean
  onToggleWatched: () => void
  onPlay: () => void
}) {
  const watched = part.progress?.completed === true
  return (
    <View style={styles.episode}>
      <View style={styles.episodeNumber}>
        <Text style={styles.episodeNumberText}>{part.episodeNumber ?? index + 1}</Text>
      </View>
      <View style={styles.episodeCopy}>
        <Text numberOfLines={1} style={styles.episodeTitle}>
          {part.title || (part.episodeNumber ? `Episode ${part.episodeNumber}` : `Part ${index + 1}`)}
        </Text>
        <Text numberOfLines={1} style={styles.episodeMeta}>
          {part.fileName} · {formatBytes(part.size)}
        </Text>
      </View>
      {part.subtitles.length ? <Text style={styles.subtitleCount}>CC · {part.subtitles.length}</Text> : null}
      <FocusIconButton
        icon={CheckIcon}
        active={watched}
        label={watched ? "Mark episode as unwatched" : "Mark episode as watched"}
        disabled={pending}
        onPress={onToggleWatched}
      />
      <FocusButton
        label={part.progress?.positionSeconds && !watched ? "Resume" : "Play"}
        icon={PlayIcon}
        variant="secondary"
        size="small"
        onPress={onPlay}
      />
    </View>
  )
}

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
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
      <ActivityIndicator color={colors.primary} size="large" />
      <Text style={styles.centeredTitle}>{title}</Text>
      {description ? <Text style={styles.centeredDescription}>{description}</Text> : null}
      {onBack ? <FocusButton label="Back" onPress={onBack} /> : null}
    </View>
  )
}

function formatBytes(bytes: number) {
  const units = ["B", "KB", "MB", "GB", "TB"]
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value.toFixed(unit > 1 ? 1 : 0)} ${units[unit]}`
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 80 },
  hero: { height: 650, backgroundColor: colors.surface },
  heroImage: { opacity: 0.58 },
  overlay: { flex: 1, backgroundColor: "rgba(18,17,15,0.5)" },
  topBar: { height: 86, paddingHorizontal: spacing.page, alignItems: "flex-start", justifyContent: "center" },
  heroContent: { flex: 1, flexDirection: "row", alignItems: "flex-end", gap: 36, paddingHorizontal: spacing.page, paddingBottom: 52 },
  poster: { width: 210, height: 315, borderRadius: 12, overflow: "hidden", backgroundColor: colors.surfaceRaised, elevation: 12 },
  posterImage: { width: "100%", height: "100%" },
  copy: { flex: 1, maxWidth: 1080, gap: 14 },
  badges: { flexDirection: "row", gap: 9 },
  badge: { color: colors.primaryText, backgroundColor: colors.primary, borderRadius: 13, paddingHorizontal: 10, paddingVertical: 6, fontSize: 11, fontWeight: "900" },
  badgeOutline: { color: colors.text, borderColor: colors.border, borderWidth: 1, borderRadius: 13, paddingHorizontal: 10, paddingVertical: 5, fontSize: 11, fontWeight: "800" },
  title: { color: colors.text, fontSize: 57, lineHeight: 60, fontWeight: "800", letterSpacing: -1.4 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 17 },
  meta: { color: colors.muted, fontSize: 15, fontWeight: "700" },
  rating: { flexDirection: "row", alignItems: "center", gap: 7 },
  ratingText: { color: colors.text, fontSize: 14, fontWeight: "700" },
  overview: { color: colors.text, opacity: 0.82, fontSize: 16, lineHeight: 25, maxWidth: 900 },
  actions: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 6 },
  lowerContent: { paddingHorizontal: spacing.page, gap: 50, marginTop: 48 },
  partsSection: { gap: 18 },
  detailsSection: { maxWidth: 900, gap: 18 },
  castSection: { gap: 18 },
  castGrid: { flexDirection: "row", flexWrap: "wrap", gap: 24 },
  sectionTitle: { color: colors.text, fontSize: 33, fontWeight: "800", letterSpacing: -0.7 },
  seasons: { gap: 5, paddingBottom: 5 },
  episodeScroller: { maxHeight: 620, borderRadius: 14, borderWidth: 1, borderColor: colors.border },
  episodes: { backgroundColor: colors.surface },
  episode: { minHeight: 82, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", gap: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  episodeNumber: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceRaised },
  episodeNumberText: { color: colors.text, fontSize: 14, fontWeight: "800" },
  episodeCopy: { flex: 1, gap: 5 },
  episodeTitle: { color: colors.text, fontSize: 17, fontWeight: "700" },
  episodeMeta: { color: colors.muted, fontSize: 12 },
  subtitleCount: { color: colors.muted, fontSize: 13, fontWeight: "700" },
  detailsCard: { borderRadius: 14, overflow: "hidden", borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  detailRow: { minHeight: 54, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: colors.border },
  detailLabel: { width: 180, color: colors.muted, fontSize: 13 },
  detailValue: { flex: 1, color: colors.text, fontSize: 14, fontWeight: "700" },
  person: { width: 150 },
  avatar: { width: 96, height: 96, borderRadius: 48, overflow: "hidden", backgroundColor: colors.surfaceRaised, marginBottom: 12 },
  avatarImage: { width: "100%", height: "100%" },
  personName: { color: colors.text, fontSize: 14, fontWeight: "700" },
  character: { color: colors.muted, fontSize: 12, marginTop: 4 },
  centered: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", gap: 18, padding: 60 },
  centeredTitle: { color: colors.text, fontSize: 36, fontWeight: "800" },
  centeredDescription: { color: colors.muted, fontSize: 16 },
  errorText: { color: colors.danger, fontSize: 13 },
})
