import {z} from "zod";

export {createPlouxApi, ApiError} from "./api-client";
export type {LibraryQueryInput, PlouxApi} from "./api-client";


export const mediaKindSchema = z.enum(["movie", "series", "anime"]);
export type MediaKind = z.infer<typeof mediaKindSchema>;

export const libraryKindSchema = z.enum(["movies", "series"]);
export type LibraryKind = z.infer<typeof libraryKindSchema>;

export const mediaSortSchema = z.enum([
    "recent",
    "title",
    "release-desc",
    "release-asc",
    "runtime-desc",
    "runtime-asc",
    "rating-desc",
    "rating-asc",
]);
export type MediaSort = z.infer<typeof mediaSortSchema>;

export const mediaWatchFilterSchema = z.enum(["all", "watched", "unwatched"]);
export type MediaWatchFilter = z.infer<typeof mediaWatchFilterSchema>;

export const libraryInputSchema = z.object({
    name: z.string().trim().min(1).max(80),
    path: z.string().trim().min(1),
    kind: libraryKindSchema,
});

export const libraryUpdateSchema = libraryInputSchema.extend({
    id: z.string().min(1),
});

export const progressInputSchema = z.object({
    partId: z.string().min(1),
    positionSeconds: z.number().nonnegative(),
    durationSeconds: z.number().nonnegative(),
});

export const metadataSearchInputSchema = z.object({
    mediaId: z.string().min(1),
    query: z.string().trim().min(1).max(160),
    year: z.number().int().min(1870).max(2200).optional(),
});

export const identifyInputSchema = z.object({
    mediaId: z.string().min(1),
    tmdbId: z.number().int().positive(),
});

export const mediaIdInputSchema = z.object({ mediaId: z.string().min(1) });

export const mediaWatchStateInputSchema = z.object({ watched: z.boolean() });

export const mediaPartWatchStateInputSchema = z.object({
    partId: z.string().min(1),
    watched: z.boolean(),
});

export const mediaDeleteInputSchema = z.object({ deleteFiles: z.literal(true) });

export const libraryIdInputSchema = z.object({ libraryId: z.string().min(1) });

export const metadataRefreshInputSchema = z.union([
    mediaIdInputSchema,
    libraryIdInputSchema,
]);

export const scanInputSchema = z.object({
    libraryId: z.string().min(1).optional(),
});

export type MediaStreamType = "video" | "audio" | "subtitle" | "other"

export interface PersonCredit {
    id: number
    name: string
    character: string
    profilePath: string | null
}

export interface SeasonMetadata {
    id: number
    name: string
    seasonNumber: number
    episodeCount: number
    airDate: string | null
    posterPath: string | null
}

export interface MediaProgress {
    positionSeconds: number
    durationSeconds: number
    percentage: number
    completed: boolean
    updatedAt: number
}

export interface SubtitleTrack {
    id: string
    language: string
    label: string
    format: string
    isDefault: boolean
    url: string
}

export interface MediaPart {
    id: string
    fileName: string
    mimeType: string
    size: number
    seasonNumber: number | null
    episodeNumber: number | null
    title: string | null
    streamUrl: string
    subtitles: SubtitleTrack[]
    progress: MediaProgress | null
}

export interface MediaSummary {
    id: string
    kind: MediaKind
    title: string
    year: number | null
    releaseDate: string | null
    overview: string | null
    posterPath: string | null
    backdropPath: string | null
    runtimeMinutes: number | null
    tmdbVoteAverage: number | null
    tmdbVoteCount: number | null
    metadataStatus: "matched" | "unmatched" | "manual"
    addedAt: number
    partCount: number
    nextPartId: string | null
    progress: MediaProgress | null
    watched: boolean
    hasProgress: boolean
}

export interface MediaDetail extends MediaSummary {
    tmdbId: number | null
    originalTitle: string | null
    originalLanguage: string | null
    contentRating: string | null
    genres: string[]
    cast: PersonCredit[]
    seasons: SeasonMetadata[]
    parts: MediaPart[]
    metadataRefreshedAt: number | null
}

export interface LibraryRecord {
    id: string
    name: string
    path: string
    kind: LibraryKind
    createdAt: number
    updatedAt: number
}

export interface MediaFolderSummary {
    id: string
    name: string
    path: string
    kind: LibraryKind
    titleCount: number
    posterPaths: string[]
}

export interface MetadataRefreshSummary {
    total: number
    refreshed: number
    matched: number
    skipped: number
    failed: number
}

export interface MediaStreamInfo {
    index: number
    type: MediaStreamType
    codec: string | null
    codecDescription: string | null
    profile: string | null
    language: string | null
    title: string | null
    width: number | null
    height: number | null
    frameRate: number | null
    channels: number | null
    channelLayout: string | null
    sampleRate: number | null
}

export interface MediaExternalSubtitleInfo {
    id: string
    path: string
    format: string
    language: string
    label: string
    isDefault: boolean
}

export interface MediaFileInfo {
    id: string
    fileName: string
    path: string
    container: string
    mimeType: string
    size: number
    modifiedAt: number
    formatName: string | null
    durationSeconds: number | null
    bitRate: number | null
    streams: MediaStreamInfo[]
    externalSubtitles: MediaExternalSubtitleInfo[]
    probeError: string | null
}

export interface MediaInfo {
    id: string
    title: string
    totalSize: number
    probeAvailable: boolean
    files: MediaFileInfo[]
}

export interface MediaDeleteResult {
    mediaId: string
    filesDeleted: number
    filesAlreadyMissing: number
}

export interface LibraryStats {
    titles: number
    movies: number
    series: number
    anime: number
    unmatched: number
    inProgress: number
}

export interface LibraryResponse {
    items: MediaSummary[]
    stats: LibraryStats
    pagination: {
        page: number
        pageSize: number
        totalItems: number
        totalPages: number
    }
}

export interface TmdbCandidate {
    id: number
    kind: "movie" | "tv"
    title: string
    originalTitle: string
    year: number | null
    overview: string
    posterPath: string | null
    popularity: number
}

export interface ScanRecord {
    id: string
    libraryId: string | null
    status: "running" | "completed" | "failed"
    filesSeen: number
    titlesAdded: number
    subtitlesFound: number
    startedAt: number
    completedAt: number | null
    error: string | null
}


export const tmdbImage = (path: string | null | undefined, size: "w342" | "w500" | "w780" | "w1280" | "original" = "w500") => {
    return path ? `https://image.tmdb.org/t/p/${size}${path}` : null;
};


export const formatRuntime = (minutes: number | null) => {
    if (!minutes) return null;

    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;

    return hours ? `${hours}h ${rest}m` : `${rest}m`;
};


export const formatBytes = (bytes: number) => {
    let unit = 0;
    let value = bytes;
    const units = ["B", "KB", "MB", "GB", "TB"];

    while (value >= 1024 && unit < units.length - 1) {
        unit += 1;
        value /= 1024;
    }

    return `${value.toFixed(unit > 1 ? 1 : 0)} ${units[unit]}`;
};


export const formatBitRate = (bitRate: number | null) => {
    return bitRate === null
        ? null
        : `${(bitRate / 1_000_000).toFixed(2)} Mbps`;
};


export const formatDurationSeconds = (seconds: number | null) => {
    if (seconds === null) return null;

    const totalSeconds = Math.round(seconds);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const remainingSeconds = totalSeconds % 60;

    return hours
        ? `${hours}h ${minutes}m ${remainingSeconds}s`
        : `${minutes}m ${remainingSeconds}s`;
};
