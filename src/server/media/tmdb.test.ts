import {afterAll, beforeAll, describe, expect, it} from "vitest";
import {execFile} from "node:child_process";
import {mkdtemp, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {promisify} from "node:util";


let temporaryDirectory: string;
const execFileAsync = promisify(execFile);


beforeAll(async () => {
    temporaryDirectory = await mkdtemp(join(tmpdir(), "foyer-tmdb-"));
});


afterAll(async () => {
    await rm(temporaryDirectory, {recursive: true, force: true});
});


describe("TMDB search", () => {
    it("composes accented titles before sending them to TMDB", async () => {
        const {stdout} = await execFileAsync("bun", ["--eval", `
            globalThis.fetch = async (input) => {
                const url = input instanceof URL ? input : new URL(String(input))
                console.log(url.searchParams.get("query"))
                return Response.json({results: []})
            }
            const {searchTmdb} = await import("./src/server/media/tmdb.server.ts")
            await searchTmdb("movie", "Le Compte de Monte\\u0301 Cristo")
        `], {
            cwd: process.cwd(),
            env: {
                ...process.env,
                TMDB_READ_ACCESS_TOKEN: "test-token",
                FOYER_DATABASE_PATH: join(temporaryDirectory, "foyer.sqlite"),
            },
        });

        expect(stdout.trim()).toBe("Le Compte de Mont\u00e9 Cristo");
    });
});
