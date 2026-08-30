import version from "../../../../version.txt?raw";
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
                    directPlay: true,
                    transcoding: false,
                    version: version.trim(),
                }),
        },
    },
});
