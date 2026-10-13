// Konto löschen: zuerst Code anfordern, dann mit dem Code bestätigen.
import {accountRoute} from '@/server/services/session';
import {deleteAccount} from '@/server/accounts/account.mjs';
export const dynamic='force-dynamic';
export const POST=accountRoute(deleteAccount);
