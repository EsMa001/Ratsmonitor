// OAuth für den Kunden-MCP: Code oder Erneuerungstoken gegen Zugangstoken tauschen (server/accounts/oauth.mjs).
import {oauthRoute} from '@/server/services/session';
import {token,preflight} from '@/server/accounts/oauth.mjs';
export const dynamic='force-dynamic';
export const POST=oauthRoute(token);
export const OPTIONS=preflight;
