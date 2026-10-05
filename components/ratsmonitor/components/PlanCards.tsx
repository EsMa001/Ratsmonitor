import Link from "next/link";
import { useState } from "react";
import { IS_DEV, PRO_PRICE, setTier, TIER_LABEL, useTier, type Tier } from "../lib/tier";

/* Leistungen je Tarif: Text, wenn enthalten (je Stufe auch abweichend), sonst null = grau durchgestrichen */
const FEATURES: { label: string; tiers: Record<Tier, string | null> }[] = [
  { label: "Suche in allen Gebieten", tiers: { guest: "Suche in allen Gebieten", basic: "Suche in allen Gebieten", pro: "Suche in allen Gebieten", enterprise: "Suche in allen Gebieten" } },
  { label: "Alle Treffer", tiers: { guest: "10 Treffer je Suche", basic: "Alle Treffer", pro: "Alle Treffer", enterprise: "Alle Treffer" } },
  { label: "Filter und Umkreis", tiers: { guest: null, basic: "Filter und Umkreis", pro: "Filter und Umkreis", enterprise: "Filter und Umkreis" } },
  { label: "Gespeicherte Suchen", tiers: { guest: null, basic: "1 gespeicherte Suche", pro: "Unbegrenzt gespeicherte Suchen", enterprise: "Unbegrenzt gespeicherte Suchen" } },
  { label: "Gespeicherte Artikel", tiers: { guest: null, basic: "1 gespeicherter Artikel", pro: "Unbegrenzt gespeicherte Artikel", enterprise: "Unbegrenzt gespeicherte Artikel" } },
  { label: "E-Mail-Benachrichtigungen", tiers: { guest: null, basic: "1 aktive Benachrichtigung", pro: "Unbegrenzt Benachrichtigungen", enterprise: "Unbegrenzt Benachrichtigungen" } },
  { label: "Sitzungskalender mit Kalender-Abo", tiers: { guest: null, basic: null, pro: null, enterprise: "Sitzungskalender mit Kalender-Abo" } },
  { label: "Bis zu 5 E-Mail-Empfänger", tiers: { guest: null, basic: null, pro: null, enterprise: "Bis zu 5 E-Mail-Empfänger je Benachrichtigung" } },
];
const PLANS: { tier: Tier; price: string; note: string }[] = [
  { tier: "guest", price: "0 €", note: "Ohne Anmeldung" },
  { tier: "basic", price: "kostenlos", note: "Für den Einstieg" },
  { tier: "pro", price: PRO_PRICE, note: "inkl. MwSt." },
  { tier: "enterprise", price: "49,99 € / Monat", note: "inkl. MwSt. · für Teams" },
];

/* Wie im übrigen Design: schwarze Pille mit Pfeil für die Hauptaktion, sonst Petrol-Text mit Pfeil */
const PRIMARY = "mt-5 inline-flex h-11 items-center justify-center gap-2 self-start rounded-full bg-slate-900 px-5 text-[14px] font-medium text-white no-underline transition-opacity after:content-['→'] hover:opacity-85";
const SECONDARY = "mt-5 inline-flex h-11 items-center gap-1.5 self-start text-[14px] font-medium text-teal-600 no-underline after:content-['→'] after:transition-transform hover:after:translate-x-0.5 disabled:text-slate-400 disabled:after:content-none";

