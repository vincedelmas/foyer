import {mediaIdInputSchema, mediaPartWatchStateInputSchema, progressInputSchema} from "@ploux/contracts";
import {createFileRoute} from "@tanstack/react-router";
import {deleteMediaProgress, listCurrentlyWatching, saveProgress, setMediaPartWatched} from "@/server/media/repository.server";
import {apiError, emptyCors, json, parseBody} from "@/server/http.server";


export const Route = createFileRoute("/api/v1/progress")({
    server: {
        handlers: {
            OPTIONS: emptyCors,
            GET: () => {
                try {
                    return json(listCurrentlyWatching())
                }
                catch (error) {
                    return apiError(error)
                }
            },
            POST: async ({ request }) => {
                try {
                    return json(saveProgress(await parseBody(request, progressInputSchema)));
                }
                catch (error) {
                    return apiError(error);
                }
            },
            PUT: async ({request}) => {
                try {
                    const {partId, watched} = await parseBody(
                        request,
                        mediaPartWatchStateInputSchema
                    )
                    return json(setMediaPartWatched(partId, watched))
                }
                catch (error) {
                    return apiError(error)
                }
            },
            DELETE: async ({ request }) => {
                try {
                    const {mediaId} = await parseBody(request, mediaIdInputSchema)
                    return json({deleted: deleteMediaProgress(mediaId)})
                }
                catch (error) {
                    return apiError(error)
                }
            },
        },
    },
});
