import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { STATUS } from "../../lib/constants";
import { ApiError, errorText, fetchOrFail } from "../../lib/fetchJson";

/* Die Vorgänge hinter einer Zahl eines Themenradars (server/integrations/analytics-radar.mjs, radarList): Thema, Signal,
   Monat, Gebiet oder Zweck eines Zuschusses. Lädt beim Öffnen, weitere Einträge auf Knopfdruck. */
export interface DrillItem { id: string; title: string; region: string; date: string; status: string; times: number; signal?: string; topics?: string[]; euro?: number }
interface List { total: number; size: number; items: DrillItem[] }

const n = (v: number) => v.toLocaleString("de-DE");
/* Datum wie überall „05.10.26“; fehlt es oder ist es ungültig, bleibt es leer (statt die Seite mit einem Fehler abzubrechen) */
const day = (iso: string) => (/^\d{4}-\d{2}-\d{2}/.test(iso || "") ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(2, 4)}` : "");
const statusLabel = (id: string) => STATUS.find((s) => s.id === id)?.label ?? "";

/** radar: Themenradar (Liste über /api/analytics/themenradar); base: andere Auswertung mit Listenmodus (by=…), etwa die Bauleitplanung */
export function RadarDrill({ radar, base, query, by, value, label, unit }: { radar?: string; base?: string; query: string; by: string; value: string; label: string; unit?: [string, string] }) {
  const [items, setItems] = useState<DrillItem[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  /* Neue Liste (anderer Wert oder andere Abfrage): beim Rendern zurücksetzen, der Effekt lädt nur */
  const listKey = [radar, base, query, by, value].join("|");
  const [shown, setShown] = useState(listKey);
  if (shown !== listKey) {
    setShown(listKey);
    setItems([]);
    setTotal(null);
    setError("");
    setLoading(true);
  }
  /* Nur der jüngste Abruf zählt: wechselt die Liste, wird der laufende abgebrochen, damit keine alte Antwort die neue überschreibt */
  const ctrl = useRef<AbortController | null>(null);
  const load = (offset: number) => {
    ctrl.current?.abort();
    const c = (ctrl.current = new AbortController());
    fetchOrFail(`${base ?? `/api/analytics/themenradar?radar=${radar}`}&${query}&by=${by}&value=${encodeURIComponent(value)}&offset=${offset}`, { signal: c.signal })
      .then(async (r) => { const b = (await r.json().catch(() => ({}))) as List & { error?: string }; if (!r.ok || !Array.isArray(b.items)) throw new ApiError(b.error || "Die Liste konnte nicht geladen werden.", r.status); return b; })
      .then((b) => { setItems((old) => (offset ? [...old, ...b.items] : b.items)); setTotal(b.total); setLoading(false); })
      .catch((e) => { if (c.signal.aborted) return; setError(errorText(e, "Die Liste konnte nicht geladen werden.")); setLoading(false); });
  };
  const more = () => {
    setLoading(true);
    setError("");
    load(items.length);
  };
  useEffect(() => {
    load(0);
    return () => ctrl.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listKey]);
  return (
    <div className="border-l-2 border-teal-600 bg-slate-50/70 px-3 pb-3 pt-2 sm:px-4" aria-live="polite">
      <p className="m-0 text-[12px] text-slate-500">{total === null ? `${label}: wird geladen …` : `${label}: ${n(total)} ${unit ? (total === 1 ? unit[0] : unit[1]) : by === "region" ? "Vorgänge (gleiche Titel einmal)" : total === 1 ? "Vorgang" : "Vorgänge"}`}</p>
      {error && <p role="alert" className="mt-2 text-[14px]">{error}</p>}
      {items.length > 0 && (
        <ol className="m-0 mt-2 list-none p-0">
          {items.map((r) => (
            <li key={r.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 border-t border-slate-200 py-2.5">
              <Link href={`/beschluss/${r.id}`} className="min-w-0 text-slate-900 no-underline hover:text-teal-800">
                <span className="block text-[14px] leading-snug [overflow-wrap:anywhere] sm:truncate sm:text-[16px]">{r.title}</span>
                <span className="block truncate text-[12px] text-slate-500">{[r.region, day(r.date), by !== "topic" && r.topics?.join(", "), r.times > 1 && (unit ? `${r.times} Vorgänge` : `in ${r.times} Sitzungen`)].filter(Boolean).join(" · ")}</span>
              </Link>
              <span className="self-center text-right text-[12px] text-slate-500">
                {r.euro ? <b className="block text-[14px] font-semibold tabular-nums text-slate-900">{r.euro.toLocaleString("de-DE")} €</b> : null}
                {r.signal && r.signal !== "Sonstiges" && by !== "signal" && <span className="block">{r.signal}</span>}
                {statusLabel(r.status) && <span className="block">{statusLabel(r.status)}</span>}
              </span>
            </li>
          ))}
        </ol>
      )}
      {total !== null && items.length < total && (
        <button type="button" disabled={loading} onClick={more} className="mt-2 text-[14px] font-medium text-teal-700 hover:underline">{loading ? "Wird geladen …" : `Weitere ${n(Math.min(50, total - items.length))} laden`}</button>
      )}
    </div>
  );
}
