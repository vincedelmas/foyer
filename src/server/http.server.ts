import type {ZodType} from "zod";


export const corsHeaders = () => ({
    "Access-Control-Allow-Headers": "Content-Type,Range",
    "Access-Control-Allow-Methods": "GET,HEAD,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Origin": process.env.PLOUX_CORS_ORIGIN ?? "*",
    "Access-Control-Expose-Headers": "Accept-Ranges,Content-Length,Content-Range",
})


export const json = (data: unknown, init: ResponseInit = {}) => {
    const headers = new Headers(init.headers);
    headers.set("Cache-Control", "no-store");

    for (const [key, value] of Object.entries(corsHeaders())) {
        if (!headers.has(key)) headers.set(key, value);
    }

    return Response.json(data, { ...init, headers });
};


export const emptyCors = () => {
    return new Response(null, { status: 204, headers: corsHeaders() });
};


export const parseBody = async <T>(request: Request, schema: ZodType<T>) => {
    return schema.parse(await request.json());
};


export const apiError = (error: unknown) => {
    const message = error instanceof Error ? error.message : "Unexpected server error";

    const status = error instanceof SyntaxError || (typeof error === "object" && error !== null && "issues" in error)
        ? 400
        : /not found/i.test(message)
            ? 404
            : /not configured/i.test(message)
                ? 409
                : 500;

    if (status === 500) {
        console.error(error);
    }

    return json({ error: message }, { status });
}
