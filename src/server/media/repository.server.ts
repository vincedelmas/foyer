import {and, eq, like, or} from "drizzle-orm";
import {db, ensureDatabase} from "@/server/db/index.server"
import {libraries, MediaItemRow, mediaItems, MediaPartRow, mediaParts, playbackProgress, ProgressRow, SubtitleRow, subtitleTracks} from "@/server/db/schema"
import {LibraryStats, MediaFolderSummary, MediaKind, MediaPart, MediaProgress, MediaSort, MediaSummary, MediaWatchFilter, PersonCredit, SeasonMetadata, SubtitleTrack} from "@ploux/contracts";
import {filterByWatchStatus, selectCurrentlyWatching} from "@/server/media/progress-utils"
import {sortMedia} from "@/server/media/media-sort"


const parseJson = <T>(value: string, fallback: T): T => {
    try {
        return JSON.parse(value) as T
    }
    catch {
        return fallback
    }
}


const asProgress = (row: ProgressRow | undefined): MediaProgress | null => {
    if (!row) return null
    const percentage = row.completed
        ? 100
        : row.durationSeconds
        ? Math.min(
            100,
            Math.round((row.positionSeconds / row.durationSeconds) * 100)
        )
        : 0
    return {
        positionSeconds: row.positionSeconds,
        durationSeconds: row.durationSeconds,
        percentage,
        completed: row.completed,
        updatedAt: row.updatedAt,
    }
}


const sortParts = (left: MediaPartRow, right: MediaPartRow) =>
    (left.seasonNumber ?? 0) - (right.seasonNumber ?? 0) ||
    (left.episodeNumber ?? 0) - (right.episodeNumber ?? 0) ||
    left.fileName.localeCompare(right.fileName)


const selectNextPart = (parts: MediaPartRow[], progressByPart: Map<string, ProgressRow>) => {
    const sorted = [...parts].sort(sortParts)
    return (
        sorted.find((part) => {
            const progress = progressByPart.get(part.id)
            return progress && !progress.completed && progress.positionSeconds > 0
        }) ??
        sorted.find((part) => !progressByPart.get(part.id)?.completed) ??
        sorted[0] ??
        null
    )
}


const asSummary = (item: MediaItemRow, parts: MediaPartRow[], progressByPart: Map<string, ProgressRow>) => {
    const nextPart = selectNextPart(parts, progressByPart);
    const partProgress = parts.flatMap((part) => {
        const progress = progressByPart.get(part.id)
        return progress ? [progress] : []
    })

    return {
        id: item.id,
        kind: item.kind,
        year: item.year,
        releaseDate: item.releaseDate,
        title: item.title,
        addedAt: item.addedAt,
        partCount: parts.length,
        overview: item.overview,
        posterPath: item.posterPath,
        backdropPath: item.backdropPath,
        nextPartId: nextPart?.id ?? null,
        runtimeMinutes: item.runtimeMinutes,
        tmdbVoteAverage: item.tmdbVoteAverage,
        tmdbVoteCount: item.tmdbVoteCount,
        metadataStatus: item.metadataStatus,
        progress: nextPart ? asProgress(progressByPart.get(nextPart.id)) : null,
        watched:
            parts.length > 0 &&
            parts.every((part) => progressByPart.get(part.id)?.completed === true),
        hasProgress: partProgress.length > 0,
    };
};


const loadMediaRows = (kind?: MediaKind, search?: string, libraryId?: string) => {
    const filters = [
        libraryId ? eq(mediaItems.libraryId, libraryId) : undefined,
        kind ? eq(mediaItems.kind, kind) : undefined,
        search
            ? or(
                like(mediaItems.title, `%${search}%`),
                like(mediaItems.originalTitle, `%${search}%`)
            )
            : undefined,
    ].filter(Boolean)

    return db
        .select()
        .from(mediaItems)
        .where(filters.length ? and(...filters) : undefined)
        .all()
}


const hydrateSummaries = (items: MediaItemRow[]) => {
    if (!items.length) return [];
    const allParts = db.select().from(mediaParts).all()
    const progressRows = db.select().from(playbackProgress).all()
    const partByMedia = new Map<string, MediaPartRow[]>()
    for (const part of allParts) {
        const bucket = partByMedia.get(part.mediaItemId) ?? []
        bucket.push(part)
        partByMedia.set(part.mediaItemId, bucket)
    }
    const progressByPart = new Map(
        progressRows.map((progress) => [progress.mediaPartId, progress])
    )
    return items.map((item) =>
        asSummary(item, partByMedia.get(item.id) ?? [], progressByPart)
    )
}


