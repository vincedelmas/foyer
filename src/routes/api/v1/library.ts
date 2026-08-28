import {createFileRoute} from "@tanstack/react-router";
import {listMedia} from "@/server/media/repository.server";
import {apiError, emptyCors, json} from "@/server/http.server";
import {mediaKindSchema, mediaSortSchema} from "@ploux/contracts";
import {z} from "zod";


export const Route = createFileRoute("/api/v1/library")({
    server: {
        handlers: {
            OPTIONS: emptyCors,
            GET: ({ request }) => {
                try {
                    const url = new URL(request.url)
                    const kind = url.searchParams.get("kind")
                    const sort = url.searchParams.get("sort")
                    const libraryId = url.searchParams.get("libraryId")
                    const page = url.searchParams.get("page")
                    const pageSize = url.searchParams.get("pageSize")
                    return json(
                        listMedia({
                            libraryId: libraryId ? z.string().min(1).parse(libraryId) : undefined,
                            kind: kind ? mediaKindSchema.parse(kind) : undefined,
                            sort: sort ? mediaSortSchema.parse(sort) : "recent",
                            search: url.searchParams.get("search") ?? undefined,
                            page: page ? z.coerce.number().int().min(1).parse(page) : undefined,
                            pageSize: pageSize
                                ? z.coerce.number().int().min(1).max(100).parse(pageSize)
                                : undefined,
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
