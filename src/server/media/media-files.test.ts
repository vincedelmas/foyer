import {tmpdir} from "node:os";
import {promisify} from "node:util";
import {delimiter, join} from "node:path";
import {execFile} from "node:child_process";
import {afterAll, beforeAll, describe, expect, it} from "vitest";
import {chmod, mkdir, mkdtemp, rm, writeFile} from "node:fs/promises";


let temporaryDirectory: string;
const execFileAsync = promisify(execFile);


beforeAll(async () => {
    temporaryDirectory = await mkdtemp(join(tmpdir(), "ploux-media-files-"));
})


afterAll(async () => {
    await rm(temporaryDirectory, { recursive: true, force: true });
})


describe("media file information", () => {
    it("probes only the requested file and caches it by its indexed fingerprint", async () => {
        const binDirectory = join(temporaryDirectory, "bin")
        const ffprobePath = join(binDirectory, "ffprobe")
        const probeCountPath = join(temporaryDirectory, "probe-count")
        await mkdir(binDirectory)
        await writeFile(ffprobePath, `#!/bin/sh
printf x >> "$REVIEW_PROBE_COUNT"
printf '%s' '{"streams":[{"index":0,"codec_name":"h264","codec_type":"video","width":1920,"height":1080}],"format":{"format_name":"matroska","duration":"120.5","bit_rate":"1000000"}}'
`)
        await chmod(ffprobePath, 0o755)

        const { stdout } = await execFileAsync("bun", ["--eval", `
            const {eq} = await import("drizzle-orm")
            const {db, ensureDatabase} = await import("./src/server/db/index.server.ts")
            const schema = await import("./src/server/db/schema.ts")
            const mediaFiles = await import("./src/server/media/media-files.server.ts")
            ensureDatabase()
            db.insert(schema.libraries).values({
                id: "library",
                name: "Movies",
                path: "/media",
                kind: "movies",
            }).run()
            db.insert(schema.mediaItems).values({
                id: "movie",
                libraryId: "library",
                kind: "movie",
                title: "Movie",
                sortTitle: "movie",
                sourceKey: "movie",
            }).run()
            db.insert(schema.mediaParts).values({
                id: "part",
                mediaItemId: "movie",
                filePath: "/media/movie.mkv",
                fileName: "movie.mkv",
                mimeType: "video/x-matroska",
                container: "mkv",
                size: 100,
                modifiedAt: 1,
            }).run()

            const initial = await mediaFiles.getMediaInfo("movie")
            const initialProbeRan = await Bun.file(process.env.REVIEW_PROBE_COUNT).exists()
            const first = await mediaFiles.getMediaFileInfo("movie", "part")
            const cached = await mediaFiles.getMediaFileInfo("movie", "part")
            db.update(schema.mediaParts)
                .set({modifiedAt: 2})
                .where(eq(schema.mediaParts.id, "part"))
                .run()
            await mediaFiles.getMediaFileInfo("movie", "part")
            const probeCount = (await Bun.file(process.env.REVIEW_PROBE_COUNT).text()).length

            console.log(JSON.stringify({
                initialProbeRan,
                initialFile: initial.files[0],
                first,
                cached,
                probeCount,
            }))
        `], {
            cwd: process.cwd(),
            env: {
                ...process.env,
                PATH: `${binDirectory}${delimiter}${process.env.PATH ?? ""}`,
                REVIEW_PROBE_COUNT: probeCountPath,
                PLOUX_DATABASE_PATH: join(temporaryDirectory, "media-files.sqlite"),
            },
        })

        const result = JSON.parse(stdout.trim())
        expect(result.initialProbeRan).toBe(false)
        expect(result.initialFile).toMatchObject({
            probeAvailable: null,
            durationSeconds: null,
            streams: [],
        })
        expect(result.first).toMatchObject({
            probeAvailable: true,
            durationSeconds: 120.5,
            bitRate: 1_000_000,
            formatName: "matroska",
            streams: [{ type: "video", codec: "h264", width: 1920, height: 1080 }],
        })
        expect(result.cached).toEqual(result.first)
        expect(result.probeCount).toBe(2)
    })
})
