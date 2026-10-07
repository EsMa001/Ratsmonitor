import { useMemo } from "react";
import { REGIONS } from "@/shared/regions";
import { radiusParam } from "@/shared/radius-areas.mjs";
import { useData } from "../../state/data";
import { useSearch, useSearchResults } from "../../state/search";

/** Abfrage für Plenara Analytics: dieselben Suchbegriffe und Filter wie auf der Startseite, Gemeindeebene, ohne Sortierung und Seiten */
export function useAnalyticsQuery() {
  const { geo } = useData();
  const search = useSearch();
  const results = useSearchResults();
  const query = useMemo(() => {
    const p = new URLSearchParams(results.key);
    for (const k of ["around", "sort", "size", "page", "part"]) p.delete(k);
    p.set("level", "city");
    const r = search.state.radius;
    if (r && geo) {
      const set = geo.within(r).set;
      if (!set) p.set("within", "");
      else { const [name, keys] = radiusParam(REGIONS.filter((x) => x.kind === "city"), set, null); p.set(name, keys); }
    }
    return p.toString();
  }, [results.key, search.state.radius, geo]);
  return { query, hasTerm: results.text.trim().length > 0, search };
}
