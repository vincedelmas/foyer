import type {MediaSummary} from "@ploux/contracts"
import {describe, expect, it} from "vitest"
import {selectCurrentlyWatching} from "./progress-utils"


const media = (
    id: string,
    progress: MediaSummary["progress"]
): MediaSummary => ({
    id,
    kind: "movie",
    title: id,
    year: null,
    overview: null,
    posterPath: null,
    backdropPath: null,
    runtimeMinutes: null,
    metadataStatus: "matched",
    addedAt: 0,
    partCount: 1,
    nextPartId: `part-${id}`,
    progress,
})


describe("selectCurrentlyWatching", () => {
    it("keeps unfinished progress and orders it by the latest update", () => {
        const items = [
            media("older", {
                positionSeconds: 300,
                durationSeconds: 1800,
                percentage: 17,
                completed: false,
                updatedAt: 1_000,
            }),
            media("completed", {
                positionSeconds: 1800,
                durationSeconds: 1800,
                percentage: 100,
                completed: true,
                updatedAt: 3_000,
            }),
            media("newer", {
                positionSeconds: 600,
                durationSeconds: 1800,
                percentage: 33,
                completed: false,
                updatedAt: 2_000,
            }),
            media("not-started", null),
        ]

        expect(selectCurrentlyWatching(items).map((item) => item.id)).toEqual([
            "newer",
            "older",
        ])
    })
})
