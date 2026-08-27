import { scanInputSchema } from "@ploux/contracts"
import { createFileRoute } from "@tanstack/react-router"

import { apiError, emptyCors, json, parseBody } from "@/server/http.server"
import { scanLibraries } from "@/server/media/scanner.server"

export const Route = createFileRoute("/api/v1/admin/scan")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const input = await parseBody(request, scanInputSchema)
          return json({ scans: await scanLibraries(input.libraryId) })
        } catch (error) {
          return apiError(error)
        }
      },
      OPTIONS: emptyCors,
    },
  },
})
