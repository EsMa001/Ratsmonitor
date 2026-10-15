import type { GeoModel } from "./geo/geoModel";

/** Gebiet des Sitzungskalenders: Ort oder Kreis, optional mit Umkreis in km */
export interface CalArea {
  ags: string;
  name: string;
  km: number;
}

/** Alle Gebietsschlüssel inkl. Umkreis, jeweils dem eigenen Gebiet (Index, für die Farbe) zugeordnet.
 *  Ohne Karte (geo null) nur die Gebiete selbst; den Umkreis rechnet der Browser, der Server übernimmt die Liste. */
export function areaOwners(areas: CalArea[], geo: GeoModel | null): Map<string, number> {
  const out = new Map<string, number>();
  areas.forEach((a, i) => {
    if (!out.has(a.ags)) out.set(a.ags, i);
    if (a.km && geo) {
      const c = geo.center(a.ags);
      if (c) geo.within({ x: c.x, y: c.y, km: a.km }).set.forEach((x) => !out.has(x) && out.set(x, i));
    }
  });
  return out;
}

/** Schlüsselliste für das Kalender-Abo (calendarAgs), höchstens 200 wie auf dem Server */
export const calendarAgs = (areas: CalArea[], geo: GeoModel | null): string[] => [...areaOwners(areas, geo).keys()].slice(0, 200);

/** Gebiete aus beliebigem JSON (Browser-Speicher, Datei, Server) */
export function cleanAreas(v: unknown): CalArea[] {
  return Array.isArray(v)
    ? v
        .filter((a) => a && typeof a === "object" && /^\d{2,12}$/.test(String((a as CalArea).ags)))
        .map((a) => ({ ags: String((a as CalArea).ags), name: typeof (a as CalArea).name === "string" ? (a as CalArea).name : String((a as CalArea).ags), km: Number.isFinite((a as CalArea).km) ? Number((a as CalArea).km) : 0 }))
    : [];
}
