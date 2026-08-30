import {cn} from "@/lib/utils";
import {Link} from "@tanstack/react-router";
import {Input} from "@/components/ui/input";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {CSSProperties, useState} from "react";
import {Spinner} from "@/components/ui/spinner";
import {MediaFolderSummary, tmdbImage} from "@ploux/contracts";
import {Field, FieldDescription, FieldGroup, FieldLabel} from "@/components/ui/field";
import {Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {useDeleteLibraryMutation, useEditCollectionMutation, useRefreshCollectionMetadataMutation, useScanLibraryMutation} from "@/lib/query-mutations";
import {ArrowUpRightIcon, EllipsisVerticalIcon, FilmIcon, FolderInputIcon, FolderSyncIcon, PencilIcon, RefreshCwIcon, Trash2Icon, TvIcon} from "lucide-react";
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


type EditMode = "rename" | "path";


interface MediaFolderCardProps {
    index: number;
    folder: MediaFolderSummary;
}


export function MediaFolderCard({ folder, index }: MediaFolderCardProps) {
    const TypeIcon = folder.kind === "movies" ? FilmIcon : TvIcon;
    const artwork = Array.from({ length: 5 }, (_, artworkIndex) => folder.posterPaths[artworkIndex]);

    return (
        <article className="group relative min-w-0">
            <Link
                to="/libraries/$id"
                params={{ id: folder.id }}
                aria-label={`Open ${folder.name}`}
                className="block rounded-xl outline-none"
            >
                <Card
                    data-archive-item
                    style={{ "--archive-index": index } as CSSProperties}
                    className="relative aspect-16/10 gap-0 py-0 transition duration-300 group-hover:ring-primary/50 group-focus-within:ring-2
                    group-focus-within:ring-ring"
                >
                    <CardContent className="absolute inset-0 grid grid-cols-[1.35fr_1fr_1fr] grid-rows-2 gap-px bg-border px-0">
                        {artwork.map((posterPath, artworkIndex) => {
                            const poster = tmdbImage(posterPath, "w500");

                            return (
                                <div key={artworkIndex} className={artworkIndex === 0 ? "row-span-2 bg-muted" : "bg-muted"}>
                                    {poster ?
                                        <img
                                            alt=""
                                            src={poster}
                                            loading="lazy"
                                            className="size-full object-cover transition duration-700 group-hover:scale-[1.025]"
                                        />
                                        :
                                        <div className="grid size-full place-items-center bg-[radial-gradient(circle_at_top,var(--accent),var(--muted))]">
                                            <TypeIcon className="size-5 text-muted-foreground/40"/>
                                        </div>
                                    }
                                </div>
                            )
                        })}
                    </CardContent>
                    <div className="absolute inset-0 bg-linear-to-t from-background via-background/30 to-transparent"/>
                    <CardHeader className="absolute inset-x-0 bottom-0 gap-2 p-5 sm:p-6">
                        <div className="flex items-center gap-2">
                            <Badge variant="secondary">
                                <TypeIcon data-icon="inline-start"/>
                                {folder.kind === "movies" ? "Movies" : "TV shows"}
                            </Badge>
                        </div>
                        <CardTitle className="truncate text-3xl sm:text-4xl">
                            {folder.name}
                        </CardTitle>
                        <CardDescription>
                            {folder.titleCount} {folder.titleCount === 1 ? "title" : "titles"}
                        </CardDescription>
                        <CardAction
                            className="grid size-10 place-items-center self-end rounded-full bg-primary text-primary-foreground shadow-lg
                            transition group-hover:rotate-3 group-hover:scale-105">
                            <ArrowUpRightIcon className="size-5"/>
                        </CardAction>
                    </CardHeader>
                </Card>
            </Link>

            <CollectionActions
                folder={folder}
            />
        </article>
    );
}


interface CollectionCardProps {
    onDeleted?: () => void;
    folder: MediaFolderSummary;
    placement?: "card" | "page";
}


export function CollectionActions({ folder, placement = "card", onDeleted }: CollectionCardProps) {
    const [editValue, setEditValue] = useState("");
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [editMode, setEditMode] = useState<EditMode | null>(null);

    const scan = useScanLibraryMutation(folder, "rescanned");
    const refresh = useRefreshCollectionMetadataMutation(folder.id);
    const update = useEditCollectionMutation(folder, () => setEditMode(null));
    const remove = useDeleteLibraryMutation(folder.id, () => {
        setDeleteOpen(false);
        onDeleted?.();
    });

    const openEditor = (mode: EditMode) => {
        setEditValue(mode === "rename" ? folder.name : folder.path);
        setEditMode(mode);
    };

    const submitEdit = async () => {
        if (!editMode) return
        const value = editValue.trim()
        if (!value) return
        await update.mutateAsync({ mode: editMode, value })
    };

    const isCardPlacement = placement === "card";
    const isCollectionWorkPending = scan.isPending || refresh.isPending;

    return (
        <>
            <div className={cn(isCardPlacement && "absolute top-3 right-3")}>
                <DropdownMenu>
                    <DropdownMenuTrigger
                        render={
                            <Button
                                disabled={isCollectionWorkPending}
                                size={isCardPlacement ? "icon" : "default"}
                                aria-label={`More options for ${folder.name}`}
                                variant={isCardPlacement ? "secondary" : "outline"}
                            />
                        }
                    >
                        {isCollectionWorkPending
                            ? <Spinner data-icon={isCardPlacement ? undefined : "inline-start"}/>
                            : <EllipsisVerticalIcon data-icon={isCardPlacement ? undefined : "inline-start"}/>
                        }
                        {isCardPlacement ? null : "Collection actions"}
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-60">
                        <DropdownMenuGroup>
                            <DropdownMenuItem onClick={() => openEditor("rename")}>
                                <PencilIcon/>
                                Rename collection
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEditor("path")}>
                                <FolderInputIcon/>
                                Change server folder
                            </DropdownMenuItem>
                        </DropdownMenuGroup>
                        <DropdownMenuSeparator/>
                        <DropdownMenuGroup>
                            <DropdownMenuItem disabled={isCollectionWorkPending} onClick={() => scan.mutate()}>
                                <FolderSyncIcon/>
                                Rescan media folder
                            </DropdownMenuItem>
                            <DropdownMenuItem disabled={isCollectionWorkPending} onClick={() => refresh.mutate()}>
                                <RefreshCwIcon/>
                                Refresh all metadata
                            </DropdownMenuItem>
                        </DropdownMenuGroup>
                        <DropdownMenuSeparator/>
                        <DropdownMenuGroup>
                            <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
                                <Trash2Icon/>
                                Delete collection
                            </DropdownMenuItem>
                        </DropdownMenuGroup>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            <Dialog
                open={editMode !== null}
                onOpenChange={(open) => {
                    if (!open && !update.isPending) setEditMode(null)
                }}
            >
                <DialogContent>
                    <form
                        className="contents"
                        onSubmit={(ev) => {
                            ev.preventDefault();
                            void submitEdit();
                        }}
                    >
                        <DialogHeader>
                            <DialogTitle>
                                {editMode === "rename"
                                    ? "Rename collection"
                                    : "Change server folder"
                                }
                            </DialogTitle>
                            <DialogDescription>
                                {editMode === "rename"
                                    ? "Choose the name shown on your Ploux home page."
                                    : "Point this collection at a different folder on your server."
                                }
                            </DialogDescription>
                        </DialogHeader>
                        <FieldGroup>
                            <Field>
                                <FieldLabel htmlFor={`collection-${folder.id}-edit`}>
                                    {editMode === "rename" ? "Collection name" : "Server folder"}
                                </FieldLabel>
                                <Input
                                    required
                                    autoFocus
                                    value={editValue}
                                    id={`collection-${folder.id}-edit`}
                                    maxLength={editMode === "rename" ? 80 : undefined}
                                    onChange={(event) => setEditValue(event.target.value)}
                                />
                                {editMode === "path" &&
                                    <FieldDescription>
                                        Use an absolute path. Changing it does not modify files.
                                    </FieldDescription>
                                }
                            </Field>
                        </FieldGroup>
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                disabled={update.isPending}
                                onClick={() => setEditMode(null)}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" disabled={!editValue.trim() || update.isPending}>
                                {update.isPending && <Spinner data-icon="inline-start"/>}
                                Save changes
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Delete “{folder.name}”?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            This removes the collection, its metadata, and its watch progress
                            from Ploux. The media files on your server will not be changed.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={remove.isPending}>
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction variant="destructive" disabled={remove.isPending} onClick={() => remove.mutate()}>
                            {remove.isPending && <Spinner data-icon="inline-start"/>}
                            Delete collection
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
