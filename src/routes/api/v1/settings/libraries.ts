import {z} from "zod";
import {createFileRoute} from "@tanstack/react-router";
import {libraryInputSchema, libraryUpdateSchema} from "@foyer/contracts";
import {emptyCors, handleApi, json, parseBody} from "@/server/http.server";
import {createLibrary, deleteLibrary, listLibraries, updateLibrary} from "@/server/media/scanner.server";


const deleteSchema = z.object({ id: z.string().min(1) });


export const Route = createFileRoute("/api/v1/settings/libraries")({
    server: {
        handlers: {
            OPTIONS: emptyCors,
            GET: () => handleApi(() => json(listLibraries())),
            POST: ({ request }) => handleApi(async () => {
                return json(createLibrary(await parseBody(request, libraryInputSchema)), { status: 201 });
            }),
            PUT: ({ request }) => handleApi(async () => {
                return json(updateLibrary(await parseBody(request, libraryUpdateSchema)));
            }),
            DELETE: ({ request }) => handleApi(async () => {
                const { id } = await parseBody(request, deleteSchema);
                return json({ deleted: await deleteLibrary(id) });
            }),
        },
    },
});
