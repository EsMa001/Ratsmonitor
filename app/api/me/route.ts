// Zustand des Kontos: Stufe, Rollen, Rechte. Ohne Sitzung: Gast.
import {accountRoute} from '@/server/services/session';
import {me} from '@/server/accounts/login.mjs';
export const dynamic='force-dynamic';
export const GET=accountRoute(me);
