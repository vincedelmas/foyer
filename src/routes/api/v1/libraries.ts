import {createFileRoute} from "@tanstack/react-router"
import {emptyCors, handleApi, json} from "@/server/http.server"
import {listMediaFolders} from "@/server/media/repository.server"


export const Route = createFileRoute("/api/v1/libraries")({
    server: {
        handlers: {
            OPTIONS: emptyCors,
            GET: () => handleApi(() => json(listMediaFolders())),
        },
    },
});
