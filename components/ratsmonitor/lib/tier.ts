import { useSyncExternalStore } from "react";

/**
 * Nutzungsstufen. Solange es keine echte Anmeldung gibt, wird die Stufe nur im Browser
 * gehalten und in der Entwicklung über den Dev-Switcher in der Kopfzeile gewechselt.
 * Die Grenzen hier sind reine Oberflächen-Logik; serverseitig wird (noch) nichts erzwungen.
 */
export type Tier = "guest" | "basic" | "pro" | "enterprise";

export interface TierLimits {
  /** Höchstzahl erreichbarer Treffer (Gäste: nur die erste Seite) */
  maxResults: number;
  filters: boolean;
  bookmarks: number;
  savedSearches: number;
  /** Aktive Benachrichtigungen: Glocke an Artikeln + E-Mail-Schalter an gespeicherten Suchen */
  notifications: number;
  /** E-Mail-Empfänger für Benachrichtigungen */
  emails: number;
  /** Sitzungskalender (nur Enterprise) */
  calendar: boolean;
}

const INF = Number.POSITIVE_INFINITY;
/** Pro und Enterprise: gespeicherte Suchen, Artikel und aktive Benachrichtigungen je bis zu 100 */
export const PLAN_MAX = 100;
export const LIMITS: Record<Tier, TierLimits> = {
  guest: { maxResults: 10, filters: false, bookmarks: 0, savedSearches: 0, notifications: 0, emails: 0, calendar: false },
  basic: { maxResults: INF, filters: true, bookmarks: 1, savedSearches: 1, notifications: 1, emails: 1, calendar: false },
  pro: { maxResults: INF, filters: true, bookmarks: PLAN_MAX, savedSearches: PLAN_MAX, notifications: PLAN_MAX, emails: 1, calendar: false },
  enterprise: { maxResults: INF, filters: true, bookmarks: PLAN_MAX, savedSearches: PLAN_MAX, notifications: PLAN_MAX, emails: 5, calendar: true },
};

export const TIER_LABEL: Record<Tier, string> = { guest: "Gast", basic: "Basic", pro: "Pro", enterprise: "Enterprise" };
export const PRO_PRICE = "9,99 € / Monat";

/** Dev-Switcher nur in der Entwicklung anzeigen */
export const IS_DEV = process.env.NODE_ENV !== "production";

const KEY = "ratsmonitor:tier:v1";
const TIERS: Tier[] = ["guest", "basic", "pro", "enterprise"];
const listeners = new Set<() => void>();
let current: Tier | null = null;

function read(): Tier {
  if (current) return current;
  try {
    const v = localStorage.getItem(KEY) as Tier | null;
    current = v && TIERS.includes(v) ? v : "guest";
  } catch {
    current = "guest";
  }
  return current;
}

export function getTier(): Tier {
  return read();
}

export function setTier(t: Tier) {
  current = t;
  try {
    localStorage.setItem(KEY, t);
  } catch {}
  listeners.forEach((l) => l());
}

export function useTier(): { tier: Tier; limits: TierLimits } {
  const tier = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    read,
    () => "guest" as Tier,
  );
  return { tier, limits: LIMITS[tier] };
}

/** Anzeige eines Limits, z. B. „1 von 1“ oder „3“ ohne feste Grenze (Treffer je Suche) */
export function usage(used: number, max: number): string {
  return Number.isFinite(max) ? `${used} von ${max}` : String(used);
}
