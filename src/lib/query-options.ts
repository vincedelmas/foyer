import {plouxQueries} from "@/lib/queries";
import type {MediaQueryInput, MediaSort, MediaWatchFilter} from "@ploux/contracts";


export const settingsOptions = plouxQueries.options.settings();


export const mediaFoldersOptions = plouxQueries.options.mediaFolders();


export const currentlyWatchingOptions = plouxQueries.options.currentlyWatching();


export const settingsLibraryOptions = plouxQueries.options.library({ page: 1, pageSize: 1 });


export const mediaOptions = (id: string, input?: MediaQueryInput) => plouxQueries.options.media(id, input);


interface LibraryOptionsInput {
    page?: number;
    search?: string;
    sort?: MediaSort;
    watch?: MediaWatchFilter;
}


export const libraryOptions = (libraryId: string, search: LibraryOptionsInput) => {
    return plouxQueries.options.library({ libraryId, ...search, pageSize: 28 });
};


export const streamAvailabilityOptions = (partId: string) => {
    return plouxQueries.options.streamAvailability(partId);
};
