import {useState} from "react";
import {Badge} from "@/components/ui/badge";
import {Input} from "@/components/ui/input";
import {useForm} from "@tanstack/react-form";
import {Button} from "@/components/ui/button";
import {Spinner} from "@/components/ui/spinner";
import {LibraryKind, LibraryRecord} from "@foyer/contracts";
import {FolderSyncIcon, PencilIcon, Trash2Icon} from "lucide-react";
import {MediaTypeToggle} from "@/components/settings/media-type-toggle";
import {Field, FieldError, FieldGroup, FieldLabel} from "@/components/ui/field";
import {createColumnHelper, tableFeatures, useTable} from "@tanstack/react-table";
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "@/components/ui/table";
import {useDeleteLibraryMutation, useScanLibraryMutation, useUpdateLibraryMutation} from "@/lib/query-mutations";
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger} from "@/components/ui/dialog";


const features = tableFeatures({});
const columnHelper = createColumnHelper<typeof features, LibraryRecord>();


const libraryKindLabel = (kind: LibraryKind) => {
    return kind === "movies" ? "Movies" : "TV shows";
}


const columns = columnHelper.columns([
    columnHelper.accessor("name", { header: "Media folder" }),
    columnHelper.accessor("path", { header: "Server folder" }),
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


const LibraryActions = ({ library }: LibraryActionsProps) => {
    const scan = useScanLibraryMutation(library);
    const remove = useDeleteLibraryMutation(library.id);

    return (
        <div className="flex justify-end gap-1">
            <EditLibraryDialog key={library.updatedAt} library={library}/>
            <Button size="sm" variant="ghost" disabled={scan.isPending} onClick={() => scan.mutate()}>
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


function EditLibraryDialog({ library }: { library: LibraryRecord }) {
    const [open, setOpen] = useState(false);
    const update = useUpdateLibraryMutation(() => setOpen(false));

    const form = useForm({
        defaultValues: {
            id: library.id,
            name: library.name,
            path: library.path,
            kind: library.kind as LibraryKind,
        },
        onSubmit: async ({ value }) => {
            await update.mutateAsync(value);
        },
    });

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button size="icon-sm" variant="ghost" aria-label={`Edit ${library.name}`}/>}>
                <PencilIcon/>
            </DialogTrigger>
            <DialogContent>
                <form
                    className="contents"
                    onSubmit={(ev) => {
                        ev.preventDefault();
                        ev.stopPropagation();
                        void form.handleSubmit();
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
                                onChange: ({ value }) => !value.trim() ? "Name is required" : undefined,
                            }}
                        >
                            {(field) => (
                                <Field data-invalid={!field.state.meta.isValid}>
                                    <FieldLabel htmlFor={`edit-${library.id}-name`}>Name</FieldLabel>
                                    <Input
                                        value={field.state.value}
                                        onBlur={field.handleBlur}
                                        id={`edit-${library.id}-name`}
                                        aria-invalid={!field.state.meta.isValid}
                                        onChange={(event) => field.handleChange(event.target.value)}
                                    />
                                    <FieldError
                                        errors={field.state.meta.errors.map((message) => ({ message }))}
                                    />
                                </Field>
                            )}
                        </form.Field>
                        <form.Field
                            name="path"
                            validators={{
                                onChange: ({ value }) => !value.trim() ? "Path is required" : undefined,
                            }}
                        >
                            {(field) => (
                                <Field data-invalid={!field.state.meta.isValid}>
                                    <FieldLabel htmlFor={`edit-${library.id}-path`}>
                                        Folder on the server
                                    </FieldLabel>
                                    <Input
                                        value={field.state.value}
                                        onBlur={field.handleBlur}
                                        id={`edit-${library.id}-path`}
                                        aria-invalid={!field.state.meta.isValid}
                                        onChange={(event) => field.handleChange(event.target.value)}
                                    />
                                    <FieldError
                                        errors={field.state.meta.errors.map((message) => ({ message }))}
                                    />
                                </Field>
                            )}
                        </form.Field>
                        <form.Field name="kind">
                            {(field) => (
                                <Field>
                                    <FieldLabel>Media type</FieldLabel>
                                    <MediaTypeToggle
                                        value={field.state.value}
                                        onValueChange={field.handleChange}
                                    />
                                </Field>
                            )}
                        </form.Field>
                    </FieldGroup>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <form.Subscribe selector={(s) => ({ canSubmit: s.canSubmit, isSubmitting: s.isSubmitting })}>
                            {({ canSubmit, isSubmitting }) => (
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
    );
}


export const LibrariesTable = ({ libraries }: { libraries: LibraryRecord[] }) => {
    const table = useTable({ columns, features, data: libraries });

    return (
        <div className="overflow-hidden rounded-xl border">
            <Table>
                <TableHeader>
                    {table.getHeaderGroups().map((group) =>
                        <TableRow key={group.id}>
                            {group.headers.map((header) =>
                                <TableHead key={header.id}>
                                    {header.isPlaceholder ? null : <table.FlexRender header={header}/>}
                                </TableHead>
                            )}
                        </TableRow>
                    )}
                </TableHeader>
                <TableBody>
                    {table.getRowModel().rows.map((row) =>
                        <TableRow key={row.id}>
                            {row.getAllCells().map((cell) =>
                                <TableCell key={cell.id}>
                                    <table.FlexRender cell={cell}/>
                                </TableCell>
                            )}
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );
};
