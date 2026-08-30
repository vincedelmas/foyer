import {api} from "@/lib/api";
import {toast} from "@/components/ui/toast";
import {QueryClient, useMutation, useQueryClient} from "@tanstack/react-query";
import {LibraryRecord, MediaFolderSummary, MediaSummary} from "@ploux/contracts";


type AfterSuccess = () => void | Promise<void>;


export type CollectionEdit = {
    value: string;
    mode: "rename" | "path";
};


const invalidateLibraryQueries = async (queryClient: QueryClient) => {
    await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["library"] }),
        queryClient.invalidateQueries({ queryKey: ["settings"] }),
        queryClient.invalidateQueries({ queryKey: ["media-folders"] }),
    ]);
};


const invalidateMediaQueries = async (queryClient: QueryClient, mediaId: string, includeFolders = false) => {
    await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["library"] }),
        queryClient.invalidateQueries({ queryKey: ["media", mediaId] }),
        queryClient.invalidateQueries({ queryKey: ["currently-watching"] }),
        ...(includeFolders ? [queryClient.invalidateQueries({ queryKey: ["media-folders"] })] : []),
    ]);
};


export const useSetMediaWatchedMutation = (item: Pick<MediaSummary, "id" | "watched">) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: () => api.setMediaWatched(item.id, !item.watched),
        onSuccess: async (result) => {
            await invalidateMediaQueries(queryClient, item.id);
            toast.add({
                type: "success",
                title: result.watched ? "Marked as watched" : "Marked as unwatched",
            });
        },
        onError: (error) => {
            toast.add({
                type: "error",
                description: error.message,
                title: "Could not change watch status",
            });
        },
    });
};


export const useSetMediaPartWatchedMutation = (mediaId: string, partId: string, watched: boolean) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: () => api.setMediaPartWatched(partId, watched),
        onSuccess: async (result) => {
            await invalidateMediaQueries(queryClient, mediaId);
            toast.add({
                type: "success",
                title: result.watched ? "Episode marked as watched" : "Episode marked as unwatched",
            });
        },
        onError: (error) => {
            toast.add({
                type: "error",
                description: error.message,
                title: "Could not change episode watch status",
            });
        },
    });
};


export const useClearMediaProgressMutation = (mediaId: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: () => api.deleteProgress(mediaId),
        onSuccess: async () => {
            await invalidateMediaQueries(queryClient, mediaId);
            toast.add({ type: "success", title: "Watch progress removed" });
        },
        onError: (error) => {
            toast.add({
                type: "error",
                description: error.message,
                title: "Could not remove watch progress",
            });
        },
    });
};


export const useRefreshMediaMetadataMutation = (mediaId: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: () => api.refreshMetadata(mediaId),
        onSuccess: async () => {
            await invalidateMediaQueries(queryClient, mediaId, true);
            toast.add({ type: "success", title: "Metadata refreshed" });
        },
        onError: (error) => {
            toast.add({
                type: "error",
                description: error.message,
                title: "Metadata refresh failed",
            });
        },
    });
};


export const useDeleteMediaMutation = (mediaId: string, afterSuccess?: AfterSuccess) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: () => api.deleteMedia(mediaId),
        onSuccess: async (result) => {
            await Promise.all([
                invalidateMediaQueries(queryClient, mediaId, true),
                queryClient.invalidateQueries({ queryKey: ["settings"] }),
            ]);

            queryClient.removeQueries({ queryKey: ["media", mediaId] });
            queryClient.removeQueries({ queryKey: ["media-info", mediaId] });

            toast.add({
                type: "success",
                title: "Media deleted permanently",
                description: [
                    `${result.filesDeleted} ${result.filesDeleted === 1 ? "file" : "files"} deleted from the server.`,
                    result.filesAlreadyMissing
                        ? `${result.filesAlreadyMissing} already missing.`
                        : null,
                ].filter(Boolean).join(" "),
            });

            await afterSuccess?.();
        },
        onError: (error) => {
            toast.add({
                type: "error",
                title: "Could not delete media",
                description: error.message,
            });
        },
    });
};


export const useEditCollectionMutation = (folder: MediaFolderSummary, afterSuccess?: AfterSuccess) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ mode, value }: CollectionEdit) => api.updateLibrary({
            id: folder.id,
            kind: folder.kind,
            path: mode === "path" ? value : folder.path,
            name: mode === "rename" ? value : folder.name,
        }),
        onSuccess: async (_, variables) => {
            await invalidateLibraryQueries(queryClient);
            toast.add({
                type: "success",
                title: variables.mode === "rename" ? "Collection renamed" : "Server folder updated",
                description: variables.mode === "path" ? "Rescan this collection to sync its files." : undefined,
            });
            await afterSuccess?.();
        },
        onError: (error) => {
            toast.add({
                type: "error",
                description: error.message,
                title: "Could not update collection",
            });
        },
    });
};


