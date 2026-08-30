import {createFoyerApi, type FoyerApi} from "@foyer/contracts";


const clients = new Map<string, FoyerApi>();


export const trimServerName = (server: string) => server.trim().replace(/\/+$/, "");


export const tvApi = (server: string) => {
    const trimmedServer = trimServerName(server);

    const existing = clients.get(trimmedServer);
    if (existing) return existing;

    const client = createFoyerApi(trimmedServer);
    clients.set(trimmedServer, client);

    return client;
}
