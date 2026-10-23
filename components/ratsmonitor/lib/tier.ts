import { PRICES } from "@/shared/plans.mjs";
import { devLogin, getMe, useMe } from "./account";

/**
 * Nutzungsstufen. Die Stufe kommt vom Server (GET /api/me, lib/account.ts); dort werden die Grenzen auch durchgesetzt.
 * Die Werte hier sind dieselben wie in shared/plans.mjs (tests/accounts-rules.test.mjs vergleicht) und dienen nur als
 * Anzeige (Preisseite, Tarifkarten), solange es keine Antwort gibt.
 */
export type Tier = "guest" | "basic" | "pro" | "enterprise";

export interface TierLimits {
  /** Höchstzahl erreichbarer Treffer (Gast und Konto: nur die erste Seite) */
  maxResults: number;
  filters: boolean;
  bookmarks: number;
  savedSearches: number;
  /** Aktive Benachrichtigungen: Glocke an Artikeln + E-Mail-Schalter an gespeicherten Suchen */
  notifications: number;
  /** E-Mail-Empfänger für Benachrichtigungen */
  emails: number;
  /** Sitzungskalender (ab Plus) */
  calendar: boolean;
  /** Mails sofort; sonst kommen sie einmal am Tag (ab Plus) */
  instant: boolean;
}

const INF = Number.POSITIVE_INFINITY;
/** Plus und Enterprise: gespeicherte Suchen, Artikel und aktive Benachrichtigungen je bis zu 100 */
export const PLAN_MAX = 100;
export const LIMITS: Record<Tier, TierLimits> = {
  guest: { maxResults: 10, filters: true, bookmarks: 0, savedSearches: 0, notifications: 0, emails: 0, calendar: false, instant: false },
  basic: { maxResults: 20, filters: true, bookmarks: 5, savedSearches: 5, notifications: 5, emails: 1, calendar: false, instant: false },
  pro: { maxResults: INF, filters: true, bookmarks: PLAN_MAX, savedSearches: PLAN_MAX, notifications: PLAN_MAX, emails: 1, calendar: true, instant: true },
  enterprise: { maxResults: INF, filters: true, bookmarks: PLAN_MAX, savedSearches: PLAN_MAX, notifications: PLAN_MAX, emails: 5, calendar: true, instant: true },
};

export const TIER_LABEL: Record<Tier, string> = { guest: "Gast", basic: "Konto", pro: "Plus", enterprise: "Enterprise" };
/** Preis je Stufe für die Anzeige; ohne festgelegten Preis (shared/plans.mjs PRICES = null) „Preis folgt“ */
export function priceLabel(t: Tier): string {
  if (t === "guest" || t === "basic") return "0 €";
  const p = (PRICES as Record<string, string | number | null>)[t];
  return p === null || p === undefined ? "Preis folgt" : typeof p === "number" ? `${p.toLocaleString("de-DE", { minimumFractionDigits: 2 })} € / Monat` : p;
}
/** Text der Upgrade-Knöpfe, solange es keine Bezahlung gibt (verweist auf /kontakt) */
export const UPGRADE_TEXT = "In der Testphase auf Anfrage";

/** Dev-Umschalter und Dev-Abkürzungen nur in der Entwicklung anzeigen */
export const IS_DEV = process.env.NODE_ENV !== "production";

export function getTier(): Tier {
  return getMe().tier;
}

/** Nur Entwicklung: als Testkonto dieser Stufe anmelden (Gast = abmelden); in Produktion ohne Wirkung */
export function setTier(t: Tier) {
  if (!IS_DEV) return;
  void devLogin(t);
}

/** Stufe und Grenzen vom Server; ready = /api/me ist beantwortet (vorher Gast-Grenzen, aber kein Sperrdialog) */
export function useTier(): { tier: Tier; limits: TierLimits; ready: boolean } {
  const me = useMe();
  return { tier: me.tier, limits: me.limits, ready: me.ready };
}

/** Anzeige eines Limits, z. B. „1 von 1“ oder „3“ ohne feste Grenze (Treffer je Suche) */
export function usage(used: number, max: number): string {
  return Number.isFinite(max) ? `${used} von ${max}` : String(used);
}
