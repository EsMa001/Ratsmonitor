import type { Article, StatusId } from "../types";

export interface FilterSpec {
  area: string;
  radiusSet: Set<string> | null;
  thema: string;
  monat: string;
  status: StatusId | "";
  terms: string[];
}

export type FilterKey = "area" | "thema" | "monat" | "status";

/** Prüft einen Beschluss gegen alle Filter; `skip` lässt einen Filter aus (für die Zähler der Auswahllisten) */
export function matches(a: Article, f: FilterSpec, skip?: FilterKey): boolean {
  if (skip !== "area" && f.area && !a.ags.startsWith(f.area)) return false;
  if (f.radiusSet && !f.radiusSet.has(a.ags)) return false;
  if (skip !== "thema" && f.thema && a.thema !== f.thema) return false;
  if (skip !== "monat" && f.monat && a.month !== f.monat) return false;
  if (skip !== "status" && f.status && a.status !== f.status) return false;
  for (const t of f.terms) if (!a.hay.includes(t)) return false;
  return true;
}

/** Zählt einen Treffer für Gemeinde, Kreis, Land und Gesamt */
export function addCount(obj: Record<string, number>, ags: string) {
  for (const k of new Set([ags, ags.slice(0, 5), ags.slice(0, 2), ""])) obj[k] = (obj[k] || 0) + 1;
}

export function countBy(articles: Article[], f: FilterSpec, key: FilterKey, field: (a: Article) => string): Record<string, number> {
  const c: Record<string, number> = {};
  for (const a of articles) if (matches(a, f, key)) c[field(a)] = (c[field(a)] || 0) + 1;
  return c;
}
