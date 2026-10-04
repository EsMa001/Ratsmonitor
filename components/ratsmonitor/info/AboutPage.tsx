import Link from "next/link";
import { useBrand, useBrandText } from "../lib/brand";
import { DarkCta, PageHead, PlacePill, StatusPill, useOpenSearch } from "./blocks";
import type { Status } from "./content";
import { Icon } from "./icons";

/* TODO: fiktive Beispiel-Treffer (Doku Kap. 8) */
const HITS: { place: string; status: Status; title: string; meta: string }[] = [
  { place: "Lindenau", status: "ok", title: "Aufstellungsbeschluss zum Bebauungsplan Nr. 14 „Am Mühlgraben“", meta: "Bauausschuss · 24.09.2026" },
  { place: "Birkenfeld-Ost", status: "ok", title: "Kommunale Wärmeplanung: Eignungsgebiete für Fernwärme festgelegt", meta: "Gemeinderat · 17.09.2026" },
  { place: "Rothenfels", status: "wait", title: "Neues Radwegekonzept und Änderung der Parkraumbewirtschaftung", meta: "Hauptausschuss · 10.09.2026" },
];

/* TODO: „4.500+“ und „16 Bundesländer“ bestätigen (Doku Kap. 8) */
const STATS: [string, string][] = [
  ["4.500+", "Ratsinformationssysteme"],
  ["16", "Bundesländer"],
  ["1", "Suche für alles"],
];

const POINTS: [string, string][] = [
  ["Informationsvorsprung", "Sie sehen Entscheidungen, sobald sie auf einer Tagesordnung stehen, nicht erst, wenn sie in der Zeitung sind."],
  ["Ganz Deutschland im Blick", "Märkte, Standorte und Wettbewerber über Kommunengrenzen hinweg beobachten."],
  ["Innovation mitgestalten", "Als früher Nutzer profitieren Sie als Erste von neuen Funktionen und prägen mit Ihrem Feedback, wie Ratsmonitor wächst."],
];

function SearchPreview() {
  return (
    <div className="ri-pv2" aria-label="Beispiel einer Suche">
      <div className="ri-pv2__search">
        <Icon name="search" size={14} />
        Suche nach Titel, Thema oder Ort …
      </div>
      {HITS.map((h) => (
        <div key={h.title} className="ri-pv2__item">
          <div className="ri-pv2__row">
            <PlacePill place={h.place} />
            <StatusPill status={h.status} />
          </div>
          <p className="ri-pv2__h">{h.title}</p>
          <span className="ri-pv2__meta">{h.meta}</span>
        </div>
      ))}
      <span className="ri-pv__foot">Beispiel mit fiktiven Daten</span>
    </div>
  );
}

export function AboutPage() {
  const openSearch = useOpenSearch();
  const { name } = useBrand();
  const brandText = useBrandText();
  return (
    <>
      <PageHead
        icon="landmark"
        label={name}
        name={`Über ${name}`}
        title={
          <>
            Kommunale Entscheidungen.
            <br />
            Endlich durchsuchbar.
          </>
        }
        lead={`${name} ist ein Tech-Startup. Wir machen aus tausenden verstreuten Ratsinformationssystemen eine einzige, intelligente Datenbank.`}
        aside={<SearchPreview />}
      >
        <div className="ri-actions">
          <button type="button" className="ri-btn ri-btn--dark" onClick={() => openSearch()}>
            Suche starten
          </button>
          <Link href="/branchen" className="ri-btn ri-btn--light">
            Branchen ansehen
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
            Free-Version ansehen
          </Link>
        </div>
      </section>

      <DarkCta
        title="Welche Beschlüsse zählen in Ihrer Branche?"
        sub="Acht Branchen, jeweils mit typischem Ablauf und passenden Suchbegriffen."
        action={
          <Link href="/branchen" className="ri-btn ri-btn--inv">
            Zu den Branchen
          </Link>
        }
      />
    </>
  );
}
