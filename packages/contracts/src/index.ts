import {z} from "zod";


export const mediaKindSchema = z.enum(["movie", "series", "anime"])
export type MediaKind = z.infer<typeof mediaKindSchema>

export const libraryKindSchema = z.enum(["movies", "series"])
export type LibraryKind = z.infer<typeof libraryKindSchema>

export const mediaSortSchema = z.enum(["recent", "title", "year", "unwatched"])
export type MediaSort = z.infer<typeof mediaSortSchema>

export const libraryInputSchema = z.object({
    name: z.string().trim().min(1).max(80),
    path: z.string().trim().min(1),
    kind: libraryKindSchema,
})

export const libraryUpdateSchema = libraryInputSchema.extend({
    id: z.string().min(1),
})

export const progressInputSchema = z.object({
    partId: z.string().min(1),
    positionSeconds: z.number().nonnegative(),
    durationSeconds: z.number().nonnegative(),
})

export const metadataSearchInputSchema = z.object({
    mediaId: z.string().min(1),
    query: z.string().trim().min(1).max(160),
    year: z.number().int().min(1870).max(2200).optional(),
})

export const identifyInputSchema = z.object({
    mediaId: z.string().min(1),
    tmdbId: z.number().int().positive(),
})

export const mediaIdInputSchema = z.object({ mediaId: z.string().min(1) })
export const scanInputSchema = z.object({
    libraryId: z.string().min(1).optional(),
})

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
    overview: string | null
    posterPath: string | null
    backdropPath: string | null
    runtimeMinutes: number | null
    metadataStatus: "matched" | "unmatched" | "manual"
    addedAt: number
    partCount: number
    nextPartId: string | null
    progress: MediaProgress | null
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
    kind: LibraryKind
    titleCount: number
    posterPaths: string[]
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
