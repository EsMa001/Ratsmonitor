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
  status: StatusId | "";
  level?: "city" | "district";
}


/** Signatur einer Suche, um gespeicherte Suchen wiederzuerkennen */
export function signature(s: Pick<SearchSnapshot, "text" | "area" | "radius" | "thema" | "monat" | "status" | "level">): string {
  const t = norm(s.text || "").split(/\s+/).filter(Boolean).sort().join(" ");
  return [t, s.area || "", s.radius ? `${s.radius.ags}@${s.radius.km}` : "", s.thema || "", s.monat || "", s.status || "", s.level || "city"].join("|");
}

export function hasFilters(s: SearchSnapshot): boolean {
  return !!(s.text || s.area || s.radius || s.thema || s.monat || s.status);
}

export interface FilterChip {
  key: "q" | "area" | "radius" | "thema" | "monat" | "status";
  label: string;
  value: string;
}

export function filterChips(s: SearchSnapshot, geo: GeoModel | null): FilterChip[] {
  const name = (ags: string) => (geo ? geo.info(ags).name : ags);
  const out: FilterChip[] = [];
  if (s.text) out.push({ key: "q", label: "Suche", value: `„${s.text}“` });
  if (s.area) out.push({ key: "area", label: "Gebiet", value: name(s.area) });
  if (s.radius) out.push({ key: "radius", label: "Umkreis", value: `${s.radius.km} km um ${name(s.radius.ags)}` });
  if (s.thema) out.push({ key: "thema", label: "Thema", value: s.thema });
  if (s.monat) out.push({ key: "monat", label: "Zeitraum", value: monthLabel(s.monat) });
  if (s.status) out.push({ key: "status", label: "Status", value: STATUS_BY_ID[s.status].label });
  return out;
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
  return out.slice(0, 80);
}

