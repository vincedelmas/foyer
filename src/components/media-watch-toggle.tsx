import {api} from "@/lib/api";
import {CheckIcon} from "lucide-react";
import {toast} from "@/components/ui/toast";
import {Button} from "@/components/ui/button";
import {Spinner} from "@/components/ui/spinner";
import type {MediaSummary} from "@ploux/contracts";
import {useMutation, useQueryClient} from "@tanstack/react-query";
import {Tooltip, TooltipContent, TooltipTrigger} from "@/components/ui/tooltip";


export function MediaWatchToggle({ item }: { item: MediaSummary }) {
    const queryClient = useQueryClient();
    const label = item.watched ? "Mark as unwatched" : "Mark as watched";

    const watchState = useMutation({
        mutationFn: () => api.setMediaWatched(item.id, !item.watched),
        onSuccess: async (result) => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ["library"] }),
                queryClient.invalidateQueries({ queryKey: ["media", item.id] }),
                queryClient.invalidateQueries({ queryKey: ["currently-watching"] }),
            ]);
            toast.add({
                type: "success",
                title: result.watched ? "Marked as watched" : "Marked as unwatched",
            });
        },
        onError: (error) => {
            toast.add({
                type: "error",
                description: error.message,
                title: "Could not change watch status",
            });
        },
    })

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
