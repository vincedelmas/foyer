import type {LibraryKind, LibraryRecord} from "@ploux/contracts"
import {useForm} from "@tanstack/react-form"
import {useMutation, useQueryClient} from "@tanstack/react-query"
import {createColumnHelper, tableFeatures, useTable} from "@tanstack/react-table"
import {FilmIcon, FolderSyncIcon, PencilIcon, Trash2Icon, TvIcon} from "lucide-react"
import {useState} from "react"
import {api} from "@/lib/api"
import {Badge} from "@/components/ui/badge"
import {Button} from "@/components/ui/button"
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger} from "@/components/ui/dialog"
import {Field, FieldError, FieldGroup, FieldLabel} from "@/components/ui/field"
import {Input} from "@/components/ui/input"
import {Spinner} from "@/components/ui/spinner"
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "@/components/ui/table"
import {ToggleGroup, ToggleGroupItem} from "@/components/ui/toggle-group"
import {toast} from "@/components/ui/toast"


const features = tableFeatures({})
const columnHelper = createColumnHelper<typeof features, LibraryRecord>()
const kindItems = [
    {label: "Movies", value: "movies", icon: FilmIcon},
    {label: "TV shows", value: "series", icon: TvIcon},
] as const

const libraryKindLabel = (kind: LibraryKind) =>
    kind === "movies" ? "Movies" : "TV shows"

const columns = columnHelper.columns([
    columnHelper.accessor("name", {header: "Media folder"}),
    columnHelper.accessor("path", {header: "Server folder"}),
    columnHelper.accessor("kind", {
        header: "Type",
        cell: (info) => (
            <Badge variant="secondary">{libraryKindLabel(info.getValue())}</Badge>
        ),
    }),
    columnHelper.display({
        id: "actions",
        header: "",
        cell: (info) => <LibraryActions library={info.row.original}/>,
    }),
])


interface LibraryActionsProps {
    library: LibraryRecord
}


const LibraryActions = ({library}: LibraryActionsProps) => {
    const queryClient = useQueryClient()

    const scan = useMutation({
        mutationFn: () => api.scan(library.id),
        onSuccess: async (result) => {
            const summary = result.scans[0]

            await Promise.all([
                queryClient.invalidateQueries({queryKey: ["settings"]}),
                queryClient.invalidateQueries({queryKey: ["library"]}),
                queryClient.invalidateQueries({queryKey: ["media-folders"]}),
            ])

            toast.add({
                type: "success",
                title: `${library.name} scanned`,
                description: summary
                    ? `${summary.filesSeen} files · ${summary.titlesAdded} new titles · ${summary.subtitlesFound} subtitles`
                    : undefined,
            })
        },
        onError: (error) =>
            toast.add({
                type: "error",
                title: "Scan failed",
                description: error.message,
            }),
    })

    const remove = useMutation({
        mutationFn: () => api.deleteLibrary(library.id),
        onSuccess: async () => {
            await Promise.all([
                queryClient.invalidateQueries({queryKey: ["settings"]}),
                queryClient.invalidateQueries({queryKey: ["library"]}),
                queryClient.invalidateQueries({queryKey: ["media-folders"]}),
            ])

            toast.add({
                type: "success",
                title: "Media folder removed",
                description: "Your media files were not touched.",
            })
        },
        onError: (error) =>
            toast.add({
                type: "error",
                title: "Could not remove media folder",
                description: error.message,
            }),
    })

    return (
        <div className="flex justify-end gap-1">
            <EditLibraryDialog key={library.updatedAt} library={library}/>
            <Button
                size="sm"
                variant="ghost"
                disabled={scan.isPending}
                onClick={() => scan.mutate()}
            >
                {scan.isPending
                    ? <Spinner data-icon="inline-start"/>
                    : <FolderSyncIcon data-icon="inline-start"/>
                }
                Scan
            </Button>
            <Button
                size="icon-sm"
                variant="ghost"
                disabled={remove.isPending}
                onClick={() => remove.mutate()}
                aria-label={`Remove ${library.name}`}
            >
                {remove.isPending ? <Spinner/> : <Trash2Icon/>}
            </Button>
        </div>
    )
}


