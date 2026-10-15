// Anmelden mit E-Mail-Adresse und Code aus der Authenticator-App, ohne Mail (LOGIN_TOTP=1, nur Konten mit zweitem Faktor).
import {accountRoute} from '@/server/services/session';
import {totpLogin} from '@/server/accounts/admin-factor.mjs';
export const dynamic='force-dynamic';
export const POST=accountRoute(totpLogin);
