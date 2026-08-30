import {useState} from "react";
import {TvModal} from "./TvModal";
import {ActionMenu} from "./ActionMenu";
import {FocusButton} from "./FocusButton";
import {ConfirmDialog} from "./ConfirmDialog";
import {StyleSheet, View} from "react-native";
import {FocusTextInput} from "./FocusTextInput";
import {MediaFolderSummary} from "@ploux/contracts";
import {FolderInputIcon, FolderSyncIcon, PencilIcon, RefreshCwIcon, Trash2Icon,} from "lucide-react-native";
import {useDeleteLibraryMutation, useRefreshLibraryMetadataMutation, useScanLibraryMutation, useUpdateLibraryMutation} from "../query-mutations";


type Mode = "menu" | "rename" | "path" | "delete";


interface CollectionActionsDialogProps {
    server: string;
    visible: boolean;
    onClose: () => void;
    folder: MediaFolderSummary | null;
    onDeleted?: (folder: MediaFolderSummary) => void;
}


export function CollectionActionsDialog({ server, folder, visible, onClose, onDeleted }: CollectionActionsDialogProps) {
    const [value, setValue] = useState("");
    const [mode, setMode] = useState<Mode>("menu");

    const close = () => {
        setMode("menu");
        onClose();
    };

    const update = useUpdateLibraryMutation(server, close);
    const scan = useScanLibraryMutation(server, folder?.id, close);
    const refresh = useRefreshLibraryMetadataMutation(server, folder?.id ?? "", close);
    const remove = useDeleteLibraryMutation(server, folder?.id ?? "", () => {
        const removed = folder;
        close();
        if (removed) onDeleted?.(removed);
    });

    if (!folder) return null;

    const error = update.error ?? scan.error ?? refresh.error ?? remove.error;
    const pending = update.isPending || scan.isPending || refresh.isPending || remove.isPending;

    const openEditor = (nextMode: "rename" | "path") => {
        setValue(nextMode === "rename" ? folder.name : folder.path)
        setMode(nextMode)
    };

    const saveEdit = () => {
        update.mutate({
            id: folder.id,
            name: mode === "rename" ? value.trim() : folder.name,
            path: mode === "path" ? value.trim() : folder.path,
            kind: folder.kind,
        });
    };

    return (
        <>
            <ActionMenu
                onClose={close}
                title={folder.name}
                visible={visible && mode === "menu"}
                description={error ? error.message : `${folder.kind === "movies" ? "Movies" : "TV shows"} · ${folder.path}`}
                items={[
                    {
                        key: "rename",
                        icon: PencilIcon,
                        disabled: pending,
                        label: "Rename collection",
                        onPress: () => openEditor("rename"),
                    },
                    {
                        key: "path",
                        disabled: pending,
                        icon: FolderInputIcon,
                        label: "Change server folder",
                        onPress: () => openEditor("path"),
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
                        description: "Removes only the Ploux collection, never server files.",
                    },
                ]}
            />
            <TvModal
                width={580}
                visible={visible && (mode === "rename" || mode === "path")}
                title={mode === "rename" ? "Rename collection" : "Change server folder"}
                description={
                    mode === "rename"
                        ? "Choose the name shown on the Ploux home screen."
                        : "Point this collection at another absolute path on the server. Files are not moved."
                }
                onClose={() => {
                    if (!update.isPending) setMode("menu")
                }}
            >
                <FocusTextInput
                    value={value}
                    autoCorrect={false}
                    autoCapitalize="none"
                    onChangeText={setValue}
                    hasTVPreferredFocus={true}
                    label={mode === "rename" ? "Collection name" : "Server folder"}
                />
                <View style={styles.actions}>
                    <FocusButton
                        label="Cancel"
                        variant="secondary"
                        disabled={update.isPending}
                        onPress={() => setMode("menu")}
                    />
                    <FocusButton
                        disabled={!value.trim() || update.isPending}
                        label={update.isPending ? "Saving…" : "Save changes"}
                        onPress={saveEdit}
                    />
                </View>
            </TvModal>
            <ConfirmDialog
                pending={remove.isPending}
                confirmLabel="Delete collection"
                title={`Delete “${folder.name}”?`}
                visible={visible && mode === "delete"}
                onConfirm={() => remove.mutate()}
                onClose={() => {
                    if (!remove.isPending) setMode("menu")
                }}
                description="This removes the collection, its metadata, and watch progress from Ploux.
                The media files on the server will not be changed."
            />
        </>
    )
}


const styles = StyleSheet.create({
    actions: {
        gap: 9,
        marginTop: 16,
        flexDirection: "row",
        justifyContent: "flex-end",
    },
})
