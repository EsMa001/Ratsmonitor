import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  /* Links auf gespeicherte Suchen (E-Mails): /?suche=<id> öffnet sie mit allen Einstellungen. App.tsx leitet / nach /suche um;
     gelesen wird erst hier, sobald die Übersicht zu sehen ist. Danach schreibt SearchProvider die Suche in die Adresse.
     Alle übrigen Parameter (?q=, ?ort=, …) liest SearchProvider selbst (lib/searchUrl.ts). */
  const params = useSearchParams();
  const router = useRouter();
  const linkId = active ? params.get("suche") : null;
  const handled = useRef("");
  useEffect(() => {
    if (!linkId) {
      handled.current = "";
      return;
    }
    if (handled.current === linkId || !ready) return;
    const sv = saved.find((x) => x.id === linkId);
    if (sv && !search.applySaved(sv)) return;
    handled.current = linkId;
    router.replace("/suche", { scroll: false });
  }, [linkId, saved, ready, search, router]);

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
      <main id={active ? "inhalt" : undefined} className="mx-auto flex max-w-page max-sm:max-w-none flex-col gap-[12px] pb-0 pt-0">
        {active && <h1 className="sr-only">Kommunalpolitik entdecken: öffentliche Vorgänge, Beratungen und Beschlüsse</h1>}
        <SearchFilterPanel />
        <ResultsPanel />
      </main>
    </div>
  );
}
