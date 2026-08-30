import {useState} from "react";
import {Button} from "@/components/ui/button";
import {MediaSummary} from "@foyer/contracts";
import {Spinner} from "@/components/ui/spinner";
import {IdentifyDialog} from "@/components/identify-dialog";
import {MediaInfoDialog} from "@/components/media-info-dialog";
import {CircleXIcon, EllipsisVerticalIcon, InfoIcon, RefreshCwIcon, SearchIcon, Trash2Icon} from "lucide-react";
import {useClearMediaPartProgressMutation, useClearMediaProgressMutation, useDeleteMediaMutation, useRefreshMediaMetadataMutation} from "@/lib/query-mutations";
import {DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger} from "@/components/ui/dropdown-menu";
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


export function MediaActionsMenu({ item }: { item: MediaSummary }) {
    const [infoOpen, setInfoOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [identifyOpen, setIdentifyOpen] = useState(false);

    const refresh = useRefreshMediaMetadataMutation(item.id);
    const clearMediaProgress = useClearMediaProgressMutation(item.id);
    const clearPartProgress = useClearMediaPartProgressMutation(item.id);
    const remove = useDeleteMediaMutation(item.id, () => setDeleteOpen(false));

    const isPending = clearMediaProgress.isPending || clearPartProgress.isPending || refresh.isPending || remove.isPending;
    const hasCurrentProgress = !!item.progress?.positionSeconds && !item.progress.completed;
    const clearsEpisode = item.kind !== "movie" && !!item.nextPartId;

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="secondary" size="icon-sm" aria-label={`More options for ${item.title}`}/>}>
                    {isPending ? <Spinner/> : <EllipsisVerticalIcon/>}
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60">
                    {hasCurrentProgress &&
                        <>
                            <DropdownMenuGroup>
                                <DropdownMenuItem
                                    disabled={isPending}
                                    onClick={() => {
                                        if (clearsEpisode && item.nextPartId) clearPartProgress.mutate(item.nextPartId);
                                        else clearMediaProgress.mutate();
                                    }}
                                >
                                    <CircleXIcon/>
                                    {clearsEpisode ? "Remove episode progress" : "Remove watch progress"}
                                </DropdownMenuItem>
                            </DropdownMenuGroup>
                            <DropdownMenuSeparator/>
                        </>
                    }
                    <DropdownMenuGroup>
                        <DropdownMenuItem onClick={() => setIdentifyOpen(true)}>
                            <SearchIcon/>
                            Identify
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setInfoOpen(true)}>
                            <InfoIcon/>
                            Media info
                        </DropdownMenuItem>
                        <DropdownMenuItem disabled={isPending} onClick={() => refresh.mutate()}>
                            <RefreshCwIcon/>
                            Refresh metadata
                        </DropdownMenuItem>
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator/>
                    <DropdownMenuGroup>
                        <DropdownMenuItem variant="destructive" disabled={isPending} onClick={() => setDeleteOpen(true)}>
                            <Trash2Icon/>
                            Delete media from server
                        </DropdownMenuItem>
                    </DropdownMenuGroup>
                </DropdownMenuContent>
            </DropdownMenu>

            <IdentifyDialog
                media={item}
                open={identifyOpen}
                showTrigger={false}
                onOpenChange={setIdentifyOpen}
                key={`${item.id}-${item.title}-${item.year ?? "unknown"}`}
            />

            <MediaInfoDialog
                open={infoOpen}
                mediaId={item.id}
                title={item.title}
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
                            from Foyer. This cannot be undone.
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
    );
}