export const listMedia = (input: {
    libraryId?: string
    kind?: MediaKind
    search?: string
    watch?: MediaWatchFilter
    sort?: MediaSort
    page?: number
    pageSize?: number
}) => {
    ensureDatabase();
    const all = hydrateSummaries(loadMediaRows(undefined, undefined, input.libraryId));
    const searched = hydrateSummaries(loadMediaRows(input.kind, input.search?.trim() || undefined, input.libraryId));
    const filtered = filterByWatchStatus(searched, input.watch ?? "all")
    const sorted = sortMedia(filtered, input.sort ?? "recent")
    const totalItems = sorted.length
    const pageSize = input.pageSize ?? Math.max(totalItems, 1)
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
    const page = Math.min(input.page ?? 1, totalPages)
    const start = (page - 1) * pageSize

    const stats: LibraryStats = {
        titles: all.length,
        anime: all.filter((item) => item.kind === "anime").length,
        movies: all.filter((item) => item.kind === "movie").length,
        series: all.filter((item) => item.kind === "series").length,
        unmatched: all.filter((item) => item.metadataStatus === "unmatched").length,
        inProgress: all.filter((item) => item.progress && item.progress.positionSeconds > 0 && !item.progress.completed).length,
    };

    return {
        stats,
        items: sorted.slice(start, start + pageSize),
        pagination: {
            page,
            pageSize,
            totalItems,
            totalPages,
        },
    };
};


export const listMediaFolders = (): MediaFolderSummary[] => {
    ensureDatabase()
    const folderRows = db.select().from(libraries).all()
    const itemRows = db.select().from(mediaItems).all()

    return folderRows.map((folder) => {
        const folderItems = itemRows
            .filter((item) => item.libraryId === folder.id)
            .sort((left, right) => right.addedAt - left.addedAt)

        return {
            id: folder.id,
            name: folder.name,
            path: folder.path,
            kind: folder.kind,
            titleCount: folderItems.length,
            posterPaths: folderItems
                .flatMap((item) => item.posterPath ? [item.posterPath] : [])
                .slice(0, 5),
        }
    })
}


export const listCurrentlyWatching = (): MediaSummary[] => {
    ensureDatabase()

    return selectCurrentlyWatching(hydrateSummaries(loadMediaRows()))
}


export const deleteMediaProgress = (mediaId: string) => {
    ensureDatabase()

    const item = db
        .select({id: mediaItems.id})
        .from(mediaItems)
        .where(eq(mediaItems.id, mediaId))
        .get()

    if (!item) throw new Error("Media item not found")

    const parts = db
        .select({id: mediaParts.id})
        .from(mediaParts)
        .where(eq(mediaParts.mediaItemId, mediaId))
        .all()

    let deleted = 0
    db.transaction(() => {
        for (const part of parts) {
            const progress = db
                .select({id: playbackProgress.mediaPartId})
                .from(playbackProgress)
                .where(eq(playbackProgress.mediaPartId, part.id))
                .get()

            if (!progress) continue
            db.delete(playbackProgress)
                .where(eq(playbackProgress.mediaPartId, part.id))
                .run()
            deleted += 1
        }
    })

    return deleted
}


export const setMediaWatched = (mediaId: string, watched: boolean) => {
    ensureDatabase()

    const item = db
        .select({id: mediaItems.id})
        .from(mediaItems)
        .where(eq(mediaItems.id, mediaId))
        .get()

    if (!item) throw new Error("Media item not found")

    const parts = db
        .select({id: mediaParts.id})
        .from(mediaParts)
        .where(eq(mediaParts.mediaItemId, mediaId))
        .all()

    if (!parts.length) throw new Error("Media item has no files")

    if (!watched) {
        return {
            watched,
            updatedParts: deleteMediaProgress(mediaId),
        }
    }

    const now = Date.now()
    db.transaction(() => {
        for (const part of parts) {
            const existing = db
                .select()
                .from(playbackProgress)
                .where(eq(playbackProgress.mediaPartId, part.id))
                .get()
            const durationSeconds = Math.max(existing?.durationSeconds ?? 0, 1)

            db.insert(playbackProgress)
                .values({
                    mediaPartId: part.id,
                    positionSeconds: durationSeconds,
                    durationSeconds,
                    completed: true,
                    updatedAt: now,
                })
                .onConflictDoUpdate({
                    target: playbackProgress.mediaPartId,
                    set: {
                        positionSeconds: durationSeconds,
                        durationSeconds,
                        completed: true,
                        updatedAt: now,
                    },
                })
                .run()
        }
    })

    return {watched, updatedParts: parts.length}
}


