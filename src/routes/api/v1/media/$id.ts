import {z} from "zod";
import {createFileRoute} from "@tanstack/react-router";
import {emptyCors, handleApi, json, parseBody} from "@/server/http.server";
import {getMediaDetail, setMediaWatched} from "@/server/media/repository.server";
import {deleteMediaFiles, getMediaInfo} from "@/server/media/media-files.server";
import {mediaDeleteInputSchema, mediaWatchStateInputSchema} from "@ploux/contracts";


export const Route = createFileRoute("/api/v1/media/$id")({
    server: {
        handlers: {
            OPTIONS: emptyCors,
            GET: ({ params, request }) => handleApi(async () => {
                const searchParams = new URL(request.url).searchParams;
                const view = searchParams.get("view");

                const media = view === "info"
                    ? await getMediaInfo(params.id)
                    : getMediaDetail(params.id, {
                        season: searchParams.get("season")
                            ? z.coerce.number().int().min(0).parse(searchParams.get("season"))
                            : undefined,
                        page: searchParams.get("page")
                            ? z.coerce.number().int().min(1).parse(searchParams.get("page"))
                            : undefined,
                        pageSize: searchParams.get("pageSize")
                            ? z.coerce.number().int().min(1).max(100).parse(searchParams.get("pageSize"))
                            : undefined,
                    });

                return media
                    ? json(media)
                    : json({ error: "Media not found" }, { status: 404 });
            }),
            PUT: ({ params, request }) => handleApi(async () => {
                const { watched } = await parseBody(request, mediaWatchStateInputSchema);
                return json(setMediaWatched(params.id, watched));
            }),
            DELETE: ({ params, request }) => handleApi(async () => {
                await parseBody(request, mediaDeleteInputSchema);
                return json(await deleteMediaFiles(params.id));
            }),
        },
    },
});
