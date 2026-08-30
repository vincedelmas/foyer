import {MediaSummary} from "@ploux/contracts";
import {WatchToggleButton} from "@/components/watch-toggle-button";
import {useSetMediaWatchedMutation} from "@/lib/query-mutations";


export function MediaWatchToggle({ item }: { item: MediaSummary }) {
    const watchState = useSetMediaWatchedMutation(item);
    const label = item.watched ? "Mark as unwatched" : "Mark as watched";

    return (
        <WatchToggleButton
            label={label}
            watched={item.watched}
            pending={watchState.isPending}
            className="rounded-full shadow-md"
            onToggle={() => watchState.mutate()}
            unwatchedVariant="secondary"
        />
    );
}