export const setMediaPartWatched = (partId: string, watched: boolean) => {
    ensureDatabase()

    const part = db
        .select({id: mediaParts.id})
        .from(mediaParts)
        .where(eq(mediaParts.id, partId))
        .get()

    if (!part) throw new Error("Media part not found")

    if (!watched) {
        db.delete(playbackProgress)
            .where(eq(playbackProgress.mediaPartId, partId))
            .run()
        return {partId, watched}
    }

    const existing = db
        .select()
        .from(playbackProgress)
        .where(eq(playbackProgress.mediaPartId, partId))
        .get()
    const durationSeconds = Math.max(existing?.durationSeconds ?? 0, 1)
    const updatedAt = Date.now()

    db.insert(playbackProgress)
        .values({
            mediaPartId: partId,
            positionSeconds: durationSeconds,
            durationSeconds,
            completed: true,
            updatedAt,
        })
        .onConflictDoUpdate({
            target: playbackProgress.mediaPartId,
            set: {
                positionSeconds: durationSeconds,
                durationSeconds,
                completed: true,
                updatedAt,
            },
        })
        .run()

    return {partId, watched}
}


export const getMediaDetail = (mediaId: string) => {
    ensureDatabase();

    const item = db
        .select()
        .from(mediaItems)
        .where(eq(mediaItems.id, mediaId))
        .get();

    if (!item) return null

    const parts = db
        .select()
        .from(mediaParts)
        .where(eq(mediaParts.mediaItemId, mediaId))
        .all()
        .sort(sortParts);

    const progressRows = db
        .select()
        .from(playbackProgress)
        .all();

    const subtitleRows = db
        .select()
        .from(subtitleTracks)
        .all();

    const subtitlesByPart = new Map<string, SubtitleRow[]>()
    const progressByPart = new Map(progressRows.map((row) => [row.mediaPartId, row]));

    for (const subtitle of subtitleRows) {
        const bucket = subtitlesByPart.get(subtitle.mediaPartId) ?? [];
        bucket.push(subtitle);
        subtitlesByPart.set(subtitle.mediaPartId, bucket);
    }

    const summary = asSummary(item, parts, progressByPart)

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
        tmdbId: item.tmdbId,
        parts: hydratedParts,
        contentRating: item.contentRating,
        originalTitle: item.originalTitle,
        originalLanguage: item.originalLanguage,
        metadataRefreshedAt: item.metadataRefreshedAt,
        genres: parseJson<string[]>(item.genresJson, []),
        cast: parseJson<PersonCredit[]>(item.castJson, []),
        seasons: parseJson<SeasonMetadata[]>(item.seasonsJson, []),
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

    const positionSeconds = Math.round(input.positionSeconds)
    const durationSeconds = Math.round(input.durationSeconds)
    const completed =
        durationSeconds > 0 &&
        (positionSeconds / durationSeconds >= 0.9 ||
            durationSeconds - positionSeconds <= 120)
    const now = Date.now()
    db.insert(playbackProgress)
        .values({
            mediaPartId: input.partId,
            positionSeconds: completed ? durationSeconds : positionSeconds,
            durationSeconds,
            completed,
            updatedAt: now,
        })
        .onConflictDoUpdate({
            target: playbackProgress.mediaPartId,
            set: {
                positionSeconds: completed ? durationSeconds : positionSeconds,
                durationSeconds,
                completed,
                updatedAt: now,
            },
        })
        .run()
    return asProgress(
        db
            .select()
            .from(playbackProgress)
            .where(eq(playbackProgress.mediaPartId, input.partId))
            .get()
    )
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
