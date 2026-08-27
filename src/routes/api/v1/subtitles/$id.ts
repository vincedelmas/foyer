import { createFileRoute } from "@tanstack/react-router"

import { emptyCors } from "@/server/http.server"
import { streamSubtitle } from "@/server/media/stream.server"

export const Route = createFileRoute("/api/v1/subtitles/$id")({
  server: {
    handlers: {
      GET: ({ params }) => streamSubtitle(params.id),
      OPTIONS: emptyCors,
    },
  },
})
