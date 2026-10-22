// Benachrichtigungen abbestellen (server/accounts/notify.mjs): Ein-Klick aus dem Mailprogramm (RFC 8058) und die Seite
// /abbestellen. Ohne Sitzung und ohne gleiche Herkunft, das Token aus der Mail ist die Berechtigung; in der Zugangssperre frei.
import {accountRoute} from '@/server/services/session';
import {unsubscribeRoute} from '@/server/accounts/notify.mjs';
export const dynamic='force-dynamic';
export const POST=accountRoute(unsubscribeRoute);
