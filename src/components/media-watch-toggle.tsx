import type {MediaSummary} from "@ploux/contracts"
import {useMutation, useQueryClient} from "@tanstack/react-query"
import {CheckIcon} from "lucide-react"
import {Button} from "@/components/ui/button"
import {Spinner} from "@/components/ui/spinner"
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import {toast} from "@/components/ui/toast"
import {api} from "@/lib/api"


export function MediaWatchToggle({item}: {item: MediaSummary}) {
    const queryClient = useQueryClient()
    const label = item.watched ? "Mark as unwatched" : "Mark as watched"
    const watchState = useMutation({
        mutationFn: () => api.setMediaWatched(item.id, !item.watched),
        onSuccess: async (result) => {
            await Promise.all([
                queryClient.invalidateQueries({queryKey: ["library"]}),
                queryClient.invalidateQueries({queryKey: ["currently-watching"]}),
                queryClient.invalidateQueries({queryKey: ["media", item.id]}),
            ])
            toast.add({
                type: "success",
                title: result.watched ? "Marked as watched" : "Marked as unwatched",
            })
        },
        onError: (error) =>
            toast.add({
                type: "error",
                title: "Could not change watch status",
                description: error.message,
            }),
    })

    return (
        <Tooltip>
            <TooltipTrigger
                render={
                    <Button
                        variant={item.watched ? "default" : "secondary"}
                        size="icon-sm"
                        className="rounded-full shadow-md"
                        aria-label={label}
                        aria-pressed={item.watched}
                        disabled={watchState.isPending}
                        onClick={() => watchState.mutate()}
                    />
                }
            >
                {watchState.isPending ? <Spinner/> : <CheckIcon/>}
            </TooltipTrigger>
            <TooltipContent>
                <p>{label}</p>
            </TooltipContent>
        </Tooltip>
    )
}
