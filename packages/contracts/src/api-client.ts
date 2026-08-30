import {z} from "zod";
import type {
    LibraryKind,
    LibraryRecord,
    LibraryResponse,
    MediaDeleteResult,
    MediaDetail,
    MediaFileInfo,
    MediaFolderSummary,
    MediaInfo,
    MediaKind,
    MediaSort,
    MediaSummary,
    MediaWatchFilter,
    MetadataRefreshSummary,
    ScanRecord,
    TmdbCandidate,
} from "./index";


export const healthResponseSchema = z.object({
    directPlay: z.boolean(),
    transcoding: z.boolean(),
    status: z.literal("ok"),
    name: z.literal("Foyer"),
    version: z.string().min(1),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;


export class ApiError extends Error {
    constructor(message: string, public readonly status: number) {
        super(message);
    }
}


export interface LibraryQueryInput {
    page?: number;
    search?: string;
    kind?: MediaKind;
    sort?: MediaSort;
    pageSize?: number;
    libraryId?: string;
    watch?: MediaWatchFilter;
}


export interface MediaQueryInput {
    page?: number;
    season?: number;
    pageSize?: number;
}


const libraryQuery = (input: LibraryQueryInput) => {
    const query = new URLSearchParams();

    if (input.kind) query.set("kind", input.kind);
    if (input.sort) query.set("sort", input.sort);
    if (input.search) query.set("search", input.search);
    if (input.page) query.set("page", String(input.page));
    if (input.libraryId) query.set("libraryId", input.libraryId);
    if (input.pageSize) query.set("pageSize", String(input.pageSize));
    if (input.watch && input.watch !== "all") query.set("watch", input.watch);

    return query.toString();
};


const mediaQuery = (input: MediaQueryInput) => {
    const query = new URLSearchParams();

    if (input.page) query.set("page", String(input.page));
    if (input.pageSize) query.set("pageSize", String(input.pageSize));
    if (input.season !== undefined) query.set("season", String(input.season));

    return query.toString();
};


export const createFoyerApi = (baseUrl = "") => {
    const trimmedBaseUrl = baseUrl.trim().replace(/\/+$/, "");

    const absoluteUrl = (path: string) => {
        return `${trimmedBaseUrl}${path}`;
    };

    const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
        const headers = new Headers(init?.headers);

        if (init?.body && !headers.has("Content-Type")) {
            headers.set("Content-Type", "application/json");
        }

        const response = await fetch(absoluteUrl(path), { ...init, headers });
        const body = (await response.json().catch(() => null)) as { error?: string } | T | null;

        if (!response.ok) {
            const message = body && typeof body === "object" && "error" in body && body.error
                ? body.error
                : `Request failed (${response.status})`;

            throw new ApiError(message, response.status);
        }

        return body as T;
    };

    return {
        absoluteUrl,
        currentlyWatching: () => request<MediaSummary[]>("/api/v1/progress"),
        mediaInfo: (id: string) => request<MediaInfo>(`/api/v1/media/${id}?view=info`),
        mediaFileInfo: (mediaId: string, partId: string) =>
            request<MediaFileInfo>(`/api/v1/media/${mediaId}?view=info&partId=${encodeURIComponent(partId)}`),
        mediaFolders: () => request<MediaFolderSummary[]>("/api/v1/libraries"),
        health: async () => {
            const result = healthResponseSchema.safeParse(await request<unknown>("/api/v1/"));
            if (!result.success) {
                throw new Error("This address does not appear to be a Foyer server.");
            }
            return result.data;
        },
        media: (id: string, input: MediaQueryInput = {}) => {
            const query = mediaQuery(input);
            return request<MediaDetail>(`/api/v1/media/${id}${query ? `?${query}` : ""}`);
        },
        library: (input: LibraryQueryInput = {}) => {
            return request<LibraryResponse>(`/api/v1/library?${libraryQuery(input)}`);
        },
        setMediaWatched: (id: string, watched: boolean) =>
            request<{ watched: boolean; updatedParts: number }>(`/api/v1/media/${id}`, {
                method: "PUT",
                body: JSON.stringify({ watched }),
            }),
        setMediaPartWatched: (partId: string, watched: boolean) =>
            request<{ partId: string; watched: boolean }>("/api/v1/progress", {
                method: "PUT",
                body: JSON.stringify({ partId, watched }),
            }),
        deleteMedia: (id: string) =>
            request<MediaDeleteResult>(`/api/v1/media/${id}`, {
                method: "DELETE",
                body: JSON.stringify({ deleteFiles: true }),
            }),
        progress: (input: { partId: string; positionSeconds: number; durationSeconds: number }) =>
            request("/api/v1/progress", {
                method: "POST",
                body: JSON.stringify(input),
            }),
        deleteProgress: (mediaId: string) =>
            request<{ deleted: number }>("/api/v1/progress", {
                method: "DELETE",
                body: JSON.stringify({ mediaId }),
            }),
        settings: () =>
            request<{ libraries: LibraryRecord[]; scans: ScanRecord[] }>("/api/v1/settings/overview"),
        createLibrary: (input: { name: string; path: string; kind: LibraryKind }) =>
            request<LibraryRecord>("/api/v1/settings/libraries", {
                method: "POST",
                body: JSON.stringify(input),
            }),
        updateLibrary: (input: { id: string; name: string; path: string; kind: LibraryKind }) =>
            request<LibraryRecord>("/api/v1/settings/libraries", {
                method: "PUT",
                body: JSON.stringify(input),
            }),
        deleteLibrary: (id: string) =>
            request<{ deleted: boolean }>("/api/v1/settings/libraries", {
                method: "DELETE",
                body: JSON.stringify({ id }),
            }),
        scan: (libraryId?: string) =>
            request<{ scans: ScanRecord[] }>("/api/v1/settings/scan", {
                method: "POST",
                body: JSON.stringify({ libraryId }),
            }),
        searchMetadata: (input: { mediaId: string; query: string; year?: number }) =>
            request<{ candidates: TmdbCandidate[] }>("/api/v1/settings/metadata/search", {
                method: "POST",
                body: JSON.stringify(input),
            }),
        identify: (mediaId: string, tmdbId: number) =>
            request<MediaDetail>("/api/v1/settings/metadata/identify", {
                method: "POST",
                body: JSON.stringify({ mediaId, tmdbId }),
            }),
        refreshMetadata: (mediaId: string) =>
            request<MediaDetail>("/api/v1/settings/metadata/refresh", {
                method: "POST",
                body: JSON.stringify({ mediaId }),
            }),
        refreshLibraryMetadata: (libraryId: string) =>
            request<MetadataRefreshSummary>("/api/v1/settings/metadata/refresh", {
                method: "POST",
                body: JSON.stringify({ libraryId }),
            }),
    };
};


export type FoyerApi = ReturnType<typeof createFoyerApi>;
