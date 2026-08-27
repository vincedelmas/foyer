import {progressInputSchema} from "@ploux/contracts";
import {createFileRoute} from "@tanstack/react-router";
import {saveProgress} from "@/server/media/repository.server";
import {apiError, emptyCors, json, parseBody} from "@/server/http.server";


export const Route = createFileRoute("/api/v1/progress")({
    server: {
        handlers: {
            OPTIONS: emptyCors,
            POST: async ({ request }) => {
                try {
                    return json(saveProgress(await parseBody(request, progressInputSchema)));
                }
                catch (error) {
                    return apiError(error);
                }
            },
        },
    },
});
