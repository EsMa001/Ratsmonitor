import { useEffect, useState } from "react";

/** Platzhalter, solange eine Auswertung berechnet wird: zeigt schon die Form der Seite statt nur eines Satzes, mit laufender Zeit */
export function Laden({ text, karte = false }: { text: string; karte?: boolean }) {
  const [sek, setSek] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setSek((s) => s + 1), 1000);
    return () => window.clearInterval(t);
  }, []);
  return (
    <div className="mt-8" role="status" aria-live="polite">
      <div className="animate-pulse" aria-hidden="true">
        <div className="h-7 w-[min(640px,90%)] rounded-full bg-slate-100" />
        <div className="mt-3 h-7 w-[min(420px,70%)] rounded-full bg-slate-100" />
        <div className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-14 rounded-xl bg-slate-100" />)}</div>
        {karte
          ? <><div className="mt-4 h-[300px] rounded-2xl bg-slate-100 sm:mt-10 sm:h-[540px]" /><div className="mt-6 space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-12 rounded-xl bg-slate-100" />)}</div></>
          : <div className="mt-10 h-48 rounded-[20px] bg-slate-100" />}
      </div>
      <p className="mt-4 text-[14px] text-slate-500">
        {text} Das kann einige Sekunden dauern{sek >= 3 ? ` (seit ${sek} s)` : ""}.
        {sek >= 15 && " Bei sehr häufigen Begriffen dauert es länger; ein genauerer Begriff rechnet schneller."}
      </p>
    </div>
  );
}
