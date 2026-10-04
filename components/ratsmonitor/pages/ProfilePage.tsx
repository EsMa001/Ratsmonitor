import { useEffect, useState } from "react";
import { useAccount } from "../state/account";
import { useToast } from "../state/toast";
import type { NotifyFreq } from "../types";
import { useTier } from "../lib/tier";
import { PlanCards } from "../components/PlanCards";
import { LoginRequired } from "../components/TierNotice";
import { PageHead } from "../info/blocks";


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
  const { tier } = useTier();
  useEffect(() => setP(readProfile()), []);
  const field = "h-11 w-full rounded-[10px] border border-slate-200 bg-white px-3 text-[14px] outline-none hover:border-slate-300 focus:border-teal-600 focus:shadow-focus";
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
        <PageHead icon="user" label="Konto" name="Mein Konto" title={<>Sie sind nicht<br />angemeldet.</>} lead="Ohne Konto sehen Sie 10 Treffer je Suche. Mit einem kostenlosen Konto nutzen Sie alle Treffer und Filter und können speichern." />
        <section className="ri-sec ri-sec--tight">
        <LoginRequired title="Kostenlos anmelden" text="Mit einem kostenlosen Konto sehen Sie alle Treffer, nutzen die Filter und können Artikel, Suchen und Benachrichtigungen speichern." />
        <PlanCards />
        </section>
      </>
    );

  return (
    <>
      <PageHead icon="user" label="Konto" name="Mein Konto" title={<>Ihre Angaben.<br />Ihr Tarif.</>} lead="Persönliche Angaben und Tarif an einem Ort. Benachrichtigungen legen Sie direkt bei jeder gespeicherten Suche fest." />
      <section className="ri-sec ri-sec--tight">

      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <h2 className="m-0 text-[18px] font-semibold sm:col-span-2">Persönliche Angaben</h2>
        <label>
          <span className={label}>Name</span>
          <input className={field} value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} placeholder="Vor- und Nachname" autoComplete="name" />
        </label>
        <label>
          <span className={label}>E-Mail</span>
          <input type="email" className={field} value={p.email} onChange={(e) => setP({ ...p, email: e.target.value })} placeholder="name@beispiel.de" autoComplete="email" />
        </label>

        <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 pt-4 sm:col-span-2">
          <button type="submit" className="btn-primary">
            Speichern
          </button>
          <button type="button" onClick={wipe} className="ml-auto text-[14px] text-rose-700 underline underline-offset-2">
            Alle Daten in diesem Browser löschen
          </button>
        </div>
      </form>
      <PlanCards />
      </section>
    </>
  );
}
