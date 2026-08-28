import {describe, expect, it} from "vitest"
import {createRequestRateLimiter} from "./request-rate-limiter"


describe("createRequestRateLimiter", () => {
    it("spaces concurrent requests at the configured rate", async () => {
        let now = 0
        const delays: number[] = []
        const limiter = createRequestRateLimiter(10, {
            now: () => now,
            wait: async (delay) => {
                delays.push(delay)
                now += delay
            },
        })

        await Promise.all([limiter(), limiter(), limiter(), limiter()])

        expect(delays).toEqual([100, 100, 100])
        expect(now).toBe(300)
    })

    it("rejects invalid request rates", () => {
        expect(() => createRequestRateLimiter(0)).toThrow(
            "Requests per second must be greater than zero"
        )
    })
})
