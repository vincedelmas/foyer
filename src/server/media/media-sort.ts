import type {MediaSort, MediaSummary} from "@ploux/contracts"


type SortDirection = "asc" | "desc"


const compareNullable = <T extends number | string>(
    left: T | null,
    right: T | null,
    direction: SortDirection
) => {
    if (left === null && right === null) return 0
    if (left === null) return 1
    if (right === null) return -1

    const comparison = typeof left === "number"
        ? left - (right as number)
        : left.localeCompare(right as string)
    return direction === "asc" ? comparison : -comparison
}


const releaseDateForSort = (item: MediaSummary) =>
    item.releaseDate ?? (item.year ? String(item.year) : null)


export const sortMedia = (items: MediaSummary[], sort: MediaSort) => {
    return items.sort((left, right) => {
        let comparison = 0

        switch (sort) {
            case "title":
                return left.title.localeCompare(right.title)
            case "release-desc":
                comparison = compareNullable(
                    releaseDateForSort(left),
                    releaseDateForSort(right),
                    "desc"
                )
                break
            case "release-asc":
                comparison = compareNullable(
                    releaseDateForSort(left),
                    releaseDateForSort(right),
                    "asc"
                )
                break
            case "runtime-desc":
                comparison = compareNullable(
                    left.runtimeMinutes,
                    right.runtimeMinutes,
                    "desc"
                )
                break
            case "runtime-asc":
                comparison = compareNullable(
                    left.runtimeMinutes,
                    right.runtimeMinutes,
                    "asc"
                )
                break
            case "rating-desc":
                comparison = compareNullable(
                    left.tmdbVoteAverage,
                    right.tmdbVoteAverage,
                    "desc"
                )
                break
            case "rating-asc":
                comparison = compareNullable(
                    left.tmdbVoteAverage,
                    right.tmdbVoteAverage,
                    "asc"
                )
                break
            case "recent":
                comparison = right.addedAt - left.addedAt
                break
        }

        return comparison || left.title.localeCompare(right.title)
    })
}