function EditLibraryDialog({library}: {library: LibraryRecord}) {
    const [open, setOpen] = useState(false)
    const queryClient = useQueryClient()
    const update = useMutation({
        mutationFn: api.updateLibrary,
        onSuccess: async () => {
            await Promise.all([
                queryClient.invalidateQueries({queryKey: ["settings"]}),
                queryClient.invalidateQueries({queryKey: ["library"]}),
                queryClient.invalidateQueries({queryKey: ["media-folders"]}),
            ])
            setOpen(false)
            toast.add({
                type: "success",
                title: "Media folder updated",
                description: "Run a scan if you changed its path or media type.",
            })
        },
        onError: (error) =>
            toast.add({
                type: "error",
                title: "Could not update media folder",
                description: error.message,
            }),
    })
    const form = useForm({
        defaultValues: {
            id: library.id,
            name: library.name,
            path: library.path,
            kind: library.kind as LibraryKind,
        },
        onSubmit: async ({value}) => {
            await update.mutateAsync(value)
        },
    })

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger
                render={
                    <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Edit ${library.name}`}
                    />
                }
            >
                <PencilIcon/>
            </DialogTrigger>
            <DialogContent>
                <form
                    className="contents"
                    onSubmit={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        void form.handleSubmit()
                    }}
                >
                    <DialogHeader>
                        <DialogTitle>Edit media folder</DialogTitle>
                        <DialogDescription>
                            Change its display name, server path, or media type.
                        </DialogDescription>
                    </DialogHeader>
                    <FieldGroup>
                        <form.Field
                            name="name"
                            validators={{
                                onChange: ({value}) => !value.trim() ? "Name is required" : undefined,
                            }}
                        >
                            {(field) => (
                                <Field data-invalid={!field.state.meta.isValid}>
                                    <FieldLabel htmlFor={`edit-${library.id}-name`}>Name</FieldLabel>
                                    <Input
                                        id={`edit-${library.id}-name`}
                                        value={field.state.value}
                                        onBlur={field.handleBlur}
                                        aria-invalid={!field.state.meta.isValid}
                                        onChange={(event) => field.handleChange(event.target.value)}
                                    />
                                    <FieldError
                                        errors={field.state.meta.errors.map((message) => ({message}))}
                                    />
                                </Field>
                            )}
                        </form.Field>
                        <form.Field
                            name="path"
                            validators={{
                                onChange: ({value}) => !value.trim() ? "Path is required" : undefined,
                            }}
                        >
                            {(field) => (
                                <Field data-invalid={!field.state.meta.isValid}>
                                    <FieldLabel htmlFor={`edit-${library.id}-path`}>
                                        Folder on the server
                                    </FieldLabel>
                                    <Input
                                        id={`edit-${library.id}-path`}
                                        value={field.state.value}
                                        onBlur={field.handleBlur}
                                        aria-invalid={!field.state.meta.isValid}
                                        onChange={(event) => field.handleChange(event.target.value)}
                                    />
                                    <FieldError
                                        errors={field.state.meta.errors.map((message) => ({message}))}
                                    />
                                </Field>
                            )}
                        </form.Field>
                        <form.Field name="kind">
                            {(field) => (
                                <Field>
                                    <FieldLabel>Media type</FieldLabel>
                                    <ToggleGroup
                                        variant="outline"
                                        className="w-full"
                                        value={[field.state.value]}
                                        onValueChange={(value) => {
                                            if (value[0]) field.handleChange(value[0] as LibraryKind)
                                        }}
                                    >
                                        {kindItems.map((item) => {
                                            const Icon = item.icon
                                            return (
                                                <ToggleGroupItem
                                                    key={item.value}
                                                    value={item.value}
                                                    className="flex-1"
                                                    aria-label={item.label}
                                                >
                                                    <Icon/>
                                                    {item.label}
                                                </ToggleGroupItem>
                                            )
                                        })}
                                    </ToggleGroup>
                                </Field>
                            )}
                        </form.Field>
                    </FieldGroup>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <form.Subscribe selector={(state) => ({canSubmit: state.canSubmit, isSubmitting: state.isSubmitting})}>
                            {({canSubmit, isSubmitting}) => (
                                <Button type="submit" disabled={!canSubmit || isSubmitting}>
                                    {isSubmitting ? <Spinner data-icon="inline-start"/> : null}
                                    Save changes
                                </Button>
                            )}
                        </form.Subscribe>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}


interface LibrariesTableProps {
    libraries: LibraryRecord[]
}


export const LibrariesTable = ({libraries}: LibrariesTableProps) => {
    const table = useTable({
        columns,
        features,
        data: libraries,
    })

    return (
        <div className="overflow-hidden rounded-xl border">
            <Table>
                <TableHeader>
                    {table.getHeaderGroups().map((group) => (
                        <TableRow key={group.id}>
                            {group.headers.map((header) => (
                                <TableHead key={header.id}>
                                    {header.isPlaceholder
                                        ? null
                                        : <table.FlexRender header={header}/>
                                    }
                                </TableHead>
                            ))}
                        </TableRow>
                    ))}
                </TableHeader>
                <TableBody>
                    {table.getRowModel().rows.map((row) => (
                        <TableRow key={row.id}>
                            {row.getAllCells().map((cell) => (
                                <TableCell key={cell.id}>
                                    <table.FlexRender cell={cell}/>
                                </TableCell>
                            ))}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}
