import {mutationOptions, type QueryClient, queryOptions} from "@tanstack/react-query";
import {LibraryQueryInput, MediaFolderSummary, MediaQueryInput, PlouxApi} from "@ploux/contracts";


type CreateLibraryInput = Parameters<PlouxApi["createLibrary"]>[0];
type UpdateLibraryInput = Parameters<PlouxApi["updateLibrary"]>[0];


export type SaveLibraryInput = CreateLibraryInput | UpdateLibraryInput;


export interface MediaPartWatchInput {
    partId: string;
    watched: boolean;
}


export interface ProgressValue {
    positionSeconds: number;
    durationSeconds: number;
}


export interface CollectionEdit {
    value: string;
    mode: "rename" | "path";
}


export const createPlouxQueries = (api: PlouxApi, cacheScope: string) => {
    const rootKey = ["ploux", cacheScope] as const;

    const keys = {
        all: rootKey,
        library: {
            all: [...rootKey, "library"] as const,
            list: (input: LibraryQueryInput = {}) => [...rootKey, "library", input] as const,
        },
        media: {
            all: [...rootKey, "media"] as const,
            detail: (mediaId: string, input?: MediaQueryInput) => input
                ? [...rootKey, "media", mediaId, input] as const
                : [...rootKey, "media", mediaId] as const,
        },
        mediaInfo: {
            all: [...rootKey, "media-info"] as const,
            detail: (mediaId: string) => [...rootKey, "media-info", mediaId] as const,
        },
        mediaFolders: [...rootKey, "media-folders"] as const,
        currentlyWatching: [...rootKey, "currently-watching"] as const,
        settings: [...rootKey, "settings"] as const,
        streamAvailability: (partId: string) => [...rootKey, "stream-availability", partId] as const,
        mutation: (name: string, id?: string) => [...rootKey, "mutation", name, id] as const,
    };

    const options = {
        mediaFolders: () => queryOptions({
            queryKey: keys.mediaFolders,
            queryFn: api.mediaFolders,
        }),
        currentlyWatching: () => queryOptions({
            queryKey: keys.currentlyWatching,
            queryFn: api.currentlyWatching,
        }),
        media: (mediaId: string, input?: MediaQueryInput) => queryOptions({
            queryKey: keys.media.detail(mediaId, input),
            queryFn: () => api.media(mediaId, input),
        }),
        mediaInfo: (mediaId: string) => queryOptions({
            queryKey: keys.mediaInfo.detail(mediaId),
            queryFn: () => api.mediaInfo(mediaId),
        }),
        settings: () => queryOptions({
            queryKey: keys.settings,
            queryFn: api.settings,
        }),
        library: (input: LibraryQueryInput = {}) => queryOptions({
            queryKey: keys.library.list(input),
            queryFn: () => api.library(input),
        }),
        streamAvailability: (partId: string) => queryOptions({
            queryKey: keys.streamAvailability(partId),
            queryFn: async ({ signal }) => {
                const response = await fetch(api.absoluteUrl(`/api/v1/stream/${encodeURIComponent(partId)}`), {
                    method: "HEAD",
                    signal,
                });

                if (response.status === 404) return false;

                if (!response.ok) {
                    throw new Error(`The media server responded with status ${response.status}.`);
                }

                return true;
            },
            retry: false,
        }),
    };

    const mutations = {
        testConnection: () => mutationOptions({
            mutationKey: keys.mutation("test-connection"),
            mutationFn: api.health,
        }),
        setMediaWatched: (mediaId: string) => mutationOptions({
            mutationKey: keys.mutation("set-media-watched", mediaId),
            mutationFn: (watched: boolean) => api.setMediaWatched(mediaId, watched),
        }),
        setMediaPartWatched: () => mutationOptions({
            mutationKey: keys.mutation("set-media-part-watched"),
            mutationFn: ({ partId, watched }: MediaPartWatchInput) => api.setMediaPartWatched(partId, watched),
        }),
        deleteMedia: (mediaId: string) => mutationOptions({
            mutationKey: keys.mutation("delete-media", mediaId),
            mutationFn: () => api.deleteMedia(mediaId),
        }),
        saveProgress: (partId: string) => mutationOptions({
            mutationKey: keys.mutation("save-progress", partId),
            scope: { id: `playback-progress:${cacheScope}:${partId}` },
            mutationFn: (value: ProgressValue) => api.progress({ partId, ...value }),
        }),
        saveProgressForPart: () => mutationOptions({
            mutationKey: keys.mutation("save-progress"),
            mutationFn: api.progress,
        }),
        deleteProgress: (mediaId: string) => mutationOptions({
            mutationKey: keys.mutation("delete-progress", mediaId),
            mutationFn: () => api.deleteProgress(mediaId),
        }),
        saveLibrary: () => mutationOptions({
            mutationKey: keys.mutation("save-library"),
            mutationFn: (input: SaveLibraryInput) => "id" in input
                ? api.updateLibrary(input)
                : api.createLibrary(input),
        }),
        createLibrary: () => mutationOptions({
            mutationKey: keys.mutation("create-library"),
            mutationFn: api.createLibrary,
        }),
        updateLibrary: () => mutationOptions({
            mutationKey: keys.mutation("update-library"),
            mutationFn: api.updateLibrary,
        }),
        editCollection: (folder: MediaFolderSummary) => mutationOptions({
            mutationKey: keys.mutation("edit-collection", folder.id),
            mutationFn: ({ mode, value }: CollectionEdit) => api.updateLibrary({
                id: folder.id,
                kind: folder.kind,
                path: mode === "path" ? value : folder.path,
                name: mode === "rename" ? value : folder.name,
            }),
        }),
        deleteLibrary: (libraryId: string) => mutationOptions({
            mutationKey: keys.mutation("delete-library", libraryId),
            mutationFn: () => api.deleteLibrary(libraryId),
        }),
        scanLibrary: (libraryId?: string) => mutationOptions({
            mutationKey: keys.mutation("scan-library", libraryId),
            mutationFn: () => api.scan(libraryId),
        }),
        searchMetadata: () => mutationOptions({
            mutationKey: keys.mutation("search-metadata"),
            mutationFn: api.searchMetadata,
        }),
        identifyMedia: (mediaId: string) => mutationOptions({
            mutationKey: keys.mutation("identify-media", mediaId),
            mutationFn: (tmdbId: number) => api.identify(mediaId, tmdbId),
        }),
        refreshMediaMetadata: (mediaId: string) => mutationOptions({
            mutationKey: keys.mutation("refresh-media-metadata", mediaId),
            mutationFn: () => api.refreshMetadata(mediaId),
        }),
        refreshLibraryMetadata: (libraryId: string) => mutationOptions({
            mutationKey: keys.mutation("refresh-library-metadata", libraryId),
            mutationFn: () => api.refreshLibraryMetadata(libraryId),
        }),
    };

    const invalidate = {
        libraries: async (queryClient: QueryClient) => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: keys.library.all }),
                queryClient.invalidateQueries({ queryKey: keys.settings }),
                queryClient.invalidateQueries({ queryKey: keys.mediaFolders }),
            ]);
        },
        media: async (queryClient: QueryClient, mediaId: string, includeFolders = false) => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: keys.library.all }),
                queryClient.invalidateQueries({ queryKey: keys.media.detail(mediaId) }),
                queryClient.invalidateQueries({ queryKey: keys.currentlyWatching }),
                ...(includeFolders
                    ? [queryClient.invalidateQueries({ queryKey: keys.mediaFolders })]
                    : []),
            ]);
        },
        catalog: async (queryClient: QueryClient) => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: keys.media.all }),
                queryClient.invalidateQueries({ queryKey: keys.library.all }),
                queryClient.invalidateQueries({ queryKey: keys.mediaFolders }),
                queryClient.invalidateQueries({ queryKey: keys.settings }),
                queryClient.invalidateQueries({ queryKey: keys.currentlyWatching }),
            ]);
        },
        identification: async (queryClient: QueryClient, mediaId: string) => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: keys.library.all }),
                queryClient.invalidateQueries({ queryKey: keys.mediaFolders }),
                queryClient.invalidateQueries({ queryKey: keys.media.detail(mediaId) }),
                queryClient.invalidateQueries({ queryKey: keys.currentlyWatching }),
            ]);
        },
    };

    const remove = {
        media: (queryClient: QueryClient, mediaId: string) => {
            queryClient.removeQueries({ queryKey: keys.media.detail(mediaId) });
            queryClient.removeQueries({ queryKey: keys.mediaInfo.detail(mediaId) });
        },
    };

    return { keys, options, mutations, invalidate, remove };
};


export type PlouxQueries = ReturnType<typeof createPlouxQueries>;
