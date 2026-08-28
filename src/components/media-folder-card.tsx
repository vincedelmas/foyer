import type {MediaFolderSummary} from "@ploux/contracts"
import {tmdbImage} from "@ploux/contracts"
import {useMutation, useQueryClient} from "@tanstack/react-query"
import {Link} from "@tanstack/react-router"
import {
    ArrowUpRightIcon,
    EllipsisVerticalIcon,
    FilmIcon,
    FolderInputIcon,
    PencilIcon,
    RefreshCwIcon,
    Trash2Icon,
    TvIcon,
} from "lucide-react"
import type {CSSProperties} from "react"
import {useState} from "react"
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
import {Badge} from "@/components/ui/badge"
import {Button} from "@/components/ui/button"
import {
    Card,
    CardAction,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {Field, FieldDescription, FieldGroup, FieldLabel} from "@/components/ui/field"
import {Input} from "@/components/ui/input"
import {Spinner} from "@/components/ui/spinner"
import {toast} from "@/components/ui/toast"
import {api} from "@/lib/api"


type EditMode = "rename" | "path"


export function MediaFolderCard({
    folder,
    index,
}: {
    folder: MediaFolderSummary
    index: number
}) {
    const TypeIcon = folder.kind === "movies" ? FilmIcon : TvIcon
    const artwork = Array.from({length: 5}, (_, artworkIndex) =>
        folder.posterPaths[artworkIndex]
    )

    return (
        <article className="group relative min-w-0">
            <Link
                to="/libraries/$id"
                params={{id: folder.id}}
                className="block rounded-xl outline-none"
                aria-label={`Open ${folder.name}`}
            >
                <Card
                    data-archive-item
                    className="relative aspect-[16/10] gap-0 py-0 transition duration-300 group-hover:-translate-y-1 group-hover:ring-primary/50 group-focus-within:ring-2 group-focus-within:ring-ring"
                    style={{"--archive-index": index} as CSSProperties}
                >
                    <CardContent className="absolute inset-0 grid grid-cols-[1.35fr_1fr_1fr] grid-rows-2 gap-px bg-border px-0">
                        {artwork.map((posterPath, artworkIndex) => {
                            const poster = tmdbImage(posterPath, "w500")
                            return (
                                <div
                                    key={artworkIndex}
                                    className={artworkIndex === 0 ? "row-span-2 bg-muted" : "bg-muted"}
                                >
                                    {poster ? (
                                        <img
                                            src={poster}
                                            alt=""
                                            loading="lazy"
                                            className="size-full object-cover transition duration-700 group-hover:scale-[1.025]"
                                        />
                                    ) : (
                                        <div className="grid size-full place-items-center bg-[radial-gradient(circle_at_top,var(--accent),var(--muted))]">
                                            <TypeIcon className="size-5 text-muted-foreground/40"/>
                                        </div>
                                    )}
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
                        <CardAction className="grid size-10 place-items-center self-end rounded-full bg-primary text-primary-foreground shadow-lg transition group-hover:rotate-3 group-hover:scale-105">
                            <ArrowUpRightIcon className="size-5"/>
                        </CardAction>
                    </CardHeader>
                </Card>
            </Link>
            <CollectionActions folder={folder}/>
        </article>
    )
}


function CollectionActions({folder}: {folder: MediaFolderSummary}) {
    const queryClient = useQueryClient()
    const [editMode, setEditMode] = useState<EditMode | null>(null)
    const [editValue, setEditValue] = useState("")
    const [deleteOpen, setDeleteOpen] = useState(false)

    const invalidateCollectionQueries = async () => {
        await Promise.all([
            queryClient.invalidateQueries({queryKey: ["settings"]}),
            queryClient.invalidateQueries({queryKey: ["library"]}),
            queryClient.invalidateQueries({queryKey: ["media-folders"]}),
        ])
    }
    const update = useMutation({
        mutationFn: ({mode, value}: {mode: EditMode; value: string}) =>
            api.updateLibrary({
                id: folder.id,
                name: mode === "rename" ? value : folder.name,
                path: mode === "path" ? value : folder.path,
                kind: folder.kind,
            }),
        onSuccess: async (_, variables) => {
            await invalidateCollectionQueries()
            setEditMode(null)
            toast.add({
                type: "success",
                title: variables.mode === "rename"
                    ? "Collection renamed"
                    : "Server folder updated",
                description: variables.mode === "path"
                    ? "Scan this collection from Settings to sync its files."
                    : undefined,
            })
        },
        onError: (error) =>
            toast.add({
                type: "error",
                title: "Could not update collection",
                description: error.message,
            }),
    })
    const refresh = useMutation({
        mutationFn: () => api.refreshLibraryMetadata(folder.id),
        onSuccess: async (summary) => {
            await Promise.all([
                invalidateCollectionQueries(),
                queryClient.invalidateQueries({queryKey: ["currently-watching"]}),
                queryClient.invalidateQueries({queryKey: ["media"]}),
            ])
            const updated = summary.refreshed + summary.matched
            toast.add({
                type: summary.failed ? "warning" : "success",
                title: updated
                    ? `${updated} ${updated === 1 ? "title" : "titles"} refreshed`
                    : "Metadata is already up to date",
                description: [
                    summary.matched ? `${summary.matched} newly matched` : null,
                    summary.skipped ? `${summary.skipped} unmatched` : null,
                    summary.failed ? `${summary.failed} failed` : null,
                ].filter(Boolean).join(" · ") || undefined,
            })
        },
        onError: (error) =>
            toast.add({
                type: "error",
                title: "Metadata refresh failed",
                description: error.message,
            }),
    })
    const remove = useMutation({
        mutationFn: () => api.deleteLibrary(folder.id),
        onSuccess: async () => {
            await Promise.all([
                invalidateCollectionQueries(),
                queryClient.invalidateQueries({queryKey: ["currently-watching"]}),
            ])
            setDeleteOpen(false)
            toast.add({
                type: "success",
                title: "Collection deleted",
                description: "Your media files were not touched.",
            })
        },
        onError: (error) =>
            toast.add({
                type: "error",
                title: "Could not delete collection",
                description: error.message,
            }),
    })

    const openEditor = (mode: EditMode) => {
        setEditValue(mode === "rename" ? folder.name : folder.path)
        setEditMode(mode)
    }
    const submitEdit = async () => {
        if (!editMode) return
        const value = editValue.trim()
        if (!value) return
        await update.mutateAsync({mode: editMode, value})
    }

    return (
        <>
            <div className="absolute top-3 right-3">
                <DropdownMenu>
                    <DropdownMenuTrigger
                        render={
                            <Button
                                variant="secondary"
                                size="icon"
                                aria-label={`More options for ${folder.name}`}
                            />
                        }
                    >
                        {refresh.isPending ? <Spinner/> : <EllipsisVerticalIcon/>}
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
                            <DropdownMenuItem
                                disabled={refresh.isPending}
                                onClick={() => refresh.mutate()}
                            >
                                <RefreshCwIcon/>
                                Refresh all metadata
                            </DropdownMenuItem>
                        </DropdownMenuGroup>
                        <DropdownMenuSeparator/>
                        <DropdownMenuGroup>
                            <DropdownMenuItem
                                variant="destructive"
                                onClick={() => setDeleteOpen(true)}
                            >
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
                        onSubmit={(event) => {
                            event.preventDefault()
                            void submitEdit()
                        }}
                    >
                        <DialogHeader>
                            <DialogTitle>
                                {editMode === "rename"
                                    ? "Rename collection"
                                    : "Change server folder"}
                            </DialogTitle>
                            <DialogDescription>
                                {editMode === "rename"
                                    ? "Choose the name shown on your Ploux home page."
                                    : "Point this collection at a different folder on your server."}
                            </DialogDescription>
                        </DialogHeader>
                        <FieldGroup>
                            <Field>
                                <FieldLabel htmlFor={`collection-${folder.id}-edit`}>
                                    {editMode === "rename" ? "Collection name" : "Server folder"}
                                </FieldLabel>
                                <Input
                                    id={`collection-${folder.id}-edit`}
                                    value={editValue}
                                    onChange={(event) => setEditValue(event.target.value)}
                                    maxLength={editMode === "rename" ? 80 : undefined}
                                    autoFocus
                                    required
                                />
                                {editMode === "path" ? (
                                    <FieldDescription>
                                        Use an absolute path. Your files remain read-only.
                                    </FieldDescription>
                                ) : null}
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
                            <Button
                                type="submit"
                                disabled={!editValue.trim() || update.isPending}
                            >
                                {update.isPending ? <Spinner data-icon="inline-start"/> : null}
                                Save changes
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete “{folder.name}”?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This removes the collection, its metadata, and its watch progress
                            from Ploux. The media files on your server will not be changed.
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
                            Delete collection
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
