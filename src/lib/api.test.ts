import {afterEach, describe, expect, it, vi} from "vitest";
import {createPlouxApi} from "@ploux/contracts";


afterEach(() => {
    vi.unstubAllGlobals();
});


describe("Ploux API health check", () => {
    it("accepts a valid Ploux health response", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => Response.json({
            status: "ok",
            name: "Ploux",
            version: "1.2.3",
            directPlay: true,
            transcoding: false,
        })));

        await expect(createPlouxApi("http://server").health()).resolves.toMatchObject({
            status: "ok",
            name: "Ploux",
        });
    });

    it("rejects an unrelated successful server response", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => Response.json({status: "ok"})));

        await expect(createPlouxApi("http://server").health()).rejects.toThrow(
            "does not appear to be a Ploux server"
        );
    });
});
