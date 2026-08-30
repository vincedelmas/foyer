import {api} from "@/lib/api";
import {queryOptions} from "@tanstack/react-query";
import type {MediaSort, MediaWatchFilter} from "@ploux/contracts";


export const mediaFoldersOptions = queryOptions({
    queryKey: ["media-folders"],
    queryFn: api.mediaFolders,
});


export const currentlyWatchingOptions = queryOptions({
    queryKey: ["currently-watching"],
    queryFn: api.currentlyWatching,
});


export const mediaOptions = (id: string) => queryOptions({
    queryKey: ["media", id],
    queryFn: () => api.media(id),
});


export const settingsOptions = queryOptions({
    queryKey: ["settings"],
    queryFn: api.settings,
});


export const settingsLibraryOptions = queryOptions({
    queryKey: ["library", "settings-stats"],
    queryFn: () => api.library({}),
});


interface LibraryOptionsInput {
    page?: number;
    search?: string;
    sort?: MediaSort;
    watch?: MediaWatchFilter;
}


export const libraryOptions = (libraryId: string, search: LibraryOptionsInput) => queryOptions({
    queryKey: ["library", libraryId, search],
    queryFn: () => api.library({
        libraryId,
        ...search,
        pageSize: 28,
    }),
});


export const streamAvailabilityOptions = (partId: string) => queryOptions({
    queryKey: ["stream-availability", partId],
    queryFn: async ({ signal }) => {
        const response = await fetch(`/api/v1/stream/${encodeURIComponent(partId)}`, { method: "HEAD", signal });
        if (response.status === 404) return false;

        if (!response.ok) {
            throw new Error(`The media server responded with status ${response.status}.`);
        }

        return true;
    },
    retry: false,
});
