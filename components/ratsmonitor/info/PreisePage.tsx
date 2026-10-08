import Link from "next/link";
import { DarkCta, PageHead, QaItem } from "./blocks";
import { PRICE_FAQ } from "./content";
import { LIMITS, PRO_PRICE, TIER_LABEL, type Tier } from "../lib/tier";
import { PlanCards } from "../components/PlanCards";

const TIERS: Tier[] = ["guest", "basic", "pro", "enterprise"];
const count = (n: number) => (n === 0 ? "–" : n > 1 ? `bis zu ${n}` : String(n));
const COMPARE_ROWS: [string, (t: Tier) => string][] = [
  ["Preis", (t) => (t === "guest" ? "0 €" : t === "basic" ? "0 €" : t === "pro" ? PRO_PRICE : "49,99 € / Monat")],
  ["Treffer je Suche", (t) => (Number.isFinite(LIMITS[t].maxResults) ? String(LIMITS[t].maxResults) : "alle")],
  ["Filter (Gebiet, Zeitraum, Thema, Status)", (t) => (LIMITS[t].filters ? "✓" : "–")],
  ["Gespeicherte Suchen", (t) => count(LIMITS[t].savedSearches)],
  ["Gespeicherte Artikel", (t) => count(LIMITS[t].bookmarks)],
  ["Aktive Benachrichtigungen", (t) => count(LIMITS[t].notifications)],
  ["Sitzungskalender mit Kalender-Abo", (t) => (LIMITS[t].calendar ? "✓" : "–")],
  ["Plenara.X (Analysen)", (t) => (t === "enterprise" ? "✓" : "–")],
  ["E-Mail-Empfänger je Benachrichtigung", (t) => (LIMITS[t].emails > 1 ? `bis zu ${LIMITS[t].emails}` : count(LIMITS[t].emails))],
];

export function PreisePage() {
  return (
    <>
      <PageHead
        icon="tag"
        label="Informationen"
        name="Preise"
        title={
          <>
            Einfache Preise.
            <br />
            Jederzeit kündbar.
          </>
        }
        lead="Früher wissen, was vor Ort beraten wird: Durchsuchen Sie die Ratsinformationssysteme der Kommunen und lassen Sie sich per E-Mail informieren, sobald zu Ihrem Thema etwas auf der Tagesordnung steht oder beschlossen wird. Plenara.X mit den Analysen ist Teil von Enterprise."
      />
      <section className="ri-sec ri-sec--prices">
        {/* Gleiche Tarifkarten wie im Konto */}
        <PlanCards publicPage />

        {/* Vergleichstabelle nur ab Tablet; am Handy zeigen die Tarif-Reiter dieselben Leistungen */}
        <div className="hidden sm:block">
        <h2 className="ri-h2 ri-h2--md ri-h2--gap">Alle Leistungen im Vergleich</h2>
        {/* Aus denselben Tarif-Grenzen wie die Karten erzeugt (lib/tier.ts), damit beides übereinstimmt */}
        <div className="-mx-4 overflow-x-auto px-4">
        <table className="ri-table">
          <thead>
            <tr>
              <th className="ri-table__first">
                <span className="sr-only">Leistung</span>
              </th>
              {TIERS.map((t) => (
                <th key={t} scope="col">
                  {t === "guest" ? "Ohne Konto" : TIER_LABEL[t]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COMPARE_ROWS.map(([label, cell]) => (
              <tr key={label}>
                <th scope="row">{label}</th>
                {TIERS.map((t) => (
                  <td key={t}>{cell(t)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        </div>

        <h2 className="ri-h2 ri-h2--md ri-h2--gap">Fragen zu Preisen</h2>
        <div className="ri-faq-list ri-faq-list--top">
          {PRICE_FAQ.map((qa) => (
            <QaItem key={qa.q} qa={qa} />
          ))}
        </div>
      </section>
      <DarkCta
        title="Starten Sie kostenlos"
        sub="Ohne Zahlungsdaten. Upgrade jederzeit möglich."
        action={
          <Link href="/registrieren?tarif=free" className="ri-btn ri-btn--inv">
            Konto erstellen
          </Link>
        }
      />
    </>
  );
}
