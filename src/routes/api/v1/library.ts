import {createFileRoute} from "@tanstack/react-router";
import {listMedia} from "@/server/media/repository.server";
import {apiError, emptyCors, json} from "@/server/http.server";
import {mediaKindSchema, mediaSortSchema} from "@ploux/contracts";


export const Route = createFileRoute("/api/v1/library")({
    server: {
        handlers: {
            OPTIONS: emptyCors,
            GET: ({ request }) => {
                try {
                    const url = new URL(request.url)
                    const kind = url.searchParams.get("kind")
                    const sort = url.searchParams.get("sort")
                    return json(
                        listMedia({
                            kind: kind ? mediaKindSchema.parse(kind) : undefined,
                            sort: sort ? mediaSortSchema.parse(sort) : "recent",
                            search: url.searchParams.get("search") ?? undefined,
                        })
                    )
                }
                catch (error) {
                    return apiError(error)
                }
            },
        },
    },
})
