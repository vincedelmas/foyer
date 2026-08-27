import {mkdirSync} from "node:fs";
import * as schema from "./schema";
import {Database} from "bun:sqlite";
import {dirname, resolve} from "node:path";
import {drizzle} from "drizzle-orm/bun-sqlite";
import {migrate} from "drizzle-orm/bun-sqlite/migrator";


const databasePath = resolve(process.env.PLOUX_DATABASE_PATH ?? "./data/ploux.sqlite");


mkdirSync(dirname(databasePath), { recursive: true });


const sqlite = new Database(databasePath, { create: true });
sqlite.run("PRAGMA journal_mode = WAL");
sqlite.run("PRAGMA foreign_keys = ON");
sqlite.run("PRAGMA busy_timeout = 5000");


export const db = drizzle(sqlite, { schema });
let migrated = false;


export const ensureDatabase = () => {
    if (migrated) return;
    migrate(db, { migrationsFolder: resolve("./drizzle") });
    migrated = true;
}
