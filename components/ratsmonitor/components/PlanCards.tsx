import Link from "next/link";
import { IS_DEV, PRO_PRICE, setTier, TIER_LABEL, useTier, type Tier } from "../lib/tier";

const PLANS: { tier: Tier; price: string; note: string; features: string[] }[] = [
  { tier: "guest", price: "0 €", note: "Ohne Anmeldung", features: ["Suche in allen Gebieten", "10 Treffer je Suche", "Kartenansicht", "Keine Filter", "Nichts speichern"] },
  { tier: "basic", price: "kostenlos", note: "Für den Einstieg", features: ["Alle Treffer deutschlandweit", "Alle Filter", "1 gespeicherter Artikel", "1 gespeicherte Suche", "1 aktive Benachrichtigung"] },
  { tier: "pro", price: PRO_PRICE, note: "inkl. MwSt.", features: ["Alles aus Basic", "Unbegrenzt Artikel speichern", "Unbegrenzt Suchen speichern", "Unbegrenzt Benachrichtigungen"] },
  { tier: "enterprise", price: "auf Anfrage", note: "Für Teams", features: ["Alles aus Pro", "Bis zu 5 E-Mail-Empfänger oder Verteiler je Benachrichtigung"] },
];

/** Tarifübersicht für Konto und Preisseite; in der Entwicklung lässt sich die Stufe im Konto direkt umschalten */
export function PlanCards({ publicPage = false }: { publicPage?: boolean }) {
  const { tier } = useTier();
  return (
    <section id="tarif" aria-labelledby="tarif-title" className={publicPage ? "" : "mt-6 scroll-mt-20"}>
      {!publicPage && <h2 id="tarif-title" className="m-0 text-[18px] font-semibold">Tarif</h2>}
      <div className={`mt-3 grid gap-[12px] ${publicPage ? "sm:grid-cols-2 lg:grid-cols-4" : "md:grid-cols-3"}`}>
        {PLANS.filter((plan) => publicPage || plan.tier !== "guest").map((plan) => {
          const current = !publicPage && plan.tier === tier;
          return (
            <div key={plan.tier} className={`flex flex-col rounded-2xl border bg-white p-5 shadow-card ${current ? "border-teal-600 ring-2 ring-teal-100" : "border-slate-200"}`}>
              <div className="flex items-center justify-between gap-2">
                <h3 className="m-0 text-[16px] font-semibold">{plan.tier === "guest" ? "Ohne Konto" : TIER_LABEL[plan.tier]}</h3>
                {current && <span className="rounded-full bg-teal-600 px-2 py-0.5 text-[11px] font-semibold text-white">Ihr Tarif</span>}
                {publicPage && plan.tier === "pro" && <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-700">Beliebt</span>}
              </div>
              <p className="m-0 mt-2 text-[22px] font-bold tracking-tight">{plan.price}</p>
              <p className="m-0 text-[12px] text-slate-500">{plan.note}</p>
              <ul className="m-0 mt-4 flex-1 list-none space-y-1.5 p-0 text-[13px] text-slate-700">
                {plan.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <span className="text-teal-600">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              {publicPage ? (
                <Link href={plan.tier === "guest" ? "/" : `/registrieren?tarif=${plan.tier === "basic" ? "free" : plan.tier}`} className={plan.tier === "pro" ? "btn-primary mt-4" : "btn-secondary mt-4"}>
                  {plan.tier === "guest" ? "Direkt suchen" : plan.tier === "basic" ? "Kostenlos starten" : plan.tier === "pro" ? "Pro wählen" : "Enterprise anfragen"}
                </Link>
              ) : !current &&
                (IS_DEV ? (
                  <button type="button" onClick={() => setTier(plan.tier)} className={plan.tier === "pro" ? "btn-primary mt-4" : "btn-secondary mt-4"}>
                    {plan.tier === "basic" ? "Basic wählen" : plan.tier === "pro" ? "Auf Pro upgraden" : "Enterprise anfragen"} (Dev)
                  </button>
                ) : (
                  <button type="button" disabled className="btn-secondary mt-4">
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
