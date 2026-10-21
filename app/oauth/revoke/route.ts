// OAuth für den Kunden-MCP: Erneuerungstoken zurückziehen (RFC 7009, server/accounts/oauth.mjs).
import {oauthRoute} from '@/server/services/session';
import {revoke,preflight} from '@/server/accounts/oauth.mjs';
export const dynamic='force-dynamic';
export const POST=oauthRoute(revoke);
export const OPTIONS=preflight;
