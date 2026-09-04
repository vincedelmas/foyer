import type {LibraryQueryInput, LibraryResponse, MediaDeleteResult, MediaSummary, TmdbCandidate} from "@foyer/contracts";
import {useMutation, useQueryClient} from "@tanstack/react-query";

import {tvQueries} from "./queries";


type AfterSuccess = () => void | Promise<void>;


export const useTestConnectionMutation = (server: string) => {
    return useMutation(tvQueries(server).mutations.testConnection());
};


export const useSetMediaWatchedMutation = (server: string, mediaId: string, afterSuccess?: AfterSuccess) => {
    const queryClient = useQueryClient();
    const queries = tvQueries(server);

    return useMutation({
        ...queries.mutations.setMediaWatched(mediaId),
        onSuccess: async (_, watched) => {
            for (const [queryKey, data] of queryClient.getQueriesData<LibraryResponse>({
                queryKey: queries.keys.library.all,
            })) {
                if (!data) continue;
                const input = queryKey.at(-1) as LibraryQueryInput;
                const excludesItem = input.watch === (watched ? "unwatched" : "watched");
                const items = excludesItem
                    ? data.items.filter((item) => item.id !== mediaId)
                    : data.items.map((item) => item.id === mediaId
                        ? {
                            ...item,
                            watched,
                            hasProgress: watched ? item.hasProgress : false,
                            progress: watched ? item.progress : null,
                            unwatchedPartCount: watched ? 0 : item.partCount,
                        }
                        : item);
                const removed = data.items.length - items.length;
                queryClient.setQueryData<LibraryResponse>(queryKey, {
                    ...data,
                    items,
                    pagination: removed
                        ? {
                            ...data.pagination,
                            totalItems: data.pagination.totalItems - removed,
                            totalPages: Math.max(1, Math.ceil(
                                (data.pagination.totalItems - removed) / data.pagination.pageSize
                            )),
                        }
                        : data.pagination,
                });
            }
            if (watched) {
                queryClient.setQueriesData<MediaSummary[]>({
                    queryKey: queries.keys.currentlyWatching.all,
                }, (items) => items?.filter((item) => item.id !== mediaId));
            }
            await Promise.all([
                queryClient.invalidateQueries({queryKey: queries.keys.library.all, refetchType: "none"}),
                queryClient.invalidateQueries({queryKey: queries.keys.media.detail(mediaId)}),
                queryClient.invalidateQueries({queryKey: queries.keys.currentlyWatching.all}),
            ]);
            await afterSuccess?.();
        },
    });
};


export const useSetMediaPartWatchedMutation = (server: string, mediaId: string, afterSuccess?: AfterSuccess) => {
    const queryClient = useQueryClient();
    const queries = tvQueries(server);

    return useMutation({
        ...queries.mutations.setMediaPartWatched(),
        onSuccess: async () => {
            await queries.invalidate.media(queryClient, mediaId);
            await afterSuccess?.();
        },
    });
};


export const useSetMediaSeasonWatchedMutation = (server: string, mediaId: string, afterSuccess?: AfterSuccess) => {
    const queryClient = useQueryClient();
    const queries = tvQueries(server);

    return useMutation({
        ...queries.mutations.setMediaSeasonWatched(mediaId),
        onSuccess: async () => {
            await queries.invalidate.media(queryClient, mediaId);
            await afterSuccess?.();
        },
    });
};


export const useClearMediaProgressMutation = (server: string, mediaId: string, afterSuccess?: AfterSuccess) => {
    const queryClient = useQueryClient();
    const queries = tvQueries(server);

    return useMutation({
        ...queries.mutations.deleteMediaProgress(mediaId),
        onSuccess: async () => {
            await queries.invalidate.media(queryClient, mediaId);
            await afterSuccess?.();
        },
    });
};


export const useClearMediaPartProgressMutation = (server: string, mediaId: string, afterSuccess?: AfterSuccess) => {
    const queryClient = useQueryClient();
    const queries = tvQueries(server);

    return useMutation({
        ...queries.mutations.deleteMediaPartProgress(),
        onSuccess: async () => {
            await queries.invalidate.media(queryClient, mediaId);
            await afterSuccess?.();
        },
    });
};


export const useRefreshMediaMetadataMutation = (server: string, mediaId: string, afterSuccess?: AfterSuccess) => {
    const queryClient = useQueryClient();
    const queries = tvQueries(server);

    return useMutation({
        ...queries.mutations.refreshMediaMetadata(mediaId),
        onSuccess: async () => {
            await queries.invalidate.media(queryClient, mediaId, true);
            await afterSuccess?.();
        },
    });
};


export const useDeleteMediaMutation = (
    server: string,
    mediaId: string,
    afterSuccess?: (result: MediaDeleteResult) => void | Promise<void>,
) => {
    const queryClient = useQueryClient();
    const queries = tvQueries(server);

    return useMutation({
        ...queries.mutations.deleteMedia(mediaId),
        onSuccess: async (result) => {
            queries.remove.media(queryClient, mediaId);
            await queries.invalidate.catalog(queryClient);
            await afterSuccess?.(result);
        },
    });
};


export const useSaveLibraryMutation = (server: string, afterSuccess?: AfterSuccess) => {
    const queryClient = useQueryClient();
    const queries = tvQueries(server);

    return useMutation({
        ...queries.mutations.saveLibrary(),
        onSuccess: async () => {
            await queries.invalidate.libraries(queryClient);
            await afterSuccess?.();
        },
    });
};


export const useScanLibraryMutation = (server: string, libraryId?: string, afterSuccess?: AfterSuccess) => {
    const queryClient = useQueryClient();
    const queries = tvQueries(server);

    return useMutation({
        ...queries.mutations.scanLibrary(libraryId),
        onSuccess: async () => {
            await queries.invalidate.catalog(queryClient);
            await afterSuccess?.();
        },
    });
};


export const useRefreshLibraryMetadataMutation = (server: string, libraryId: string, afterSuccess?: AfterSuccess) => {
    const queryClient = useQueryClient();
    const queries = tvQueries(server);

    return useMutation({
        ...queries.mutations.refreshLibraryMetadata(libraryId),
        onSuccess: async () => {
            await queries.invalidate.catalog(queryClient);
            await afterSuccess?.();
        },
    });
};


export const useDeleteLibraryMutation = (server: string, libraryId: string, afterSuccess?: AfterSuccess) => {
    const queryClient = useQueryClient();
    const queries = tvQueries(server);

    return useMutation({
        ...queries.mutations.deleteLibrary(libraryId),
        onSuccess: async () => {
            await queries.invalidate.catalog(queryClient);
            await afterSuccess?.();
        },
    });
};


export const useSearchMetadataMutation = (
    server: string,
    afterSuccess?: (result: { candidates: TmdbCandidate[] }) => void,
) => {
    return useMutation({
        ...tvQueries(server).mutations.searchMetadata(),
        onSuccess: afterSuccess,
    });
};


export const useIdentifyMediaMutation = (server: string, mediaId: string, afterSuccess?: AfterSuccess) => {
    const queryClient = useQueryClient();
    const queries = tvQueries(server);

    return useMutation({
        ...queries.mutations.identifyMedia(mediaId),
        onSuccess: async () => {
            await queries.invalidate.identification(queryClient, mediaId);
            await afterSuccess?.();
        },
    });
};


export const useSaveProgressMutation = (server: string) => {
    return useMutation(tvQueries(server).mutations.saveProgressForPart());
};
