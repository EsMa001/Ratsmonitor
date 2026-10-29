import { useMe, type Me } from "./account";
import { TIER_LABEL, UPGRADE_TEXT } from "./tier";

/**
 * Buchung von Plus und Pro (pages/BookingPage.tsx, Backend server/accounts/billing.mjs). Alle Buchungsknöpfe führen zur
 * Buchungsseite, sobald der Server Bezahlung meldet (/api/me checkout, bookable); dort stehen Plus und Pro zur Wahl, eine
 * mitgegebene Stufe (?stufe=pro) ist vorausgewählt. Ohne Anmeldung erst anmelden oder kostenlos registrieren, danach geht es
 * zurück zur Buchungsseite. Ohne Bezahlung bleibt es bei der Anfrage über den Kontakt.
 */
export const BOOK_PATH = "/konto/buchen";
export type Bookable = "plus" | "pro";
const pathOf = (tier?: Bookable) => (tier ? `${BOOK_PATH}?stufe=${tier}` : BOOK_PATH);
export const bookHref = (me: Me, tier?: Bookable) => (me.user ? pathOf(tier) : `/anmelden?weiter=${encodeURIComponent(pathOf(tier))}`);

/** Ziel und Text der Buchungsknöpfe; mit Stufe ist sie auf der Buchungsseite vorausgewählt */
export function usePlusLink(tier?: Bookable): { href: string; label: string; book: boolean } {
  const me = useMe();
  const bookable = me.bookable ?? ["plus"];
  const book = !!me.checkout && (tier ? bookable.includes(tier) : bookable.length > 0);
  return book ? { href: bookHref(me, tier), label: tier ? `${TIER_LABEL[tier]} buchen` : "Plus oder Pro buchen", book: true } : { href: "/kontakt", label: UPGRADE_TEXT, book: false };
}
