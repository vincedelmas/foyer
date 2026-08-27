import { libraryInputSchema } from "@ploux/contracts"
import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

import { apiError, emptyCors, json, parseBody } from "@/server/http.server"
import {
  createLibrary,
  deleteLibrary,
  listLibraries,
} from "@/server/media/scanner.server"

const deleteSchema = z.object({ id: z.string().min(1) })

export const Route = createFileRoute("/api/v1/admin/libraries")({
  server: {
    handlers: {
      GET: () => json(listLibraries()),
      POST: async ({ request }) => {
        try {
          return json(
            createLibrary(await parseBody(request, libraryInputSchema)),
            { status: 201 }
          )
        } catch (error) {
          return apiError(error)
        }
      },
      DELETE: async ({ request }) => {
        try {
          const { id } = await parseBody(request, deleteSchema)
          return json({ deleted: deleteLibrary(id) })
        } catch (error) {
          return apiError(error)
        }
      },
      OPTIONS: emptyCors,
    },
  },
})
