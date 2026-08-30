interface SortableMediaPart {
    fileName: string;
    seasonNumber: number | null;
    episodeNumber: number | null;
}


export const compareMediaParts = (left: SortableMediaPart, right: SortableMediaPart) => {
    return (left.seasonNumber ?? 0) - (right.seasonNumber ?? 0) ||
        (left.episodeNumber ?? 0) - (right.episodeNumber ?? 0) ||
        left.fileName.localeCompare(right.fileName);
};
