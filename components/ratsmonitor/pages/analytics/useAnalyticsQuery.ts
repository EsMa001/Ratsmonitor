import { useEffect, useMemo, useRef } from "react";
import { useCatalog } from "../../lib/catalog";
import { radiusParam } from "@/shared/radius-areas.mjs";
import { useData } from "../../state/data";
import { useSearch, useSearchResults } from "../../state/search";
import { useSearchParams } from "next/navigation";
import { SUBTOPICS, THEMES } from "@/shared/themes.mjs";

/** Abfrage für plenara.X: dieselben Suchbegriffe und Filter wie auf der Startseite, Gemeindeebene, ohne Sortierung und Seiten */
export function useAnalyticsQuery() {
  const { geo } = useData();
  const search = useSearch();
  const results = useSearchResults();
  /* Katalog nur mit Umkreis laden; bis er da ist, fragt die Seite ohne die Umkreisgrenze (wenige 100 ms) */
  const regions = useCatalog(!!search.state.radius);
  /* Unterthema aus der Adresse (Themenleiste, ?sub=): nur wenn es zum gewählten Thema gehört */
  const subRaw = useSearchParams().get("sub") ?? "";
  const subTheme = SUBTOPICS.find((s: { id: string }) => s.id === subRaw)?.theme;
  const sub = subTheme && THEMES.find((t: { id: string }) => t.id === subTheme)?.name === search.state.thema ? subRaw : "";
  const query = useMemo(() => {
    const p = new URLSearchParams(results.key);
    for (const k of ["around", "sort", "size", "page", "part"]) p.delete(k);
    p.set("level", "city");
    if (sub) p.set("sub", sub);
    const r = search.state.radius;
    if (r && geo && regions) {
      const set = geo.within(r).set;
      if (!set) p.set("within", "");
      else { const [name, keys] = radiusParam(regions.filter((x) => x.kind === "city"), set, null); p.set(name, keys); }
    }
    return p.toString();
  }, [results.key, search.state.radius, geo, regions, sub]);
  useSearchHistory(search);
  return { query, hasTerm: results.text.trim().length > 0, search };
}

/**
 * Zurück-Taste auf den plenara.X-Seiten: Ort, Suchbegriff und Filter stehen nicht in der Adresse, sondern in der gemeinsamen
 * Suche. Ändert sich der Suchstand, entsteht ein Verlaufseintrag mit derselben Adresse (Stand in history.state.rmX); Zurück
 * stellt den vorherigen Stand wieder her, statt die Seite zu verlassen. Schnelle Folgen (unter 1 s, etwa Tippen) ergeben einen
 * Eintrag. history.state wird ergänzt, nie ersetzt (der Router speichert dort seinen Stand).
 */
function useSearchHistory(search: ReturnType<typeof useSearch>) {
  const key = JSON.stringify(search.state);
  const last = useRef<string | null>(null), restoring = useRef(false), timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const st = (history.state ?? {}) as { rmX?: string };
    if (last.current === null) {
      /* Zurück auf einen Eintrag dieser Seite mit eigenem Stand: diesen wiederherstellen */
      if (st.rmX && st.rmX !== key) {
        last.current = st.rmX;
        restoring.current = true;
        try { search.restoreState(JSON.parse(st.rmX)); return; } catch { restoring.current = false; }
      }
      /* Erster Aufruf: Stand an den Eintrag hängen (wer hierher zurückkommt, bekommt ihn wieder) */
      last.current = key;
      history.replaceState({ ...history.state, rmX: key }, "", location.href);
      return;
    }
    if (restoring.current) { if (key === last.current) restoring.current = false; else { restoring.current = false; last.current = key; } return; }
    if (key === last.current || st.rmX === key) return;
    const push = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; history.pushState({ ...history.state, rmX: key }, "", location.href); last.current = key; };
    /* Nur getippt (Begriff, im Text erkannter Ort): erst nach 1,5 s Ruhe ein Eintrag; gewählter Ort, Filter usw. sofort */
    let onlyText = false;
    try {
      const a = JSON.parse(last.current), b = JSON.parse(key);
      /* Beim Tippen erkennt die Suche Orte im Text (areaSrc "search"): das gehört noch zum Tippen */
      const typed = new Set(["q", ...(b.areaSrc === "search" ? ["area", "areaSrc", "level", "scope"] : [])]);
      onlyText = Object.keys({ ...a, ...b }).every((k) => typed.has(k) || JSON.stringify(a[k]) === JSON.stringify(b[k]));
    } catch { /* dann sofort */ }
    if (timer.current) clearTimeout(timer.current);
    if (onlyText) timer.current = setTimeout(push, 1500); else push();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  useEffect(() => {
    const onPop = () => {
      const st = (history.state ?? {}) as { rmX?: string };
      if (timer.current) { clearTimeout(timer.current); timer.current = null; }
      if (!st.rmX || st.rmX === last.current) return;
      restoring.current = true;
      try { search.restoreState(JSON.parse(st.rmX)); } catch { restoring.current = false; }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [search]);
}
