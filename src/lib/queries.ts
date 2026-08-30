import {api} from "@/lib/api";
import {createPlouxQueries} from "@ploux/query";


export const plouxQueries = createPlouxQueries(api, "web");
