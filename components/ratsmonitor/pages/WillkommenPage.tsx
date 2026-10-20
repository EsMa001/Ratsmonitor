import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { THEMES } from "@/shared/themes.mjs";
import { PlaceField } from "./analytics/CompareFields";
import type { PlaceEntry } from "../lib/place";
import { useHomePlace } from "../lib/homePlace";

const BEISPIELE = ["Solarpark", "Wärmeplanung", "Hebesatz"];
const CARD = "rounded-[22px] border border-slate-200 bg-white p-5 max-sm:p-4";

/**
 * Nach der ersten Anmeldung: eine ruhige Seite statt Menüs. Drei Antworten auf „Was möchtest du beobachten?“:
 * ein Ort (wird Favorit-Ort im Konto), ein Thema oder ein Begriff. Jede führt in die passende Auswertung; später ändern geht überall.
 */
export function WillkommenPage() {
  const router = useRouter();
  const [, setHome] = useHomePlace();
  const [ort, setOrt] = useState<PlaceEntry | null>(null);
  const [begriff, setBegriff] = useState("");
  useEffect(() => { try { localStorage.setItem("plenara.willkommen", "1"); } catch { /* egal */ } }, []);
  const suche = (q: string) => { const t = q.trim(); if (t) router.push(`/suche?q=${encodeURIComponent(t)}`); };
  return (
    <section className="ri-sec">
      <h1 className="m-0 text-[32px] font-semibold leading-tight max-sm:text-[26px]">Hallo, was möchtest du beobachten?</h1>
      <p className="m-0 max-w-[60ch] pt-3 text-[16px] text-slate-600">Such dir einen Anfang aus. Alles lässt sich später ändern, und deine Auswahl bleibt in deinem Konto.</p>
      <div className="grid grid-cols-1 gap-4 pt-8 lg:grid-cols-3">
        <div className={CARD}>
          <h2 className="m-0 text-[18px] font-semibold">Meinen Ort</h2>
          <p className="m-0 pt-1 text-[14px] text-slate-500">Dein Ort wird zum Favorit und steht überall bereit.</p>
          <div className="mt-4"><PlaceField label="Ort" color="var(--st-core)" value={ort} onChange={setOrt} /></div>
          <button type="button" disabled={!ort} onClick={() => { if (!ort) return; setHome({ ags: ort.ags, name: ort.name }); router.push(`/analytics/atlas?ort=${ort.ags}`); }}
            className="mt-4 inline-flex h-11 items-center rounded-full bg-teal-700 px-5 text-[16px] font-medium text-white disabled:cursor-default disabled:opacity-40">Diesen Ort merken →</button>
        </div>
        <div className={CARD}>
          <h2 className="m-0 text-[18px] font-semibold">Ein Thema</h2>
          <p className="m-0 pt-1 text-[14px] text-slate-500">Zum Beispiel Bauen, Finanzen oder Mobilität.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {THEMES.map((t: { id: string; name: string }) => (
              <button key={t.id} type="button" onClick={() => router.push(`/analytics/atlas?thema=${t.id}`)} className="inline-flex h-9 items-center rounded-full border border-slate-200 bg-white px-3 text-[14px] text-slate-700 hover:border-slate-400">{t.name}</button>
            ))}
          </div>
        </div>
        <div className={CARD}>
          <h2 className="m-0 text-[18px] font-semibold">Einen Begriff</h2>
          <p className="m-0 pt-1 text-[14px] text-slate-500">Alles, was dich interessiert, als Suchwort.</p>
          <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); suche(begriff); }}>
            <input value={begriff} onChange={(e) => setBegriff(e.target.value)} placeholder="z. B. Solarpark" aria-label="Begriff" className="h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-[16px] outline-none focus:border-teal-700" />
            <button type="submit" disabled={!begriff.trim()} className="inline-flex h-11 items-center rounded-full bg-teal-700 px-5 text-[16px] font-medium text-white disabled:cursor-default disabled:opacity-40">Suchen</button>
          </form>
          <p className="m-0 mt-3 flex flex-wrap items-center gap-2 text-[14px] text-slate-500">Zum Beispiel:
            {BEISPIELE.map((b) => <button key={b} type="button" onClick={() => suche(b)} className="inline-flex h-8 items-center rounded-full border border-slate-200 bg-white px-3 text-slate-700 hover:border-slate-400">{b}</button>)}
          </p>
        </div>
      </div>
      <p className="m-0 pt-8"><Link href="/konto/profil" className="text-[14px] text-slate-500 hover:text-slate-900">Später, ich schaue mich erst um</Link></p>
    </section>
  );
}
