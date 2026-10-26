// Abo verwalten: Kundenportal von Stripe (kündigen, Zahlart, Rechnungen; server/accounts/billing.mjs).
import {accountRoute} from '@/server/services/session';
import {portal} from '@/server/accounts/billing.mjs';
export const dynamic='force-dynamic';
export const POST=accountRoute(portal);
