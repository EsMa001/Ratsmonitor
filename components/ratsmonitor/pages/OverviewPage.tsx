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
  /* Links aus E-Mails und von Lena: /?suche=<id> öffnet eine gespeicherte Suche mit allen Einstellungen, /?q=… startet eine
     Suche. App.tsx leitet / mit diesen Parametern nach /suche um; gelesen wird erst hier, sobald die Übersicht zu sehen ist
     (sonst setzte sie die Suche schon auf / und löschte die Adresse vor der Umleitung). Andere Seiten lesen ?q= selbst
     (Atlas, „Link kopieren“). Jeder Link wirkt einmal; derselbe Link später erneut geöffnet wirkt wieder. */
  const params = useSearchParams();
  const router = useRouter();
  const linkQ = active ? params.get("q") : null;
  const linkId = active ? params.get("suche") : null;
  const handled = useRef("");
  useEffect(() => {
    if (!linkQ && !linkId) {
      handled.current = "";
      return;
    }
    const key = `${linkId}|${linkQ}`;
    if (handled.current === key || (linkId && !ready)) return;
    const sv = linkId ? saved.find((x) => x.id === linkId) : undefined;
    if (sv ? !search.applySaved(sv) : linkQ ? (search.applySearch(linkQ), false) : false) return;
    handled.current = key;
    router.replace("/suche", { scroll: false });
  }, [linkQ, linkId, saved, ready, search, router]);

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
