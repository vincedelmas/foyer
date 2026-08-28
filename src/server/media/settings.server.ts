import {desc} from "drizzle-orm";
import {listLibraries} from "./scanner.server";
import {scans} from "@/server/db/schema";
import {db, ensureDatabase} from "@/server/db/index.server";


export const getSettingsOverview = () => {
    ensureDatabase();

    return {
        libraries: listLibraries(),
        scans: db
            .select()
            .from(scans)
            .orderBy(desc(scans.startedAt))
            .limit(25)
            .all(),
    }
};
