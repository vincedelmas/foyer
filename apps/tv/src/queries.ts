import {createFoyerQueries, type FoyerQueries} from "@foyer/query";

import {trimServerName, tvApi} from "./api";


const queries = new Map<string, FoyerQueries>();


export const tvQueries = (server: string) => {
    const normalizedServer = trimServerName(server);
    const existing = queries.get(normalizedServer);

    if (existing) return existing;

    const client = createFoyerQueries(tvApi(normalizedServer), normalizedServer);
    queries.set(normalizedServer, client);

    return client;
};
