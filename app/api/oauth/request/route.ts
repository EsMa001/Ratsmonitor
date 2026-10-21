// Zustimmungsseite /verbinden: Anwendung und freigeschaltete Kunden des angemeldeten Kontos (server/accounts/oauth.mjs).
import {accountRoute} from '@/server/services/session';
import {requestInfo} from '@/server/accounts/oauth.mjs';
export const dynamic='force-dynamic';
export const GET=accountRoute(requestInfo);
