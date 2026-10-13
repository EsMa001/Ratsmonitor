// Kalender-Abo: Link mit Token anzeigen, neu erzeugen oder beenden.
import {accountRoute} from '@/server/services/session';
import {calendarFeed} from '@/server/accounts/account.mjs';
export const dynamic='force-dynamic';
export const GET=accountRoute(calendarFeed);
export const POST=accountRoute(calendarFeed);
export const DELETE=accountRoute(calendarFeed);
