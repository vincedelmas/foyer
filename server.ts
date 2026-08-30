/**
 * Bun production entry for the TanStack Start application.
 *
 * Vite writes the browser assets to dist/client and the fetch-compatible
 * application handler to dist/server/server.js. This file serves the former
 * and forwards every other request to the latter.
 */

import {basename, join, resolve, sep} from "node:path";


type StartHandler = {
    fetch(request: Request): Response | Promise<Response>;
};


const currentDirectory = import.meta.dir;
const DIST_DIRECTORY = basename(currentDirectory) === "dist" ?
    currentDirectory :
    resolve(currentDirectory, "dist");
const CLIENT_DIRECTORY = join(DIST_DIRECTORY, "client");
const SERVER_ENTRY_POINT = join(DIST_DIRECTORY, "server", "server.js");
const SERVER_PORT = Number(process.env.PORT ?? 3000);
const SERVER_HOST = process.env.HOST ?? "0.0.0.0";
const SHUTDOWN_TIMEOUT_MS = 10_000;


if (!Number.isInteger(SERVER_PORT) || SERVER_PORT < 1 || SERVER_PORT > 65_535) {
    throw new Error(`Invalid PORT value: ${process.env.PORT ?? ""}`);
}


let isShuttingDown = false;
let server: ReturnType<typeof Bun.serve> | undefined;


function errorMessage(error: unknown) {
    return error instanceof Error ? error.stack ?? error.message : String(error);
}


async function loadStartHandler() {
    const serverModule = await import(SERVER_ENTRY_POINT) as {default?: StartHandler};

    if (typeof serverModule.default?.fetch !== "function") {
        throw new Error(`No TanStack Start fetch handler found at ${SERVER_ENTRY_POINT}`);
    }

    return serverModule.default;
}


async function createStaticRoutes() {
    const glob = new Bun.Glob("**/*");
    const routes: Record<string, () => Response> = {};

    for await (const relativePath of glob.scan({cwd: CLIENT_DIRECTORY})) {
        const filePath = join(CLIENT_DIRECTORY, relativePath);
        const file = Bun.file(filePath);
        const route = `/${relativePath.split(sep).join("/")}`;
        const isImmutableAsset = relativePath.startsWith(`assets${sep}`);

        routes[route] = () => new Response(file, {
            headers: {
                "Cache-Control": isImmutableAsset ?
                    "public, max-age=31536000, immutable" :
                    "public, max-age=0, must-revalidate",
                "Content-Type": file.type || "application/octet-stream",
            },
        });
    }

    return routes;
}


async function startServer() {
    const handler = await loadStartHandler();
    const staticRoutes = await createStaticRoutes();

    server = Bun.serve({
        hostname: SERVER_HOST,
        port: SERVER_PORT,
        routes: {
            ...staticRoutes,
            "/*": async (request: Request) => {
                if (isShuttingDown) {
                    return new Response("Service Unavailable", {
                        status: 503,
                        headers: {"Retry-After": "5"},
                    });
                }

                return await handler.fetch(request);
            },
        },
        error(error) {
            console.error(`[foyer] Unhandled server error:\n${errorMessage(error)}`);
            return new Response("Internal Server Error", {status: 500});
        },
    });

    console.info(`[foyer] Serving ${Object.keys(staticRoutes).length} static assets`);
    console.info(`[foyer] Listening on ${server.url}`);
}


async function shutdown(signal: string) {
    if (isShuttingDown) return;
    isShuttingDown = true;

    console.info(`[foyer] Received ${signal}; shutting down`);

    const forceShutdown = setTimeout(() => {
        console.warn("[foyer] Graceful shutdown timed out; closing active connections");
        void server?.stop(true);
    }, SHUTDOWN_TIMEOUT_MS);
    forceShutdown.unref();

    await server?.stop(false);
    clearTimeout(forceShutdown);
    process.exit(0);
}


process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));


startServer().catch((error: unknown) => {
    console.error(`[foyer] Failed to start:\n${errorMessage(error)}`);
    process.exit(1);
});
