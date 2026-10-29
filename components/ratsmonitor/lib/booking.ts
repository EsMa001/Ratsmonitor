import { useMe, type Me } from "./account";
import { TIER_LABEL, UPGRADE_TEXT } from "./tier";

/**
 * Buchung von Plus und Pro (pages/BookingPage.tsx, Backend server/accounts/billing.mjs). Alle Buchungsknöpfe führen hierher,
 * sobald der Server Bezahlung meldet (/api/me checkout, bookable); ohne Anmeldung erst anmelden oder kostenlos registrieren,
 * danach geht es von selbst weiter zur Bezahlseite. Ohne Bezahlung bleibt es bei der Anfrage über den Kontakt.
 */
export const BOOK_PATH = "/konto/buchen";
export type Bookable = "plus" | "pro";
const pathOf = (tier: Bookable) => (tier === "plus" ? BOOK_PATH : `${BOOK_PATH}?stufe=${tier}`);
export const bookHref = (me: Me, tier: Bookable = "plus") => (me.user ? pathOf(tier) : `/anmelden?weiter=${encodeURIComponent(pathOf(tier))}`);

/** Ziel und Text der Buchungsknöpfe einer Stufe (Plus oder Pro) */
export function usePlusLink(tier: Bookable = "plus"): { href: string; label: string; book: boolean } {
  const me = useMe();
  const book = !!me.checkout && (me.bookable ?? ["plus"]).includes(tier);
  return book ? { href: bookHref(me, tier), label: `${TIER_LABEL[tier]} buchen`, book: true } : { href: "/kontakt", label: UPGRADE_TEXT, book: false };
}
