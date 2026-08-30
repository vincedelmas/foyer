import {colors, spacing} from "../theme";
import {useEffect, useMemo, useState} from "react";
import {FocusButton} from "../components/FocusButton";
import {IdentifyDialog} from "../components/IdentifyDialog";
import {MediaInfoDialog} from "../components/MediaInfoDialog";
import {FocusIconButton} from "../components/FocusIconButton";
import {MediaActionsDialog} from "../components/MediaActionsDialog";
import {useQuery} from "@tanstack/react-query";
import {CheckIcon, MoreVerticalIcon, PlayIcon, StarIcon} from "lucide-react-native";
import {formatBytes, formatRuntime, MediaPart, MediaSummary, tmdbImage} from "@foyer/contracts";
import {ActivityIndicator, BackHandler, Image, ImageBackground, ScrollView, StyleSheet, Text, View} from "react-native";
import {mediaOptions} from "../query-options";
import {useSetMediaPartWatchedMutation, useSetMediaWatchedMutation} from "../query-mutations";


interface DetailScreenProps {
    server: string;
    onBack: () => void;
    summary: MediaSummary;
    onPlay: (part: MediaPart, media: MediaSummary, parts: MediaPart[]) => void;
}


export function DetailScreen({ server, summary, onBack, onPlay }: DetailScreenProps) {
    const [infoOpen, setInfoOpen] = useState(false);
    const [actionsOpen, setActionsOpen] = useState(false);
    const [identifyOpen, setIdentifyOpen] = useState(false);
    const [selectedSeason, setSelectedSeason] = useState<number | null>(null);

    const media = useQuery(mediaOptions(server, summary.id));

    useEffect(() => {
        const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
            onBack();
            return true;
        });

        return () => subscription.remove();
    }, [onBack]);

    const watchMedia = useSetMediaWatchedMutation(server, summary.id);
    const watchPart = useSetMediaPartWatchedMutation(server, summary.id);

    const seasons = useMemo(() => {
        const grouped = new Map<number, MediaPart[]>();

        for (const part of media.data?.parts ?? []) {
            const season = part.seasonNumber ?? 1;
            const bucket = grouped.get(season) ?? [];
            bucket.push(part);
            grouped.set(season, bucket);
        }

        return grouped;

    }, [media.data?.parts]);

    useEffect(() => {
        if (!seasons.size) return;

        if (selectedSeason === null || !seasons.has(selectedSeason)) {
            setSelectedSeason(seasons.keys().next().value ?? 1);
        }
    }, [seasons, selectedSeason]);

    if (media.isPending) {
        return <CenteredMessage title="Opening title…"/>;
    }

    if (media.isError)
        return (
            <CenteredMessage
                onBack={onBack}
                title="Could not open title"
                description={media.error.message}
            />
        );

    const item = media.data;
    const poster = tmdbImage(item.posterPath, "w500");
    const backdrop = tmdbImage(item.backdropPath, "w1280");
    const nextPart = item.parts.find((part) => part.id === item.nextPartId) ?? item.parts[0];

    const selectedParts = seasons.get(selectedSeason ?? 1) ?? [];
    const showPartList = item.kind !== "movie" || item.parts.length > 1;

    const rating = item.tmdbVoteAverage === null
        ? null
        : `${item.tmdbVoteAverage.toFixed(1)}/10${item.tmdbVoteCount === null
            ? ""
            : ` · ${item.tmdbVoteCount.toLocaleString()} votes`}`

    return (
        <View style={styles.screen}>
            <ScrollView contentContainerStyle={styles.content}>
                <ImageBackground
                    style={styles.hero}
                    imageStyle={styles.heroImage}
                    source={backdrop ? { uri: backdrop } : undefined}
                >
                    <View style={styles.overlay}>
                        <View style={styles.heroContent}>
                            <View style={styles.poster}>
                                {poster &&
                                    <Image
                                        source={{ uri: poster }}
                                        style={styles.posterImage}
                                    />
                                }
                            </View>
                            <View style={styles.copy}>
                                <View style={styles.badges}>
                                    <Text style={styles.badge}>
                                        {item.kind === "movie" ? "MOVIE" : "TV SHOW"}
                                    </Text>
                                    {item.contentRating &&
                                        <Text style={styles.badgeOutline}>
                                            PEGI {item.contentRating}
                                        </Text>
                                    }
                                    {item.metadataStatus === "unmatched" &&
                                        <Text style={styles.badgeOutline}>
                                            NEEDS IDENTIFICATION
                                        </Text>
                                    }
                                </View>
                                <Text numberOfLines={2} style={styles.title}>
                                    {item.title}
                                </Text>
                                <View style={styles.metaRow}>
                                    {item.year ? <Text style={styles.meta}>{item.year}</Text> : null}
                                    {item.runtimeMinutes ? <Text style={styles.meta}>{formatRuntime(item.runtimeMinutes)}</Text> : null}
                                    <Text style={styles.meta}>
                                        {item.parts.length} {item.kind === "movie" ? (item.parts.length === 1 ? "file" : "files") : (item.parts.length === 1 ? "episode" : "episodes")}
                                    </Text>
                                    {rating ? (
                                        <View style={styles.rating}>
                                            <StarIcon color={colors.rating} fill={colors.rating} size={18}/>
                                            <Text style={styles.ratingText}>{rating}</Text>
                                        </View>
                                    ) : null}
                                </View>
                                {item.overview ? <Text numberOfLines={2} style={styles.overview}>{item.overview}</Text> : null}
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
                                            onPress={() => onPlay(nextPart, item, item.parts)}
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
                                        onPlay={() => onPlay(part, item, item.parts)}
                                    />
                                ))}
                            </ScrollView>
                        </View>
                    ) : null}

                    <View style={styles.detailsSection}>
                        <Text style={styles.sectionTitle}>Details</Text>
                        <View style={styles.detailsCard}>
                            <DetailRow label="Original title" value={item.originalTitle}/>
                            <DetailRow label="Language" value={item.originalLanguage?.toUpperCase()}/>
                            <DetailRow label="Genres" value={item.genres.join(", ")}/>
                            <DetailRow label="TMDB" value={item.tmdbId ? `#${item.tmdbId}` : "Not matched"}/>
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
                                                {profile ? <Image source={{ uri: profile }} style={styles.avatarImage}/> : null}
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
            <ActivityIndicator color={colors.primary} size="large"/>
            <Text style={styles.centeredTitle}>{title}</Text>
            {description ? <Text style={styles.centeredDescription}>{description}</Text> : null}
            {onBack ? <FocusButton label="Back" onPress={onBack}/> : null}
        </View>
    )
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: { paddingBottom: 54 },
    hero: { height: 430, backgroundColor: colors.surface },
    heroImage: { opacity: 0.58 },
    overlay: { flex: 1, backgroundColor: "rgba(18,17,15,0.5)" },
    heroContent: { flex: 1, flexDirection: "row", alignItems: "flex-end", gap: 24, paddingHorizontal: spacing.page, paddingBottom: 28 },
    poster: { width: 140, height: 210, borderRadius: 9, overflow: "hidden", backgroundColor: colors.surfaceRaised, elevation: 10 },
    posterImage: { width: "100%", height: "100%" },
    copy: { flex: 1, maxWidth: 980, gap: 9 },
    badges: { flexDirection: "row", gap: 7 },
    badge: { color: colors.primaryText, backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, fontSize: 9, fontWeight: "900" },
    badgeOutline: { color: colors.text, borderColor: colors.border, borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, fontSize: 9, fontWeight: "800" },
    title: { color: colors.text, fontSize: 38, lineHeight: 41, fontWeight: "800", letterSpacing: -0.8 },
    metaRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    meta: { color: colors.muted, fontSize: 12, fontWeight: "700" },
    rating: { flexDirection: "row", alignItems: "center", gap: 7 },
    ratingText: { color: colors.text, fontSize: 11, fontWeight: "700" },
    overview: { color: colors.text, opacity: 0.82, fontSize: 13, lineHeight: 19, maxWidth: 850 },
    actions: { flexDirection: "row", alignItems: "center", gap: 9, marginTop: 3 },
    lowerContent: { paddingHorizontal: spacing.page, gap: 34, marginTop: 30 },
    partsSection: { gap: 13 },
    detailsSection: { maxWidth: 900, gap: 13 },
    castSection: { gap: 13 },
    castGrid: { flexDirection: "row", flexWrap: "wrap", gap: 18 },
    sectionTitle: { color: colors.text, fontSize: 24, fontWeight: "800", letterSpacing: -0.4 },
    seasons: { gap: 5, paddingBottom: 5 },
    episodeScroller: { maxHeight: 410, borderRadius: 11, borderWidth: 1, borderColor: colors.border },
    episodes: { backgroundColor: colors.surface },
    episode: { minHeight: 60, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 11, borderBottomWidth: 1, borderBottomColor: colors.border },
    episodeNumber: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceRaised },
    episodeNumberText: { color: colors.text, fontSize: 11, fontWeight: "800" },
    episodeCopy: { flex: 1, gap: 3 },
    episodeTitle: { color: colors.text, fontSize: 14, fontWeight: "700" },
    episodeMeta: { color: colors.muted, fontSize: 9 },
    subtitleCount: { color: colors.muted, fontSize: 10, fontWeight: "700" },
    detailsCard: { borderRadius: 14, overflow: "hidden", borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
    detailRow: { minHeight: 54, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: colors.border },
    detailLabel: { width: 180, color: colors.muted, fontSize: 13 },
    detailValue: { flex: 1, color: colors.text, fontSize: 14, fontWeight: "700" },
    person: { width: 116 },
    avatar: { width: 72, height: 72, borderRadius: 36, overflow: "hidden", backgroundColor: colors.surfaceRaised, marginBottom: 8 },
    avatarImage: { width: "100%", height: "100%" },
    personName: { color: colors.text, fontSize: 11, fontWeight: "700" },
    character: { color: colors.muted, fontSize: 9, marginTop: 3 },
    centered: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", gap: 18, padding: 60 },
    centeredTitle: { color: colors.text, fontSize: 36, fontWeight: "800" },
    centeredDescription: { color: colors.muted, fontSize: 16 },
    errorText: { color: colors.danger, fontSize: 13 },
})
