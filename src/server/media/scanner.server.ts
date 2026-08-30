import {eq} from "drizzle-orm";
import {readdir, stat} from "node:fs/promises";
import {db, ensureDatabase} from "@/server/db/index.server";
import {removeTvCompatibilityCache} from "./tv-cache.server";
import type {LibraryKind, ScanRecord} from "@ploux/contracts";
import {basename, dirname, extname, relative, resolve, sep} from "node:path";
import {autoMatchMetadata, isTmdbConfigured, refreshTmdbEpisodeTitles} from "./tmdb.server";
import {libraries, type LibraryRow, mediaItems, mediaParts, scans, subtitleTracks} from "@/server/db/schema";
import {cleanMovieTitle, extensionOf, inferEpisode, inferYear, isSubtitle, isVideo, mimeTypeFor, normalizeTitle, stableId, subtitleLanguage} from "./file-utils.server";


interface DiscoveredTitle {
    title: string
    sourceKey: string
    year: number | null
    kind: "movie" | "series"
    videos: DiscoveredVideo[]
}


interface DiscoveredVideo {
    path: string
    size: number
    modifiedAt: number
    subtitles: string[]
    title: string | null
    seasonNumber: number | null
    episodeNumber: number | null
}


const walk = async (root: string) => {
    const files: string[] = [];

    const visit = async (directory: string) => {
        const entries = await readdir(directory, { withFileTypes: true });

        for (const entry of entries) {
            if (entry.name.startsWith(".")) continue;

            const absolute = resolve(directory, entry.name);

            if (entry.isDirectory()) {
                await visit(absolute);
            }
            else if (entry.isFile() && (isVideo(absolute) || isSubtitle(absolute))) {
                files.push(absolute)
            }
        }
    }

    await visit(root);
    return files;
};


const deriveSeriesTitle = (videoPath: string, libraryPath: string) => {
    const relativePath = relative(libraryPath, videoPath);
    const segments = relativePath.split(sep);

    if (segments.length > 1) return normalizeTitle(segments[0] ?? "");

    return normalizeTitle(
        basename(videoPath, extname(videoPath))
            .replace(/\bS\d{1,2}[ ._-]*E\d{1,3}.*$/i, "")
            .replace(/\b\d{1,2}x\d{1,3}.*$/i, "")
            .replace(/\s+-\s+\d{1,3}.*$/, "")
    );
};


const subtitleCandidates = (videoPath: string, subtitles: string[]) => {
    const videoStem = basename(videoPath, extname(videoPath)).toLocaleLowerCase();

    return subtitles.filter((subtitle) => {
        if (dirname(subtitle) !== dirname(videoPath)) return false;
        const subtitleStem = basename(subtitle, extname(subtitle)).toLocaleLowerCase();

        return (
            subtitleStem === videoStem ||
            subtitleStem.startsWith(`${videoStem}.`) ||
            subtitleStem.startsWith(`${videoStem} `) ||
            subtitleStem.startsWith(`${videoStem}-`)
        )
    });
};


const discoverLibrary = async (library: LibraryRow) => {
    const files = await walk(library.path);
    const subtitleFiles = files.filter(isSubtitle);
    const discovered = new Map<string, DiscoveredTitle>();

    for (const videoPath of files.filter(isVideo)) {
        const episode = inferEpisode(videoPath);
        const isSeries = library.kind === "series";

        const kind = isSeries ? "series" : "movie";
        const relativePath = relative(library.path, videoPath);

        const movie = cleanMovieTitle(videoPath);

        const title = isSeries
            ? deriveSeriesTitle(videoPath, library.path)
            : movie.title;

        const firstSegment = relativePath.split(sep)[0] ?? relativePath;

        const sourceKey = isSeries
            ? `show:${normalizeTitle(firstSegment).toLocaleLowerCase() || title.toLocaleLowerCase()}`
            : `movie:${relativePath.toLocaleLowerCase()}`;

        const fileStat = await stat(videoPath);

        const entry = discovered.get(sourceKey) ?? {
            kind,
            title,
            sourceKey,
            videos: [],
            year: inferYear(firstSegment) ?? movie.year,
        }

        entry.videos.push({
            path: videoPath,
            size: fileStat.size,
            title: episode?.title ?? null,
            modifiedAt: Math.round(fileStat.mtimeMs),
            seasonNumber: episode?.seasonNumber ?? null,
            episodeNumber: episode?.episodeNumber ?? null,
            subtitles: subtitleCandidates(videoPath, subtitleFiles),
        });

        discovered.set(sourceKey, entry);
    }

    return {
        titles: [...discovered.values()],
        filesSeen: files.filter(isVideo).length,
    };
};


