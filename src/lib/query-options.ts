import {foyerQueries} from "@/lib/queries";
import type {MediaQueryInput, MediaSort, MediaWatchFilter} from "@foyer/contracts";


export const settingsOptions = foyerQueries.options.settings();


export const mediaFoldersOptions = foyerQueries.options.mediaFolders();


export const currentlyWatchingOptions = foyerQueries.options.currentlyWatching();


export const settingsLibraryOptions = foyerQueries.options.library({ page: 1, pageSize: 1 });


export const mediaOptions = (id: string, input?: MediaQueryInput) => foyerQueries.options.media(id, input);


interface LibraryOptionsInput {
    page?: number;
    search?: string;
    sort?: MediaSort;
    watch?: MediaWatchFilter;
}


export const libraryOptions = (libraryId: string, search: LibraryOptionsInput) => {
    return foyerQueries.options.library({ libraryId, ...search, pageSize: 50 });
};


export const streamAvailabilityOptions = (partId: string) => {
    return foyerQueries.options.streamAvailability(partId);
};
