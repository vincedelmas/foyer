import {eq} from "drizzle-orm";
import {normalizeTitle} from "./file-utils.server";
import {createRequestRateLimiter} from "./request-rate-limiter";
import {libraries, mediaItems, mediaParts} from "@/server/db/schema";
import {db, ensureDatabase} from "@/server/db/index.server";
import {MediaKind, MetadataRefreshSummary, PersonCredit, SeasonMetadata, TmdbCandidate} from "@foyer/contracts";
import {matchLocalEpisodeTitles} from "./episode-metadata";


const API_URL = "https://api.themoviedb.org/3";
const waitForTmdbRequestSlot = createRequestRateLimiter(10)


interface SearchResult {
    id: number
    media_type?: "movie" | "tv"
    title?: string
    name?: string
    original_title?: string
    original_name?: string
    release_date?: string
    first_air_date?: string
    overview?: string
    poster_path?: string | null
    popularity?: number
}

interface TmdbDetails {
    id: number
    title?: string
    name?: string
    original_title?: string
    original_name?: string
    release_date?: string
    first_air_date?: string
    overview?: string
    poster_path?: string | null
    backdrop_path?: string | null
    runtime?: number | null
    vote_average?: number
    vote_count?: number
    episode_run_time?: number[]
    original_language?: string
    genres?: Array<{ id: number; name: string }>
    seasons?: Array<{
        id: number
        name: string
        season_number: number
        episode_count: number
        air_date?: string | null
        poster_path?: string | null
    }>
    credits?: {
        cast?: Array<{
            id: number
            name: string
            character?: string
            roles?: Array<{ character?: string }>
            profile_path?: string | null
        }>
    }
    content_ratings?: { results?: Array<{ iso_3166_1: string; rating: string }> }
    release_dates?: {
        results?: Array<{
            iso_3166_1: string
            release_dates: Array<{ certification?: string }>
        }>
    }
}

interface TmdbSeasonDetails {
    episodes?: Array<{
        episode_number: number
        name?: string | null
    }>
}

class TmdbNotConfiguredError extends Error {
    constructor() {
        super(
            "TMDB is not configured. Set TMDB_READ_ACCESS_TOKEN in the environment."
        )
    }
}

const readToken = () => {
    return process.env.TMDB_READ_ACCESS_TOKEN?.trim()
}

export const isTmdbConfigured = () => Boolean(readToken())

const tmdbFetch = async <T>(
    path: string,
    params?: Record<string, string | number>
) => {
    const token = readToken()
    if (!token) throw new TmdbNotConfiguredError()

    const url = new URL(`${API_URL}${path}`)
    url.searchParams.set("language", "en-US")
    for (const [key, value] of Object.entries(params ?? {})) {
        url.searchParams.set(key, String(value))
    }

    await waitForTmdbRequestSlot()
    const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    })
    if (!response.ok) {
        throw new Error(
            `TMDB request failed (${response.status} ${response.statusText})`
        )
    }
    return (await response.json()) as T
}

const resultKind = (kind: MediaKind) => (kind === "movie" ? "movie" : "tv")

export const searchTmdb = async (
    kind: MediaKind,
    query: string,
    year?: number
): Promise<TmdbCandidate[]> => {
    const tmdbKind = resultKind(kind)
    const response = await tmdbFetch<{ results: SearchResult[] }>(
        `/search/${tmdbKind}`,
        {
            query: query.normalize("NFC"),
            include_adult: "false",
            ...(year
                ? tmdbKind === "movie"
                    ? { year }
                    : { first_air_date_year: year }
                : {}),
        }
    )

    return response.results.slice(0, 12).map((result) => {
        const date = result.release_date ?? result.first_air_date
        return {
            id: result.id,
            kind: tmdbKind,
            title: result.title ?? result.name ?? "Untitled",
            originalTitle:
                result.original_title ??
                result.original_name ??
                result.title ??
                result.name ??
                "Untitled",
            year: date ? Number(date.slice(0, 4)) || null : null,
            overview: result.overview ?? "",
            posterPath: result.poster_path ?? null,
            popularity: result.popularity ?? 0,
        }
    })
}

