import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

import { apiError, emptyCors, json, parseBody } from "@/server/http.server"
import { getAdminOverview, saveTmdbToken } from "@/server/media/admin.server"

const settingsSchema = z.object({ tmdbToken: z.string().max(2000) })

export const Route = createFileRoute("/api/v1/admin/settings")({
  server: {
    handlers: {
      GET: () => json(getAdminOverview()),
      PUT: async ({ request }) => {
        try {
          const input = await parseBody(request, settingsSchema)
          return json(saveTmdbToken(input.tmdbToken))
        } catch (error) {
          return apiError(error)
        }
      },
      OPTIONS: emptyCors,
    },
  },
})
