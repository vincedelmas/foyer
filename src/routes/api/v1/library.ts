import {z} from "zod";
import {createFileRoute} from "@tanstack/react-router";
import {listMedia} from "@/server/media/repository.server";
import {emptyCors, handleApi, json} from "@/server/http.server";
import {mediaKindSchema, mediaSortSchema, mediaWatchFilterSchema} from "@foyer/contracts";


export const Route = createFileRoute("/api/v1/library")({
    server: {
        handlers: {
            OPTIONS: emptyCors,
            GET: ({ request }) => handleApi(() => {
                const url = new URL(request.url);

                const kind = url.searchParams.get("kind");
                const sort = url.searchParams.get("sort");
                const page = url.searchParams.get("page");
                const watch = url.searchParams.get("watch");
                const pageSize = url.searchParams.get("pageSize");
                const libraryId = url.searchParams.get("libraryId");

                return json(listMedia({
                    sort: sort ? mediaSortSchema.parse(sort) : "recent",
                    kind: kind ? mediaKindSchema.parse(kind) : undefined,
                    search: url.searchParams.get("search") ?? undefined,
                    watch: watch ? mediaWatchFilterSchema.parse(watch) : "all",
                    page: page ? z.coerce.number().int().min(1).parse(page) : undefined,
                    libraryId: libraryId ? z.string().min(1).parse(libraryId) : undefined,
                    pageSize: pageSize ? z.coerce.number().int().min(1).max(100).parse(pageSize) : undefined,
                }));
            }),
        },
    },
});