const preferredRating = (details: TmdbDetails, kind: MediaKind) => {
    if (kind === "movie") {
        const releases = details.release_dates?.results ?? []
        const region =
            releases.find((entry) => entry.iso_3166_1 === "FR") ??
            releases.find((entry) => entry.iso_3166_1 === "US")
        return (
            region?.release_dates.find((entry) => entry.certification)
                ?.certification || null
        )
    }
    const ratings = details.content_ratings?.results ?? []
    return (
        ratings.find((entry) => entry.iso_3166_1 === "FR")?.rating ??
        ratings.find((entry) => entry.iso_3166_1 === "US")?.rating ??
        null
    )
}

const syncEpisodeTitles = async (
    mediaId: string,
    tmdbId: number,
    requestedSeasons?: number[]
) => {
    const parts = db
        .select({
            id: mediaParts.id,
            seasonNumber: mediaParts.seasonNumber,
            episodeNumber: mediaParts.episodeNumber,
        })
        .from(mediaParts)
        .where(eq(mediaParts.mediaItemId, mediaId))
        .all()
    const requested = requestedSeasons ? new Set(requestedSeasons) : null
    const localSeasons = [...new Set(parts.flatMap((part) =>
        part.seasonNumber !== null &&
        part.episodeNumber !== null &&
        (!requested || requested.has(part.seasonNumber))
            ? [part.seasonNumber]
            : []
    ))].sort((left, right) => left - right)

    if (!localSeasons.length) return 0

    const episodeMetadata = []
    for (const seasonNumber of localSeasons) {
        try {
            const season = await tmdbFetch<TmdbSeasonDetails>(
                `/tv/${tmdbId}/season/${seasonNumber}`
            )
            episodeMetadata.push(...(season.episodes ?? []).flatMap((episode) => {
                const title = episode.name?.trim()
                return title
                    ? [{
                        seasonNumber,
                        episodeNumber: episode.episode_number,
                        title,
                    }]
                    : []
            }))
        }
        catch (error) {
            console.warn(
                `TMDB episode metadata failed for ${mediaId} season ${seasonNumber}`,
                error
            )
        }
    }

    const updates = matchLocalEpisodeTitles(parts, episodeMetadata)
    db.transaction(() => {
        for (const update of updates) {
            db.update(mediaParts)
                .set({title: update.title, updatedAt: Date.now()})
                .where(eq(mediaParts.id, update.partId))
                .run()
        }
    })
    return updates.length
}

export const refreshTmdbEpisodeTitles = async (
    mediaId: string,
    seasonNumbers?: number[]
) => {
    ensureDatabase()
    const item = db
        .select({id: mediaItems.id, kind: mediaItems.kind, tmdbId: mediaItems.tmdbId})
        .from(mediaItems)
        .where(eq(mediaItems.id, mediaId))
        .get()

    if (!item) throw new Error("Media item not found")
    if (item.kind === "movie" || !item.tmdbId) return 0
    return syncEpisodeTitles(item.id, item.tmdbId, seasonNumbers)
}

