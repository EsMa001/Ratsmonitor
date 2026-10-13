// Sitzung verlängern (GET schreibt nie; /api/me meldet renewAfter).
import {accountRoute} from '@/server/services/session';
import {refresh} from '@/server/accounts/login.mjs';
export const dynamic='force-dynamic';
export const POST=accountRoute(refresh);