const saveDiscovery = (library: LibraryRow, discovery: Awaited<ReturnType<typeof discoverLibrary>>) => {
    const existingItems = db
        .select()
        .from(mediaItems)
        .where(eq(mediaItems.libraryId, library.id))
        .all();

    const existingBySource = new Map(existingItems.map((item) => [item.sourceKey, item]));

    const existingParts = db
        .select({
            id: mediaParts.id,
            seasonNumber: mediaParts.seasonNumber,
            episodeNumber: mediaParts.episodeNumber,
            title: mediaParts.title,
            size: mediaParts.size,
            modifiedAt: mediaParts.modifiedAt,
        })
        .from(mediaParts)
        .innerJoin(mediaItems, eq(mediaParts.mediaItemId, mediaItems.id))
        .where(eq(mediaItems.libraryId, library.id))
        .all();

    let subtitlesFound = 0;
    const seenPartIds: string[] = [];
    const newMediaIds: string[] = [];
    const seenSubtitleIds = new Set<string>();
    const cachePartIdsToRemove = new Set<string>();
    const episodeSeasonsToRefresh = new Map<string, Set<number>>();
    const existingPartById = new Map(existingParts.map((part) => [part.id, part]));

    db.transaction(() => {
        for (const title of discovery.titles) {
            const existing = existingBySource.get(title.sourceKey);
            const mediaId = existing?.id ?? stableId("media", library.id, title.sourceKey);

            if (!existing) newMediaIds.push(mediaId);

            db.insert(mediaItems)
                .values({
                    id: mediaId,
                    kind: title.kind,
                    year: title.year,
                    title: title.title,
                    libraryId: library.id,
                    sourceKey: title.sourceKey,
                    sortTitle: normalizeTitle(title.title).toLocaleLowerCase(),
                })
                .onConflictDoUpdate({
                    target: [mediaItems.libraryId, mediaItems.sourceKey],
                    set: {
                        kind: title.kind,
                        ...(existing?.metadataStatus === "unmatched"
                            ? {
                                title: title.title,
                                year: title.year,
                                sortTitle: normalizeTitle(title.title).toLocaleLowerCase(),
                            }
                            : {}),
                        updatedAt: Date.now(),
                    },
                }).run();

            for (const video of title.videos) {
                const partId = stableId("part", video.path);
                const existingPart = existingPartById.get(partId);

                if (existingPart && (existingPart.size !== video.size || existingPart.modifiedAt !== video.modifiedAt)) {
                    cachePartIdsToRemove.add(partId);
                }

                const episodeIdentityChanged = existingPart
                    && (existingPart.seasonNumber !== video.seasonNumber || existingPart.episodeNumber !== video.episodeNumber);

                const episodeTitleMissing = Boolean(existing?.tmdbId && existingPart && !existingPart.title?.trim());

                if (video.seasonNumber !== null && video.episodeNumber !== null && (!existingPart || episodeIdentityChanged || episodeTitleMissing)) {
                    const seasons = episodeSeasonsToRefresh.get(mediaId) ?? new Set();
                    seasons.add(video.seasonNumber);
                    episodeSeasonsToRefresh.set(mediaId, seasons);
                }

                seenPartIds.push(partId);
                db.insert(mediaParts)
                    .values({
                        id: partId,
                        size: video.size,
                        title: video.title,
                        filePath: video.path,
                        mediaItemId: mediaId,
                        modifiedAt: video.modifiedAt,
                        fileName: basename(video.path),
                        seasonNumber: video.seasonNumber,
                        mimeType: mimeTypeFor(video.path),
                        episodeNumber: video.episodeNumber,
                        container: extensionOf(video.path).slice(1),
                    })
                    .onConflictDoUpdate({
                        target: mediaParts.filePath,
                        set: {
                            size: video.size,
                            mediaItemId: mediaId,
                            modifiedAt: video.modifiedAt,
                            seasonNumber: video.seasonNumber,
                            episodeNumber: video.episodeNumber,
                            ...(existing?.metadataStatus === "unmatched" ? { title: video.title } : {}),
                            updatedAt: Date.now(),
                        },
                    }).run();

                for (const subtitlePath of video.subtitles) {
                    const subtitleId = stableId("subtitle", subtitlePath);
                    const language = subtitleLanguage(subtitlePath, video.path);
                    seenSubtitleIds.add(subtitleId);
                    subtitlesFound += 1;

                    db.insert(subtitleTracks)
                        .values({
                            id: subtitleId,
                            mediaPartId: partId,
                            label: language.label,
                            filePath: subtitlePath,
                            language: language.language,
                            isDefault: language.isDefault,
                            format: extensionOf(subtitlePath).slice(1),
                        })
                        .onConflictDoUpdate({
                            target: subtitleTracks.filePath,
                            set: {
                                mediaPartId: partId,
                                label: language.label,
                                updatedAt: Date.now(),
                                language: language.language,
                                isDefault: language.isDefault,
                            },
                        }).run();
                }
            }
        }

        const libraryPartRows = db
            .select({ id: mediaParts.id })
            .from(mediaParts)
            .innerJoin(mediaItems, eq(mediaParts.mediaItemId, mediaItems.id))
            .where(eq(mediaItems.libraryId, library.id))
            .all();

        for (const row of libraryPartRows) {
            if (!seenPartIds.includes(row.id)) {
                cachePartIdsToRemove.add(row.id);

                db.delete(mediaParts)
                    .where(eq(mediaParts.id, row.id))
                    .run();
            }
        }

        const librarySubtitleRows = db
            .select({ id: subtitleTracks.id })
            .from(subtitleTracks)
            .innerJoin(mediaParts, eq(subtitleTracks.mediaPartId, mediaParts.id))
            .innerJoin(mediaItems, eq(mediaParts.mediaItemId, mediaItems.id))
            .where(eq(mediaItems.libraryId, library.id))
            .all();

        for (const row of librarySubtitleRows) {
            if (!seenSubtitleIds.has(row.id)) {
                db.delete(subtitleTracks)
                    .where(eq(subtitleTracks.id, row.id))
                    .run();
            }
        }

        for (const item of existingItems) {
            const remaining = db
                .select({ id: mediaParts.id })
                .from(mediaParts)
                .where(eq(mediaParts.mediaItemId, item.id))
                .get();

            if (!remaining)
                db.delete(mediaItems)
                    .where(eq(mediaItems.id, item.id))
                    .run();
        }
    })

    return {
        newMediaIds,
        subtitlesFound,
        cachePartIdsToRemove,
        episodeSeasonsToRefresh,
    };
};


