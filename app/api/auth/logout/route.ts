// Abmelden: Sitzung löschen, Cookie entfernen.
import {accountRoute} from '@/server/services/session';
import {logout} from '@/server/accounts/login.mjs';
export const dynamic='force-dynamic';
export const POST=accountRoute(logout);
