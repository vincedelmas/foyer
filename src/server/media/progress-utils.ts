import type {MediaSummary, MediaWatchFilter} from "@ploux/contracts"


export const selectCurrentlyWatching = (items: MediaSummary[]) =>
    items
        .filter((item) =>
            item.progress &&
            item.progress.positionSeconds > 0 &&
            !item.progress.completed
        )
        .sort((left, right) =>
            (right.progress?.updatedAt ?? 0) - (left.progress?.updatedAt ?? 0)
        )


export const filterByWatchStatus = (
    items: MediaSummary[],
    watch: MediaWatchFilter
) => {
    if (watch === "watched") return items.filter((item) => item.watched)
    if (watch === "unwatched") return items.filter((item) => !item.watched)
    return items
}
