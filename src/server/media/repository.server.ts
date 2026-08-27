import type {
  LibraryResponse,
  LibraryStats,
  MediaDetail,
  MediaKind,
  MediaPart,
  MediaProgress,
  MediaSort,
  MediaSummary,
  PersonCredit,
  SeasonMetadata,
  SubtitleTrack,
} from "@ploux/contracts"
import { and, eq, like, or } from "drizzle-orm"

import { db, ensureDatabase } from "@/server/db/index.server"
import {
  mediaItems,
  mediaParts,
  playbackProgress,
  subtitleTracks,
  type MediaItemRow,
  type MediaPartRow,
  type ProgressRow,
  type SubtitleRow,
} from "@/server/db/schema"

const parseJson = <T>(value: string, fallback: T): T => {
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

const asProgress = (row: ProgressRow | undefined): MediaProgress | null => {
  if (!row) return null
  const percentage = row.durationSeconds
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

const selectNextPart = (
  parts: MediaPartRow[],
  progressByPart: Map<string, ProgressRow>
) => {
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

const asSummary = (
  item: MediaItemRow,
  parts: MediaPartRow[],
  progressByPart: Map<string, ProgressRow>
): MediaSummary => {
  const nextPart = selectNextPart(parts, progressByPart)
  return {
    id: item.id,
    kind: item.kind,
    title: item.title,
    year: item.year,
    overview: item.overview,
    posterPath: item.posterPath,
    backdropPath: item.backdropPath,
    runtimeMinutes: item.runtimeMinutes,
    metadataStatus: item.metadataStatus,
    addedAt: item.addedAt,
    partCount: parts.length,
    nextPartId: nextPart?.id ?? null,
    progress: nextPart ? asProgress(progressByPart.get(nextPart.id)) : null,
  }
}

const loadMediaRows = (kind?: MediaKind, search?: string) => {
  const filters = [
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
  if (!items.length) return []
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

const applySort = (items: MediaSummary[], sort: MediaSort) => {
  return items.sort((left, right) => {
    if (sort === "title") return left.title.localeCompare(right.title)
    if (sort === "year")
      return (
        (right.year ?? 0) - (left.year ?? 0) ||
        left.title.localeCompare(right.title)
      )
    if (sort === "unwatched") {
      return (
        Number(left.progress?.completed ?? false) -
        Number(right.progress?.completed ?? false)
      )
    }
    return right.addedAt - left.addedAt
  })
}

export const listMedia = (input: {
  kind?: MediaKind
  search?: string
  sort?: MediaSort
}): LibraryResponse => {
  ensureDatabase()
  const all = hydrateSummaries(loadMediaRows())
  const filtered = hydrateSummaries(
    loadMediaRows(input.kind, input.search?.trim() || undefined)
  )
  const stats: LibraryStats = {
    titles: all.length,
    movies: all.filter((item) => item.kind === "movie").length,
    series: all.filter((item) => item.kind === "series").length,
    anime: all.filter((item) => item.kind === "anime").length,
    unmatched: all.filter((item) => item.metadataStatus === "unmatched").length,
    inProgress: all.filter(
      (item) =>
        item.progress &&
        item.progress.positionSeconds > 0 &&
        !item.progress.completed
    ).length,
  }
  return { items: applySort(filtered, input.sort ?? "recent"), stats }
}

export const getMediaDetail = (mediaId: string): MediaDetail | null => {
  ensureDatabase()
  const item = db
    .select()
    .from(mediaItems)
    .where(eq(mediaItems.id, mediaId))
    .get()
  if (!item) return null
  const parts = db
    .select()
    .from(mediaParts)
    .where(eq(mediaParts.mediaItemId, mediaId))
    .all()
    .sort(sortParts)
  const progressRows = db.select().from(playbackProgress).all()
  const progressByPart = new Map(
    progressRows.map((row) => [row.mediaPartId, row])
  )
  const subtitleRows = db.select().from(subtitleTracks).all()
  const subtitlesByPart = new Map<string, SubtitleRow[]>()
  for (const subtitle of subtitleRows) {
    const bucket = subtitlesByPart.get(subtitle.mediaPartId) ?? []
    bucket.push(subtitle)
    subtitlesByPart.set(subtitle.mediaPartId, bucket)
  }
  const summary = asSummary(item, parts, progressByPart)

  const hydratedParts: MediaPart[] = parts.map((part) => ({
    id: part.id,
    fileName: part.fileName,
    mimeType: part.mimeType,
    size: part.size,
    seasonNumber: part.seasonNumber,
    episodeNumber: part.episodeNumber,
    title: part.title,
    streamUrl: `/api/v1/stream/${part.id}`,
    subtitles: (subtitlesByPart.get(part.id) ?? []).map(
      (subtitle): SubtitleTrack => ({
        id: subtitle.id,
        language: subtitle.language,
        label: subtitle.label,
        format: subtitle.format,
        isDefault: subtitle.isDefault,
        url: `/api/v1/subtitles/${subtitle.id}`,
      })
    ),
    progress: asProgress(progressByPart.get(part.id)),
  }))

  return {
    ...summary,
    tmdbId: item.tmdbId,
    originalTitle: item.originalTitle,
    originalLanguage: item.originalLanguage,
    contentRating: item.contentRating,
    genres: parseJson<string[]>(item.genresJson, []),
    cast: parseJson<PersonCredit[]>(item.castJson, []),
    seasons: parseJson<SeasonMetadata[]>(item.seasonsJson, []),
    parts: hydratedParts,
    metadataRefreshedAt: item.metadataRefreshedAt,
  }
}

export const saveProgress = (input: {
  partId: string
  positionSeconds: number
  durationSeconds: number
}) => {
  ensureDatabase()
  const part = db
    .select()
    .from(mediaParts)
    .where(eq(mediaParts.id, input.partId))
    .get()
  if (!part) throw new Error("Media part not found")
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
  ensureDatabase()
  return (
    db.select().from(mediaParts).where(eq(mediaParts.id, partId)).get() ?? null
  )
}

export const getSubtitleFile = (subtitleId: string) => {
  ensureDatabase()
  return (
    db
      .select()
      .from(subtitleTracks)
      .where(eq(subtitleTracks.id, subtitleId))
      .get() ?? null
  )
}
