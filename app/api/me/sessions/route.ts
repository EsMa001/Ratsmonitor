// Geräte: anzeigen und beenden.
import {accountRoute} from '@/server/services/session';
import {sessionsList,sessionsRevoke} from '@/server/accounts/login.mjs';
export const dynamic='force-dynamic';
export const GET=accountRoute(sessionsList);
export const POST=accountRoute(sessionsRevoke);
