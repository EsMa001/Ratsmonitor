// Übernahme der Daten aus dem Browser (einmal je Gerät, auch als Datei).
import {accountRoute} from '@/server/services/session';
import {importData} from '@/server/accounts/account.mjs';
export const dynamic='force-dynamic';
export const POST=accountRoute(importData);
