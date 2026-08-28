import {describe, expect, it} from "vitest"
import {
    isPlaybackCompleted,
    PLAYBACK_COMPLETION_THRESHOLD,
} from "./playback-completion"


describe("isPlaybackCompleted", () => {
    it("marks playback complete at 90 percent", () => {
        expect(PLAYBACK_COMPLETION_THRESHOLD).toBe(0.9)
        expect(isPlaybackCompleted(899, 1_000)).toBe(false)
        expect(isPlaybackCompleted(900, 1_000)).toBe(true)
    })

    it("does not complete short episodes just because little time remains", () => {
        expect(isPlaybackCompleted(60, 180)).toBe(false)
        expect(isPlaybackCompleted(162, 180)).toBe(true)
    })

    it("rejects missing or invalid durations", () => {
        expect(isPlaybackCompleted(0, 0)).toBe(false)
        expect(isPlaybackCompleted(Number.NaN, 1_000)).toBe(false)
    })
})
