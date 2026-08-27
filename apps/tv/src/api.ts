import type { LibraryResponse, MediaDetail, MediaKind } from "@ploux/contracts"

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

export const tvApi = {
  health: (server: string) => request<{ status: string }>(server, "/api/v1/"),
  library: (server: string, kind?: MediaKind) =>
    request<LibraryResponse>(
      server,
      `/api/v1/library?sort=recent${kind ? `&kind=${kind}` : ""}`
    ),
  media: (server: string, id: string) =>
    request<MediaDetail>(server, `/api/v1/media/${id}`),
  progress: (
    server: string,
    input: { partId: string; positionSeconds: number; durationSeconds: number }
  ) =>
    request(server, "/api/v1/progress", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  absoluteUrl: (server: string, path: string) =>
    `${normalizeServer(server)}${path}`,
}
