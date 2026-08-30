import {afterEach, describe, expect, it, vi} from "vitest";
import {createFoyerApi} from "@foyer/contracts";


afterEach(() => {
    vi.unstubAllGlobals();
});


describe("Foyer API health check", () => {
    it("accepts a valid Foyer health response", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => Response.json({
            status: "ok",
            name: "Foyer",
            version: "1.2.3",
            directPlay: true,
            transcoding: false,
        })));

        await expect(createFoyerApi("http://server").health()).resolves.toMatchObject({
            status: "ok",
            name: "Foyer",
        });
    });

    it("rejects an unrelated successful server response", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => Response.json({status: "ok"})));

        await expect(createFoyerApi("http://server").health()).rejects.toThrow(
            "does not appear to be a Foyer server"
        );
    });
});
