import {randomUUID} from "node:crypto"
import {rm, writeFile} from "node:fs/promises"
import {resolve} from "node:path"
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest"

const repository = vi.hoisted(() => ({
    getPartFile: vi.fn(),
    getSubtitleFile: vi.fn(),
}))

vi.mock("@/server/media/repository.server.ts", () => repository)

import {streamPart, streamSubtitle} from "./stream.server"

const temporaryPaths: string[] = []

beforeEach(() => {
    vi.stubGlobal("Bun", {
        file: vi.fn(() => ({})),
    })
})

afterEach(async () => {
    repository.getPartFile.mockReset()
    repository.getSubtitleFile.mockReset()
    vi.unstubAllGlobals()
    await Promise.all(
        temporaryPaths.splice(0).map((path) => rm(path, {force: true}))
    )
})

const part = (filePath: string, size: number) => ({
    id: "part-1",
    mediaItemId: "media-1",
    filePath,
    fileName: "episode.mkv",
    mimeType: "video/x-matroska",
    container: "mkv",
    size,
    modifiedAt: 0,
    seasonNumber: 1,
    episodeNumber: 1,
    title: null,
    createdAt: 0,
    updatedAt: 0,
})

describe("media streaming", () => {
    it("returns a helpful 404 when a scanned file has moved", async () => {
        repository.getPartFile.mockReturnValue(
            part(resolve("/tmp", `${randomUUID()}.mkv`), 123)
        )

        const response = await streamPart(
            new Request("http://localhost/api/v1/stream/part-1"),
            "part-1"
        )

        expect(response.status).toBe(404)
        expect(await response.text()).toContain("Rescan the collection")
    })

    it("uses the current file size rather than stale scan metadata", async () => {
        const filePath = resolve("/tmp", `${randomUUID()}.mkv`)
        temporaryPaths.push(filePath)
        await writeFile(filePath, "current media bytes")
        repository.getPartFile.mockReturnValue(part(filePath, 999))

        const response = await streamPart(
            new Request("http://localhost/api/v1/stream/part-1"),
            "part-1",
            true
        )

        expect(response.status).toBe(200)
        expect(response.headers.get("content-length")).toBe("19")
    })

    it("returns a helpful 404 when a scanned subtitle has moved", async () => {
        repository.getSubtitleFile.mockReturnValue({
            id: "subtitle-1",
            mediaPartId: "part-1",
            filePath: resolve("/tmp", `${randomUUID()}.srt`),
            language: "en",
            label: "English",
            format: "srt",
            isDefault: false,
            createdAt: 0,
            updatedAt: 0,
        })

        const response = await streamSubtitle(
            new Request("http://localhost/api/v1/subtitles/subtitle-1"),
            "subtitle-1"
        )

        expect(response.status).toBe(404)
        expect(response.headers.get("cache-control")).toBe("no-store")
        expect(await response.text()).toContain("Rescan the collection")
    })
})
