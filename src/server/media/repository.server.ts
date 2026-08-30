import {db, ensureDatabase} from "@/server/db/index.server";
import {compareMediaParts} from "@/server/media/media-part-sort";
import {isPlaybackCompleted} from "@/server/media/playback-completion";
import {selectCurrentlyWatching, selectNextPart} from "@/server/media/progress-utils";
import {and, asc, count, desc, eq, inArray, like, or, sql, type SQL} from "drizzle-orm";
import {libraries, MediaItemRow, mediaItems, MediaPartRow, mediaParts, playbackProgress, ProgressRow, SubtitleRow, subtitleTracks} from "@/server/db/schema";
import {LibraryStats, MediaKind, MediaPart, MediaProgress, MediaSort, MediaWatchFilter, PersonCredit, SeasonMetadata, SubtitleTrack} from "@foyer/contracts";


const parseJson = <T>(value: string, fallback: T): T => {
    try {
        return JSON.parse(value) as T;
    }
    catch {
        return fallback;
    }
};


const asProgress = (row: ProgressRow | undefined): MediaProgress | null => {
    if (!row) return null;
    const percentage = row.completed
        ? 100
        : row.durationSeconds
            ? Math.min(100, Math.round((row.positionSeconds / row.durationSeconds) * 100))
            : 0;

    return {
        percentage,
        completed: row.completed,
        updatedAt: row.updatedAt,
        positionSeconds: row.positionSeconds,
        durationSeconds: row.durationSeconds,
    };
};


type SummaryPart = Pick<MediaPartRow, "id" | "fileName" | "seasonNumber" | "episodeNumber">;


const asSummary = (item: MediaItemRow, parts: SummaryPart[], progressByPart: Map<string, ProgressRow>) => {
    const nextPart = selectNextPart([...parts].sort(compareMediaParts), progressByPart);

    const partProgress = parts.flatMap((part) => {
        const progress = progressByPart.get(part.id);
        return progress ? [progress] : [];
    });

    return {
        id: item.id,
        kind: item.kind,
        year: item.year,
        title: item.title,
        addedAt: item.addedAt,
        partCount: parts.length,
        overview: item.overview,
        posterPath: item.posterPath,
        releaseDate: item.releaseDate,
        backdropPath: item.backdropPath,
        nextPartId: nextPart?.id ?? null,
        tmdbVoteCount: item.tmdbVoteCount,
        runtimeMinutes: item.runtimeMinutes,
        metadataStatus: item.metadataStatus,
        hasProgress: partProgress.length > 0,
        tmdbVoteAverage: item.tmdbVoteAverage,
        progress: nextPart ? asProgress(progressByPart.get(nextPart.id)) : null,
        watched:
            parts.length > 0 &&
            parts.every((part) => progressByPart.get(part.id)?.completed === true),
    };
};


const hasParts = sql<boolean>`exists (
    select 1 from ${mediaParts}
    where ${mediaParts.mediaItemId} = ${mediaItems.id}
)`;


const hasUnfinishedParts = sql<boolean>`exists (
    select 1 from ${mediaParts}
    left join ${playbackProgress}
        on ${playbackProgress.mediaPartId} = ${mediaParts.id}
    where ${mediaParts.mediaItemId} = ${mediaItems.id}
        and coalesce(${playbackProgress.completed}, 0) = 0
)`;


const hasInProgressPart = sql<boolean>`exists (
    select 1 from ${mediaParts}
    inner join ${playbackProgress}
        on ${playbackProgress.mediaPartId} = ${mediaParts.id}
    where ${mediaParts.mediaItemId} = ${mediaItems.id}
        and ${playbackProgress.completed} = 0
        and ${playbackProgress.positionSeconds} > 0
)`;


const watchedFilter = (watch: MediaWatchFilter | undefined) => {
    if (watch === "watched") return sql`${hasParts} and not ${hasUnfinishedParts}`;
    if (watch === "unwatched") return sql`not (${hasParts} and not ${hasUnfinishedParts})`;

    return undefined;
};


