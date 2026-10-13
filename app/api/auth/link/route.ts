// Anmeldelink anfordern: immer dieselbe Antwort (202), die Mail entsteht nach der Antwort.
import {accountRoute} from '@/server/services/session';
import {requestLink} from '@/server/accounts/login.mjs';
export const dynamic='force-dynamic';
export const POST=accountRoute(requestLink);
