import {readdir, rm} from "node:fs/promises"
import {resolve} from "node:path"

export const tvCompatibilityCacheDirectory = resolve(
    process.env.PLOUX_CACHE_PATH ?? "./data/cache",
    "android-tv"
)

export const removeTvCompatibilityCache = async (partIds: Iterable<string>) => {
    const prefixes = [...new Set(partIds)].map((partId) => `${partId}-`)
    if (!prefixes.length) return

    const entries = await readdir(tvCompatibilityCacheDirectory, {
        withFileTypes: true,
    }).catch((error: unknown) => {
        if (
            typeof error === "object" &&
            error !== null &&
            "code" in error &&
            error.code === "ENOENT"
        ) return []
        throw error
    })

    await Promise.all(
        entries
            .filter(
                (entry) =>
                    entry.isFile() &&
                    entry.name.endsWith(".mkv") &&
                    prefixes.some((prefix) => entry.name.startsWith(prefix))
            )
            .map((entry) =>
                rm(resolve(tvCompatibilityCacheDirectory, entry.name), {
                    force: true,
                })
            )
    )
}
