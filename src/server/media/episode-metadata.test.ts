import {describe, expect, it} from "vitest"
import {matchLocalEpisodeTitles} from "./episode-metadata"


describe("matchLocalEpisodeTitles", () => {
    it("matches titles only to episodes available on the server", () => {
        const updates = matchLocalEpisodeTitles(
            [
                {id: "episode-4", seasonNumber: 1, episodeNumber: 4},
                {id: "episode-6", seasonNumber: 1, episodeNumber: 6},
            ],
            [
                {seasonNumber: 1, episodeNumber: 4, title: "The Visitor"},
                {seasonNumber: 1, episodeNumber: 5, title: "The Missing One"},
                {seasonNumber: 1, episodeNumber: 6, title: "Home Again"},
            ]
        )

        expect(updates).toEqual([
            {partId: "episode-4", title: "The Visitor"},
            {partId: "episode-6", title: "Home Again"},
        ])
    })

    it("ignores unnumbered parts and blank metadata titles", () => {
        expect(matchLocalEpisodeTitles(
            [
                {id: "unnumbered", seasonNumber: null, episodeNumber: null},
                {id: "episode-1", seasonNumber: 1, episodeNumber: 1},
            ],
            [{seasonNumber: 1, episodeNumber: 1, title: "   "}]
        )).toEqual([])
    })
})