const mediaPartOrder = () => [
    asc(sql`coalesce(${mediaParts.seasonNumber}, 0)`),
    asc(sql`coalesce(${mediaParts.episodeNumber}, 0)`),
    asc(sql`${mediaParts.fileName} collate nocase`),
];


interface MediaFiltersProps {
    search?: string
    kind?: MediaKind
    libraryId?: string
    watch?: MediaWatchFilter
}


const mediaFilters = (input: MediaFiltersProps) => {
    const search = input.search?.trim();

    return and(
        input.libraryId ? eq(mediaItems.libraryId, input.libraryId) : undefined,
        input.kind ? eq(mediaItems.kind, input.kind) : undefined,
        search ? or(like(mediaItems.title, `%${search}%`), like(mediaItems.originalTitle, `%${search}%`)) : undefined,
        watchedFilter(input.watch),
    );
};


const mediaOrder = (sort: MediaSort): SQL[] => {
    const title = asc(mediaItems.sortTitle);
    const releaseDate = sql<string | null>`coalesce(${mediaItems.releaseDate}, cast(${mediaItems.year} as text))`;

    switch (sort) {
        case "title":
            return [title];
        case "release-desc":
            return [asc(sql`${releaseDate} is null`), desc(releaseDate), title];
        case "release-asc":
            return [asc(sql`${releaseDate} is null`), asc(releaseDate), title];
        case "runtime-desc":
            return [asc(sql`${mediaItems.runtimeMinutes} is null`), desc(mediaItems.runtimeMinutes), title];
        case "runtime-asc":
            return [asc(sql`${mediaItems.runtimeMinutes} is null`), asc(mediaItems.runtimeMinutes), title];
        case "rating-desc":
            return [asc(sql`${mediaItems.tmdbVoteAverage} is null`), desc(mediaItems.tmdbVoteAverage), title];
        case "rating-asc":
            return [asc(sql`${mediaItems.tmdbVoteAverage} is null`), asc(mediaItems.tmdbVoteAverage), title];
        case "recent":
            return [desc(mediaItems.addedAt), title];
    }
};


const hydrateSummaries = (items: MediaItemRow[]) => {
    if (!items.length) return [];

    const allParts = db
        .select()
        .from(mediaParts)
        .where(inArray(mediaParts.mediaItemId, items.map((item) => item.id)))
        .all();

    const partIds = allParts.map((part) => part.id);

    const progressRows = partIds.length
        ? db
            .select()
            .from(playbackProgress)
            .where(inArray(playbackProgress.mediaPartId, partIds))
            .all()
        : [];

    const partByMedia = new Map<string, MediaPartRow[]>();
    for (const part of allParts) {
        const bucket = partByMedia.get(part.mediaItemId) ?? [];
        bucket.push(part);
        partByMedia.set(part.mediaItemId, bucket);
    }

    const progressByPart = new Map(progressRows.map((progress) => [progress.mediaPartId, progress]));

    return items.map((item) => asSummary(item, partByMedia.get(item.id) ?? [], progressByPart));
};


interface ListMediaProps {
    page?: number;
    search?: string;
    kind?: MediaKind;
    sort?: MediaSort;
    pageSize?: number;
    libraryId?: string;
    watch?: MediaWatchFilter;
}


