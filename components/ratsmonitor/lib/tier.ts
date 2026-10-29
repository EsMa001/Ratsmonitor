import { BOOKABLE as PLAN_BOOKABLE, LIMITS as PLAN_LIMITS, PLAN_MAX as PLAN_CAP, PRICES, TIER_LABEL as PLAN_LABEL, TIERS as PLAN_TIERS } from "@/shared/plans.mjs";
import { devLogin, getMe, useMe } from "./account";

/**
 * Nutzungsstufen. Die Stufe kommt vom Server (GET /api/me, lib/account.ts); dort werden die Grenzen auch durchgesetzt.
 * Namen, Grenzen und Preise stammen aus shared/plans.mjs (eine Quelle für Server und Oberfläche); sie dienen hier der
 * Anzeige (Preisseite, Tarifkarten) und gelten, solange es keine Antwort gibt. Enterprise ist verborgen (nicht im Angebot).
 */
export type Tier = "guest" | "basic" | "plus" | "pro" | "enterprise";
/** Rhythmus der Mails; „sofort“ steht nur noch in älteren Zeilen und gilt als täglich */
export type Freq = "daily" | "weekly";

export interface TierLimits {
  /** Höchstzahl erreichbarer Treffer (Gast und Konto: nur die erste Seite) */
  maxResults: number;
  /** Filter (Zeitraum, Thema, Status, Schalter); ohne sie nur Begriff und Ort */
  filters: boolean;
  bookmarks: number;
  savedSearches: number;
  /** Glocken: an gefolgten Vorgängen und an gespeicherten Suchen zusammen */
  notifications: number;
  /** Erlaubte Rhythmen der Mails, schnellster zuerst */
  freqs: Freq[];
  /** Wochenbericht über alle gespeicherten Suchen (ab Plus) */
  weeklyReport: boolean;
  /** Gebiete im Sitzungskalender (je Ort, auf Wunsch mit Umkreis) */
  calendarAreas: number;
  /** E-Mail-Empfänger für Benachrichtigungen */
  emails: number;
}

export const LIMITS = PLAN_LIMITS as unknown as Record<Tier, TierLimits>;
/** „Unbegrenzt“: interne Obergrenze (Pro, Enterprise) */
export const PLAN_MAX: number = PLAN_CAP;
export const TIER_LABEL = PLAN_LABEL as Record<Tier, string>;
/** Stufen, die sich buchen lassen (Plus, Pro) */
export const BOOKABLE = PLAN_BOOKABLE as Tier[];
/** Stufen der Preisseite in Reihenfolge; Enterprise ist nicht im Angebot */
export const OFFERED: Tier[] = ["basic", "plus", "pro"];

/** Rang einer Stufe (shared/plans.mjs: Reihenfolge der Stufen) */
export const rankOf = (t: Tier) => (PLAN_TIERS as Tier[]).indexOf(t);
/** Nächsthöhere Stufe im Angebot (Gast → Konto → Plus → Pro) */
export function nextTier(t: Tier): Tier {
  return t === "guest" ? "basic" : t === "basic" ? "plus" : "pro";
}
/** Niedrigste Stufe im Angebot, die eine Grenze über den Wert hebt (für Hinweise „mit Plus …“) */
export function tierFor(pick: (l: TierLimits) => number | boolean, from: Tier): Tier {
  const start = OFFERED.indexOf(nextTier(from));
  const now = pick(LIMITS[from]);
  return OFFERED.slice(Math.max(0, start)).find((t) => pick(LIMITS[t]) > now) ?? "pro";
}
/** Unbegrenzt: ohne Grenze oder an der internen Obergrenze */
export const unlimited = (n: number) => !Number.isFinite(n) || n >= PLAN_MAX;
/** Zahl für Texte: „unbegrenzt“ oder die Zahl */
export const countLabel = (n: number) => (unlimited(n) ? "unbegrenzt" : String(n));
export const FREQ_LABEL: Record<Freq, string> = { daily: "täglich", weekly: "wöchentlich" };
/** „täglich oder wöchentlich“, „wöchentlich“ */
export const freqsLabel = (l: TierLimits) => l.freqs.map((f) => FREQ_LABEL[f]).join(" oder ");
/** Rhythmus, der in der Stufe gilt (wie freqFor in shared/plans.mjs): der gewünschte, wenn erlaubt, sonst der nächst langsamere */
export function freqIn(l: TierLimits, wanted?: string | null): Freq {
  if (l.freqs.includes(wanted as Freq)) return wanted as Freq;
  const order = ["instant", "daily", "weekly"],
    at = order.indexOf(wanted ?? "");
  return l.freqs.find((f) => order.indexOf(f) > at) ?? l.freqs.at(-1) ?? "weekly";
}

/** Preis je Stufe für die Anzeige; ohne festgelegten Preis (shared/plans.mjs PRICES = null) „Preis folgt“ */
export function priceLabel(t: Tier): string {
  if (t === "guest" || t === "basic") return "0 €";
  const p = (PRICES as Record<string, string | number | null>)[t];
  return p === null || p === undefined ? "Preis folgt" : typeof p === "number" ? `${p.toLocaleString("de-DE", { minimumFractionDigits: 2 })} € / Monat` : p;
}
/** Preis kurz für Sätze: „2,99 €“ (ohne Zeitraum) */
export function priceShort(t: Tier): string {
  const p = (PRICES as Record<string, number | null>)[t];
  return typeof p === "number" ? `${p.toLocaleString("de-DE", { minimumFractionDigits: p % 1 ? 2 : 0 })} €` : "Preis folgt";
}
/** Text der Upgrade-Knöpfe, solange es keine Bezahlung gibt (verweist auf /kontakt) */
export const UPGRADE_TEXT = "Jetzt anfragen";

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

/** Anzeige eines Limits, z. B. „1 von 1“ oder „3“ ohne feste Grenze (Treffer je Suche, Pro) */
export function usage(used: number, max: number): string {
  return unlimited(max) ? String(used) : `${used} von ${max}`;
}
