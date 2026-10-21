import { useSyncExternalStore } from "react";
import type { SavedSearch } from "../types";
import type { GeoModel } from "./geo/geoModel";
import type { PlaceIndex } from "./place";
import { readSavedSearches, SAVED_SEARCHES_KEY } from "../services/api";
import { signature, snapshotOf } from "./savedSearch";
import { calendarAgs, cleanAreas, type CalArea } from "./calendarAreas";
import { accountChanged, api } from "./account";
import { onOtherTab } from "./otherTab";
import { savedSearchQuery } from "../state/search";

/**
 * Daten aus der Zeit vor den Konten, die nur in diesem Browser liegen, und ihre Übernahme ins Konto
 * (POST /api/me/import, requirements/konten-konzept.md Abschnitt 8). Ohne Klick wird nichts gesendet.
 * Nach der Übernahme löscht der Browser genau die bestätigten Einträge; übersprungene bleiben mit ihrem Titel stehen.
 */
const ARTICLES_KEY = "ratsmonitor:saved-articles:v1";
const CALENDAR_KEY = "rm-calendar:v1";
const WEEKLY_KEY = "ratsmonitor:weekly:v1";
const WEEKLY_DAY_KEY = "ratsmonitor:weekly-day:v1";
const PROFILE_KEY = "ratsmonitor:profile:v1";
const TIER_KEY = "ratsmonitor:tier:v1";
const IMPORTED_KEY = "ratsmonitor:imported:v1";
/* „Später“: in dieser Sitzung nicht wieder von selbst fragen */
const LATER_KEY = "ratsmonitor:import-later:v1";
const KEYS = [SAVED_SEARCHES_KEY, ARTICLES_KEY, CALENDAR_KEY, WEEKLY_KEY, WEEKLY_DAY_KEY, PROFILE_KEY, IMPORTED_KEY];

/** Wochentage wie im Konto (weeklyDay 0 = Sonntag … 6 = Samstag, wie Date.getDay) */
export const WEEK_DAYS = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

export interface LocalArticle {
  id: string;
  title: string;
  savedAt: string;
  follow?: boolean;
}
export interface LocalData {
  searches: SavedSearch[];
  articles: LocalArticle[];
  calendar: CalArea[];
  /** null: nicht gesetzt */
  weekly: boolean | null;
  /** Text wie früher gespeichert („Montag“ … „Sonntag“, „Täglich“); null: nicht gesetzt */
  weeklyDay: string | null;
  name: string;
  /** Übernahme oder Verwerfen schon entschieden (ratsmonitor:imported:v1) */
  imported: boolean;
}
export interface ImportPayload {
  searches: { id: string; name: string; signature: string; state: unknown; query: string | null; notify: { mail: boolean; freq: string }; created: string; lastSeen: string }[];
  articles: { id: string; follow: boolean; savedAt: string }[];
  settings?: { weekly: boolean; weeklyDay: number | null; calendar: CalArea[]; calendarAgs: string[] };
  name?: string;
}
export interface ImportResult {
  searches: { added: string[]; existing: string[]; invalid: (string | null)[] };
  articles: { added: string[]; existing: string[]; missing: (string | null)[] };
  limits?: { savedSearches: number | null; bookmarks: number | null };
}

const raw = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const remove = (k: string) => {
  try {
    localStorage.removeItem(k);
  } catch {
    /* ohne Speicher */
  }
};
const write = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* ohne Speicher */
  }
};
const json = (v: string | null): unknown => {
  try {
    return v ? JSON.parse(v) : null;
  } catch {
    return null;
  }
};

function readArticles(): LocalArticle[] {
  const v = json(raw(ARTICLES_KEY));
  return Array.isArray(v)
    ? v.filter((a) => a && typeof a.id === "string").map((a) => ({ id: a.id, title: typeof a.title === "string" ? a.title : a.id, savedAt: typeof a.savedAt === "string" ? a.savedAt : "", follow: !!a.follow }))
    : [];
}
function readAll(): LocalData {
  const cal = json(raw(CALENDAR_KEY)) as { areas?: unknown } | null;
  const weekly = raw(WEEKLY_KEY);
  const profile = json(raw(PROFILE_KEY)) as { name?: unknown } | null;
  return {
    searches: readSavedSearches(),
    articles: readArticles(),
    calendar: cleanAreas(cal?.areas),
    weekly: weekly === null ? null : weekly === "1",
    weeklyDay: raw(WEEKLY_DAY_KEY),
    name: typeof profile?.name === "string" ? profile.name.trim() : "",
    imported: raw(IMPORTED_KEY) !== null,
  };
}

