import {z} from "zod";

export {createPlouxApi, ApiError, healthResponseSchema} from "./api-client";
export type {HealthResponse, LibraryQueryInput, MediaQueryInput, PlouxApi} from "./api-client";


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
    updatedAt: number
    percentage: number
    completed: boolean
    positionSeconds: number
    durationSeconds: number
}

export interface SubtitleTrack {
    id: string
    url: string
    label: string
    format: string
    language: string
    isDefault: boolean
}

export interface MediaPart {
    id: string
    size: number
    fileName: string
    mimeType: string
    streamUrl: string
    title: string | null
    subtitles: SubtitleTrack[]
    seasonNumber: number | null
    episodeNumber: number | null
    progress: MediaProgress | null
}

export interface MediaSummary {
    id: string
    title: string
    addedAt: number
    kind: MediaKind
    watched: boolean
    partCount: number
    year: number | null
    hasProgress: boolean
    overview: string | null
    nextPartId: string | null
    posterPath: string | null
    releaseDate: string | null
    backdropPath: string | null
    tmdbVoteCount: number | null
    runtimeMinutes: number | null
    tmdbVoteAverage: number | null
    progress: MediaProgress | null
    metadataStatus: "matched" | "unmatched" | "manual"
}

export interface MediaDetail extends MediaSummary {
    genres: string[]
    parts: MediaPart[]
    cast: PersonCredit[]
    tmdbId: number | null
    partSeasons: number[]
    seasons: SeasonMetadata[]
    partsPagination: Pagination
    originalTitle: string | null
    contentRating: string | null
    originalLanguage: string | null
    selectedPartSeason: number | null
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
    failed: number
    matched: number
    skipped: number
    refreshed: number
}

export interface MediaStreamInfo {
    index: number
    codec: string | null
    title: string | null
    width: number | null
    type: MediaStreamType
    height: number | null
    profile: string | null
    language: string | null
    channels: number | null
    frameRate: number | null
    sampleRate: number | null
    channelLayout: string | null
    codecDescription: string | null
}

export interface MediaExternalSubtitleInfo {
    id: string
    path: string
    label: string
    format: string
    language: string
    isDefault: boolean
}

export interface MediaFileInfo {
    id: string
    path: string
    size: number
    fileName: string
    mimeType: string
    container: string
    modifiedAt: number
    bitRate: number | null
    formatName: string | null
    probeError: string | null
    streams: MediaStreamInfo[]
    durationSeconds: number | null
    externalSubtitles: MediaExternalSubtitleInfo[]
}

export interface MediaInfo {
    id: string
    title: string
    totalSize: number
    files: MediaFileInfo[]
    probeAvailable: boolean
}

export interface MediaDeleteResult {
    mediaId: string
    filesDeleted: number
    filesAlreadyMissing: number
}

export interface LibraryStats {
    anime: number
    titles: number
    movies: number
    series: number
    unmatched: number
    inProgress: number
}

export interface Pagination {
    page: number
    pageSize: number
    totalItems: number
    totalPages: number
}

export interface LibraryResponse {
    stats: LibraryStats
    items: MediaSummary[]
    pagination: Pagination
}

export interface TmdbCandidate {
    id: number
    title: string
    overview: string
    popularity: number
    year: number | null
    kind: "movie" | "tv"
    originalTitle: string
    posterPath: string | null
}

export interface ScanRecord {
    id: string
    startedAt: number
    filesSeen: number
    titlesAdded: number
    error: string | null
    subtitlesFound: number
    libraryId: string | null
    completedAt: number | null
    status: "running" | "completed" | "failed"
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