const scanLibrary = async (libraryId: string, throwOnFailure = true): Promise<ScanRecord> => {
    ensureDatabase();

    const library = db
        .select()
        .from(libraries)
        .where(eq(libraries.id, libraryId))
        .get();

    if (!library) throw new Error("Library not found");

    const scanId = crypto.randomUUID();
    db.insert(scans).values({ id: scanId, libraryId }).run();

    try {
        const discovery = await discoverLibrary(library);
        const saved = saveDiscovery(library, discovery);
        await removeTvCompatibilityCache(saved.cachePartIdsToRemove);

        if (isTmdbConfigured()) {
            for (const mediaId of saved.newMediaIds) {
                try {
                    await autoMatchMetadata(mediaId);
                }
                catch (error) {
                    console.warn(`TMDB auto-match failed for ${mediaId}`, error);
                }
            }

            const newMediaIdSet = new Set(saved.newMediaIds);
            for (const [mediaId, seasons] of saved.episodeSeasonsToRefresh) {
                if (newMediaIdSet.has(mediaId)) continue;
                try {
                    await refreshTmdbEpisodeTitles(mediaId, [...seasons]);
                }
                catch (error) {
                    console.warn(`TMDB episode refresh failed for ${mediaId}`, error);
                }
            }
        }

        const completedAt = Date.now();
        db.update(scans)
            .set({
                completedAt,
                status: "completed",
                filesSeen: discovery.filesSeen,
                subtitlesFound: saved.subtitlesFound,
                titlesAdded: saved.newMediaIds.length,
            })
            .where(eq(scans.id, scanId))
            .run();

        return db
            .select()
            .from(scans)
            .where(eq(scans.id, scanId))
            .get() as ScanRecord;
    }
    catch (error) {
        db.update(scans)
            .set({
                status: "failed",
                completedAt: Date.now(),
                error: error instanceof Error ? error.message : "Unknown scan error",
            })
            .where(eq(scans.id, scanId))
            .run();

        if (throwOnFailure) throw error

        return db
            .select()
            .from(scans)
            .where(eq(scans.id, scanId))
            .get() as ScanRecord;
    }
};