/* Stand im Speicher, stabil je Inhalt (useSyncExternalStore vergleicht per Referenz) */
const listeners = new Set<() => void>();
let cache: { key: string; data: LocalData } | null = null;
const emit = () => listeners.forEach((l) => l());
function snapshot(): LocalData {
  const key = KEYS.map(raw).join("\u0001");
  if (!cache || cache.key !== key) cache = { key, data: readAll() };
  return cache.data;
}
const EMPTY: LocalData = { searches: [], articles: [], calendar: [], weekly: null, weeklyDay: null, name: "", imported: false };
if (typeof window !== "undefined") onOtherTab(KEYS, emit);
/** Daten aus diesem Browser (auf dem Server leer) */
export function useLocalData(): LocalData {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    snapshot,
    () => EMPTY,
  );
}

/** Gibt es etwas zu übernehmen? (Wochenbericht „aus“ allein zählt nicht) */
export const hasLocal = (d: LocalData) => d.searches.length > 0 || d.articles.length > 0 || d.calendar.length > 0 || d.weekly === true || !!d.name;
/** Dialog von selbst zeigen: Daten da, noch nicht entschieden, nicht auf „Später“ gestellt */
export const shouldAsk = (d: LocalData) => !d.imported && hasLocal(d) && (() => {
  try {
    return !sessionStorage.getItem(LATER_KEY);
  } catch {
    return true;
  }
})();
export function postponeImport() {
  try {
    sessionStorage.setItem(LATER_KEY, "1");
  } catch {
    /* ohne Speicher fragt der Dialog beim nächsten Laden wieder */
  }
  emit();
}

