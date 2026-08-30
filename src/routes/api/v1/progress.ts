import {createFileRoute} from "@tanstack/react-router";
import {emptyCors, handleApi, json, parseBody} from "@/server/http.server";
import {mediaPartWatchStateInputSchema, progressDeleteInputSchema, progressInputSchema} from "@foyer/contracts";
import {deleteMediaPartProgress, deleteMediaProgress, listCurrentlyWatching, saveProgress, setMediaPartWatched} from "@/server/media/repository.server";


export const Route = createFileRoute("/api/v1/progress")({
    server: {
        handlers: {
            OPTIONS: emptyCors,
            GET: () => handleApi(() => json(listCurrentlyWatching())),
            POST: ({ request }) => handleApi(async () => {
                return json(saveProgress(await parseBody(request, progressInputSchema)));
            }),
            PUT: ({ request }) => handleApi(async () => {
                const { partId, watched } = await parseBody(request, mediaPartWatchStateInputSchema);
                return json(setMediaPartWatched(partId, watched));
            }),
            DELETE: ({ request }) => handleApi(async () => {
                const input = await parseBody(request, progressDeleteInputSchema);

                if ("partId" in input) {
                    return json({ deleted: deleteMediaPartProgress(input.partId) });
                }

                return json({ deleted: deleteMediaProgress(input.mediaId) });
            }),
        },
    },
});
