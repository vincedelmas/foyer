CREATE TABLE `libraries` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`path` text NOT NULL,
	`kind` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `libraries_path_unique` ON `libraries` (`path`);--> statement-breakpoint
CREATE TABLE `media_items` (
	`id` text PRIMARY KEY NOT NULL,
	`library_id` text NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`sort_title` text NOT NULL,
	`original_title` text,
	`year` integer,
	`overview` text,
	`metadata_status` text DEFAULT 'unmatched' NOT NULL,
	`tmdb_id` integer,
	`poster_path` text,
	`backdrop_path` text,
	`runtime_minutes` integer,
	`content_rating` text,
	`genres_json` text DEFAULT '[]' NOT NULL,
	`cast_json` text DEFAULT '[]' NOT NULL,
	`seasons_json` text DEFAULT '[]' NOT NULL,
	`original_language` text,
	`source_key` text NOT NULL,
	`added_at` integer NOT NULL,
	`metadata_refreshed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`library_id`) REFERENCES `libraries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `media_items_source_unique` ON `media_items` (`library_id`,`source_key`);--> statement-breakpoint
CREATE INDEX `media_items_kind_idx` ON `media_items` (`kind`);--> statement-breakpoint
CREATE INDEX `media_items_title_idx` ON `media_items` (`sort_title`);--> statement-breakpoint
CREATE INDEX `media_items_tmdb_idx` ON `media_items` (`tmdb_id`);--> statement-breakpoint
CREATE TABLE `media_parts` (
	`id` text PRIMARY KEY NOT NULL,
	`media_item_id` text NOT NULL,
	`file_path` text NOT NULL,
	`file_name` text NOT NULL,
	`mime_type` text NOT NULL,
	`container` text NOT NULL,
	`size` integer NOT NULL,
	`modified_at` integer NOT NULL,
	`season_number` integer,
	`episode_number` integer,
	`title` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`media_item_id`) REFERENCES `media_items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `media_parts_path_unique` ON `media_parts` (`file_path`);--> statement-breakpoint
CREATE INDEX `media_parts_item_idx` ON `media_parts` (`media_item_id`);--> statement-breakpoint
CREATE INDEX `media_parts_episode_idx` ON `media_parts` (`media_item_id`,`season_number`,`episode_number`);--> statement-breakpoint
CREATE TABLE `playback_progress` (
	`media_part_id` text PRIMARY KEY NOT NULL,
	`position_seconds` integer DEFAULT 0 NOT NULL,
	`duration_seconds` integer DEFAULT 0 NOT NULL,
	`completed` integer DEFAULT false NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`media_part_id`) REFERENCES `media_parts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `scans` (
	`id` text PRIMARY KEY NOT NULL,
	`library_id` text,
	`status` text DEFAULT 'running' NOT NULL,
	`files_seen` integer DEFAULT 0 NOT NULL,
	`titles_added` integer DEFAULT 0 NOT NULL,
	`subtitles_found` integer DEFAULT 0 NOT NULL,
	`started_at` integer NOT NULL,
	`completed_at` integer,
	`error` text,
	FOREIGN KEY (`library_id`) REFERENCES `libraries`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `scans_started_idx` ON `scans` (`started_at`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `subtitle_tracks` (
	`id` text PRIMARY KEY NOT NULL,
	`media_part_id` text NOT NULL,
	`file_path` text NOT NULL,
	`language` text DEFAULT 'und' NOT NULL,
	`label` text DEFAULT 'Subtitles' NOT NULL,
	`format` text NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`media_part_id`) REFERENCES `media_parts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `subtitle_tracks_path_unique` ON `subtitle_tracks` (`file_path`);--> statement-breakpoint
CREATE INDEX `subtitle_tracks_part_idx` ON `subtitle_tracks` (`media_part_id`);