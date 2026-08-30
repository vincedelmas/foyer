import type {MediaDeleteResult, TmdbCandidate} from "@foyer/contracts";
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
        onSuccess: async () => {
            await queries.invalidate.media(queryClient, mediaId);
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


export const useClearMediaProgressMutation = (server: string, mediaId: string, afterSuccess?: AfterSuccess) => {
    const queryClient = useQueryClient();
    const queries = tvQueries(server);

    return useMutation({
        ...queries.mutations.deleteProgress(mediaId),
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


export const useUpdateLibraryMutation = (server: string, afterSuccess?: AfterSuccess) => {
    const queryClient = useQueryClient();
    const queries = tvQueries(server);

    return useMutation({
        ...queries.mutations.updateLibrary(),
        onSuccess: async () => {
            await queries.invalidate.catalog(queryClient);
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
