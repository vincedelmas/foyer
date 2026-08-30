import {afterEach, describe, expect, it} from "vitest";
import {corsHeaders} from "./http.server";


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
