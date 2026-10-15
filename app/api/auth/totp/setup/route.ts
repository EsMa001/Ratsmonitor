// Zweiten Faktor einrichten (nur über den Tunnel): Schlüssel anlegen, dann mit einem Code bestätigen.
import {accountRoute} from '@/server/services/session';
import {totpSetup} from '@/server/accounts/admin-factor.mjs';
export const dynamic='force-dynamic';
export const POST=accountRoute(totpSetup);
