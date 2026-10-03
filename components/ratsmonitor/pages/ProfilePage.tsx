import { useEffect, useState } from "react";
import { useAccount } from "../state/account";
import { useToast } from "../state/toast";
import type { NotifyFreq } from "../types";
import { IS_DEV, PRO_PRICE, setTier, TIER_LABEL, useTier, type Tier } from "../lib/tier";
import { LoginRequired } from "../components/TierNotice";

const PLANS: { tier: Exclude<Tier, "guest">; price: string; note: string; features: string[] }[] = [
  { tier: "basic", price: "kostenlos", note: "Für den Einstieg", features: ["Alle Treffer deutschlandweit", "Alle Filter", "1 gespeicherter Artikel", "1 gespeicherte Suche", "1 aktive Benachrichtigung"] },
  { tier: "pro", price: PRO_PRICE, note: "inkl. MwSt.", features: ["Alles aus Basic", "Unbegrenzt Artikel speichern", "Unbegrenzt Suchen speichern", "Unbegrenzt Benachrichtigungen"] },
  { tier: "enterprise", price: "auf Anfrage", note: "Für Teams", features: ["Alles aus Pro", "Bis zu 5 E-Mail-Empfänger oder Verteiler je Benachrichtigung"] },
];

/** Tarifübersicht; in der Entwicklung lässt sich die Stufe direkt umschalten */
function PlanCards() {
  const { tier } = useTier();
  return (
    <section id="tarif" aria-labelledby="tarif-title" className="mt-6 scroll-mt-20">
      <h2 id="tarif-title" className="m-0 text-lg font-semibold">Tarif</h2>
      <div className="mt-3 grid gap-[max(0.3vw,6px)] md:grid-cols-3">
        {PLANS.map((plan) => {
          const current = plan.tier === tier;
          return (
            <div key={plan.tier} className={`flex flex-col rounded-2xl border bg-white p-5 shadow-card ${current ? "border-teal-600 ring-2 ring-teal-100" : "border-slate-200"}`}>
              <div className="flex items-center justify-between gap-2">
                <h3 className="m-0 text-base font-semibold">{TIER_LABEL[plan.tier]}</h3>
                {current && <span className="rounded-full bg-teal-600 px-2 py-0.5 text-[11px] font-semibold text-white">Dein Tarif</span>}
              </div>
              <p className="m-0 mt-2 text-2xl font-bold tracking-tight">{plan.price}</p>
              <p className="m-0 text-[12.5px] text-slate-500">{plan.note}</p>
              <ul className="m-0 mt-4 flex-1 list-none space-y-1.5 p-0 text-[13.5px] text-slate-700">
                {plan.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <span className="text-teal-600">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              {!current &&
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

const KEY = "ratsmonitor:profile:v1";
export interface ProfileSettings {
  name: string;
  email: string;
  region: string;
  freq: NotifyFreq;
  newsletter: boolean;
  /** Zusätzliche Benachrichtigungs-Empfänger (nur Enterprise, zusammen mit E-Mail max. 5) */
  recipients: string[];
}
const EMPTY: ProfileSettings = { name: "", email: "", region: "", freq: "daily", newsletter: false, recipients: [] };

export function readProfile(): ProfileSettings {
  try {
    return { ...EMPTY, ...JSON.parse(localStorage.getItem(KEY) || "{}") };
  } catch {
    return EMPTY;
  }
}

/** Kontoeinstellungen; ohne Benutzerkonto vorerst nur in diesem Browser gespeichert */
export function ProfilePage() {
  const toast = useToast();
  const { saved, removeSaved } = useAccount();
  const [p, setP] = useState<ProfileSettings>(EMPTY);
  const { tier, limits } = useTier();
  useEffect(() => setP(readProfile()), []);
  const field = "h-11 w-full rounded-[10px] border border-slate-200 bg-white px-3 text-sm outline-none hover:border-slate-300 focus:border-teal-600 focus:shadow-focus";
  const label = "mb-1 block text-[12px] font-semibold uppercase tracking-wide text-slate-500";
  const save = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(p));
      toast("Kontoeinstellungen gespeichert.");
    } catch {
      toast("Der Browser erlaubt derzeit keine dauerhafte Speicherung.");
    }
  };
  const wipe = () => {
    if (!confirm("Alle gespeicherten Suchen und Kontoeinstellungen in diesem Browser löschen?")) return;
    saved.forEach((s) => removeSaved(s.id));
    try {
      localStorage.removeItem(KEY);
    } catch {}
    setP(EMPTY);
    toast("Daten in diesem Browser gelöscht.");
  };

  if (tier === "guest")
    return (
      <>
        <h1 className="text-3xl font-bold tracking-tight">Konto</h1>
        <LoginRequired title="Du bist nicht angemeldet" text="Mit einem kostenlosen Konto siehst du alle Treffer, nutzt die Filter und kannst Artikel, Suchen und Benachrichtigungen speichern." />
        <PlanCards />
      </>
    );

  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight">Konto</h1>
      <p className="mt-2 text-slate-600">Deine persönlichen Angaben und Voreinstellungen. Sie werden derzeit nur in diesem Browser gespeichert.</p>

      <form
        className="card-shell mt-4 grid gap-4 px-4 py-5 sm:grid-cols-2 sm:px-6"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <h2 className="m-0 text-lg font-semibold sm:col-span-2">Persönliche Angaben</h2>
        <label>
          <span className={label}>Name</span>
          <input className={field} value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} placeholder="Vor- und Nachname" autoComplete="name" />
        </label>
        <label>
          <span className={label}>E-Mail</span>
          <input type="email" className={field} value={p.email} onChange={(e) => setP({ ...p, email: e.target.value })} placeholder="name@beispiel.de" autoComplete="email" />
        </label>

        <h2 className="m-0 mt-2 text-lg font-semibold sm:col-span-2">Voreinstellungen</h2>
        <label>
          <span className={label}>Meine Region</span>
          <input className={field} value={p.region} onChange={(e) => setP({ ...p, region: e.target.value })} placeholder="z. B. Billerbeck" />
        </label>
        <label>
          <span className={label}>Benachrichtigungen standardmäßig</span>
          <select className="select-base w-full" value={p.freq} onChange={(e) => setP({ ...p, freq: e.target.value as NotifyFreq })}>
            <option value="instant">Sofort</option>
            <option value="daily">Täglich</option>
            <option value="weekly">Wöchentlich</option>
          </select>
        </label>
        <label className="flex items-center gap-2.5 text-sm sm:col-span-2">
          <input type="checkbox" className="h-4 w-4 accent-teal-600" checked={p.newsletter} onChange={(e) => setP({ ...p, newsletter: e.target.checked })} />
          Wöchentliche Zusammenfassung für meine Region per E-Mail
        </label>

        <h2 className="m-0 mt-2 text-lg font-semibold sm:col-span-2">Empfänger für Benachrichtigungen</h2>
        {limits.emails > 1 ? (
          <div className="grid gap-2 sm:col-span-2">
            <p className="m-0 text-[13px] text-slate-500">Neben deiner E-Mail-Adresse kannst du bis zu {limits.emails - 1} weitere Adressen oder Verteiler eintragen. Alle werden parallel benachrichtigt.</p>
            {Array.from({ length: limits.emails - 1 }, (_, i) => (
              <input
                key={i}
                type="email"
                className={field}
                value={p.recipients[i] ?? ""}
                onChange={(e) => {
                  const next = [...p.recipients];
                  next[i] = e.target.value.trim();
                  setP({ ...p, recipients: next });
                }}
                placeholder={`Weitere Adresse ${i + 2} (z. B. team@firma.de)`}
              />
            ))}
          </div>
        ) : (
          <p className="m-0 text-[13px] text-slate-500 sm:col-span-2">
            Benachrichtigungen gehen an deine E-Mail-Adresse oben. Mehrere Empfänger oder Verteiler gibt es mit <a href="#tarif" className="font-medium text-teal-700 underline underline-offset-2">Enterprise</a>.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 pt-4 sm:col-span-2">
          <button type="submit" className="btn-primary">
            Speichern
          </button>
          <button type="button" onClick={wipe} className="ml-auto text-[13px] text-rose-700 underline underline-offset-2">
            Alle Daten in diesem Browser löschen
          </button>
        </div>
      </form>
      <PlanCards />
    </>
  );
}
