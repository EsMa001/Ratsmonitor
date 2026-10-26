// Plus buchen: Bezahlseite von Stripe (server/accounts/billing.mjs); freigeschaltet wird erst per Meldung von Stripe.
import {accountRoute} from '@/server/services/session';
import {checkout} from '@/server/accounts/billing.mjs';
export const dynamic='force-dynamic';
export const POST=accountRoute(checkout);
