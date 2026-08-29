import {randomUUID} from "node:crypto"
import {rm, writeFile} from "node:fs/promises"
import {resolve} from "node:path"
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest"

const repository = vi.hoisted(() => ({
    getPartFile: vi.fn(),
    getSubtitleFile: vi.fn(),
}))

vi.mock("@/server/media/repository.server.ts", () => repository)

import {streamPart} from "./stream.server"

const temporaryPaths: string[] = []

beforeEach(() => {
    vi.stubGlobal("Bun", {
        file: vi.fn(() => ({})),
    })
})

afterEach(async () => {
    repository.getPartFile.mockReset()
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
})
