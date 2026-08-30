import {createFileRoute} from "@tanstack/react-router";
import {apiError, emptyCors, json, parseBody} from "@/server/http.server";
import {getMediaDetail, setMediaWatched} from "@/server/media/repository.server";
import {deleteMediaFiles, getMediaInfo} from "@/server/media/media-files.server";
import {mediaDeleteInputSchema, mediaWatchStateInputSchema} from "@ploux/contracts";


export const Route = createFileRoute("/api/v1/media/$id")({
    server: {
        handlers: {
            OPTIONS: emptyCors,
            GET: async ({ params, request }) => {
                try {
                    const view = new URL(request.url).searchParams.get("view");
                    const media = view === "info"
                        ? await getMediaInfo(params.id)
                        : getMediaDetail(params.id);

                    return media
                        ? json(media)
                        : json({ error: "Media not found" }, { status: 404 });
                }
                catch (error) {
                    return apiError(error);
                }
            },
            PUT: async ({ params, request }) => {
                try {
                    const { watched } = await parseBody(request, mediaWatchStateInputSchema);
                    return json(setMediaWatched(params.id, watched));
                }
                catch (error) {
                    return apiError(error);
                }
            },
            DELETE: async ({ params, request }) => {
                try {
                    await parseBody(request, mediaDeleteInputSchema);
                    return json(await deleteMediaFiles(params.id));
                }
                catch (error) {
                    return apiError(error);
                }
            },
        },
    },
});