export const applyTmdbMetadata = async (
    mediaId: string,
    tmdbId: number,
    mode: "matched" | "manual" = "manual"
) => {
    ensureDatabase()
    const item = db
        .select()
        .from(mediaItems)
        .where(eq(mediaItems.id, mediaId))
        .get()
    if (!item) throw new Error("Media item not found")

    const tmdbKind = resultKind(item.kind)
    const details = await tmdbFetch<TmdbDetails>(`/${tmdbKind}/${tmdbId}`, {
        append_to_response: "credits,content_ratings,release_dates",
    })

    const cast: PersonCredit[] = (details.credits?.cast ?? [])
        .slice(0, 14)
        .map((person) => ({
            id: person.id,
            name: person.name,
            character: person.character ?? person.roles?.[0]?.character ?? "",
            profilePath: person.profile_path ?? null,
        }))
    const seasons: SeasonMetadata[] = (details.seasons ?? [])
        .filter((season) => season.season_number > 0)
        .map((season) => ({
            id: season.id,
            name: season.name,
            seasonNumber: season.season_number,
            episodeCount: season.episode_count,
            airDate: season.air_date ?? null,
            posterPath: season.poster_path ?? null,
        }))
    const date = details.release_date ?? details.first_air_date
    const title = details.title ?? details.name ?? item.title

    db.update(mediaItems)
        .set({
            tmdbId,
            title,
            sortTitle: normalizeTitle(title).toLocaleLowerCase(),
            originalTitle: details.original_title ?? details.original_name ?? null,
            year: date ? Number(date.slice(0, 4)) || item.year : item.year,
            releaseDate: date ?? null,
            overview: details.overview ?? null,
            posterPath: details.poster_path ?? null,
            backdropPath: details.backdrop_path ?? null,
            runtimeMinutes:
                details.runtime ??
                (details.episode_run_time?.length
                    ? Math.round(
                        details.episode_run_time.reduce(
                            (total, value) => total + value,
                            0
                        ) / details.episode_run_time.length
                    )
                    : null),
            contentRating: preferredRating(details, item.kind),
            tmdbVoteAverage: details.vote_average ?? null,
            tmdbVoteCount: details.vote_count ?? null,
            genresJson: JSON.stringify(
                details.genres?.map((genre) => genre.name) ?? []
            ),
            castJson: JSON.stringify(cast),
            seasonsJson: JSON.stringify(seasons),
            originalLanguage: details.original_language ?? null,
            metadataStatus: mode,
            metadataRefreshedAt: Date.now(),
            updatedAt: Date.now(),
        })
        .where(eq(mediaItems.id, mediaId))
        .run()

    if (tmdbKind === "tv") await syncEpisodeTitles(mediaId, tmdbId)

    return db.select().from(mediaItems).where(eq(mediaItems.id, mediaId)).get()
}

export const autoMatchMetadata = async (mediaId: string) => {
    ensureDatabase()
    const item = db
        .select()
        .from(mediaItems)
        .where(eq(mediaItems.id, mediaId))
        .get()
    if (!item || item.tmdbId) return null
    const candidates = await searchTmdb(
        item.kind,
        item.title,
        item.year ?? undefined
    )
    const exact = candidates.find(
        (candidate) =>
            normalizeTitle(candidate.title).toLocaleLowerCase() ===
            normalizeTitle(item.title).toLocaleLowerCase()
    )
    const selected = exact ?? candidates[0]
    if (!selected) return null
    return applyTmdbMetadata(item.id, selected.id, "matched")
}

export const refreshTmdbMetadata = async (mediaId: string) => {
    ensureDatabase()
    const item = db
        .select()
        .from(mediaItems)
        .where(eq(mediaItems.id, mediaId))
        .get()
    if (!item) throw new Error("Media item not found")
    if (!item.tmdbId)
        throw new Error("Identify this title before refreshing its metadata")
    return applyTmdbMetadata(
        item.id,
        item.tmdbId,
        item.metadataStatus === "manual" ? "manual" : "matched"
    )
}


export const refreshLibraryMetadata = async (
    libraryId: string
): Promise<MetadataRefreshSummary> => {
    ensureDatabase()

    const library = db
        .select({id: libraries.id})
        .from(libraries)
        .where(eq(libraries.id, libraryId))
        .get()

    if (!library) throw new Error("Media folder not found")

    const items = db
        .select()
        .from(mediaItems)
        .where(eq(mediaItems.libraryId, libraryId))
        .all()
    const summary: MetadataRefreshSummary = {
        total: items.length,
        refreshed: 0,
        matched: 0,
        skipped: 0,
        failed: 0,
    }

    if (!items.length) return summary
    if (!isTmdbConfigured()) throw new TmdbNotConfiguredError()

    for (const item of items) {
        try {
            if (item.tmdbId) {
                await refreshTmdbMetadata(item.id)
                summary.refreshed += 1
                continue
            }

            const match = await autoMatchMetadata(item.id)
            if (match) summary.matched += 1
            else summary.skipped += 1
        }
        catch (error) {
            summary.failed += 1
            console.warn(`TMDB metadata refresh failed for ${item.id}`, error)
        }
    }

    return summary
}
