import { progressInputSchema } from "@ploux/contracts"
import { createFileRoute } from "@tanstack/react-router"

import { apiError, emptyCors, json, parseBody } from "@/server/http.server"
import { saveProgress } from "@/server/media/repository.server"

export const Route = createFileRoute("/api/v1/progress")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          return json(
            saveProgress(await parseBody(request, progressInputSchema))
          )
        } catch (error) {
          return apiError(error)
        }
      },
      OPTIONS: emptyCors,
    },
  },
})
