import type {MediaSummary} from "@ploux/contracts"
import {useMutation, useQueryClient} from "@tanstack/react-query"
import {
    CircleXIcon,
    EllipsisVerticalIcon,
    InfoIcon,
    RefreshCwIcon,
    SearchIcon,
    Trash2Icon,
} from "lucide-react"
import {useState} from "react"
import {IdentifyDialog} from "@/components/identify-dialog"
import {MediaInfoDialog} from "@/components/media-info-dialog"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {Button} from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {Spinner} from "@/components/ui/spinner"
import {toast} from "@/components/ui/toast"
import {api} from "@/lib/api"


export function MediaActionsMenu({item}: {item: MediaSummary}) {
    const queryClient = useQueryClient()
    const [identifyOpen, setIdentifyOpen] = useState(false)
    const [infoOpen, setInfoOpen] = useState(false)
    const [deleteOpen, setDeleteOpen] = useState(false)

    const invalidateMedia = async (includeFolders = false) => {
        await Promise.all([
            queryClient.invalidateQueries({queryKey: ["library"]}),
            queryClient.invalidateQueries({queryKey: ["currently-watching"]}),
            queryClient.invalidateQueries({queryKey: ["media", item.id]}),
            ...(includeFolders
                ? [queryClient.invalidateQueries({queryKey: ["media-folders"]})]
                : []),
        ])
    }
    const clearProgress = useMutation({
        mutationFn: () => api.deleteProgress(item.id),
        onSuccess: async () => {
            await invalidateMedia()
            toast.add({type: "success", title: "Watch progress removed"})
        },
        onError: (error) =>
            toast.add({
                type: "error",
                title: "Could not remove watch progress",
                description: error.message,
            }),
    })
    const refresh = useMutation({
        mutationFn: () => api.refreshMetadata(item.id),
        onSuccess: async () => {
            await invalidateMedia(true)
            toast.add({type: "success", title: "Metadata refreshed"})
        },
        onError: (error) =>
            toast.add({
                type: "error",
                title: "Metadata refresh failed",
                description: error.message,
            }),
    })
    const remove = useMutation({
        mutationFn: () => api.deleteMedia(item.id),
        onSuccess: async (result) => {
            await Promise.all([
                invalidateMedia(true),
                queryClient.invalidateQueries({queryKey: ["settings"]}),
            ])
            queryClient.removeQueries({queryKey: ["media", item.id]})
            queryClient.removeQueries({queryKey: ["media-info", item.id]})
            setDeleteOpen(false)
            toast.add({
                type: "success",
                title: "Media deleted permanently",
                description: [
                    `${result.filesDeleted} ${result.filesDeleted === 1 ? "file" : "files"} deleted from the server.`,
                    result.filesAlreadyMissing
                        ? `${result.filesAlreadyMissing} already missing.`
                        : null,
                ].filter(Boolean).join(" "),
            })
        },
        onError: (error) =>
            toast.add({
                type: "error",
                title: "Could not delete media",
                description: error.message,
            }),
    })
    const isPending =
        clearProgress.isPending ||
        refresh.isPending ||
        remove.isPending

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger
                    render={
                        <Button
                            variant="secondary"
                            size="icon-sm"
                            aria-label={`More options for ${item.title}`}
                        />
                    }
                >
                    {isPending ? <Spinner/> : <EllipsisVerticalIcon/>}
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60">
                    {item.hasProgress ? (
                        <>
                            <DropdownMenuGroup>
                                <DropdownMenuItem
                                    disabled={isPending}
                                    onClick={() => clearProgress.mutate()}
                                >
                                    <CircleXIcon/>
                                    Remove watch progress
                                </DropdownMenuItem>
                            </DropdownMenuGroup>
                            <DropdownMenuSeparator/>
                        </>
                    ) : null}
                    <DropdownMenuGroup>
                        <DropdownMenuItem onClick={() => setIdentifyOpen(true)}>
                            <SearchIcon/>
                            Identify
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setInfoOpen(true)}>
                            <InfoIcon/>
                            Media info
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            disabled={isPending}
                            onClick={() => refresh.mutate()}
                        >
                            <RefreshCwIcon/>
                            Refresh metadata
                        </DropdownMenuItem>
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator/>
                    <DropdownMenuGroup>
                        <DropdownMenuItem
                            variant="destructive"
                            disabled={isPending}
                            onClick={() => setDeleteOpen(true)}
                        >
                            <Trash2Icon/>
                            Delete media from server
                        </DropdownMenuItem>
                    </DropdownMenuGroup>
                </DropdownMenuContent>
            </DropdownMenu>

            <IdentifyDialog
                key={`${item.id}-${item.title}-${item.year ?? "unknown"}`}
                media={item}
                open={identifyOpen}
                onOpenChange={setIdentifyOpen}
                showTrigger={false}
            />
            <MediaInfoDialog
                mediaId={item.id}
                title={item.title}
                open={infoOpen}
                onOpenChange={setInfoOpen}
            />
            <AlertDialog
                open={deleteOpen}
                onOpenChange={(open) => {
                    if (!remove.isPending) setDeleteOpen(open)
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete “{item.title}” permanently?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This permanently deletes {item.partCount}{" "}
                            {item.partCount === 1 ? "media file" : "media files"} and any
                            indexed external subtitles from the server, then removes the title
                            from Ploux. This cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={remove.isPending}>
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            variant="destructive"
                            disabled={remove.isPending}
                            onClick={() => remove.mutate()}
                        >
                            {remove.isPending ? <Spinner data-icon="inline-start"/> : null}
                            Delete files permanently
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
