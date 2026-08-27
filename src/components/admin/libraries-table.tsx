import type { LibraryRecord } from "@ploux/contracts"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  createColumnHelper,
  tableFeatures,
  useTable,
} from "@tanstack/react-table"
import { FolderSyncIcon, Trash2Icon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { toast } from "@/components/ui/toast"
import { api } from "@/lib/api"

const features = tableFeatures({})
const columnHelper = createColumnHelper<typeof features, LibraryRecord>()
const columns = columnHelper.columns([
  columnHelper.accessor("name", { header: "Library" }),
  columnHelper.accessor("path", { header: "Server folder" }),
  columnHelper.accessor("kind", {
    header: "Type",
    cell: (info) => <Badge variant="secondary">{info.getValue()}</Badge>,
  }),
  columnHelper.display({
    id: "actions",
    header: "",
    cell: (info) => <LibraryActions library={info.row.original} />,
  }),
])

export function LibrariesTable({ libraries }: { libraries: LibraryRecord[] }) {
  const table = useTable({ features, columns, data: libraries })
  return (
    <div className="overflow-hidden rounded-xl border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((group) => (
            <TableRow key={group.id}>
              {group.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder ? null : (
                    <table.FlexRender header={header} />
                  )}
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
                  <table.FlexRender cell={cell} />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function LibraryActions({ library }: { library: LibraryRecord }) {
  const queryClient = useQueryClient()
  const scan = useMutation({
    mutationFn: () => api.scan(library.id),
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin"] }),
        queryClient.invalidateQueries({ queryKey: ["library"] }),
      ])
      const summary = result.scans[0]
      toast.add({
        title: `${library.name} scanned`,
        description: summary
          ? `${summary.filesSeen} files · ${summary.titlesAdded} new titles · ${summary.subtitlesFound} subtitles`
          : undefined,
        type: "success",
      })
    },
    onError: (error) =>
      toast.add({
        title: "Scan failed",
        description: error.message,
        type: "error",
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
        title: "Library removed",
        description: "Your media files were not touched.",
        type: "success",
      })
    },
  })

  return (
    <div className="flex justify-end gap-1">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => scan.mutate()}
        disabled={scan.isPending}
      >
        {scan.isPending ? (
          <Spinner data-icon="inline-start" />
        ) : (
          <FolderSyncIcon data-icon="inline-start" />
        )}
        Scan
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => remove.mutate()}
        disabled={remove.isPending}
        aria-label={`Remove ${library.name}`}
      >
        <Trash2Icon />
      </Button>
    </div>
  )
}
