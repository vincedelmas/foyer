import type {LibraryRecord, LibraryResponse, MediaDetail, MediaKind, MediaSort, ScanRecord, TmdbCandidate} from "@ploux/contracts";


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
    library: (input: { kind?: MediaKind; search?: string; sort?: MediaSort }) => {
        const query = new URLSearchParams()
        if (input.kind) query.set("kind", input.kind)
        if (input.search) query.set("search", input.search)
        if (input.sort) query.set("sort", input.sort)
        return request<LibraryResponse>(`/api/v1/library?${query}`)
    },
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
    admin: () =>
        request<{
            libraries: LibraryRecord[]
            scans: ScanRecord[]
            tmdbConfigured: boolean
            tmdbSource: "environment" | "database"
            databasePath: string
        }>("/api/v1/admin/settings"),
    createLibrary: (input: { name: string; path: string; kind: string }) =>
        request<LibraryRecord>("/api/v1/admin/libraries", {
            method: "POST",
            body: JSON.stringify(input),
        }),
    deleteLibrary: (id: string) =>
        request<{ deleted: boolean }>("/api/v1/admin/libraries", {
            method: "DELETE",
            body: JSON.stringify({ id }),
        }),
    scan: (libraryId?: string) =>
        request<{ scans: ScanRecord[] }>("/api/v1/admin/scan", {
            method: "POST",
            body: JSON.stringify({ libraryId }),
        }),
    saveTmdbToken: (tmdbToken: string) =>
        request<{ configured: boolean }>("/api/v1/admin/settings", {
            method: "PUT",
            body: JSON.stringify({ tmdbToken }),
        }),
    searchMetadata: (input: { mediaId: string; query: string; year?: number }) =>
        request<{ candidates: TmdbCandidate[] }>("/api/v1/admin/metadata/search", {
            method: "POST",
            body: JSON.stringify(input),
        }),
    identify: (mediaId: string, tmdbId: number) =>
        request<MediaDetail>("/api/v1/admin/metadata/identify", {
            method: "POST",
            body: JSON.stringify({ mediaId, tmdbId }),
        }),
    refreshMetadata: (mediaId: string) =>
        request<MediaDetail>("/api/v1/admin/metadata/refresh", {
            method: "POST",
            body: JSON.stringify({ mediaId }),
        }),
}
