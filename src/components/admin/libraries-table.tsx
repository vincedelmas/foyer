import {api} from "@/lib/api";
import {Badge} from "@/components/ui/badge";
import {toast} from "@/components/ui/toast";
import {Button} from "@/components/ui/button";
import {Spinner} from "@/components/ui/spinner";
import type {LibraryRecord} from "@ploux/contracts";
import {FolderSyncIcon, Trash2Icon} from "lucide-react";
import {useMutation, useQueryClient} from "@tanstack/react-query";
import {createColumnHelper, tableFeatures, useTable} from "@tanstack/react-table";
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "@/components/ui/table";


const features = tableFeatures({});

const columnHelper = createColumnHelper<typeof features, LibraryRecord>();

const columns = columnHelper.columns([
    columnHelper.accessor("name", { header: "Library" }),
    columnHelper.accessor("path", { header: "Server folder" }),
    columnHelper.accessor("kind", {
        header: "Type",
        cell: (info) => (
            <Badge variant="secondary">
                {info.getValue()}
            </Badge>
        ),
    }),
    columnHelper.display({
        id: "actions",
        header: "",
        cell: (info) => (
            <LibraryActions
                library={info.row.original}
            />
        ),
    }),
]);


interface LibraryActionsProps {
    library: LibraryRecord;
}


const LibraryActions = ({ library }: LibraryActionsProps) => {
    const queryClient = useQueryClient();

    const scan = useMutation({
        mutationFn: () => api.scan(library.id),
        onSuccess: async (result) => {
            const summary = result.scans[0];

            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ["admin"] }),
                queryClient.invalidateQueries({ queryKey: ["library"] }),
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
                queryClient.invalidateQueries({ queryKey: ["admin"] }),
                queryClient.invalidateQueries({ queryKey: ["library"] }),
            ])

            toast.add({
                type: "success",
                title: "Library removed",
                description: "Your media files were not touched.",
            })
        },
    })

    return (
        <div className="flex justify-end gap-1">
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
                <Trash2Icon/>
            </Button>
        </div>
    )
};


interface LibrariesTableProps {
    libraries: LibraryRecord[];
}


export const LibrariesTable = ({ libraries }: LibrariesTableProps) => {
    const table = useTable({
        columns,
        features,
        data: libraries,
    });

    return (
        <div className="overflow-hidden rounded-xl border">
            <Table>
                <TableHeader>
                    {table.getHeaderGroups().map((group) =>
                        <TableRow key={group.id}>
                            {group.headers.map((header) =>
                                <TableHead key={header.id}>
                                    {header.isPlaceholder
                                        ? null
                                        : <table.FlexRender header={header}/>
                                    }
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
                                    <table.FlexRender
                                        cell={cell}
                                    />
                                </TableCell>
                            )}
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );
};