export const scanLibraries = async (libraryId?: string) => {
    ensureDatabase();

    if (libraryId) return [await scanLibrary(libraryId)];

    const results: ScanRecord[] = [];
    const rows = db.select().from(libraries).all();

    for (const library of rows) {
        results.push(await scanLibrary(library.id, false));
    }

    return results;
};


export const createLibrary = (input: { name: string, path: string, kind: LibraryKind }) => {
    ensureDatabase();

    const path = resolve(input.path);
    const id = stableId("library", path);

    db.insert(libraries)
        .values({ id, name: input.name, path, kind: input.kind })
        .onConflictDoUpdate({
            target: libraries.path,
            set: { name: input.name, kind: input.kind, updatedAt: Date.now() },
        })
        .run();

    return db.select().from(libraries).where(eq(libraries.path, path)).get();
};


export const updateLibrary = (input: { id: string, name: string, path: string, kind: LibraryKind }) => {
    ensureDatabase();

    const existing = db
        .select({ id: libraries.id })
        .from(libraries)
        .where(eq(libraries.id, input.id))
        .get();

    if (!existing) throw new Error("Media folder not found");

    db.update(libraries)
        .set({
            name: input.name,
            path: resolve(input.path),
            kind: input.kind,
            updatedAt: Date.now(),
        })
        .where(eq(libraries.id, input.id))
        .run();

    return db.select().from(libraries).where(eq(libraries.id, input.id)).get();
};


export const deleteLibrary = async (libraryId: string) => {
    ensureDatabase();

    const exists = Boolean(db.select({ id: libraries.id })
        .from(libraries)
        .where(eq(libraries.id, libraryId))
        .get()
    );

    const partIds = db
        .select({ id: mediaParts.id })
        .from(mediaParts)
        .innerJoin(mediaItems, eq(mediaParts.mediaItemId, mediaItems.id))
        .where(eq(mediaItems.libraryId, libraryId))
        .all()
        .map((part) => part.id);

    await removeTvCompatibilityCache(partIds)

    db.delete(libraries).where(eq(libraries.id, libraryId)).run();

    return exists;
};


export const listLibraries = () => {
    ensureDatabase();
    return db.select().from(libraries).all();
};
