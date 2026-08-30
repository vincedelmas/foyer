import {CheckIcon} from "lucide-react";
import {Button} from "@/components/ui/button";
import {MediaSummary} from "@ploux/contracts";
import {Spinner} from "@/components/ui/spinner";
import {useSetMediaWatchedMutation} from "@/lib/query-mutations";
import {Tooltip, TooltipContent, TooltipTrigger} from "@/components/ui/tooltip";


export function MediaWatchToggle({ item }: { item: MediaSummary }) {
    const watchState = useSetMediaWatchedMutation(item);
    const label = item.watched ? "Mark as unwatched" : "Mark as watched";

    return (
        <Tooltip>
            <TooltipTrigger
                render={
                    <Button
                        size="icon-sm"
                        aria-label={label}
                        aria-pressed={item.watched}
                        disabled={watchState.isPending}
                        className="rounded-full shadow-md"
                        onClick={() => watchState.mutate()}
                        variant={item.watched ? "default" : "secondary"}
                    />
                }
            >
                {watchState.isPending
                    ? <Spinner/>
                    : <CheckIcon/>
                }
            </TooltipTrigger>
            <TooltipContent>
                <p>{label}</p>
            </TooltipContent>
        </Tooltip>
    );
}
