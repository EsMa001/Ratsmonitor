// Code statt Link: nur mit dem Flow-Cookie des Browsers, der den Link angefordert hat.
import {accountRoute} from '@/server/services/session';
import {enterCode} from '@/server/accounts/login.mjs';
export const dynamic='force-dynamic';
export const POST=accountRoute(enterCode);
