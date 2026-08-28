import {defineConfig} from "drizzle-kit";


export default defineConfig({
    strict: true,
    verbose: true,
    out: "./drizzle",
    dialect: "sqlite",
    schema: "./src/server/db/schema.ts",
    dbCredentials: {
        url: process.env.PLOUX_DATABASE_PATH ?? "./data/ploux.sqlite",
    },
});
