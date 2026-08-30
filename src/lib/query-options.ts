import {plouxQueries} from "@/lib/queries";
import type {MediaSort, MediaWatchFilter} from "@ploux/contracts";


export const mediaFoldersOptions = plouxQueries.options.mediaFolders();


export const currentlyWatchingOptions = plouxQueries.options.currentlyWatching();


export const mediaOptions = (id: string) => plouxQueries.options.media(id);


export const settingsOptions = plouxQueries.options.settings();


export const settingsLibraryOptions = plouxQueries.options.library({});


interface LibraryOptionsInput {
    page?: number;
    search?: string;
    sort?: MediaSort;
    watch?: MediaWatchFilter;
}


export const libraryOptions = (libraryId: string, search: LibraryOptionsInput) => {
    return plouxQueries.options.library({
        libraryId,
        ...search,
        pageSize: 28,
    });
};


export const streamAvailabilityOptions = (partId: string) => {
    return plouxQueries.options.streamAvailability(partId);
};
