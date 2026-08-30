import {createPlouxQueries, type PlouxQueries} from "@ploux/query";

import {trimServerName, tvApi} from "./api";


const queries = new Map<string, PlouxQueries>();


export const tvQueries = (server: string) => {
    const normalizedServer = trimServerName(server);
    const existing = queries.get(normalizedServer);

    if (existing) return existing;

    const client = createPlouxQueries(tvApi(normalizedServer), normalizedServer);
    queries.set(normalizedServer, client);

    return client;
};
