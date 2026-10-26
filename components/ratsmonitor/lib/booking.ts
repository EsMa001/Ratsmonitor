import { useMe, type Me } from "./account";
import { UPGRADE_TEXT } from "./tier";

/**
 * Buchung von Plus (pages/BookingPage.tsx, Backend server/accounts/billing.mjs). Alle Plus-Knöpfe führen hierher, sobald
 * der Server Bezahlung meldet (/api/me checkout); ohne Anmeldung erst anmelden oder kostenlos registrieren, danach geht
 * es von selbst weiter zur Bezahlseite. Ohne Bezahlung bleibt es bei der Anfrage über den Kontakt.
 */
export const BOOK_PATH = "/konto/buchen";
export const bookHref = (me: Me) => (me.user ? BOOK_PATH : `/anmelden?weiter=${encodeURIComponent(BOOK_PATH)}`);

/** Ziel und Text der Plus-Knöpfe */
export function usePlusLink(): { href: string; label: string; book: boolean } {
  const me = useMe();
  return me.checkout ? { href: bookHref(me), label: "Plus buchen", book: true } : { href: "/kontakt", label: UPGRADE_TEXT, book: false };
}
