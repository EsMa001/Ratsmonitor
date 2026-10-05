import type { SavedSearch, StatusId } from "../types";
import { STATUS_BY_ID } from "./constants";
import type { GeoModel } from "./geo/geoModel";
import { monthLabel, norm } from "./text";

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
}


/** Signatur einer Suche, um gespeicherte Suchen wiederzuerkennen */
export function signature(s: Pick<SearchSnapshot, "text" | "area" | "radius" | "thema" | "monat" | "von" | "bis" | "status" | "level" | "more"> & { future?: boolean; noformal?: boolean }): string {
  const t = norm(s.text || "").split(/\s+/).filter(Boolean).sort().join(" ");
  const more = (s.more || []).map((m) => `${m.ags}:${m.scope}`).sort().join(",");
  return [t, s.area || "", s.radius ? `${s.radius.ags}@${s.radius.km}` : "", s.thema || "", s.monat || "", (s.von || "") + "~" + (s.bis || ""), s.status || "", s.level || "city", more].join("|") + (s.future ? "|future" : "") + (s.noformal ? "|noformal" : "");
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
export function placeLabel(ags: string, scope: "only" | "with" | undefined, geo: GeoModel | null): string {
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

const deDate = (d: string) => d.split("-").reverse().join(".");
export function rangeLabel(von = "", bis = ""): string {
  return von && bis ? `${deDate(von)} – ${deDate(bis)}` : von ? `ab ${deDate(von)}` : `bis ${deDate(bis)}`;
}

/** Beschriftung des Gebietsumfangs, z. B. „inkl. Gemeinden“ oder „inkl. Kreis Coesfeld“ */
export function scopeLabel(area: string, scope: "only" | "with" = "with", geo: GeoModel | null): string {
  if (!hasScope(area, geo)) return "";
  if (scope === "only") return area.length === 5 ? "nur Kreisebene" : "nur Gemeinde";
  if (area.length === 5) return "inkl. Gemeinden";
  return `inkl. ${geo ? geo.info(area.slice(0, 5)).name : "Kreis"}`;
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

