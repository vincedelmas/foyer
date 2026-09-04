import {afterAll, beforeAll, describe, expect, it} from "vitest";
import {execFile} from "node:child_process";
import {mkdtemp, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {promisify} from "node:util";


let temporaryDirectory: string;
const execFileAsync = promisify(execFile);


beforeAll(async () => {
    temporaryDirectory = await mkdtemp(join(tmpdir(), "foyer-repository-"));
});


afterAll(async () => {
    await rm(temporaryDirectory, {recursive: true, force: true});
});


describe("media repository", () => {
    it("paginates titles and seasons in SQLite while keeping collection stats and the playback queue", async () => {
        const {stdout} = await execFileAsync("bun", ["--eval", `
            const {db, ensureDatabase} = await import("./src/server/db/index.server.ts")
            const schema = await import("./src/server/db/schema.ts")
            const repository = await import("./src/server/media/repository.server.ts")
            ensureDatabase()

            db.insert(schema.libraries).values({
                id: "library",
                name: "Movies",
                path: "/media",
                kind: "movies",
            }).run()
            db.insert(schema.mediaItems).values([
                {id: "a", libraryId: "library", kind: "movie", title: "Alpha", sortTitle: "alpha", sourceKey: "a", addedAt: 1},
                {id: "b", libraryId: "library", kind: "movie", title: "Bravo", sortTitle: "bravo", sourceKey: "b", addedAt: 2},
                {id: "c", libraryId: "library", kind: "movie", title: "Charlie", sortTitle: "charlie", sourceKey: "c", addedAt: 3},
                {id: "show", libraryId: "library", kind: "series", title: "Show", sortTitle: "show", sourceKey: "show", addedAt: 4},
            ]).run()
            db.insert(schema.mediaParts).values([
                {id: "part-a", mediaItemId: "a", filePath: "/media/a.mkv", fileName: "a.mkv", mimeType: "video/x-matroska", container: "mkv", size: 1, modifiedAt: 1},
                {id: "part-b", mediaItemId: "b", filePath: "/media/b.mkv", fileName: "b.mkv", mimeType: "video/x-matroska", container: "mkv", size: 1, modifiedAt: 1},
                {id: "part-c", mediaItemId: "c", filePath: "/media/c.mkv", fileName: "c.mkv", mimeType: "video/x-matroska", container: "mkv", size: 1, modifiedAt: 1},
                {id: "s1e1", mediaItemId: "show", filePath: "/media/s1e1.mkv", fileName: "s1e1.mkv", mimeType: "video/x-matroska", container: "mkv", size: 1, modifiedAt: 1, seasonNumber: 1, episodeNumber: 1},
                {id: "s1e2", mediaItemId: "show", filePath: "/media/s1e2.mkv", fileName: "s1e2.mkv", mimeType: "video/x-matroska", container: "mkv", size: 1, modifiedAt: 1, seasonNumber: 1, episodeNumber: 2},
                {id: "s1e3", mediaItemId: "show", filePath: "/media/s1e3.mkv", fileName: "s1e3.mkv", mimeType: "video/x-matroska", container: "mkv", size: 1, modifiedAt: 1, seasonNumber: 1, episodeNumber: 3},
                {id: "s2e1", mediaItemId: "show", filePath: "/media/s2e1.mkv", fileName: "s2e1.mkv", mimeType: "video/x-matroska", container: "mkv", size: 1, modifiedAt: 1, seasonNumber: 2, episodeNumber: 1},
            ]).run()
            db.insert(schema.playbackProgress).values([
                {mediaPartId: "part-a", positionSeconds: 100, durationSeconds: 100, completed: true},
                {mediaPartId: "part-b", positionSeconds: 40, durationSeconds: 100, completed: false},
            ]).run()

            const first = repository.listMedia({libraryId: "library", sort: "title", watch: "unwatched", page: 1, pageSize: 1})
            const second = repository.listMedia({libraryId: "library", sort: "title", watch: "unwatched", page: 2, pageSize: 1})
            const episodePage = repository.getMediaDetail("show", {season: 1, page: 2, pageSize: 1})
            const playbackQueue = repository.getMediaDetail("show")
            repository.setMediaPartWatched("s1e1", true)
            const continuationPage = repository.getMediaDetail("show", {season: 1, pageSize: 1})
            repository.setMediaPartWatched("s1e1", false)
            repository.setMediaWatched("show", true, 1)
            const watchedSeason = repository.getMediaDetail("show")
            const continuation = repository.getMediaDetail("show", {pageSize: 50})
            const deletedEpisodeProgress = repository.deleteMediaPartProgress("s1e2")
            const clearedEpisode = repository.getMediaDetail("show")
            console.log(JSON.stringify({
                firstId: first.items[0].id,
                secondId: second.items[0].id,
                pagination: first.pagination,
                stats: first.stats,
                episodePage: {
                    partCount: episodePage.partCount,
                    partIds: episodePage.parts.map((part) => part.id),
                    partSeasons: episodePage.partSeasons,
                    selectedPartSeason: episodePage.selectedPartSeason,
                    pagination: episodePage.partsPagination,
                },
                playbackQueueSize: playbackQueue.parts.length,
                continuationPage: {
                    page: continuationPage.partsPagination.page,
                    partIds: continuationPage.parts.map((part) => part.id),
                },
                watchedSeasons: watchedSeason.watchedSeasons,
                continuationSeason: continuation.selectedPartSeason,
                remainingEpisodes: continuation.unwatchedPartCount,
                deletedEpisodeProgress,
                watchedSeasonsAfterClear: clearedEpisode.watchedSeasons,
                clearedEpisodeProgress: clearedEpisode.parts.find((part) => part.id === "s1e2").progress,
            }))
        `], {
            cwd: process.cwd(),
            env: {
                ...process.env,
                FOYER_DATABASE_PATH: join(temporaryDirectory, "foyer.sqlite"),
            },
        });

        expect(JSON.parse(stdout.trim())).toEqual({
            firstId: "b",
            secondId: "c",
            pagination: {
                page: 1,
                pageSize: 1,
                totalItems: 3,
                totalPages: 3,
            },
            stats: {
                titles: 4,
                anime: 0,
                movies: 3,
                series: 1,
                unmatched: 4,
                inProgress: 1,
            },
            episodePage: {
                partCount: 4,
                partIds: ["s1e2"],
                partSeasons: [1, 2],
                selectedPartSeason: 1,
                pagination: {
                    page: 2,
                    pageSize: 1,
                    totalItems: 3,
                    totalPages: 3,
                },
            },
            playbackQueueSize: 4,
            continuationPage: {
                page: 2,
                partIds: ["s1e2"],
            },
            watchedSeasons: [1],
            continuationSeason: 2,
            remainingEpisodes: 1,
            deletedEpisodeProgress: 1,
            watchedSeasonsAfterClear: [],
            clearedEpisodeProgress: null,
        });
    });
});