/** Tarifübersicht für Konto und Preisseite; in der Entwicklung lässt sich die Stufe im Konto direkt umschalten */
export function PlanCards({ publicPage = false }: { publicPage?: boolean }) {
  const { tier } = useTier();
  /* Handy: ein Tarif auf einmal, Auswahl über Reiter (kein seitliches Wischen) */
  const [pick, setPick] = useState<Tier>(publicPage ? "pro" : tier);
  return (
    <section id="tarif" aria-labelledby="tarif-title" className={publicPage ? "" : "mt-6 scroll-mt-20"}>
      {!publicPage && <h2 id="tarif-title" className="m-0 text-[18px] font-semibold">Tarif</h2>}
      <div role="tablist" aria-label="Tarif wählen" className="mt-3 flex border-b border-slate-200 sm:hidden">
        {PLANS.map((p) => (
          <button key={p.tier} type="button" role="tab" aria-selected={pick === p.tier} onClick={() => setPick(p.tier)} className={`-mb-px flex-1 border-b-2 py-2.5 text-[14px] ${pick === p.tier ? "border-teal-600 font-semibold text-teal-600" : "border-transparent text-slate-500"}`}>
            {p.tier === "guest" ? "Gast" : TIER_LABEL[p.tier]}
          </button>
        ))}
      </div>
      <div className="mt-3 grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
        {PLANS.map((plan) => {
          const current = !publicPage && plan.tier === tier;
          return (
            <div key={plan.tier} className={`${pick === plan.tier ? "flex" : "hidden sm:flex"} flex-col border-t-2 pb-2 pt-5 lg:pr-2 ${current ? "border-teal-600" : plan.tier === "pro" && publicPage ? "border-slate-900" : "border-slate-200"}`}>
              <div className="flex items-center justify-between gap-2">
                <h3 className="m-0 text-[16px] font-semibold">{plan.tier === "guest" ? "Ohne Konto" : TIER_LABEL[plan.tier]}</h3>
                {current && <span className="rounded-full bg-teal-600 px-2 py-0.5 text-[12px] font-semibold text-white">{plan.tier === "guest" ? "Ihr Status" : "Ihr Tarif"}</span>}
                {publicPage && plan.tier === "pro" && <span className="text-[12px] font-semibold text-teal-600">Beliebt</span>}
              </div>
              <p className="m-0 mt-2 text-[22px] font-bold tracking-tight">{plan.price}</p>
              <p className="m-0 text-[12px] text-slate-500">{plan.note}</p>
              <ul className="m-0 mt-4 flex-1 list-none space-y-1.5 p-0 text-[14px]">
                {FEATURES.map((f) => {
                  const text = f.tiers[plan.tier];
                  return text ? (
                    <li key={f.label} className="flex gap-2 text-slate-900">
                      <span aria-hidden="true" className="text-teal-600">✓</span>
                      {text}
                    </li>
                  ) : (
                    /* Nicht enthalten: grau und durchgestrichen */
                    <li key={f.label} className="flex gap-2 text-slate-400">
                      <span aria-hidden="true">✕</span>
                      <span className="line-through">{f.label}</span>
                      <span className="sr-only">(nicht enthalten)</span>
                    </li>
                  );
                })}
              </ul>
              {publicPage ? (
                <Link href={plan.tier === "guest" ? "/" : `/registrieren?tarif=${plan.tier === "basic" ? "free" : plan.tier}`} className={plan.tier === "pro" ? PRIMARY : SECONDARY}>
                  {plan.tier === "guest" ? "Direkt suchen" : plan.tier === "basic" ? "Kostenlos starten" : plan.tier === "pro" ? "Pro wählen" : "Enterprise wählen"}
                </Link>
              ) : !current &&
                (IS_DEV ? (
                  <button type="button" onClick={() => setTier(plan.tier)} className={plan.tier === "pro" ? PRIMARY : SECONDARY}>
                    {plan.tier === "guest" ? "Abmelden" : plan.tier === "basic" ? "Basic wählen" : plan.tier === "pro" ? "Auf Pro upgraden" : "Enterprise anfragen"} (Dev)
                  </button>
                ) : plan.tier === "guest" ? null : tier === "guest" ? (
                  <Link href={`/registrieren?tarif=${plan.tier === "basic" ? "free" : plan.tier}`} className={plan.tier === "pro" ? PRIMARY : SECONDARY}>
                    {plan.tier === "basic" ? "Kostenlos registrieren" : plan.tier === "pro" ? "Pro wählen" : "Enterprise anfragen"}
                  </Link>
                ) : (
                  <button type="button" disabled className={SECONDARY}>
                    Bald verfügbar
                  </button>
                ))}
            </div>
          );
        })}
      </div>
    </section>
  );
}