const n = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
/** „3 Suchen, 12 Artikel und Kalender mit 4 Gebieten“ */
export function localSummary(d: LocalData): string {
  const parts = [
    d.searches.length ? n(d.searches.length, "Suche", "Suchen") : "",
    d.articles.length ? n(d.articles.length, "Artikel", "Artikel") : "",
    d.calendar.length ? `Kalender mit ${n(d.calendar.length, "Gebiet", "Gebieten")}` : "",
  ].filter(Boolean);
  if (!parts.length) return "Einstellungen";
  return parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} und ${parts[parts.length - 1]}`;
}

const dayIndex = (d: string | null) => (d && WEEK_DAYS.includes(d) ? WEEK_DAYS.indexOf(d) : null);
/** Daten im Format der Übernahme; Abfragen und Umkreise rechnet der Browser (mit Karte, sonst ohne) */
export async function buildPayload(d: LocalData, geo: GeoModel | null, place: PlaceIndex | null, server?: { weekly?: boolean; weeklyDay?: number | null }): Promise<ImportPayload> {
  const searches = await Promise.all(
    d.searches.map(async (s) => ({
      id: s.id,
      name: s.name,
      signature: signature(s),
      state: snapshotOf(s),
      query: geo && place ? await savedSearchQuery(s, geo, place).catch(() => null) : null,
      notify: { mail: !!s.notify?.mail, freq: s.notify?.freq || "daily" },
      created: s.created,
      lastSeen: s.lastSeen,
    })),
  );
  const payload: ImportPayload = { searches, articles: d.articles.map((a) => ({ id: a.id, follow: !!a.follow, savedAt: a.savedAt })) };
  if (d.weekly !== null || d.weeklyDay !== null || d.calendar.length) {
    payload.settings = {
      weekly: d.weekly ?? !!server?.weekly,
      weeklyDay: d.weeklyDay !== null ? dayIndex(d.weeklyDay) : (server?.weeklyDay ?? null),
      calendar: d.calendar,
      calendarAgs: calendarAgs(d.calendar, geo),
    };
  }
  if (d.name) payload.name = d.name;
  return payload;
}

/** Datei herunterladen (Blob), z. B. die Daten dieses Browsers oder die Datenauskunft */
export function downloadFile(content: Blob | string, filename: string, type = "application/json") {
  const blob = typeof content === "string" ? new Blob([content], { type }) : content;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const today = () => new Date().toISOString().slice(0, 10);
/** „Daten aus diesem Browser als Datei sichern“: dasselbe Format wie die Übernahme */
export async function saveLocalFile(d: LocalData, geo: GeoModel | null, place: PlaceIndex | null) {
  const payload = await buildPayload(d, geo, place);
  downloadFile(JSON.stringify({ ...payload, quelle: "Plenara, Daten aus diesem Browser", erstellt: new Date().toISOString() }, null, 2), `plenara-browserdaten-${today()}.json`);
}

/** Alte Test- und Tarifschlüssel entfernen und die Entscheidung merken */
function finish() {
  remove(TIER_KEY);
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith("ratsmonitor:test-")) localStorage.removeItem(k);
    }
  } catch {
    /* ohne Speicher */
  }
  write(IMPORTED_KEY, new Date().toISOString());
}

/** Übernehmen: senden, dann genau die bestätigten Einträge hier löschen. Liefert das Ergebnis des Servers. */
export async function importLocal(d: LocalData, payload: ImportPayload): Promise<ImportResult> {
  const r = await api<ImportResult>("/api/me/import", { method: "POST", body: payload });
  const done = new Set([...(r.searches?.added ?? []), ...(r.searches?.existing ?? [])]);
  const doneA = new Set([...(r.articles?.added ?? []), ...(r.articles?.existing ?? [])]);
  /* Suchen: übersprungene bleiben (im alten Format) stehen */
  const leftS = (json(raw(SAVED_SEARCHES_KEY)) as { id?: string }[] | null)?.filter((s) => s && !done.has(String(s.id))) ?? [];
  if (leftS.length) write(SAVED_SEARCHES_KEY, JSON.stringify(leftS));
  else remove(SAVED_SEARCHES_KEY);
  const leftA = (json(raw(ARTICLES_KEY)) as { id?: string }[] | null)?.filter((a) => a && !doneA.has(String(a.id))) ?? [];
  if (leftA.length) write(ARTICLES_KEY, JSON.stringify(leftA));
  else remove(ARTICLES_KEY);
  if (payload.settings) {
    remove(CALENDAR_KEY);
    remove(WEEKLY_KEY);
    remove(WEEKLY_DAY_KEY);
  }
  if (payload.name !== undefined || d.name) remove(PROFILE_KEY);
  finish();
  emit();
  await accountChanged();
  return r;
}

/** „Nicht übernehmen“ bzw. übersprungene Einträge verwerfen: alles aus diesem Browser löschen */
export function discardLocal() {
  for (const k of [SAVED_SEARCHES_KEY, ARTICLES_KEY, CALENDAR_KEY, WEEKLY_KEY, WEEKLY_DAY_KEY, PROFILE_KEY]) remove(k);
  finish();
  emit();
}

/** „Datei übernehmen“: eine gesicherte Datei (Format der Übernahme) an das Konto senden */
export async function importFile(file: File): Promise<ImportResult> {
  if (file.size > 256 * 1024) throw new Error("Die Datei ist zu groß (höchstens 256 KB).");
  let data: unknown;
  try {
    data = JSON.parse(await file.text());
  } catch {
    throw new Error("Die Datei ist keine gültige JSON-Datei.");
  }
  if (!data || typeof data !== "object" || (!Array.isArray((data as ImportPayload).searches) && !Array.isArray((data as ImportPayload).articles) && !(data as ImportPayload).settings)) throw new Error("Die Datei enthält keine Daten zum Übernehmen.");
  const { searches, articles, settings, name } = data as ImportPayload;
  const r = await api<ImportResult>("/api/me/import", { method: "POST", body: { searches: searches ?? [], articles: articles ?? [], ...(settings ? { settings } : {}), ...(typeof name === "string" ? { name } : {}) } });
  await accountChanged();
  return r;
}

/** Ergebnis in Worten: „2 Suchen übernommen, 1 schon im Konto, 1 übersprungen …“ */
export function resultText(r: ImportResult): string {
  const s = r.searches ?? { added: [], existing: [], invalid: [] };
  const a = r.articles ?? { added: [], existing: [], missing: [] };
  const part = (label: string, added: number, existing: number, skipped: number) =>
    added + existing + skipped ? `${label}: ${added} übernommen${existing ? `, ${existing} schon im Konto` : ""}${skipped ? `, ${skipped} übersprungen` : ""}` : "";
  return [part("Suchen", s.added.length, s.existing.length, s.invalid.length), part("Artikel", a.added.length, a.existing.length, a.missing.length)].filter(Boolean).join(". ") || "Einstellungen übernommen";
}
