import {tvApi} from "../api";
import {useState} from "react";
import {TvModal} from "./TvModal";
import {ActionMenu} from "./ActionMenu";
import {FocusButton} from "./FocusButton";
import {ConfirmDialog} from "./ConfirmDialog";
import {StyleSheet, View} from "react-native";
import {FocusTextInput} from "./FocusTextInput";
import type {MediaFolderSummary} from "@ploux/contracts";
import {useMutation, useQueryClient} from "@tanstack/react-query";
import {FolderInputIcon, FolderSyncIcon, PencilIcon, RefreshCwIcon, Trash2Icon,} from "lucide-react-native";


type Mode = "menu" | "rename" | "path" | "delete";


interface CollectionActionsDialogProps {
    server: string;
    visible: boolean;
    onClose: () => void;
    folder: MediaFolderSummary | null;
    onDeleted?: (folder: MediaFolderSummary) => void;
}


export function CollectionActionsDialog({ server, folder, visible, onClose, onDeleted }: CollectionActionsDialogProps) {
    const queryClient = useQueryClient();
    const [value, setValue] = useState("");
    const [mode, setMode] = useState<Mode>("menu");

    const close = () => {
        setMode("menu");
        onClose();
    };

    const invalidate = async () => {
        await Promise.all([
            queryClient.invalidateQueries({ queryKey: ["tv-media", server] }),
            queryClient.invalidateQueries({ queryKey: ["tv-library", server] }),
            queryClient.invalidateQueries({ queryKey: ["tv-folders", server] }),
            queryClient.invalidateQueries({ queryKey: ["tv-settings", server] }),
            queryClient.invalidateQueries({ queryKey: ["tv-watching", server] }),
        ])
    };

    const update = useMutation({
        mutationFn: (editMode: "rename" | "path") => tvApi(server)
            .updateLibrary({
                id: folder!.id,
                name: editMode === "rename" ? value.trim() : folder!.name,
                path: editMode === "path" ? value.trim() : folder!.path,
                kind: folder!.kind,
            }),
        onSuccess: async () => {
            await invalidate();
            close();
        },
    });

    const scan = useMutation({
        mutationFn: () => tvApi(server).scan(folder!.id),
        onSuccess: async () => {
            await invalidate();
            close();
        },
    });

    const refresh = useMutation({
        mutationFn: () => tvApi(server).refreshLibraryMetadata(folder!.id),
        onSuccess: async () => {
            await invalidate();
            close();
        },
    });

    const remove = useMutation({
        mutationFn: () => tvApi(server).deleteLibrary(folder!.id),
        onSuccess: async () => {
            const removed = folder!;
            await invalidate();
            close();
            onDeleted?.(removed);
        },
    });

    if (!folder) return null;

    const error = update.error ?? scan.error ?? refresh.error ?? remove.error;
    const pending = update.isPending || scan.isPending || refresh.isPending || remove.isPending;

    const openEditor = (nextMode: "rename" | "path") => {
        setValue(nextMode === "rename" ? folder.name : folder.path)
        setMode(nextMode)
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
                        onPress={() => update.mutate(mode as "rename" | "path")}
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
