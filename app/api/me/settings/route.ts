// Einstellungen und Name.
import {accountRoute} from '@/server/services/session';
import {settingsRead,settingsWrite} from '@/server/accounts/account.mjs';
export const dynamic='force-dynamic';
export const GET=accountRoute(settingsRead);
export const PUT=accountRoute(settingsWrite);
