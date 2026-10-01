import { useEffect, useRef } from "react";
import { MapPanel } from "../components/map/MapPanel";
import { ResultsPanel } from "../components/results/ResultsPanel";
import { overviewScroll } from "../state/nav";

/**
 * Übersicht mit Karte und Ergebnisliste. Bleibt beim Wechsel auf Detail- und Kontoseiten
 * eingehängt (nur ausgeblendet), damit Kartenausschnitt und Zustand erhalten bleiben.
 */
export function OverviewPage({ active }: { active: boolean }) {
  const wasActive = useRef(active);

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
    <div hidden={!active}>
      <MapPanel active={active} />
      <main id={active ? "inhalt" : undefined} className="mx-auto flex max-w-page flex-col gap-4 px-4 pb-8 pt-4 sm:gap-6 sm:px-6 sm:pb-10 sm:pt-6">
        <h1 className="sr-only">Kommunalpolitik entdecken: öffentliche Vorgänge, Beratungen und Beschlüsse</h1>
        <ResultsPanel />
        <p className="m-0 text-center text-[12.5px] text-slate-500">
          Öffentliche Ratsinformationen aus dem gespeicherten Bestand. Kartenflächen bedeuten keine vollständige Datenabdeckung. Verwaltungsgrenzen: © GeoBasis-DE / BKG 2019 (VG250, Stand 31.12.2018),{" "}
          <a href="https://www.govdata.de/dl-de/by-2-0" target="_blank" rel="noopener noreferrer" className="text-slate-600 underline">
            Datenlizenz Deutschland Namensnennung 2.0
          </a>
          , für die Darstellung vereinfacht. Nachbarstaaten: Natural Earth.
        </p>
      </main>
    </div>
  );
}
