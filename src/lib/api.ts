import type {LibraryKind, LibraryRecord, LibraryResponse, MediaDetail, MediaFolderSummary, MediaKind, MediaSort, ScanRecord, TmdbCandidate} from "@ploux/contracts";


class ApiError extends Error {
    constructor(
        message: string,
        public readonly status: number
    ) {
        super(message);
    }
}


const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
    const headers = new Headers(init?.headers);

    if (init?.body && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json")
    }

    const response = await fetch(path, { ...init, headers });
    const body = (await response.json().catch(() => null)) as { error?: string } | T | null;

    if (!response.ok) {
        const message = (body && typeof body === "object" && "error" in body && body.error)
            ? body.error
            : `Request failed (${response.status})`;

        throw new ApiError(message, response.status)
    }

    return body as T;
}


export const api = {
    library: (input: {
        libraryId?: string
        kind?: MediaKind
        search?: string
        sort?: MediaSort
        page?: number
        pageSize?: number
    }) => {
        const query = new URLSearchParams()
        if (input.libraryId) query.set("libraryId", input.libraryId)
        if (input.kind) query.set("kind", input.kind)
        if (input.search) query.set("search", input.search)
        if (input.sort) query.set("sort", input.sort)
        if (input.page) query.set("page", String(input.page))
        if (input.pageSize) query.set("pageSize", String(input.pageSize))
        return request<LibraryResponse>(`/api/v1/library?${query}`)
    },
    mediaFolders: () => request<MediaFolderSummary[]>("/api/v1/libraries"),
    media: (id: string) => request<MediaDetail>(`/api/v1/media/${id}`),
    progress: (input: {
        partId: string
        positionSeconds: number
        durationSeconds: number
    }) =>
        request("/api/v1/progress", {
            method: "POST",
            body: JSON.stringify(input),
        }),
    settings: () =>
        request<{
            libraries: LibraryRecord[]
            scans: ScanRecord[]
            tmdbConfigured: boolean
            tmdbSource: "environment" | "database"
            databasePath: string
        }>("/api/v1/settings/overview"),
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
    saveTmdbToken: (tmdbToken: string) =>
        request<{ configured: boolean }>("/api/v1/settings/overview", {
            method: "PUT",
            body: JSON.stringify({ tmdbToken }),
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
}
