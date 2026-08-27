import {emptyCors} from "@/server/http.server";
import {createFileRoute} from "@tanstack/react-router";
import {streamPart} from "@/server/media/stream.server";


export const Route = createFileRoute("/api/v1/stream/$id")({
    server: {
        handlers: {
            OPTIONS: emptyCors,
            GET: ({ request, params }) => streamPart(request, params.id),
            HEAD: ({ request, params }) => streamPart(request, params.id, true),
        },
    },
})
