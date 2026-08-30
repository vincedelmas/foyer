import {emptyCors, json} from "@/server/http.server";
import {createFileRoute} from "@tanstack/react-router";


export const Route = createFileRoute("/api/v1/")({
    server: {
        handlers: {
            OPTIONS: emptyCors,
            GET: () =>
                json({
                    status: "ok",
                    name: "Ploux",
                    version: "0.1.0",
                    directPlay: true,
                    transcoding: false,
                }),
        },
    },
});
