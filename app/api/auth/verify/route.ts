// Link einlösen: erst nach dem Klick auf der Bestätigungsseite.
import {accountRoute} from '@/server/services/session';
import {verify} from '@/server/accounts/login.mjs';
export const dynamic='force-dynamic';
export const POST=accountRoute(verify);
