// Admins: Seite mit den Rechten einer Stufe ansehen.
import {accountRoute} from '@/server/services/session';
import {viewTier} from '@/server/accounts/admin-factor.mjs';
export const dynamic='force-dynamic';
export const POST=accountRoute(viewTier);
