import type {MediaSummary} from "@foyer/contracts"
import {describe, expect, it} from "vitest"
import {sortMedia} from "./media-sort"


const media = (
    id: string,
    overrides: Partial<MediaSummary> = {}
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
    progress: null,
    watched: false,
    hasProgress: false,
    ...overrides,
})


describe("sortMedia", () => {
    it("sorts exact release dates in both directions and keeps unknown dates last", () => {
        const items = [
            media("unknown"),
            media("newer", {releaseDate: "2024-05-02"}),
            media("older", {releaseDate: "1998-11-14"}),
        ]

        expect(sortMedia([...items], "release-desc").map((item) => item.id))
            .toEqual(["newer", "older", "unknown"])
        expect(sortMedia([...items], "release-asc").map((item) => item.id))
            .toEqual(["older", "newer", "unknown"])
    })

    it("sorts runtime in both directions", () => {
        const items = [
            media("short", {runtimeMinutes: 82}),
            media("long", {runtimeMinutes: 181}),
        ]

        expect(sortMedia([...items], "runtime-desc").map((item) => item.id))
            .toEqual(["long", "short"])
        expect(sortMedia([...items], "runtime-asc").map((item) => item.id))
            .toEqual(["short", "long"])
    })

    it("sorts TMDB scores in both directions", () => {
        const items = [
            media("lower", {tmdbVoteAverage: 6.4}),
            media("higher", {tmdbVoteAverage: 8.7}),
        ]

        expect(sortMedia([...items], "rating-desc").map((item) => item.id))
            .toEqual(["higher", "lower"])
        expect(sortMedia([...items], "rating-asc").map((item) => item.id))
            .toEqual(["lower", "higher"])
    })
})
