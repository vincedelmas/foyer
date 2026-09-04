import {z} from "zod";
import {createFileRoute} from "@tanstack/react-router";
import {emptyCors, handleApi, json, parseBody} from "@/server/http.server";
import {mediaPartWatchStateInputSchema, progressDeleteInputSchema, progressInputSchema} from "@foyer/contracts";
import {deleteMediaPartProgress, deleteMediaProgress, listCurrentlyWatching, saveProgress, setMediaPartWatched} from "@/server/media/repository.server";


export const Route = createFileRoute("/api/v1/progress")({
    server: {
        handlers: {
            OPTIONS: emptyCors,
            GET: ({request}) => handleApi(() => {
                const limitParam = new URL(request.url).searchParams.get("limit");
                const limit = limitParam
                    ? z.coerce.number().int().min(1).max(100).parse(limitParam)
                    : undefined;
                return json(listCurrentlyWatching(limit));
            }),
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
