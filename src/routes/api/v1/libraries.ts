import {createFileRoute} from "@tanstack/react-router"
import {apiError, emptyCors, json} from "@/server/http.server"
import {listMediaFolders} from "@/server/media/repository.server"


export const Route = createFileRoute("/api/v1/libraries")({
    server: {
        handlers: {
            OPTIONS: emptyCors,
            GET: () => {
                try {
                    return json(listMediaFolders())
                }
                catch (error) {
                    return apiError(error)
                }
            },
        },
    },
})
