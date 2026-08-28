interface RateLimiterOptions {
    now?: () => number
    wait?: (delayMs: number) => Promise<void>
}


const defaultWait = (delayMs: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, delayMs))


export const createRequestRateLimiter = (
    requestsPerSecond: number,
    {now = Date.now, wait = defaultWait}: RateLimiterOptions = {}
) => {
    if (!Number.isFinite(requestsPerSecond) || requestsPerSecond <= 0) {
        throw new Error("Requests per second must be greater than zero")
    }

    const intervalMs = 1000 / requestsPerSecond
    let requestQueue = Promise.resolve()
    let nextRequestAt = 0

    return () => {
        const requestSlot = requestQueue.then(async () => {
            const delay = Math.max(0, nextRequestAt - now())
            if (delay > 0) await wait(delay)
            nextRequestAt = now() + intervalMs
        })

        requestQueue = requestSlot.catch(() => undefined)
        return requestSlot
    }
}
