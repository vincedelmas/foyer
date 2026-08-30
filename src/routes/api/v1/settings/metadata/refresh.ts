import {createFileRoute} from "@tanstack/react-router";
import {metadataRefreshInputSchema} from "@foyer/contracts";
import {getMediaDetail} from "@/server/media/repository.server";
import {emptyCors, handleApi, json, parseBody} from "@/server/http.server";
import {refreshLibraryMetadata, refreshTmdbMetadata} from "@/server/media/tmdb.server";


export const Route = createFileRoute("/api/v1/settings/metadata/refresh")({
    server: {
        handlers: {
            OPTIONS: emptyCors,
            POST: ({ request }) => handleApi(async () => {
                const input = await parseBody(request, metadataRefreshInputSchema);
                if ("libraryId" in input) {
                    return json(await refreshLibraryMetadata(input.libraryId));
                }

                await refreshTmdbMetadata(input.mediaId);
                return json(getMediaDetail(input.mediaId));
            }),
        },
    },
});
