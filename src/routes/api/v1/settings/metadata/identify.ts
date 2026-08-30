import {identifyInputSchema} from "@foyer/contracts";
import {createFileRoute} from "@tanstack/react-router";
import {applyTmdbMetadata} from "@/server/media/tmdb.server";
import {getMediaDetail} from "@/server/media/repository.server";
import {emptyCors, handleApi, json, parseBody} from "@/server/http.server";


export const Route = createFileRoute("/api/v1/settings/metadata/identify")({
    server: {
        handlers: {
            OPTIONS: emptyCors,
            POST: ({ request }) => handleApi(async () => {
                const input = await parseBody(request, identifyInputSchema);
                await applyTmdbMetadata(input.mediaId, input.tmdbId, "manual");

                return json(getMediaDetail(input.mediaId));
            }),
        },
    },
});
