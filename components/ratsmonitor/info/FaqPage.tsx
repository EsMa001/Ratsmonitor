import Link from "next/link";
import { useState } from "react";
import { useBrand } from "../lib/brand";
import { DarkCta, PageHead, QaItem } from "./blocks";
import { FAQ } from "./content";

export function FaqPage() {
  const { name } = useBrand();
  /* Fragen und Antworten durchsuchen; Gruppen ohne Treffer werden ausgeblendet */
  const [find, setFind] = useState("");
  const n = find.trim().toLowerCase();
  const groups = FAQ.map((g) => ({ ...g, items: g.items.filter((qa) => !n || (qa.q + " " + (qa.a ?? "")).toLowerCase().includes(n)) })).filter((g) => g.items.length);
  return (
    <>
      <PageHead icon="circleHelp" label="Informationen" name="FAQ" title="Häufige Fragen" lead={`Die wichtigsten Antworten zu ${name}, Alarmen, Tarifen und zur Nutzung im Unternehmen.`} />
      <section className="ri-sec ri-sec--faq">
        <label className="relative mb-8 block max-w-[560px]">
          <span className="sr-only">Fragen durchsuchen</span>
          <input type="search" value={find} onChange={(e) => setFind(e.target.value)} placeholder="Fragen durchsuchen, z. B. Benachrichtigung, Tarif, Team …" className="h-11 w-full rounded-xl border border-transparent bg-[#f8f9fa] px-4 text-[16px] outline-none placeholder:text-slate-400 focus:border-teal-600 focus:bg-white focus:shadow-focus" />
        </label>
        {!groups.length && <p className="text-slate-500">Keine passende Frage gefunden. Schreiben Sie uns gern über die Kontaktseite.</p>}
        {groups.map((g) => (
          <div key={g.group} className="ri-faq-group">
            <h2 className="ri-faq-group__label">{g.group}</h2>
            <div className="ri-faq-list">
              {g.items.map((qa) => (
                <QaItem key={qa.q} qa={qa} />
              ))}
            </div>
          </div>
        ))}
      </section>
      <DarkCta
        title="Ihre Frage war nicht dabei?"
        sub="Schreiben Sie uns, wir antworten in der Regel innerhalb eines Werktags."
        action={
          <Link href="/kontakt" className="ri-btn ri-btn--inv">
            Kontakt aufnehmen
          </Link>
        }
      />
    </>
  );
}
