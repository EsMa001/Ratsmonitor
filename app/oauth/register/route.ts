// OAuth für den Kunden-MCP: Anwendungen registrieren sich selbst (RFC 7591, server/accounts/oauth.mjs).
import {oauthRoute} from '@/server/services/session';
import {register,preflight} from '@/server/accounts/oauth.mjs';
export const dynamic='force-dynamic';
export const POST=oauthRoute(register);
export const OPTIONS=preflight;
