import Link from "next/link";
import { DarkCta, PageHead, QaItem } from "./blocks";
import { PRICE_FAQ } from "./content";
import { LIMITS, priceLabel, TIER_LABEL, type Tier } from "../lib/tier";
import { usePlusLink } from "../lib/booking";
import { PlanCards } from "../components/PlanCards";

/* Angebotene Stufen; Enterprise gibt es noch nicht (später KI, Team, Schnittstelle) */
const TIERS: Tier[] = ["guest", "basic", "pro"];
const count = (n: number) => (n === 0 ? "–" : n > 1 ? `bis zu ${n}` : String(n));
const COMPARE_ROWS: [string, (t: Tier) => string][] = [
  ["Preis", priceLabel],
  ["Ganz Deutschland: alle Gebiete mit Daten", () => "✓"],
  ["Treffer je Suche", (t) => (Number.isFinite(LIMITS[t].maxResults) ? String(LIMITS[t].maxResults) : "alle")],
  ["Filter (Gebiet, Zeitraum, Thema, Status)", (t) => (LIMITS[t].filters ? "✓" : "–")],
  ["Meine Suchen", (t) => count(LIMITS[t].savedSearches)],
  ["Gespeicherte Artikel", (t) => count(LIMITS[t].bookmarks)],
  ["Aktive Benachrichtigungen", (t) => count(LIMITS[t].notifications)],
  ["E-Mails sofort (sonst täglich oder wöchentlich)", (t) => (LIMITS[t].instant ? "✓" : "–")],
  ["Sitzungskalender mit Kalender-Abo", (t) => (LIMITS[t].calendar ? "✓" : "–")],
  ["plenara.X (Analysen)", (t) => (t === "pro" || t === "enterprise" ? "✓" : "–")],
];

export function PreisePage() {
  /* Mit Bezahlung führt Plus zur Buchung (lib/booking.ts), sonst zur Anfrage */
  const plus = usePlusLink();
  return (
    <>
      <PageHead
        icon="tag"
        label="Informationen"
        name="Preise"
        title="Die Stufen im Überblick."
        lead={`Kostenlos suchen und lesen, für ganz Deutschland. Plus für 2,99 € im Monat, monatlich kündbar.${plus.book ? "" : " In der Testphase schalten wir Plus auf Anfrage frei."}`}
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
        title={plus.book ? "Plus für 2,99 € im Monat" : "Plenara in der Testphase"}
        sub={plus.book ? "Das Konto ist kostenlos. Plus buchen Sie direkt hier: anmelden oder kostenlos registrieren, dann bezahlen. Monatlich kündbar." : "Das Konto ist kostenlos. Plus schalten wir in der Testphase auf Anfrage frei, bis die Bezahlung angebunden ist."}
        action={
          <Link href={plus.href} className="ri-btn ri-btn--inv">
            {plus.label}
          </Link>
        }
      />
    </>
  );
}
