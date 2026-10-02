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
  status: StatusId | "";
  level?: "city" | "district";
}


/** Signatur einer Suche, um gespeicherte Suchen wiederzuerkennen */
export function signature(s: Pick<SearchSnapshot, "text" | "area" | "radius" | "thema" | "monat" | "von" | "bis" | "status" | "level">): string {
  const t = norm(s.text || "").split(/\s+/).filter(Boolean).sort().join(" ");
  return [t, s.area || "", s.radius ? `${s.radius.ags}@${s.radius.km}` : "", s.thema || "", s.monat || "", (s.von || "") + "~" + (s.bis || ""), s.status || "", s.level || "city"].join("|");
}

export function hasFilters(s: SearchSnapshot): boolean {
  return !!(s.text || s.area || s.radius || s.thema || s.monat || s.von || s.bis || s.status);
}

export interface FilterChip {
  key: "q" | "area" | "radius" | "thema" | "monat" | "zeitraum" | "status";
  label: string;
  value: string;
  /** bei mehreren Suchbegriffen: der einzelne Begriff dieses Chips */
  term?: string;
}

export function filterChips(s: SearchSnapshot, geo: GeoModel | null): FilterChip[] {
  const name = (ags: string) => (geo ? geo.info(ags).name : ags);
  const out: FilterChip[] = [];
  /* Komma trennt Suchbegriffe; jeder Begriff ist ein eigenes Suchobjekt */
  for (const term of splitTerms(s.text)) out.push({ key: "q", label: "Suche", value: `„${term}“`, term });
  if (s.area) out.push({ key: "area", label: "Gebiet", value: hasScope(s.area, geo) && s.scope === "with" ? (s.area.length === 5 ? `${name(s.area)} & Gemeinden` : `${name(s.area)} & ${name(s.area.slice(0, 5))}`) : name(s.area) });
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
  return (text || "").split(/[,;|]/).map((t) => t.trim()).filter(Boolean);
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

