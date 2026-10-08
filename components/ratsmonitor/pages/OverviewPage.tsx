import { useEffect, useRef } from "react";
import { MapPanel } from "../components/map/MapPanel";
import { SearchFilterPanel } from "../components/SearchFilterPanel";
import { ResultsPanel } from "../components/results/ResultsPanel";
import { useAccount } from "../state/account";
import { overviewScroll } from "../state/nav";
import { useSearch } from "../state/search";

/**
 * Übersicht mit Karte und Ergebnisliste. Bleibt beim Wechsel auf Detail- und Kontoseiten
 * eingehängt (nur ausgeblendet), damit Kartenausschnitt und Zustand erhalten bleiben.
 */
export function OverviewPage({ active }: { active: boolean }) {
  const wasActive = useRef(active);
  const search = useSearch();
  const { saved, ready } = useAccount();
  /* Links aus E-Mails: /?suche=<id> öffnet eine gespeicherte Suche mit allen Einstellungen, /?q=… startet eine Suche */
  const fromMail = useRef<URLSearchParams | null>(typeof location === "undefined" ? null : new URLSearchParams(location.search));
  useEffect(() => {
    const p = fromMail.current;
    if (!p || (!p.get("suche") && !p.get("q")) || (p.get("suche") && !ready)) return;
    const sv = saved.find((x) => x.id === p.get("suche"));
    if (sv ? !search.applySaved(sv) : p.get("q") ? (search.applySearch(p.get("q")!), false) : false) return;
    fromMail.current = null;
    history.replaceState(history.state, "", location.pathname);
  }, [saved, ready, search]);

  useEffect(() => {
    if (active && !wasActive.current) {
      const s = overviewScroll.current;
      overviewScroll.current = null;
      requestAnimationFrame(() => {
        window.scrollTo(0, s ? s.y : 0);
        if (s && overviewScroll.listEl) {
          overviewScroll.listEl.scrollTop = s.list;
          const link = s.id ? overviewScroll.listEl.querySelector<HTMLAnchorElement>(`a[href="/beschluss/${s.id}"]`) : null;
          link?.focus({ preventScroll: true });
        }
      });
    }
    wasActive.current = active;
  }, [active]);

  return (
    <div hidden={!active} className="rm-flat">
      <MapPanel active={active} />
      <main id={active ? "inhalt" : undefined} className="mx-auto flex max-w-page flex-col gap-[12px] pb-0 pt-[12px] max-sm:pt-0">
        {active && <h1 className="sr-only">Kommunalpolitik entdecken: öffentliche Vorgänge, Beratungen und Beschlüsse</h1>}
        <SearchFilterPanel />
        <ResultsPanel />
      </main>
    </div>
  );
}
