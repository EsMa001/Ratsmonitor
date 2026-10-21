import type { SavedSearch, StatusId } from "../types";
import { STATUS_BY_ID } from "./constants";
import type { GeoModel } from "./geo/geoModel";
import { monthLabel, norm, todayLocal } from "./text";

export interface SearchSnapshot {
  q: string;
  text: string;
  area: string;
  areaSrc: SavedSearch["areaSrc"];
  radius: { ags: string; km: number; x?: number; y?: number } | null;
  thema: string;
  monat: string;
  von?: string;
  bis?: string;
  scope?: "only" | "with";
  /** Weitere Orte aus der Suche */
  more?: { ags: string; scope: "only" | "with" }[];
  status: StatusId | "";
  level?: "city" | "district";
  future?: boolean;
  noformal?: boolean;
  allterms?: boolean;
  exact?: boolean;
}

const SNAPSHOT_KEYS = ["q", "text", "area", "areaSrc", "radius", "thema", "monat", "von", "bis", "scope", "more", "status", "level", "future", "noformal", "allterms", "exact"] as const;
/** Nur die Felder der Suche (ohne id, name, notify, created, lastSeen): so speichert das Konto sie (state) */
export function snapshotOf(s: SearchSnapshot): SearchSnapshot {
  const out: Record<string, unknown> = {};
  for (const k of SNAPSHOT_KEYS) if (s[k] !== undefined) out[k] = s[k];
  return out as unknown as SearchSnapshot;
}

/** Signatur einer Suche, um gespeicherte Suchen wiederzuerkennen */
export function signature(s: Pick<SearchSnapshot, "text" | "area" | "radius" | "thema" | "monat" | "von" | "bis" | "status" | "level" | "more"> & { future?: boolean; noformal?: boolean; allterms?: boolean; exact?: boolean }): string {
  const t = norm(s.text || "").split(/\s+/).filter(Boolean).sort().join(" ");
  const more = (s.more || []).map((m) => `${m.ags}:${m.scope}`).sort().join(",");
  return [t, s.area || "", s.radius ? `${s.radius.ags}@${s.radius.km}` : "", s.thema || "", s.monat || "", (s.von || "") + "~" + (s.bis || ""), s.status || "", s.level || "city", more].join("|") + (s.future ? "|future" : "") + (s.noformal ? "|noformal" : "") + (s.allterms ? "|all" : "") + (s.exact ? "|exact" : "");
}

/** Suchtext für die Abfrage. Das Backend verknüpft Kommas (zwischen Chips) mit ODER, Leerzeichen mit UND.
 *  Standard: Begriffe mit ODER (Text unverändert); „alle Begriffe“: jedes Wort muss vorkommen (nur Leerzeichen).
 *  Orte/Gebiete sind nicht Teil des Texts und davon unberührt. */
export function queryText(text: string, all?: boolean): string {
  return all ? text.replace(/[,;|]/g, " ").split(/\s+/).filter(Boolean).join(" ") : text;
}

/* Dieselbe Normalisierung wie im Backend (monitor-search.mjs): klein, ohne Akzente, ß als ss */
const normQ = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replaceAll("ß", "ss");
const FILLER_Q = new Set(["und", "oder", "der", "die", "das", "den", "dem", "des", "ein", "eine", "einer", "in", "im", "am", "an", "zu", "zum", "zur", "von", "vom", "fur", "mit", "bei", "auf", "aus", "nach"]);
/** Kanonische Schreibweise der Abfrage: gleiche Suchen (Groß-/Kleinschreibung, Leerzeichen, Reihenfolge der Wörter und
 *  der ODER-Teile, Füllwörter) ergeben denselben Schlüssel und treffen damit den Zwischenspeicher im Browser und auf dem Server. */
export function canonicalQuery(q: string): string {
  const groups = q
    .split(/[,;|]|\s+oder\s+/i)
    .map((g) => normQ(g).split(/\s+/).filter((w) => w && !FILLER_Q.has(w)))
    .filter((g) => g.length)
    .slice(0, 8)
    .map((g) => g.slice(0, 12));
  return [...new Set(groups.map((g) => [...new Set(g)].sort().join(" ")))].sort().join(", ");
}

export function hasFilters(s: SearchSnapshot): boolean {
  return !!(s.text || s.area || s.radius || s.thema || s.monat || s.von || s.bis || s.status);
}

export interface FilterChip {
  key: "q" | "area" | "more" | "radius" | "thema" | "monat" | "zeitraum" | "status";
  label: string;
  value: string;
  /** bei mehreren Suchbegriffen: der einzelne Begriff dieses Chips; bei weiteren Orten: deren AGS */
  term?: string;
}

/** Anzeigename eines Orts samt Umfang, z. B. „Billerbeck & Kreis Coesfeld“ */
function placeLabel(ags: string, scope: "only" | "with" | undefined, geo: GeoModel | null): string {
  const name = (a: string) => (geo ? geo.info(a).name : a);
  if (!hasScope(ags, geo) || scope !== "with") return name(ags);
  return ags.length === 5 ? `${name(ags)} & Gemeinden` : `${name(ags)} & ${name(ags.slice(0, 5))}`;
}

