import { createFileRoute } from "@tanstack/react-router"

import { emptyCors, json } from "@/server/http.server"

export const Route = createFileRoute("/api/v1/")({
  server: {
    handlers: {
      GET: () =>
        json({
          name: "Ploux",
          version: "0.1.0",
          status: "ok",
          directPlay: true,
          transcoding: false,
        }),
      OPTIONS: emptyCors,
    },
  },
})