export const listMedia = (input: ListMediaProps) => {
    ensureDatabase();
    const filters = mediaFilters(input);

    const totalItems = db
        .select({ value: count() })
        .from(mediaItems)
        .where(filters)
        .get()?.value ?? 0;

    const pageSize = input.pageSize ?? 50;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const page = Math.min(input.page ?? 1, totalPages);
    const start = (page - 1) * pageSize;

    const rows = db
        .select()
        .from(mediaItems)
        .where(filters)
        .orderBy(...mediaOrder(input.sort ?? "recent"))
        .limit(pageSize)
        .offset(start)
        .all();

    const statsRow = db
        .select({
            titles: count(),
            inProgress: sql<number>`coalesce(sum(case when ${hasInProgressPart} then 1 else 0 end), 0)`,
            anime: sql<number>`coalesce(sum(case when ${mediaItems.kind} = 'anime' then 1 else 0 end), 0)`,
            movies: sql<number>`coalesce(sum(case when ${mediaItems.kind} = 'movie' then 1 else 0 end), 0)`,
            series: sql<number>`coalesce(sum(case when ${mediaItems.kind} = 'series' then 1 else 0 end), 0)`,
            unmatched: sql<number>`coalesce(sum(case when ${mediaItems.metadataStatus} = 'unmatched' then 1 else 0 end), 0)`,
        })
        .from(mediaItems)
        .where(input.libraryId ? eq(mediaItems.libraryId, input.libraryId) : undefined)
        .get();

    const stats: LibraryStats = {
        anime: statsRow?.anime ?? 0,
        movies: statsRow?.movies ?? 0,
        series: statsRow?.series ?? 0,
        titles: statsRow?.titles ?? 0,
        unmatched: statsRow?.unmatched ?? 0,
        inProgress: statsRow?.inProgress ?? 0,
    };

    return {
        stats,
        items: hydrateSummaries(rows),
        pagination: {
            page,
            pageSize,
            totalItems,
            totalPages,
        },
    };
};


export const listMediaFolders = () => {
    ensureDatabase();

    const folderRows = db
        .select()
        .from(libraries)
        .all();

    const itemRows = db
        .select({
            addedAt: mediaItems.addedAt,
            libraryId: mediaItems.libraryId,
            posterPath: mediaItems.posterPath,
        })
        .from(mediaItems)
        .all();

    return folderRows.map((folder) => {
        const folderItems = itemRows
            .filter((item) => item.libraryId === folder.id)
            .sort((left, right) => right.addedAt - left.addedAt);

        return {
            id: folder.id,
            name: folder.name,
            path: folder.path,
            kind: folder.kind,
            titleCount: folderItems.length,
            posterPaths: folderItems.flatMap((item) => item.posterPath ? [item.posterPath] : []).slice(0, 5),
        };
    });
};


export const listCurrentlyWatching = () => {
    ensureDatabase();

    const rows = db
        .select()
        .from(mediaItems)
        .where(hasInProgressPart)
        .all();

    return selectCurrentlyWatching(hydrateSummaries(rows));
};


export const deleteMediaProgress = (mediaId: string) => {
    ensureDatabase();

    const item = db
        .select({ id: mediaItems.id })
        .from(mediaItems)
        .where(eq(mediaItems.id, mediaId))
        .get();

    if (!item) throw new Error("Media item not found");

    const parts = db
        .select({ id: mediaParts.id })
        .from(mediaParts)
        .where(eq(mediaParts.mediaItemId, mediaId))
        .all();

    let deleted = 0;
    db.transaction(() => {
        for (const part of parts) {
            const progress = db
                .select({ id: playbackProgress.mediaPartId })
                .from(playbackProgress)
                .where(eq(playbackProgress.mediaPartId, part.id))
                .get();

            if (!progress) continue
            db.delete(playbackProgress)
                .where(eq(playbackProgress.mediaPartId, part.id))
                .run();

            deleted += 1;
        }
    });

    return deleted;
};