export function filterChips(s: SearchSnapshot, geo: GeoModel | null): FilterChip[] {
  const name = (ags: string) => (geo ? geo.info(ags).name : ags);
  const out: FilterChip[] = [];
  /* Komma trennt Suchbegriffe; jeder Begriff ist ein eigenes Suchobjekt */
  for (const term of splitTerms(s.text)) out.push({ key: "q", label: "Suche", value: `„${term}“`, term });
  /* Mit Umkreis steht das Gebiet nur als dessen Mittelpunkt im Umkreis-Filter */
  if (s.area && !s.radius) out.push({ key: "area", label: "Gebiet", value: placeLabel(s.area, s.scope, geo) });
  for (const m of s.more || []) out.push({ key: "more", label: "Gebiet", value: placeLabel(m.ags, m.scope, geo), term: m.ags });
  if (s.radius) out.push({ key: "radius", label: "Umkreis", value: `${s.radius.km} km um ${name(s.radius.ags)}` });
  if (s.thema) out.push({ key: "thema", label: "Thema", value: s.thema });
  if (s.monat) out.push({ key: "monat", label: "Zeitraum", value: monthLabel(s.monat) });
  if (s.von || s.bis) out.push({ key: "zeitraum", label: "Zeitraum", value: rangeLabel(s.von, s.bis) });
  if (s.status) out.push({ key: "status", label: "Status", value: STATUS_BY_ID[s.status].label });
  return out;
}

/** Schnellauswahl des Zeitraums. Sie wird als Kürzel in „von“ gespeichert („@d7“, „bis“ leer) und erst bei der Abfrage in
 *  Daten umgerechnet (resolveRange): So bleibt „Letzte 7 Tage“ in gespeicherten Suchen und Benachrichtigungen relativ. */
export interface RangePreset { id: string; label: string; range: () => [string, string] }
const thisYear = () => new Date().getFullYear();
export const RANGE_PRESETS: RangePreset[] = [
  { id: "d7", label: "Letzte 7 Tage", range: () => [todayLocal(-7), todayLocal()] },
  { id: "d30", label: "Letzte 30 Tage", range: () => [todayLocal(-30), todayLocal()] },
  { id: "d91", label: "Letzte 3 Monate", range: () => [todayLocal(-91), todayLocal()] },
  { id: "d365", label: "Letzte 12 Monate", range: () => [todayLocal(-365), todayLocal()] },
  { id: "y0", label: "Dieses Jahr", range: () => [`${thisYear()}-01-01`, `${thisYear()}-12-31`] },
  { id: "y1", label: "Letztes Jahr", range: () => [`${thisYear() - 1}-01-01`, `${thisYear() - 1}-12-31`] },
];
export const presetOf = (von = "") => (von.startsWith("@") ? RANGE_PRESETS.find((p) => "@" + p.id === von) : undefined);
/** Von und bis als Daten (JJJJ-MM-TT): Kürzel der Schnellauswahl umgerechnet, feste Daten unverändert */
export function resolveRange(von = "", bis = ""): [string, string] {
  const p = presetOf(von);
  return p ? p.range() : von.startsWith("@") ? ["", bis] : [von, bis];
}

const deDate = (d: string) => d.split("-").reverse().join(".");
export function rangeLabel(von = "", bis = ""): string {
  const p = presetOf(von);
  if (p) return p.label;
  return von && bis ? `${deDate(von)} – ${deDate(bis)}` : von ? `ab ${deDate(von)}` : `bis ${deDate(bis)}`;
}


/** Umfang ist nur bei Kreisen und kreisangehörigen Gemeinden sinnvoll, nicht bei kreisfreien Städten */
export function hasScope(area: string, geo: GeoModel | null): boolean {
  if (area.length !== 5 && area.length !== 8) return false;
  return !geo?.get(area.slice(0, 5))?.kreisfrei;
}

export function splitTerms(text: string): string[] {
  /* Komma, Semikolon, senkrechter Strich und das Wort „oder“ trennen Alternativen */
  return (text || "").split(/[,;|]|\s+oder\s+/i).map((t) => t.trim()).filter(Boolean);
}

function wherePhrase(name: string): string {
  return (/^(Kreis|Landkreis|Regionalverband|Städteregion|Saarland)\b/.test(name) ? "im " : "in ") + name;
}

export function suggestName(s: SearchSnapshot, geo: GeoModel | null): string {
  const name = (ags: string) => (geo ? geo.info(ags).name : ags);
  const parts: string[] = [];
  if (s.thema) parts.push(s.thema);
  if (s.text) parts.push(`„${s.text}“`);
  if (s.status) parts.push(STATUS_BY_ID[s.status].label);
  let out = parts.join(", ") || "Alle Beschlüsse";
  if (s.radius) out += ` im Umkreis von ${s.radius.km} km um ${name(s.radius.ags)}`;
  else if (s.area) out += " " + wherePhrase(name(s.area));
  if (s.monat) out += ", " + monthLabel(s.monat);
  if (s.von || s.bis) out += ", " + rangeLabel(s.von, s.bis);
  return out.slice(0, 80);
}

