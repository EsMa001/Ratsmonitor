import { useEffect, useState } from "react";
import Link from "next/link";
import { useHomePlace } from "../../lib/homePlace";
import { weekAgo } from "./Kennzahlen";

/**
 * „Neu in meinem Ort“: Ist ein Favorit-Ort gemerkt und gerade kein Ort gewählt, steht hier, wie viele Vorgänge dort in den
 * letzten 7 Tagen beraten wurden, mit Wegen zu Projekten, Nachrichten, Werten und Beschlusslage für diesen Ort.
 * Nichts wird vorgerechnet: eine Abfrage wie die Kennzahl der Seite (/api/x), nur ohne Anzeige für Fremde.
 */
export function MeinOrtNeu({ onApply }: { onApply: (ags: string) => void }) {
  const [ort] = useHomePlace();
  const [n, setN] = useState<number | null>(null);
  useEffect(() => {
    if (!ort) return;
    const c = new AbortController();
    fetch(`/api/x?by=theme&area=${ort.ags}&scope=with&level=city&noformal=1&from=${weekAgo()}`, { signal: c.signal })
      .then((r) => (r.ok ? (r.json() as Promise<{ total?: number }>) : null)).then((b) => setN(typeof b?.total === "number" ? b.total : null)).catch(() => {});
    return () => c.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ort?.ags]);
  if (!ort) return null;
  const link = "font-medium text-teal-700 hover:underline";
  const q = `?ort=${ort.ags}`;
  return (
    <section aria-label="Neu in meinem Ort" className="mt-3 rounded-xl bg-slate-50 px-4 py-3 text-[14px] text-slate-700 max-sm:mt-2 print:hidden">
      <p className="m-0"><span aria-hidden="true" className="text-teal-700">★</span> <b className="font-semibold text-slate-900">{ort.name}</b>
        {n === null ? "" : <>: <b className="font-semibold tabular-nums text-slate-900">{n.toLocaleString("de-DE")}</b> {n === 1 ? "Vorgang" : "Vorgänge"} in den letzten 7 Tagen</>}</p>
      <p className="m-0 mt-1 flex flex-wrap gap-x-4 gap-y-1">
        <button type="button" onClick={() => onApply(ort.ags)} className={link + " bg-transparent p-0"}>Im Themenatlas zeigen</button>
        <Link href={`/analytics/signale${q}`} className={link}>Projekte</Link>
        <Link href={`/analytics/news${q}`} className={link}>Nachrichten</Link>
        <Link href={`/analytics/fakten${q}`} className={link}>Werte</Link>
        <Link href={`/analytics/beschluesse${q}`} className={link}>Beschlusslage</Link>
      </p>
    </section>
  );
}
