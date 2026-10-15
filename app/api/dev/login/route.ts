// Nur im Dev-Server (sonst 404): login.
import {accountRoute} from '@/server/services/session';
import {devLogin} from '@/server/accounts/dev.mjs';
export const dynamic='force-dynamic';
export const POST=accountRoute(devLogin);
