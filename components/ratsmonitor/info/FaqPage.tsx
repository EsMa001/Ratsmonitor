import Link from "next/link";
import { useBrand } from "../lib/brand";
import { PageHead, QaItem } from "./blocks";
import { FAQ } from "./content";

export function FaqPage() {
  const { name } = useBrand();
  return (
    <>
      <PageHead icon="circleHelp" label="Hilfe" name="FAQ" title="Häufige Fragen" lead={`Die wichtigsten Antworten zu ${name}, Alarmen, Tarifen und zur Nutzung im Unternehmen.`} />
      <section className="ri-sec ri-sec--faq">
        {FAQ.map((g) => (
          <div key={g.group} className="ri-faq-group">
            <h2 className="ri-faq-group__label">{g.group}</h2>
            <div className="ri-faq-list">
              {g.items.map((qa) => (
                <QaItem key={qa.q} qa={qa} />
              ))}
            </div>
          </div>
        ))}
        <div className="ri-darkbox">
          <div>
            <h2>Ihre Frage war nicht dabei?</h2>
            <p>Schreiben Sie uns, wir antworten in der Regel innerhalb eines Werktags.</p>
          </div>
          <Link href="/kontakt" className="ri-btn ri-btn--inv">
            Kontakt aufnehmen ›
          </Link>
        </div>
      </section>
    </>
  );
}
