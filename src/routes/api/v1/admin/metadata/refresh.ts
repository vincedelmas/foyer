import { mediaIdInputSchema } from "@ploux/contracts"
import { createFileRoute } from "@tanstack/react-router"

import { apiError, emptyCors, json, parseBody } from "@/server/http.server"
import { getMediaDetail } from "@/server/media/repository.server"
import { refreshTmdbMetadata } from "@/server/media/tmdb.server"

export const Route = createFileRoute("/api/v1/admin/metadata/refresh")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { mediaId } = await parseBody(request, mediaIdInputSchema)
          await refreshTmdbMetadata(mediaId)
          return json(getMediaDetail(mediaId))
        } catch (error) {
          return apiError(error)
        }
      },
      OPTIONS: emptyCors,
    },
  },
})
