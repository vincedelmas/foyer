import {createPlouxApi, type PlouxApi} from "@ploux/contracts";


const clients = new Map<string, PlouxApi>();


export const tvApi = (server: string) => {
    const trimmedServer = server.trim().replace(/\/+$/, "");

    const existing = clients.get(trimmedServer);
    if (existing) return existing;

    const client = createPlouxApi(trimmedServer);
    clients.set(trimmedServer, client);

    return client;
}
