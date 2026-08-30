import {createFileRoute} from "@tanstack/react-router";
import {emptyCors, handleApi, json} from "@/server/http.server";
import {getSettingsOverview} from "@/server/media/settings.server";


export const Route = createFileRoute("/api/v1/settings/overview")({
    server: {
        handlers: {
            OPTIONS: emptyCors,
            GET: () => handleApi(() => json(getSettingsOverview())),
        },
    },
});