export const useRefreshCollectionMetadataMutation = (libraryId: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: () => api.refreshLibraryMetadata(libraryId),
        onSuccess: async (summary) => {
            await Promise.all([
                invalidateLibraryQueries(queryClient),
                queryClient.invalidateQueries({ queryKey: ["currently-watching"] }),
                queryClient.invalidateQueries({ queryKey: ["media"] }),
            ]);

            const updated = summary.refreshed + summary.matched;

            toast.add({
                type: summary.failed ? "warning" : "success",
                title: updated ? `${updated} ${updated === 1 ? "title" : "titles"} refreshed` : "Metadata is already up to date",
                description: [
                    summary.failed ? `${summary.failed} failed` : null,
                    summary.skipped ? `${summary.skipped} unmatched` : null,
                    summary.matched ? `${summary.matched} newly matched` : null,
                ].filter(Boolean).join(" · ") || undefined,
            });
        },
        onError: (error) => {
            toast.add({
                type: "error",
                description: error.message,
                title: "Metadata refresh failed",
            });
        },
    });
};


export const useScanLibraryMutation = (library: Pick<LibraryRecord, "id" | "name">, verb: "scanned" | "rescanned" = "scanned") => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: () => api.scan(library.id),
        onSuccess: async (result) => {
            await Promise.all([
                invalidateLibraryQueries(queryClient),
                queryClient.invalidateQueries({ queryKey: ["media"] }),
                queryClient.invalidateQueries({ queryKey: ["currently-watching"] }),
            ]);

            const summary = result.scans[0];

            toast.add({
                type: "success",
                title: `${library.name} ${verb}`,
                description: summary
                    ? `${summary.filesSeen} files · ${summary.titlesAdded} new titles · ${summary.subtitlesFound} subtitles`
                    : undefined,
            });
        },
        onError: (error) => {
            toast.add({ type: "error", title: "Scan failed", description: error.message });
        },
    });
};


export const useDeleteLibraryMutation = (libraryId: string, afterSuccess?: AfterSuccess) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: () => api.deleteLibrary(libraryId),
        onSuccess: async () => {
            await Promise.all([
                invalidateLibraryQueries(queryClient),
                queryClient.invalidateQueries({ queryKey: ["currently-watching"] }),
            ]);

            toast.add({
                type: "success",
                title: "Collection deleted",
                description: "Your media files were not touched.",
            });
            await afterSuccess?.();
        },
        onError: (error) => {
            toast.add({
                type: "error",
                description: error.message,
                title: "Could not delete collection",
            });
        },
    });
};


export const useCreateLibraryMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: api.createLibrary,
        onSuccess: async () => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ["settings"] }),
                queryClient.invalidateQueries({ queryKey: ["media-folders"] }),
            ]);
            toast.add({
                type: "success",
                title: "Media folder added",
                description: "Run a scan to index its files.",
            });
        },
        onError: (error) => {
            toast.add({
                type: "error",
                description: error.message,
                title: "Could not add media folder",
            });
        },
    });
};


export const useUpdateLibraryMutation = (afterSuccess?: AfterSuccess) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: api.updateLibrary,
        onSuccess: async () => {
            await invalidateLibraryQueries(queryClient);
            toast.add({
                type: "success",
                title: "Media folder updated",
                description: "Run a scan if you changed its path or media type.",
            });
            await afterSuccess?.();
        },
        onError: (error) => {
            toast.add({
                type: "error",
                description: error.message,
                title: "Could not update media folder",
            });
        },
    });
};


export const useIdentifyMediaMutation = (mediaId: string, afterSuccess?: AfterSuccess) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (tmdbId: number) => api.identify(mediaId, tmdbId),
        onSuccess: async () => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ["library"] }),
                queryClient.invalidateQueries({ queryKey: ["media-folders"] }),
                queryClient.invalidateQueries({ queryKey: ["media", mediaId] }),
                queryClient.invalidateQueries({ queryKey: ["currently-watching"] }),
            ]);
            toast.add({
                type: "success",
                title: "Identity updated",
                description: "TMDB metadata has been replaced.",
            });
            await afterSuccess?.();
        },
        onError: (error) => {
            toast.add({
                type: "error",
                description: error.message,
                title: "Could not identify title",
            });
        },
    });
};


export const useScanAllLibrariesMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: () => api.scan(),
        onSuccess: async (result) => {
            await invalidateLibraryQueries(queryClient);
            toast.add({
                type: "success",
                title: "All media folders scanned",
                description: `${result.scans.length} folders completed.`,
            });
        },
        onError: (error) => {
            toast.add({
                type: "error",
                title: "Scan failed",
                description: error.message,
            });
        },
    });
};


export const useSaveProgressMutation = (mediaId: string, partId: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (value: { positionSeconds: number; durationSeconds: number }) => {
            return api.progress({ partId, ...value });
        },
        onSuccess: () => {
            void invalidateMediaQueries(queryClient, mediaId);
        },
    });
};
