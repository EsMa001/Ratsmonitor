import { useEffect, useState } from "react";
import Link from "next/link";
import { useBrand, useBrandText } from "../lib/brand";
import { DarkCta, PageHead, PlacePill, StatusPill, useOpenSearch } from "./blocks";
import type { Status } from "./content";
import { Icon } from "./icons";

/* TODO: fiktive Beispiel-Treffer (Doku Kap. 8) */
const HITS: { place: string; status: Status; title: string; meta: string }[] = [
  { place: "Lindenau", status: "ok", title: "Aufstellungsbeschluss zum Bebauungsplan Nr. 14 „Am Mühlgraben“", meta: "Bauausschuss · 24.09.26" },
  { place: "Birkenfeld-Ost", status: "ok", title: "Kommunale Wärmeplanung: Eignungsgebiete für Fernwärme festgelegt", meta: "Gemeinderat · 17.09.26" },
  { place: "Rothenfels", status: "wait", title: "Neues Radwegekonzept und Änderung der Parkraumbewirtschaftung", meta: "Hauptausschuss · 10.09.26" },
];

/* Echte Zahlen zur Abdeckung (aus /api/sources), keine festen Werbezahlen */
function useCoverageStats(): [string, string][] {
  const [t, setT] = useState<{ withArticles: number; connected: number; articles: number; areas: number } | null>(null);
  useEffect(() => {
    fetch("/api/sources")
      .then((r) => r.json() as Promise<{ totals?: { withArticles: number; connected: number; articles: number; areas: number } }>)
      .then((d) => d.totals && setT(d.totals))
      .catch(() => {});
  }, []);
  const n = (v?: number) => (v == null ? "…" : v.toLocaleString("de-DE"));
  return [
    [n(t?.articles), "Vorgänge in einer Suche"],
    [n(t?.withArticles), "Kommunen und Kreise mit Daten"],
    [n(t?.areas), "Gebiete auswählbar, laufend erweitert"],
  ];
}

const POINTS: [string, string][] = [
  ["Informationsvorsprung", "Sie sehen Entscheidungen, sobald sie auf einer Tagesordnung stehen, nicht erst, wenn sie in der Zeitung sind."],
  ["Ganz Deutschland im Blick", "Märkte, Standorte und Wettbewerber über Kommunengrenzen hinweg beobachten."],
  ["Innovation mitgestalten", "Als früher Nutzer profitieren Sie als Erste von neuen Funktionen und prägen mit Ihrem Feedback, wie Ratsmonitor wächst."],
];

/* Suchbegriffe zu den Beispielen: ein Klick startet eine echte Suche */
const HIT_TERMS = ["Bebauungsplan", "Wärmeplanung", "Radweg"];

function SearchPreview() {
  const openSearch = useOpenSearch();
  const [q, setQ] = useState("");
  return (
    <div className="ri-pv2" aria-label="Suche ausprobieren">
      <form
        className="ri-pv2__search"
        onSubmit={(e) => {
          e.preventDefault();
          openSearch(q.trim());
        }}
      >
        <Icon name="search" size={14} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Suche nach Titel, Thema oder Ort …" aria-label="Suche ausprobieren" className="min-w-0 flex-1 border-0 bg-transparent text-inherit outline-none" />
      </form>
      {HITS.map((h, i) => (
        <button key={h.title} type="button" onClick={() => openSearch(HIT_TERMS[i] ?? h.title)} className="ri-pv2__item w-full cursor-pointer text-left hover:bg-slate-50">
          <div className="ri-pv2__row">
            <PlacePill place={h.place} />
            <StatusPill status={h.status} />
          </div>
          <p className="ri-pv2__h">{h.title}</p>
          <span className="ri-pv2__meta">{h.meta}</span>
        </button>
      ))}
      <span className="ri-pv__foot">Beispiele mit fiktiven Daten. Ein Klick sucht im echten Bestand.</span>
    </div>
  );
}

export function AboutPage() {
  const openSearch = useOpenSearch();
  const { name } = useBrand();
  const brandText = useBrandText();
  const STATS = useCoverageStats();
  return (
    <>
      <PageHead
        icon="search"
        label="Funktionen"
        name="Suche"
        title={
          <>
            Kommunale Entscheidungen.
            <br />
            Endlich durchsuchbar.
          </>
        }
        lead={`Eine Suche statt hunderter Ratsinformationssysteme: ${name} durchsucht alle angebundenen Kommunen gleichzeitig, nach Begriff, Ort, Umkreis, Thema, Zeitraum und Stand. Was früher Tage dauerte, dauert jetzt Sekunden.`}
        aside={<SearchPreview />}
      >
        <div className="ri-actions">
          <button type="button" className="ri-btn ri-btn--dark" onClick={() => openSearch()}>
            Suche starten
          </button>
          <Link href="/preise" className="ri-btn ri-btn--light">
            Preismodelle ansehen
          </Link>
        </div>
      </PageHead>

      <section className="ri-sec">
        <div className="ri-stats">
          {STATS.map(([n, l]) => (
            <div key={l} className="ri-stat">
              <span className="ri-stat__num">{n}</span>
              <span className="ri-stat__lab">{l}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="ri-sec">
        <div className="ri-two">
          <h2 className="ri-h2">Die Datenbank der kommunalen Entscheidungen</h2>
          <p>
            Jede Kommune veröffentlicht ihre Beschlüsse anders. Unsere Technologie sammelt sie laufend ein, ordnet sie nach Ort, Thema und Gremium und macht sie in Sekunden
            auffindbar. Was früher Tage an Recherche bedeutete, ist jetzt eine Suche.
          </p>
        </div>
      </section>

      <section className="ri-sec">
        <h2 className="ri-h2">Früher wissen, schneller handeln</h2>
        <div className="ri-points">
          {POINTS.map(([t, p], i) => (
            <div key={t} className="ri-point">
              <span className="ri-point__num">0{i + 1}</span>
              <h3>{t}</h3>
              <p>{brandText(p)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="ri-sec">
        <div className="ri-mint">
          <div>
            <h2 className="ri-h2">Demokratie lebt vom Mitlesen</h2>
            <p>
              Kommunale Entscheidungen betreffen alle. Deshalb gibt es {name} bewusst auch kostenlos: Jede Bürgerin und jeder Bürger soll nachvollziehen können, was vor Ort
              beschlossen wird, und sich einbringen können, bevor entschieden ist.
            </p>
          </div>
          <Link href="/preise" className="ri-btn ri-btn--light">
            Kostenlose Version ansehen
          </Link>
        </div>
      </section>

      <DarkCta
        title="Welche Beschlüsse zählen in Ihrer Branche?"
        sub="Acht Branchen, jeweils mit typischem Ablauf und passenden Suchbegriffen."
        action={
          <Link href="/branchen/immobilien" className="ri-btn ri-btn--inv">
            Zu den Use Cases
          </Link>
        }
      />
    </>
  );
}
