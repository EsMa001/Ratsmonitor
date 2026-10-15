// Code aus der Authenticator-App: Administration über die öffentliche Adresse für 12 Stunden.
import {accountRoute} from '@/server/services/session';
import {totpVerify} from '@/server/accounts/admin-factor.mjs';
export const dynamic='force-dynamic';
export const POST=accountRoute(totpVerify);
