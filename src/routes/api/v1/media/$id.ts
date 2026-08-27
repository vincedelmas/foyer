import {createFileRoute} from "@tanstack/react-router";
import {emptyCors, json} from "@/server/http.server";
import {getMediaDetail} from "@/server/media/repository.server";


export const Route = createFileRoute("/api/v1/media/$id")({
    server: {
        handlers: {
            OPTIONS: emptyCors,
            GET: ({ params }) => {
                const media = getMediaDetail(params.id);

                return media
                    ? json(media)
                    : json({ error: "Media not found" }, { status: 404 });
            },
        },
    },
})
