import {useState} from "react";
import {ActionMenu} from "./ActionMenu";
import {ConfirmDialog} from "./ConfirmDialog";
import {MediaFolderSummary} from "@foyer/contracts";
import {LibraryFormDialog} from "./LibraryFormDialog";
import {FolderSyncIcon, PencilIcon, RefreshCwIcon, Trash2Icon,} from "lucide-react-native";
import {useDeleteLibraryMutation, useRefreshLibraryMetadataMutation, useScanLibraryMutation} from "../query-mutations";


type Mode = "menu" | "edit" | "delete";


interface CollectionActionsDialogProps {
    server: string;
    visible: boolean;
    onClose: () => void;
    folder: MediaFolderSummary | null;
    onDeleted?: (folder: MediaFolderSummary) => void;
}


export function CollectionActionsDialog({ server, folder, visible, onClose, onDeleted }: CollectionActionsDialogProps) {
    const [mode, setMode] = useState<Mode>("menu");

    const close = () => {
        setMode("menu");
        onClose();
    };

    const scan = useScanLibraryMutation(server, folder?.id, close);
    const refresh = useRefreshLibraryMetadataMutation(server, folder?.id ?? "", close);
    const remove = useDeleteLibraryMutation(server, folder?.id ?? "", () => {
        const removed = folder;
        close();
        if (removed) onDeleted?.(removed);
    });

    if (!folder) return null;

    const error = scan.error ?? refresh.error ?? remove.error;
    const pending = scan.isPending || refresh.isPending || remove.isPending;

    return (
        <>
            <ActionMenu
                onClose={close}
                title={folder.name}
                visible={visible && mode === "menu"}
                description={error ? error.message : `${folder.kind === "movies" ? "Movies" : "TV shows"} · ${folder.path}`}
                items={[
                    {
                        key: "edit",
                        icon: PencilIcon,
                        disabled: pending,
                        label: "Edit collection",
                        onPress: () => setMode("edit"),
                        description: "Change its name, server folder, or media type.",
                    },
                    {
                        key: "scan",
                        disabled: pending,
                        icon: FolderSyncIcon,
                        pending: scan.isPending,
                        label: "Rescan media folder",
                        onPress: () => scan.mutate(),
                        description: "Find new, changed, or removed media files.",
                    },
                    {
                        key: "refresh",
                        disabled: pending,
                        icon: RefreshCwIcon,
                        pending: refresh.isPending,
                        label: "Refresh all metadata",
                        onPress: () => refresh.mutate(),
                        description: "Fetch fresh TMDB metadata for every matched title.",
                    },
                    {
                        danger: true,
                        key: "delete",
                        icon: Trash2Icon,
                        disabled: pending,
                        label: "Delete collection",
                        onPress: () => setMode("delete"),
                        description: "Removes only the Foyer collection, never server files.",
                    },
                ]}
            />
            <LibraryFormDialog
                server={server}
                library={folder}
                visible={visible && mode === "edit"}
                onClose={close}
            />
            <ConfirmDialog
                pending={remove.isPending}
                confirmLabel="Delete collection"
                title={`Delete “${folder.name}”?`}
                visible={visible && mode === "delete"}
                onConfirm={() => remove.mutate()}
                onClose={() => {
                    if (!remove.isPending) setMode("menu")
                }}
                description="This removes the collection, its metadata, and watch progress from Foyer.
                The media files on the server will not be changed."
            />
        </>
    )
}
