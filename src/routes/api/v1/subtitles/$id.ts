import {emptyCors} from "@/server/http.server";
import {createFileRoute} from "@tanstack/react-router";
import {streamSubtitle} from "@/server/media/stream.server";


export const Route = createFileRoute("/api/v1/subtitles/$id")({
    server: {
        handlers: {
            OPTIONS: emptyCors,
            GET: ({ request, params }) => streamSubtitle(request, params.id),
        },
    },
})
