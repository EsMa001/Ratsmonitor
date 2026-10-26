// Kündigungsbutton nach § 312k BGB (server/accounts/cancel.mjs): ohne Sitzung, gleiche Herkunft und JSON; in der
// Zugangssperre frei (server/accounts/access.mjs), wie die Seite /kuendigen.
import {accountRoute} from '@/server/services/session';
import {cancelRoute} from '@/server/accounts/cancel.mjs';
export const dynamic='force-dynamic';
export const POST=accountRoute(cancelRoute);
