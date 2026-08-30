import {api} from "@/lib/api";
import {createFoyerQueries} from "@foyer/query";


export const foyerQueries = createFoyerQueries(api, "web");
