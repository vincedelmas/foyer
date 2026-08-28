import {mediaIdInputSchema} from "@ploux/contracts";
import {createFileRoute} from "@tanstack/react-router";
import {refreshTmdbMetadata} from "@/server/media/tmdb.server";
import {getMediaDetail} from "@/server/media/repository.server";
import {apiError, emptyCors, json, parseBody} from "@/server/http.server";


export const Route = createFileRoute("/api/v1/settings/metadata/refresh")({
    server: {
        handlers: {
            OPTIONS: emptyCors,
            POST: async ({ request }) => {
                try {
                    const { mediaId } = await parseBody(request, mediaIdInputSchema);
                    await refreshTmdbMetadata(mediaId);
                    return json(getMediaDetail(mediaId));
                }
                catch (error) {
                    return apiError(error);
                }
            },
        },
    },
});
