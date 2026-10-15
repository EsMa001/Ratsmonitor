// Link prüfen, ohne ihn zu verbrauchen (Mail-Scanner öffnen Links vorab).
import {accountRoute} from '@/server/services/session';
import {peek} from '@/server/accounts/login.mjs';
export const dynamic='force-dynamic';
export const POST=accountRoute(peek);
