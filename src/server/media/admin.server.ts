import {desc, eq} from "drizzle-orm";
import {listLibraries} from "./scanner.server";
import {isTmdbConfigured} from "./tmdb.server";
import {scans, settings} from "@/server/db/schema";
import {db, ensureDatabase} from "@/server/db/index.server";


export const getAdminOverview = () => {
    ensureDatabase();

    return {
        libraries: listLibraries(),
        tmdbConfigured: isTmdbConfigured(),
        databasePath: process.env.PLOUX_DATABASE_PATH ?? "./data/ploux.sqlite",
        tmdbSource: process.env.TMDB_READ_ACCESS_TOKEN?.trim() ? "environment" : "database",
        scans: db
            .select()
            .from(scans)
            .orderBy(desc(scans.startedAt))
            .limit(25)
            .all(),
    }
};


export const saveTmdbToken = (token: string) => {
    ensureDatabase();
    const normalized = token.trim();
    if (!normalized) {
        db
            .delete(settings)
            .where(eq(settings.key, "tmdb_token"))
            .run();

        return {
            configured: Boolean(process.env.TMDB_READ_ACCESS_TOKEN?.trim()),
        };
    }

    db.insert(settings)
        .values({
            key: "tmdb_token",
            value: normalized,
            updatedAt: Date.now(),
        }).onConflictDoUpdate({
        target: settings.key,
        set: {
            value: normalized,
            updatedAt: Date.now(),
        },
    }).run();

    return { configured: true };
};

