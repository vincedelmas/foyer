import {scanInputSchema} from "@foyer/contracts";
import {createFileRoute} from "@tanstack/react-router";
import {scanLibraries} from "@/server/media/scanner.server";
import {emptyCors, handleApi, json, parseBody} from "@/server/http.server";


export const Route = createFileRoute("/api/v1/settings/scan")({
    server: {
        handlers: {
            OPTIONS: emptyCors,
            POST: ({ request }) => handleApi(async () => {
                const input = await parseBody(request, scanInputSchema);
                return json({ scans: await scanLibraries(input.libraryId) });
            }),
        },
    },
});
