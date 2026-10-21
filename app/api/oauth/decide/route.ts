// Zustimmungsseite /verbinden: zulassen oder ablehnen; Antwort ist die Rücksprungadresse (server/accounts/oauth.mjs).
import {accountRoute} from '@/server/services/session';
import {decide} from '@/server/accounts/oauth.mjs';
export const dynamic='force-dynamic';
export const POST=accountRoute(decide);
