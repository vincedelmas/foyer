import type {MediaSummary} from "@ploux/contracts"


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
