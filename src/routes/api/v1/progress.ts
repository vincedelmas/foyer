import {createFileRoute} from "@tanstack/react-router";
import {emptyCors, handleApi, json, parseBody} from "@/server/http.server";
import {mediaIdInputSchema, mediaPartWatchStateInputSchema, progressInputSchema} from "@foyer/contracts";
import {deleteMediaProgress, listCurrentlyWatching, saveProgress, setMediaPartWatched} from "@/server/media/repository.server";


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
                const { mediaId } = await parseBody(request, mediaIdInputSchema);
                return json({ deleted: deleteMediaProgress(mediaId) });
            }),
        },
    },
});
