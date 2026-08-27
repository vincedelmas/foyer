import type {
  MediaKind,
  PersonCredit,
  SeasonMetadata,
  TmdbCandidate,
} from "@ploux/contracts"
import { eq } from "drizzle-orm"

import { db, ensureDatabase } from "@/server/db/index.server"
import { mediaItems, settings } from "@/server/db/schema"
import { normalizeTitle } from "./file-utils.server"

const API_URL = "https://api.themoviedb.org/3"

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

class TmdbNotConfiguredError extends Error {
  constructor() {
    super(
      "TMDB is not configured. Add TMDB_READ_ACCESS_TOKEN or save a token in Settings."
    )
  }
}

const readToken = () => {
  const environmentToken = process.env.TMDB_READ_ACCESS_TOKEN?.trim()
  if (environmentToken) return environmentToken
  ensureDatabase()
  return db
    .select()
    .from(settings)
    .where(eq(settings.key, "tmdb_token"))
    .get()
    ?.value.trim()
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
      query,
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
