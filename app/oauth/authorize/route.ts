// OAuth für den Kunden-MCP: Anfrage prüfen und zur Zustimmung (/verbinden) weiterleiten (server/accounts/oauth.mjs).
import {oauthRoute} from '@/server/services/session';
import {authorize} from '@/server/accounts/oauth.mjs';
export const dynamic='force-dynamic';
export const GET=oauthRoute(authorize);
