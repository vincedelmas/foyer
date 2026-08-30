import {z} from "zod";
import {afterEach, describe, expect, it} from "vitest";
import {corsHeaders, handleApi, json, parseBody} from "./http.server";


const configuredOrigin = process.env.PLOUX_CORS_ORIGIN;


afterEach(() => {
    if (configuredOrigin === undefined) delete process.env.PLOUX_CORS_ORIGIN;
    else process.env.PLOUX_CORS_ORIGIN = configuredOrigin;
});


describe("CORS headers", () => {
    it("disables cross-origin browser access by default and for wildcards", () => {
        delete process.env.PLOUX_CORS_ORIGIN;
        expect(corsHeaders()).toEqual({});

        process.env.PLOUX_CORS_ORIGIN = "*";
        expect(corsHeaders()).toEqual({});
    });

    it("allows one explicitly configured browser origin", () => {
        process.env.PLOUX_CORS_ORIGIN = "http://192.168.1.10:5173";
        expect(corsHeaders()["Access-Control-Allow-Origin"]).toBe("http://192.168.1.10:5173");
    });
});


describe("JSON request bodies", () => {
    const schema = z.object({ value: z.string() });

    it("rejects CORS-simple text bodies before parsing them as JSON", async () => {
        const request = new Request("http://localhost/api/v1/progress", {
            method: "POST",
            headers: { "Content-Type": "text/plain" },
            body: JSON.stringify({ value: "unsafe" }),
        });

        const response = await handleApi(async () => {
            return json(await parseBody(request, schema));
        });

        expect(response.status).toBe(415);
        expect(await response.json()).toEqual({
            error: "Content-Type must be application/json",
        });
    });

    it("accepts JSON content types with parameters", async () => {
        const request = new Request("http://localhost/api/v1/progress", {
            method: "POST",
            headers: { "Content-Type": "application/json; charset=utf-8" },
            body: JSON.stringify({ value: "safe" }),
        });

        await expect(parseBody(request, schema)).resolves.toEqual({ value: "safe" });
    });
});
