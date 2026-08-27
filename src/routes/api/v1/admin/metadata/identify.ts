import { identifyInputSchema } from "@ploux/contracts"
import { createFileRoute } from "@tanstack/react-router"

import { apiError, emptyCors, json, parseBody } from "@/server/http.server"
import { getMediaDetail } from "@/server/media/repository.server"
import { applyTmdbMetadata } from "@/server/media/tmdb.server"

export const Route = createFileRoute("/api/v1/admin/metadata/identify")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const input = await parseBody(request, identifyInputSchema)
          await applyTmdbMetadata(input.mediaId, input.tmdbId, "manual")
          return json(getMediaDetail(input.mediaId))
        } catch (error) {
          return apiError(error)
        }
      },
      OPTIONS: emptyCors,
    },
  },
})
