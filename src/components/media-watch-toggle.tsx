import {MediaSummary} from "@foyer/contracts";
import {WatchToggleButton} from "@/components/watch-toggle-button";
import {useSetMediaWatchedMutation} from "@/lib/query-mutations";


export function MediaWatchToggle({ item }: { item: MediaSummary }) {
    const watchState = useSetMediaWatchedMutation(item.id);
    const label = item.watched ? "Mark as unwatched" : "Mark as watched";

    return (
        <WatchToggleButton
            label={label}
            watched={item.watched}
            pending={watchState.isPending}
            className="rounded-full shadow-md"
            onToggle={() => watchState.mutate(!item.watched)}
            unwatchedVariant="secondary"
        />
    );
}
