import {createFileRoute} from "@tanstack/react-router";
import {metadataRefreshInputSchema} from "@ploux/contracts";
import {getMediaDetail} from "@/server/media/repository.server";
import {apiError, emptyCors, json, parseBody} from "@/server/http.server";
import {refreshLibraryMetadata, refreshTmdbMetadata} from "@/server/media/tmdb.server";


export const Route = createFileRoute("/api/v1/settings/metadata/refresh")({
    server: {
        handlers: {
            OPTIONS: emptyCors,
            POST: async ({ request }) => {
                try {
                    const input = await parseBody(request, metadataRefreshInputSchema);
                    if ("libraryId" in input) {
                        return json(await refreshLibraryMetadata(input.libraryId));
                    }

                    await refreshTmdbMetadata(input.mediaId);
                    return json(getMediaDetail(input.mediaId));
                }
                catch (error) {
                    return apiError(error);
                }
            },
        },
    },
});
