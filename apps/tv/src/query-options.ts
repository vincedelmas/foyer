import type {LibraryQueryInput} from "@ploux/contracts";

import {tvQueries} from "./queries";


export const mediaFoldersOptions = (server: string) => {
    return tvQueries(server).options.mediaFolders();
};


export const currentlyWatchingOptions = (server: string) => {
    return tvQueries(server).options.currentlyWatching();
};


export const mediaOptions = (server: string, mediaId: string) => {
    return tvQueries(server).options.media(mediaId);
};


export const mediaInfoOptions = (server: string, mediaId: string) => {
    return tvQueries(server).options.mediaInfo(mediaId);
};


export const settingsOptions = (server: string) => {
    return tvQueries(server).options.settings();
};


export const libraryOptions = (server: string, input: LibraryQueryInput = {}) => {
    return tvQueries(server).options.library(input);
};