export const setMediaWatched = (mediaId: string, watched: boolean) => {
    ensureDatabase();

    const item = db
        .select({ id: mediaItems.id })
        .from(mediaItems)
        .where(eq(mediaItems.id, mediaId))
        .get();

    if (!item) throw new Error("Media item not found");

    const parts = db
        .select({ id: mediaParts.id })
        .from(mediaParts)
        .where(eq(mediaParts.mediaItemId, mediaId))
        .all();

    if (!parts.length) throw new Error("Media item has no files");

    if (!watched) {
        return {
            watched,
            updatedParts: deleteMediaProgress(mediaId),
        };
    }

    const now = Date.now();
    db.transaction(() => {
        for (const part of parts) {
            const existing = db
                .select()
                .from(playbackProgress)
                .where(eq(playbackProgress.mediaPartId, part.id))
                .get();

            const durationSeconds = Math.max(existing?.durationSeconds ?? 0, 1);

            db.insert(playbackProgress)
                .values({
                    updatedAt: now,
                    durationSeconds,
                    completed: true,
                    mediaPartId: part.id,
                    positionSeconds: durationSeconds,
                })
                .onConflictDoUpdate({
                    target: playbackProgress.mediaPartId,
                    set: {
                        updatedAt: now,
                        durationSeconds,
                        completed: true,
                        positionSeconds: durationSeconds,
                    },
                }).run();
        }
    });

    return { watched, updatedParts: parts.length };
};


export const setMediaPartWatched = (partId: string, watched: boolean) => {
    ensureDatabase();

    const part = db
        .select({ id: mediaParts.id })
        .from(mediaParts)
        .where(eq(mediaParts.id, partId))
        .get();

    if (!part) throw new Error("Media part not found");

    if (!watched) {
        db.delete(playbackProgress)
            .where(eq(playbackProgress.mediaPartId, partId))
            .run();

        return { partId, watched };
    }

    const existing = db
        .select()
        .from(playbackProgress)
        .where(eq(playbackProgress.mediaPartId, partId))
        .get();

    const durationSeconds = Math.max(existing?.durationSeconds ?? 0, 1);
    const updatedAt = Date.now();

    db.insert(playbackProgress)
        .values({
            updatedAt,
            durationSeconds,
            completed: true,
            mediaPartId: partId,
            positionSeconds: durationSeconds,
        })
        .onConflictDoUpdate({
            target: playbackProgress.mediaPartId,
            set: {
                updatedAt,
                durationSeconds,
                completed: true,
                positionSeconds: durationSeconds,
            },
        }).run();

    return { partId, watched };
};


