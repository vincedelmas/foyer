import { createFileRoute } from "@tanstack/react-router"

import { emptyCors } from "@/server/http.server"
import { streamPart } from "@/server/media/stream.server"

export const Route = createFileRoute("/api/v1/stream/$id")({
  server: {
    handlers: {
      GET: ({ request, params }) => streamPart(request, params.id),
      HEAD: ({ request, params }) => streamPart(request, params.id, true),
      OPTIONS: emptyCors,
    },
  },
})
