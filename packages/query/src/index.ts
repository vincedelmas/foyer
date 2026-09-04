import {mutationOptions, type QueryClient, queryOptions} from "@tanstack/react-query";
import {LibraryQueryInput, MediaFileInfo, MediaFolderSummary, MediaQueryInput, FoyerApi} from "@foyer/contracts";


type CreateLibraryInput = Parameters<FoyerApi["createLibrary"]>[0];
type UpdateLibraryInput = Parameters<FoyerApi["updateLibrary"]>[0];


export type SaveLibraryInput = CreateLibraryInput | UpdateLibraryInput;


export interface MediaPartWatchInput {
    partId: string;
    watched: boolean;
}


export interface MediaSeasonWatchInput {
    seasonNumber: number;
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


export const createFoyerQueries = (api: FoyerApi, cacheScope: string) => {
    const rootKey = ["foyer", cacheScope] as const;

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
        mediaFileInfo: {
            all: [...rootKey, "media-file-info"] as const,
            detail: (mediaId: string, file: Pick<MediaFileInfo, "id" | "size" | "modifiedAt">) =>
                [...rootKey, "media-file-info", mediaId, file.id, file.size, file.modifiedAt] as const,
        },
        mediaFolders: [...rootKey, "media-folders"] as const,
        currentlyWatching: {
            all: [...rootKey, "currently-watching"] as const,
            list: (limit?: number) => [...rootKey, "currently-watching", limit ?? "all"] as const,
        },
        settings: [...rootKey, "settings"] as const,
        streamAvailability: (partId: string) => [...rootKey, "stream-availability", partId] as const,
        mutation: (name: string, id?: string) => [...rootKey, "mutation", name, id] as const,
    };

    const options = {
        mediaFolders: () => queryOptions({
            queryKey: keys.mediaFolders,
            queryFn: ({signal}) => api.mediaFolders(signal),
        }),
        currentlyWatching: (limit?: number) => queryOptions({
            queryKey: keys.currentlyWatching.list(limit),
            queryFn: ({signal}) => api.currentlyWatching(limit, signal),
        }),
        media: (mediaId: string, input?: MediaQueryInput) => queryOptions({
            queryKey: keys.media.detail(mediaId, input),
            queryFn: ({signal}) => api.media(mediaId, input, signal),
        }),
        mediaInfo: (mediaId: string) => queryOptions({
            queryKey: keys.mediaInfo.detail(mediaId),
            queryFn: ({signal}) => api.mediaInfo(mediaId, signal),
        }),
        mediaFileInfo: (mediaId: string, file: Pick<MediaFileInfo, "id" | "size" | "modifiedAt">) => queryOptions({
            queryKey: keys.mediaFileInfo.detail(mediaId, file),
            queryFn: ({signal}) => api.mediaFileInfo(mediaId, file.id, signal),
        }),
        settings: () => queryOptions({
            queryKey: keys.settings,
            queryFn: ({signal}) => api.settings(signal),
        }),
        library: (input: LibraryQueryInput = {}) => queryOptions({
            queryKey: keys.library.list(input),
            queryFn: ({signal}) => api.library(input, signal),
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
        setMediaSeasonWatched: (mediaId: string) => mutationOptions({
            mutationKey: keys.mutation("set-media-season-watched", mediaId),
            mutationFn: ({ seasonNumber, watched }: MediaSeasonWatchInput) =>
                api.setMediaSeasonWatched(mediaId, seasonNumber, watched),
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
        deleteMediaProgress: (mediaId: string) => mutationOptions({
            mutationKey: keys.mutation("delete-media-progress", mediaId),
            mutationFn: () => api.deleteMediaProgress(mediaId),
        }),
        deleteMediaPartProgress: () => mutationOptions({
            mutationKey: keys.mutation("delete-media-part-progress"),
            mutationFn: (partId: string) => api.deleteMediaPartProgress(partId),
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
                queryClient.invalidateQueries({ queryKey: keys.currentlyWatching.all }),
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
                queryClient.invalidateQueries({ queryKey: keys.currentlyWatching.all }),
                queryClient.invalidateQueries({ queryKey: keys.mediaInfo.all }),
                queryClient.invalidateQueries({ queryKey: keys.mediaFileInfo.all }),
            ]);
        },
        identification: async (queryClient: QueryClient, mediaId: string) => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: keys.library.all }),
                queryClient.invalidateQueries({ queryKey: keys.mediaFolders }),
                queryClient.invalidateQueries({ queryKey: keys.media.detail(mediaId) }),
                queryClient.invalidateQueries({ queryKey: keys.currentlyWatching.all }),
            ]);
        },
    };

    const remove = {
        media: (queryClient: QueryClient, mediaId: string) => {
            queryClient.removeQueries({ queryKey: keys.media.detail(mediaId) });
            queryClient.removeQueries({ queryKey: keys.mediaInfo.detail(mediaId) });
            queryClient.removeQueries({ queryKey: [...keys.mediaFileInfo.all, mediaId] });
        },
    };

    return { keys, options, mutations, invalidate, remove };
};


export type FoyerQueries = ReturnType<typeof createFoyerQueries>;
