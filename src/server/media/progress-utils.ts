import type {MediaSummary, MediaWatchFilter} from "@ploux/contracts"


interface ResumablePart {
    id: string
}


interface ResumableProgress {
    completed: boolean
    positionSeconds: number
    updatedAt: number
}


export const selectNextPart = <Part extends ResumablePart>(
    sortedParts: Part[],
    progressByPart: Map<string, ResumableProgress>
) => {
    const latestInProgress = sortedParts
        .flatMap((part) => {
            const progress = progressByPart.get(part.id)
            return progress && !progress.completed && progress.positionSeconds > 0
                ? [{part, progress}]
                : []
        })
        .sort((left, right) => right.progress.updatedAt - left.progress.updatedAt)[0]

    return (
        latestInProgress?.part ??
        sortedParts.find((part) => !progressByPart.get(part.id)?.completed) ??
        sortedParts[0] ??
        null
    )
}


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