export const getMediaDetail = (mediaId: string, input: { season?: number, page?: number, pageSize?: number } = {}) => {
    ensureDatabase();

    const item = db
        .select()
        .from(mediaItems)
        .where(eq(mediaItems.id, mediaId))
        .get();

    if (!item) return null;

    const summaryParts = db
        .select({
            id: mediaParts.id,
            fileName: mediaParts.fileName,
            seasonNumber: mediaParts.seasonNumber,
            episodeNumber: mediaParts.episodeNumber,
        })
        .from(mediaParts)
        .where(eq(mediaParts.mediaItemId, mediaId))
        .orderBy(...mediaPartOrder())
        .all();

    const partIds = summaryParts.map((part) => part.id);
    const progressRows = partIds.length
        ? db
            .select()
            .from(playbackProgress)
            .where(inArray(playbackProgress.mediaPartId, partIds))
            .all()
        : [];

    const partSeasons = [...new Set(summaryParts.map((p) => p.seasonNumber ?? 1))].sort((l, r) => l - r);
    const requestedSeason = input.season ?? partSeasons[0];

    const selectedPartSeason = input.pageSize
        ? partSeasons.includes(requestedSeason ?? 1) ? requestedSeason ?? 1 : partSeasons[0] ?? 1
        : null;

    const totalItems = selectedPartSeason === null
        ? summaryParts.length
        : summaryParts.filter((part) => (part.seasonNumber ?? 1) === selectedPartSeason).length;

    const pageSize = input.pageSize ?? Math.max(totalItems, 1);
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const page = Math.min(input.page ?? 1, totalPages);

    const partFilter = and(
        eq(mediaParts.mediaItemId, mediaId),
        selectedPartSeason === null ? undefined : sql`coalesce(${mediaParts.seasonNumber}, 1) = ${selectedPartSeason}`,
    );

    const parts = input.pageSize
        ? db
            .select()
            .from(mediaParts)
            .where(partFilter)
            .orderBy(...mediaPartOrder())
            .limit(pageSize)
            .offset((page - 1) * pageSize)
            .all()
        : db
            .select()
            .from(mediaParts)
            .where(partFilter)
            .orderBy(...mediaPartOrder())
            .all();

    const pagePartIds = parts.map((part) => part.id);
    const subtitleRows = pagePartIds.length
        ? db
            .select()
            .from(subtitleTracks)
            .where(inArray(subtitleTracks.mediaPartId, pagePartIds))
            .all()
        : [];

    const subtitlesByPart = new Map<string, SubtitleRow[]>();
    const progressByPart = new Map(progressRows.map((row) => [row.mediaPartId, row]));

    for (const subtitle of subtitleRows) {
        const bucket = subtitlesByPart.get(subtitle.mediaPartId) ?? [];
        bucket.push(subtitle);
        subtitlesByPart.set(subtitle.mediaPartId, bucket);
    }

    const summary = asSummary(item, summaryParts, progressByPart);

    const hydratedParts: MediaPart[] = parts.map((part) => ({
        id: part.id,
        size: part.size,
        title: part.title,
        fileName: part.fileName,
        mimeType: part.mimeType,
        seasonNumber: part.seasonNumber,
        episodeNumber: part.episodeNumber,
        streamUrl: `/api/v1/stream/${part.id}`,
        progress: asProgress(progressByPart.get(part.id)),
        subtitles: (subtitlesByPart.get(part.id) ?? []).map(
            (subtitle): SubtitleTrack => ({
                id: subtitle.id,
                label: subtitle.label,
                format: subtitle.format,
                language: subtitle.language,
                isDefault: subtitle.isDefault,
                url: `/api/v1/subtitles/${subtitle.id}`,
            })
        ),
    }));

    return {
        ...summary,
        partSeasons,
        selectedPartSeason,
        tmdbId: item.tmdbId,
        parts: hydratedParts,
        contentRating: item.contentRating,
        originalTitle: item.originalTitle,
        originalLanguage: item.originalLanguage,
        metadataRefreshedAt: item.metadataRefreshedAt,
        genres: parseJson<string[]>(item.genresJson, []),
        cast: parseJson<PersonCredit[]>(item.castJson, []),
        seasons: parseJson<SeasonMetadata[]>(item.seasonsJson, []),
        partsPagination: {
            page,
            pageSize,
            totalItems,
            totalPages,
        },
    };
};


export const saveProgress = (input: { partId: string, positionSeconds: number, durationSeconds: number }) => {
    ensureDatabase();

    const part = db
        .select()
        .from(mediaParts)
        .where(eq(mediaParts.id, input.partId))
        .get();

    if (!part) throw new Error("Media part not found");

    const now = Date.now();
    const positionSeconds = Math.round(input.positionSeconds);
    const durationSeconds = Math.round(input.durationSeconds);
    const completed = isPlaybackCompleted(positionSeconds, durationSeconds);

    db.insert(playbackProgress)
        .values({
            completed,
            updatedAt: now,
            durationSeconds,
            mediaPartId: input.partId,
            positionSeconds: completed ? durationSeconds : positionSeconds,
        })
        .onConflictDoUpdate({
            target: playbackProgress.mediaPartId,
            set: {
                completed,
                updatedAt: now,
                durationSeconds,
                positionSeconds: completed ? durationSeconds : positionSeconds,
            },
        }).run();

    return asProgress(db
        .select()
        .from(playbackProgress)
        .where(eq(playbackProgress.mediaPartId, input.partId))
        .get()
    );
}


export const getPartFile = (partId: string) => {
    ensureDatabase();

    return db
        .select()
        .from(mediaParts)
        .where(eq(mediaParts.id, partId))
        .get() ?? null;
};


export const getSubtitleFile = (subtitleId: string) => {
    ensureDatabase();

    return db
        .select()
        .from(subtitleTracks)
        .where(eq(subtitleTracks.id, subtitleId))
        .get() ?? null;
};
