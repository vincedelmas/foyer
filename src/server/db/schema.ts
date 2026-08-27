import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core"

const timestamps = {
  createdAt: integer("created_at")
    .notNull()
    .$defaultFn(() => Date.now()),
  updatedAt: integer("updated_at")
    .notNull()
    .$defaultFn(() => Date.now())
    .$onUpdateFn(() => Date.now()),
}

export const libraries = sqliteTable(
  "libraries",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    path: text("path").notNull(),
    kind: text("kind", {
      enum: ["movies", "series", "anime", "mixed"],
    }).notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex("libraries_path_unique").on(table.path)]
)

export const mediaItems = sqliteTable(
  "media_items",
  {
    id: text("id").primaryKey(),
    libraryId: text("library_id")
      .notNull()
      .references(() => libraries.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["movie", "series", "anime"] }).notNull(),
    title: text("title").notNull(),
    sortTitle: text("sort_title").notNull(),
    originalTitle: text("original_title"),
    year: integer("year"),
    overview: text("overview"),
    metadataStatus: text("metadata_status", {
      enum: ["matched", "unmatched", "manual"],
    })
      .notNull()
      .default("unmatched"),
    tmdbId: integer("tmdb_id"),
    posterPath: text("poster_path"),
    backdropPath: text("backdrop_path"),
    runtimeMinutes: integer("runtime_minutes"),
    contentRating: text("content_rating"),
    genresJson: text("genres_json").notNull().default("[]"),
    castJson: text("cast_json").notNull().default("[]"),
    seasonsJson: text("seasons_json").notNull().default("[]"),
    originalLanguage: text("original_language"),
    sourceKey: text("source_key").notNull(),
    addedAt: integer("added_at")
      .notNull()
      .$defaultFn(() => Date.now()),
    metadataRefreshedAt: integer("metadata_refreshed_at"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("media_items_source_unique").on(
      table.libraryId,
      table.sourceKey
    ),
    index("media_items_kind_idx").on(table.kind),
    index("media_items_title_idx").on(table.sortTitle),
    index("media_items_tmdb_idx").on(table.tmdbId),
  ]
)

export const mediaParts = sqliteTable(
  "media_parts",
  {
    id: text("id").primaryKey(),
    mediaItemId: text("media_item_id")
      .notNull()
      .references(() => mediaItems.id, { onDelete: "cascade" }),
    filePath: text("file_path").notNull(),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    container: text("container").notNull(),
    size: integer("size").notNull(),
    modifiedAt: integer("modified_at").notNull(),
    seasonNumber: integer("season_number"),
    episodeNumber: integer("episode_number"),
    title: text("title"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("media_parts_path_unique").on(table.filePath),
    index("media_parts_item_idx").on(table.mediaItemId),
    index("media_parts_episode_idx").on(
      table.mediaItemId,
      table.seasonNumber,
      table.episodeNumber
    ),
  ]
)

export const subtitleTracks = sqliteTable(
  "subtitle_tracks",
  {
    id: text("id").primaryKey(),
    mediaPartId: text("media_part_id")
      .notNull()
      .references(() => mediaParts.id, { onDelete: "cascade" }),
    filePath: text("file_path").notNull(),
    language: text("language").notNull().default("und"),
    label: text("label").notNull().default("Subtitles"),
    format: text("format").notNull(),
    isDefault: integer("is_default", { mode: "boolean" })
      .notNull()
      .default(false),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("subtitle_tracks_path_unique").on(table.filePath),
    index("subtitle_tracks_part_idx").on(table.mediaPartId),
  ]
)

export const playbackProgress = sqliteTable("playback_progress", {
  mediaPartId: text("media_part_id")
    .primaryKey()
    .references(() => mediaParts.id, { onDelete: "cascade" }),
  positionSeconds: integer("position_seconds").notNull().default(0),
  durationSeconds: integer("duration_seconds").notNull().default(0),
  completed: integer("completed", { mode: "boolean" }).notNull().default(false),
  updatedAt: integer("updated_at")
    .notNull()
    .$defaultFn(() => Date.now()),
})

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at")
    .notNull()
    .$defaultFn(() => Date.now()),
})

export const scans = sqliteTable(
  "scans",
  {
    id: text("id").primaryKey(),
    libraryId: text("library_id").references(() => libraries.id, {
      onDelete: "set null",
    }),
    status: text("status", { enum: ["running", "completed", "failed"] })
      .notNull()
      .default("running"),
    filesSeen: integer("files_seen").notNull().default(0),
    titlesAdded: integer("titles_added").notNull().default(0),
    subtitlesFound: integer("subtitles_found").notNull().default(0),
    startedAt: integer("started_at")
      .notNull()
      .$defaultFn(() => Date.now()),
    completedAt: integer("completed_at"),
    error: text("error"),
  },
  (table) => [index("scans_started_idx").on(table.startedAt)]
)

export type LibraryRow = typeof libraries.$inferSelect
export type MediaItemRow = typeof mediaItems.$inferSelect
export type MediaPartRow = typeof mediaParts.$inferSelect
export type SubtitleRow = typeof subtitleTracks.$inferSelect
export type ProgressRow = typeof playbackProgress.$inferSelect
