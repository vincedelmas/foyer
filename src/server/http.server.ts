import type {ZodType} from "zod";


class HttpError extends Error {
    constructor(public readonly status: number, message: string) {
        super(message);
    }
}


export const corsHeaders = (): Record<string, string> => {
    const origin = process.env.PLOUX_CORS_ORIGIN?.trim();
    if (!origin || origin === "*") return {};

    return {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Headers": "Content-Type,Range",
        "Access-Control-Allow-Methods": "GET,HEAD,POST,PUT,DELETE,OPTIONS",
        "Access-Control-Expose-Headers": "Accept-Ranges,Content-Length,Content-Range",
    };
}


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
    const contentType = request.headers.get("Content-Type")
        ?.split(";", 1)[0]
        ?.trim()
        .toLowerCase();

    if (contentType !== "application/json") {
        throw new HttpError(415, "Content-Type must be application/json");
    }

    return schema.parse(await request.json());
};


const apiError = (error: unknown) => {
    const message = error instanceof Error ? error.message : "Unexpected server error";

    const status = error instanceof HttpError
        ? error.status
        : error instanceof SyntaxError || (typeof error === "object" && error !== null && "issues" in error)
            ? 400
            : /not found/i.test(message)
                ? 404
                : /not configured|identify .* before/i.test(message)
                    ? 409
                    : 500;

    if (status === 500) {
        console.error(error);
    }

    return json({ error: message }, { status });
};


export const handleApi = async (handler: () => Response | Promise<Response>) => {
    try {
        return await handler();
    }
    catch (error) {
        return apiError(error);
    }
};
