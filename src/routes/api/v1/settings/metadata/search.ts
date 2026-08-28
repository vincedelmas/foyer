import {searchTmdb} from "@/server/media/tmdb.server";
import {createFileRoute} from "@tanstack/react-router";
import {metadataSearchInputSchema} from "@ploux/contracts";
import {getMediaDetail} from "@/server/media/repository.server";
import {apiError, emptyCors, json, parseBody} from "@/server/http.server";


export const Route = createFileRoute("/api/v1/settings/metadata/search")({
    server: {
        handlers: {
            OPTIONS: emptyCors,
            POST: async ({ request }) => {
                try {
                    const input = await parseBody(request, metadataSearchInputSchema);
                    const media = getMediaDetail(input.mediaId);

                    if (!media) return json({ error: "Media not found" }, { status: 404 });

                    return json({ candidates: await searchTmdb(media.kind, input.query, input.year) });
                }
                catch (error) {
                    return apiError(error);
                }
            },
        },
    },
});
