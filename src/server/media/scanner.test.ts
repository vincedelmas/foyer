import {afterAll, beforeAll, describe, expect, it} from "vitest"
import {execFile} from "node:child_process"
import {mkdtemp, mkdir, rm, writeFile} from "node:fs/promises"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {promisify} from "node:util"


let temporaryDirectory: string
const execFileAsync = promisify(execFile)


beforeAll(async () => {
    temporaryDirectory = await mkdtemp(join(tmpdir(), "ploux-scanner-"))
})


afterAll(async () => {
    await rm(temporaryDirectory, {recursive: true, force: true})
})


describe("library scanning", () => {
    it("removes subtitle records when their files disappear", async () => {
        const mediaDirectory = join(temporaryDirectory, "media")
        const videoPath = join(mediaDirectory, "Movie.2024.mkv")
        const subtitlePath = join(mediaDirectory, "Movie.2024.en.srt")
        await mkdir(mediaDirectory)
        await Promise.all([
            writeFile(videoPath, "video"),
            writeFile(subtitlePath, "subtitle"),
        ])

        const {stdout} = await execFileAsync("bun", ["--eval", `
            const scanner = await import("./src/server/media/scanner.server.ts")
            const repository = await import("./src/server/media/repository.server.ts")
            const {unlink} = await import("node:fs/promises")
            const library = scanner.createLibrary({
                name: "Movies",
                path: process.env.REVIEW_MEDIA_PATH,
                kind: "movies",
            })
            await scanner.scanLibraries(library.id)
            const mediaId = repository.listMedia({}).items[0].id
            const before = repository.getMediaDetail(mediaId).parts[0].subtitles.length
            await unlink(process.env.REVIEW_SUBTITLE_PATH)
            await scanner.scanLibraries(library.id)
            const after = repository.getMediaDetail(mediaId).parts[0].subtitles.length
            console.log(JSON.stringify({before, after}))
        `], {
            cwd: process.cwd(),
            env: {
                ...process.env,
                TMDB_READ_ACCESS_TOKEN: "",
                REVIEW_MEDIA_PATH: mediaDirectory,
                REVIEW_SUBTITLE_PATH: subtitlePath,
                PLOUX_DATABASE_PATH: join(temporaryDirectory, "ploux.sqlite"),
            },
        })

        expect(JSON.parse(stdout.trim())).toEqual({before: 1, after: 0})
    })

    it("continues scan-all after a folder fails but throws for an explicitly requested folder", async () => {
        const mediaDirectory = join(temporaryDirectory, "scan-all-media")
        await mkdir(mediaDirectory)
        await writeFile(join(mediaDirectory, "Movie.2025.mkv"), "video")

        const {stdout} = await execFileAsync("bun", ["--eval", `
            const scanner = await import("./src/server/media/scanner.server.ts")
            const repository = await import("./src/server/media/repository.server.ts")
            const broken = scanner.createLibrary({
                name: "Broken",
                path: process.env.REVIEW_MISSING_PATH,
                kind: "movies",
            })
            const valid = scanner.createLibrary({
                name: "Movies",
                path: process.env.REVIEW_MEDIA_PATH,
                kind: "movies",
            })
            const scans = await scanner.scanLibraries()
            let explicitFailed = false
            let missingFailed = false
            try {
                await scanner.scanLibraries(broken.id)
            } catch {
                explicitFailed = true
            }
            try {
                await scanner.scanLibraries("missing-library")
            } catch {
                missingFailed = true
            }
            console.log(JSON.stringify({
                statuses: Object.fromEntries(scans.map((scan) => [scan.libraryId, scan.status])),
                titleCount: repository.listMedia({}).items.length,
                explicitFailed,
                missingFailed,
                brokenId: broken.id,
                validId: valid.id,
            }))
        `], {
            cwd: process.cwd(),
            env: {
                ...process.env,
                TMDB_READ_ACCESS_TOKEN: "",
                REVIEW_MEDIA_PATH: mediaDirectory,
                REVIEW_MISSING_PATH: join(temporaryDirectory, "does-not-exist"),
                PLOUX_DATABASE_PATH: join(temporaryDirectory, "scan-all.sqlite"),
            },
        })

        const result = JSON.parse(stdout.trim())
        expect(result.statuses).toEqual({
            [result.brokenId]: "failed",
            [result.validId]: "completed",
        })
        expect(result.titleCount).toBe(1)
        expect(result.explicitFailed).toBe(true)
        expect(result.missingFailed).toBe(true)
    })
})
