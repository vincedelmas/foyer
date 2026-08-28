import {z} from "zod";
import {libraryInputSchema, libraryUpdateSchema} from "@ploux/contracts";
import {createFileRoute} from "@tanstack/react-router";
import {apiError, emptyCors, json, parseBody} from "@/server/http.server";
import {createLibrary, deleteLibrary, listLibraries, updateLibrary} from "@/server/media/scanner.server";


const deleteSchema = z.object({ id: z.string().min(1) });


export const Route = createFileRoute("/api/v1/settings/libraries")({
    server: {
        handlers: {
            OPTIONS: emptyCors,
            GET: () => json(listLibraries()),
            POST: async ({ request }) => {
                try {
                    return json(createLibrary(await parseBody(request, libraryInputSchema)), { status: 201 });
                }
                catch (error) {
                    return apiError(error);
                }
            },
            PUT: async ({ request }) => {
                try {
                    return json(updateLibrary(await parseBody(request, libraryUpdateSchema)));
                }
                catch (error) {
                    return apiError(error);
                }
            },
            DELETE: async ({ request }) => {
                try {
                    const { id } = await parseBody(request, deleteSchema);
                    return json({ deleted: await deleteLibrary(id) });
                }
                catch (error) {
                    return apiError(error);
                }
            },
        },
    },
})
