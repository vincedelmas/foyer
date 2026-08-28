import type {MediaSummary} from "@ploux/contracts"
import {describe, expect, it} from "vitest"
import {filterByWatchStatus, selectCurrentlyWatching} from "./progress-utils"


const media = (
    id: string,
    progress: MediaSummary["progress"],
    watched = false
): MediaSummary => ({
    id,
    kind: "movie",
    title: id,
    year: null,
    releaseDate: null,
    overview: null,
    posterPath: null,
    backdropPath: null,
    runtimeMinutes: null,
    tmdbVoteAverage: null,
    tmdbVoteCount: null,
    metadataStatus: "matched",
    addedAt: 0,
    partCount: 1,
    nextPartId: `part-${id}`,
    progress,
    watched,
    hasProgress: progress !== null,
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
            }, true),
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

    it("filters watched and unwatched titles", () => {
        const watched = media("watched", null, true)
        const unwatched = media("unwatched", null)

        expect(filterByWatchStatus([watched, unwatched], "all")).toHaveLength(2)
        expect(filterByWatchStatus([watched, unwatched], "watched")).toEqual([watched])
        expect(filterByWatchStatus([watched, unwatched], "unwatched")).toEqual([unwatched])
    })
})
