import { useEffect, useState } from "react";
import { useAccount } from "../state/account";
import { useToast } from "../state/toast";
import type { NotifyFreq } from "../types";

const KEY = "ratsmonitor:profile:v1";
export interface ProfileSettings {
  name: string;
  email: string;
  region: string;
  freq: NotifyFreq;
  newsletter: boolean;
}
const EMPTY: ProfileSettings = { name: "", email: "", region: "", freq: "daily", newsletter: false };

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

        <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 pt-4 sm:col-span-2">
          <button type="submit" className="btn-primary">
            Speichern
          </button>
          <button type="button" onClick={wipe} className="ml-auto text-[13px] text-rose-700 underline underline-offset-2">
            Alle Daten in diesem Browser löschen
          </button>
        </div>
      </form>
    </>
  );
}
