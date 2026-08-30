import {foyerQueries} from "@/lib/queries";
import {toast} from "@/components/ui/toast";
import {LibraryRecord, MediaFolderSummary} from "@foyer/contracts";
import {QueryClient, useMutation, useQueryClient} from "@tanstack/react-query";


type AfterSuccess = () => void | Promise<void>;


const invalidateLibraryQueries = async (queryClient: QueryClient) => {
    await foyerQueries.invalidate.libraries(queryClient);
};


const invalidateMediaQueries = async (queryClient: QueryClient, mediaId: string, includeFolders = false) => {
    await foyerQueries.invalidate.media(queryClient, mediaId, includeFolders);
};


export const useSetMediaWatchedMutation = (mediaId: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        ...foyerQueries.mutations.setMediaWatched(mediaId),
        onSuccess: async (result) => {
            await invalidateMediaQueries(queryClient, mediaId);
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


export const useSetMediaPartWatchedMutation = (mediaId: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        ...foyerQueries.mutations.setMediaPartWatched(),
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
        ...foyerQueries.mutations.deleteProgress(mediaId),
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
        ...foyerQueries.mutations.refreshMediaMetadata(mediaId),
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
        ...foyerQueries.mutations.deleteMedia(mediaId),
        onSuccess: async (result) => {
            foyerQueries.remove.media(queryClient, mediaId);

            await Promise.all([
                invalidateMediaQueries(queryClient, mediaId, true),
                queryClient.invalidateQueries({ queryKey: foyerQueries.keys.settings }),
            ]);

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
        ...foyerQueries.mutations.editCollection(folder),
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
        ...foyerQueries.mutations.refreshLibraryMetadata(libraryId),
        onSuccess: async (summary) => {
            await foyerQueries.invalidate.catalog(queryClient);

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
        ...foyerQueries.mutations.scanLibrary(library.id),
        onSuccess: async (result) => {
            await foyerQueries.invalidate.catalog(queryClient);

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
        ...foyerQueries.mutations.deleteLibrary(libraryId),
        onSuccess: async () => {
            await foyerQueries.invalidate.catalog(queryClient);

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
        ...foyerQueries.mutations.createLibrary(),
        onSuccess: async () => {
            await invalidateLibraryQueries(queryClient);
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
        ...foyerQueries.mutations.updateLibrary(),
        onSuccess: async () => {
            await foyerQueries.invalidate.catalog(queryClient);
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
        ...foyerQueries.mutations.identifyMedia(mediaId),
        onSuccess: async () => {
            await foyerQueries.invalidate.identification(queryClient, mediaId);
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


export const useSearchMetadataMutation = () => {
    return useMutation(foyerQueries.mutations.searchMetadata());
};


export const useScanAllLibrariesMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        ...foyerQueries.mutations.scanLibrary(),
        onSuccess: async (result) => {
            await foyerQueries.invalidate.catalog(queryClient);

            const failed = result.scans.filter((scan) => scan.status === "failed").length;
            const completed = result.scans.length - failed;

            toast.add({
                type: failed ? "warning" : "success",
                title: failed ? "Scan completed with errors" : "All media folders scanned",
                description: failed
                    ? `${completed} completed, ${failed} failed.`
                    : `${completed} folders completed.`,
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
        ...foyerQueries.mutations.saveProgress(partId),
        onSuccess: () => {
            void invalidateMediaQueries(queryClient, mediaId);
        },
    });
};
