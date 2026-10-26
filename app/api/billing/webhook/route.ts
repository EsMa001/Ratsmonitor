// Meldungen von Stripe (server/accounts/billing.mjs): ohne Sitzung und ohne gleiche Herkunft, berechtigt ist nur die
// Signatur (Stripe-Signature); in der Zugangssperre frei (server/accounts/access.mjs).
import {accountRoute} from '@/server/services/session';
import {webhook} from '@/server/accounts/billing.mjs';
export const dynamic='force-dynamic';
export const POST=accountRoute(webhook);
