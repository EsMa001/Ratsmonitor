// Gespeicherte Suchen des Kontos.
import {accountRoute} from '@/server/services/session';
import {searchesList,searchesWrite} from '@/server/accounts/account.mjs';
export const dynamic='force-dynamic';
export const GET=accountRoute(searchesList);
export const POST=accountRoute(searchesWrite);
export const PATCH=accountRoute(searchesWrite);
export const DELETE=accountRoute(searchesWrite);
