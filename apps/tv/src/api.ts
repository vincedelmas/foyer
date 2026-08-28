import type {
  LibraryKind,
  LibraryRecord,
  LibraryResponse,
  MediaDeleteResult,
  MediaDetail,
  MediaFolderSummary,
  MediaInfo,
  MediaKind,
  MediaSort,
  MediaSummary,
  MediaWatchFilter,
  MetadataRefreshSummary,
  ScanRecord,
  TmdbCandidate,
} from "@ploux/contracts"

const normalizeServer = (server: string) => server.trim().replace(/\/+$/, "")

const request = async <T>(
  server: string,
  path: string,
  init?: RequestInit
): Promise<T> => {
  const headers = new Headers(init?.headers)
  if (init?.body && !headers.has("Content-Type"))
    headers.set("Content-Type", "application/json")
  const response = await fetch(`${normalizeServer(server)}${path}`, {
    ...init,
    headers,
  })
  const body = (await response.json().catch(() => null)) as
    T | { error?: string } | null
  if (!response.ok) {
    throw new Error(
      body && typeof body === "object" && "error" in body && body.error
        ? body.error
        : `Server returned ${response.status}`
    )
  }
  return body as T
}

const libraryQuery = (input: {
  libraryId?: string
  kind?: MediaKind
  search?: string
  watch?: MediaWatchFilter
  sort?: MediaSort
  page?: number
  pageSize?: number
}) => {
  const query = new URLSearchParams()
  if (input.libraryId) query.set("libraryId", input.libraryId)
  if (input.kind) query.set("kind", input.kind)
  if (input.search) query.set("search", input.search)
  if (input.watch && input.watch !== "all") query.set("watch", input.watch)
  if (input.sort) query.set("sort", input.sort)
  if (input.page) query.set("page", String(input.page))
  if (input.pageSize) query.set("pageSize", String(input.pageSize))
  return query.toString()
}

export const tvApi = {
  health: (server: string) => request<{ status: string }>(server, "/api/v1/"),
  library: (
    server: string,
    input: {
      libraryId?: string
      kind?: MediaKind
      search?: string
      watch?: MediaWatchFilter
      sort?: MediaSort
      page?: number
      pageSize?: number
    } = {}
  ) =>
    request<LibraryResponse>(
      server,
      `/api/v1/library?${libraryQuery(input)}`
    ),
  mediaFolders: (server: string) =>
    request<MediaFolderSummary[]>(server, "/api/v1/libraries"),
  currentlyWatching: (server: string) =>
    request<MediaSummary[]>(server, "/api/v1/progress"),
  media: (server: string, id: string) =>
    request<MediaDetail>(server, `/api/v1/media/${id}`),
  mediaInfo: (server: string, id: string) =>
    request<MediaInfo>(server, `/api/v1/media/${id}?view=info`),
  setMediaWatched: (server: string, id: string, watched: boolean) =>
    request<{ watched: boolean; updatedParts: number }>(
      server,
      `/api/v1/media/${id}`,
      {
        method: "PUT",
        body: JSON.stringify({ watched }),
      }
    ),
  setMediaPartWatched: (
    server: string,
    partId: string,
    watched: boolean
  ) =>
    request<{ partId: string; watched: boolean }>(server, "/api/v1/progress", {
      method: "PUT",
      body: JSON.stringify({ partId, watched }),
    }),
  deleteMedia: (server: string, id: string) =>
    request<MediaDeleteResult>(server, `/api/v1/media/${id}`, {
      method: "DELETE",
      body: JSON.stringify({ deleteFiles: true }),
    }),
  progress: (
    server: string,
    input: { partId: string; positionSeconds: number; durationSeconds: number }
  ) =>
    request(server, "/api/v1/progress", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  deleteProgress: (server: string, mediaId: string) =>
    request<{ deleted: number }>(server, "/api/v1/progress", {
      method: "DELETE",
      body: JSON.stringify({ mediaId }),
    }),
  settings: (server: string) =>
    request<{ libraries: LibraryRecord[]; scans: ScanRecord[] }>(
      server,
      "/api/v1/settings/overview"
    ),
  createLibrary: (
    server: string,
    input: { name: string; path: string; kind: LibraryKind }
  ) =>
    request<LibraryRecord>(server, "/api/v1/settings/libraries", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateLibrary: (
    server: string,
    input: { id: string; name: string; path: string; kind: LibraryKind }
  ) =>
    request<LibraryRecord>(server, "/api/v1/settings/libraries", {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  deleteLibrary: (server: string, id: string) =>
    request<{ deleted: boolean }>(server, "/api/v1/settings/libraries", {
      method: "DELETE",
      body: JSON.stringify({ id }),
    }),
  scan: (server: string, libraryId?: string) =>
    request<{ scans: ScanRecord[] }>(server, "/api/v1/settings/scan", {
      method: "POST",
      body: JSON.stringify({ libraryId }),
    }),
  searchMetadata: (
    server: string,
    input: { mediaId: string; query: string; year?: number }
  ) =>
    request<{ candidates: TmdbCandidate[] }>(
      server,
      "/api/v1/settings/metadata/search",
      {
        method: "POST",
        body: JSON.stringify(input),
      }
    ),
  identify: (server: string, mediaId: string, tmdbId: number) =>
    request<MediaDetail>(server, "/api/v1/settings/metadata/identify", {
      method: "POST",
      body: JSON.stringify({ mediaId, tmdbId }),
    }),
  refreshMetadata: (server: string, mediaId: string) =>
    request<MediaDetail>(server, "/api/v1/settings/metadata/refresh", {
      method: "POST",
      body: JSON.stringify({ mediaId }),
    }),
  refreshLibraryMetadata: (server: string, libraryId: string) =>
    request<MetadataRefreshSummary>(
      server,
      "/api/v1/settings/metadata/refresh",
      {
        method: "POST",
        body: JSON.stringify({ libraryId }),
      }
    ),
  absoluteUrl: (server: string, path: string) =>
    `${normalizeServer(server)}${path}`,
}
