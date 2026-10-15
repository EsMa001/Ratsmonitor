// Datenauskunft als Datei: mit frischer Anmeldung sofort, sonst per Code.
import {accountRoute} from '@/server/services/session';
import {exportData} from '@/server/accounts/account.mjs';
export const dynamic='force-dynamic';
export const POST=accountRoute(exportData);
