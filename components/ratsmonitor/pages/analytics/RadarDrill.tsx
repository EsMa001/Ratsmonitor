import { usePhone } from "../../lib/usePhone";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowRight, Crosshair, List } from "lucide-react";
import { WheelList } from "../../components/WheelList";
import { STATUS } from "../../lib/constants";
import { ApiError, errorText, fetchOrFail } from "../../lib/fetchJson";
import { DateBadge } from "../../components/DateBadge";

/* Die Vorgänge hinter einer Zahl einer Auswertung (Listenmodus by=…&value=…, etwa /api/x?list=1): Lädt beim Öffnen,
   weitere Einträge auf Knopfdruck. */
export interface DrillItem { id: string; title: string; region: string; date: string; status: string; times: number; gremium?: string; signal?: string; topics?: string[]; euro?: number; /* Wert aus den Unterlagen, schon formatiert („465 %“) */ value?: string }
interface List { total: number; size: number; items: DrillItem[] }

const n = (v: number) => v.toLocaleString("de-DE");
/* Datum wie überall „05.10.26“; fehlt es oder ist es ungültig, bleibt es leer (statt die Seite mit einem Fehler abzubrechen) */
const statusLabel = (id: string) => STATUS.find((s) => s.id === id)?.label ?? "";
/** Stand als kleiner farbiger Punkt vor dem Wort: Farbe nur als Punkt, kein buntes Abzeichen. Ergebnis grün/rot, offen blau,
    unterwegs Petrol, vertagt gelb, zur Kenntnis und ohne Stand grau */
const DOT: Record<string, string> = { approved: "bg-sky-900", rejected: "bg-amber-700", announced: "bg-slate-300", consulting: "bg-sky-300", recommended: "bg-sky-500", postponed: "bg-slate-400", info: "bg-slate-400", unknown: "bg-slate-300" };
const StatusDot = ({ status }: { status: string }) => (DOT[status] ? <span aria-hidden="true" className={`mr-1.5 inline-block h-2 w-2 rounded-full align-middle ${DOT[status]}`} /> : null);

/** base: Adresse der Auswertung mit Listenmodus (by=…), etwa /api/x?list=1. limit: nur so viele Einträge zeigen und statt
    „Weitere laden“ den Weg zur ganzen Liste (onAll); footer: weitere Wege unter der Liste (etwa „Auf … eingrenzen“). */
/** Aktionszeile in der Walze (Handy): Symbol, Text, Pfeil; die ganze Zeile ist antippbar (der Knopf deckt sie per ::after).
 *  [&_button]:!block und !mt-0 gegen die Tippflächen-Regel main#inhalt button[class*="hover:underline"] (app/styles/base.css) */
function ActionRow({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="relative flex h-[calc(100%-12px)] items-center gap-3 rounded-xl border border-teal-600/30 px-3 text-teal-800 [&_button]:!mt-0 [&_button]:!block [&_button]:flex-1 [&_button]:text-left [&_button]:no-underline [&_button]:after:absolute [&_button]:after:inset-0 [&_button]:after:content-['']" style={{ marginBlock: 6 }}>
      <span aria-hidden="true" className="grid h-8 w-8 flex-none place-items-center rounded-full bg-teal-50 text-teal-700">{icon}</span>
      {children}
      <ArrowRight size={16} strokeWidth={1.6} aria-hidden="true" className="flex-none text-teal-700" />
    </div>
  );
}

export function RadarDrill({ base, query, by, value, label, unit, limit, plain = false, onAll, footer }: { /** Handy: die Einträge als normale Liste zeigen statt in der Walze (bei schon gewählter Auswahl, wo die Liste im Mittelpunkt steht) */ plain?: boolean; base: string; query: string; by: string; value: string; label: string; unit?: [string, string]; limit?: number; onAll?: (total: number) => void; footer?: React.ReactNode }) {
  /* Handy: bis zu 10 Vorgänge in einem Fenster von etwa 3 Zeilen zum Wischen (statt nur 3 untereinander) */
  const phone = usePhone();
  const cap = limit && phone && !plain ? Math.max(limit, 10) : limit;
  const wheel = !!(limit && phone && !plain);
  const [items, setItems] = useState<DrillItem[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  /* Neue Liste (anderer Wert oder andere Abfrage): beim Rendern zurücksetzen, der Effekt lädt nur */
  const listKey = [base, query, by, value].join("|");
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
    fetchOrFail(`${base}&${query}&by=${by}&value=${encodeURIComponent(value)}&offset=${offset}`, { signal: c.signal })
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
    <div className="border-l-2 border-teal-600 bg-slate-50/70 px-3 pb-3 pt-2 max-sm:bg-transparent max-sm:pb-1 max-sm:pt-0 sm:px-4" aria-live="polite">
      <p className={`m-0 text-[12px] text-slate-500 ${wheel ? "hidden" : ""}`}>{total === null ? `${label}: wird geladen …` : `${label}: ${n(total)} ${unit ? (total === 1 ? unit[0] : unit[1]) : by === "region" ? "Vorgänge (gleiche Titel einmal)" : total === 1 ? "Vorgang" : "Vorgänge"}`}</p>
      {error && <p role="alert" className="mt-2 text-[14px]">{error}</p>}
      {items.length > 0 && (wheel ? (
        <WheelList resetKey={listKey} items={[
          ...(cap ? items.slice(0, cap) : items).map((r) => (
            <div key={r.id} className="grid h-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 px-1">
              <DateBadge iso={r.date} />
              <Link href={`/beschluss/${r.id}`} className="min-w-0 text-slate-900 no-underline hover:text-teal-800">
                {/* Höchstens zwei Zeilen Titel, wie in den Listen der Signale */}
                <span className="line-clamp-2 text-[14px] leading-snug [overflow-wrap:anywhere] sm:text-[16px]">{r.title}</span>
                <span className="block truncate text-[12px] text-slate-500">{[r.region, r.gremium, by !== "topic" && r.topics?.join(", "), r.times > 1 && (unit ? `${r.times} Vorgänge` : `in ${r.times} Sitzungen`)].filter(Boolean).join(" · ")}</span>
              </Link>
              <span className="self-center text-right text-[12px] text-slate-500">
                {r.value ? <b className="block text-[14px] font-semibold tabular-nums text-slate-900">{r.value}</b> : null}
                {r.euro ? <b className="block text-[14px] font-semibold tabular-nums text-slate-900">{r.euro.toLocaleString("de-DE")} €</b> : null}
                {r.signal && r.signal !== "Sonstiges" && by !== "signal" && <span className="block">{r.signal}</span>}
                {statusLabel(r.status) && <span className="block"><StatusDot status={r.status} />{statusLabel(r.status)}</span>}
              </span>
            </div>
          )),
          ...(onAll && total !== null ? [<ActionRow key="a" icon={<List size={18} strokeWidth={1.6} aria-hidden="true" />}><button type="button" onClick={() => onAll(total)} className="text-left text-[14px] font-medium text-teal-800 max-sm:min-h-[44px]">Alle {n(total)} Vorgänge zeigen</button></ActionRow>] : []),
          ...(footer ? [<ActionRow key="f" icon={<Crosshair size={18} strokeWidth={1.6} aria-hidden="true" />}>{footer}</ActionRow>] : []),
        ]} />
      ) : (
        <ol className="m-0 mt-2 list-none p-0">
          {(cap ? items.slice(0, cap) : items).map((r) => (
            <li key={r.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 border-t border-slate-200 py-2.5">
              <DateBadge iso={r.date} />
              <Link href={`/beschluss/${r.id}`} className="min-w-0 text-slate-900 no-underline hover:text-teal-800">
                {/* Höchstens zwei Zeilen Titel, wie in den Listen der Signale */}
                <span className="line-clamp-2 text-[14px] leading-snug [overflow-wrap:anywhere] sm:text-[16px]">{r.title}</span>
                <span className="block truncate text-[12px] text-slate-500">{[r.region, r.gremium, by !== "topic" && r.topics?.join(", "), r.times > 1 && (unit ? `${r.times} Vorgänge` : `in ${r.times} Sitzungen`)].filter(Boolean).join(" · ")}</span>
              </Link>
              <span className="self-center text-right text-[12px] text-slate-500">
                {r.value ? <b className="block text-[14px] font-semibold tabular-nums text-slate-900">{r.value}</b> : null}
                {r.euro ? <b className="block text-[14px] font-semibold tabular-nums text-slate-900">{r.euro.toLocaleString("de-DE")} €</b> : null}
                {r.signal && r.signal !== "Sonstiges" && by !== "signal" && <span className="block">{r.signal}</span>}
                {statusLabel(r.status) && <span className="block"><StatusDot status={r.status} />{statusLabel(r.status)}</span>}
              </span>
            </li>
          ))}
        </ol>
      ))}
      {!wheel && cap && onAll && total !== null && total > cap && (
        <button type="button" onClick={() => onAll(total)} className="mt-3 text-[14px] font-medium text-teal-700 hover:underline">Alle {n(total)} Vorgänge zeigen →</button>
      )}
      {!limit && total !== null && items.length < total && (
        <button type="button" disabled={loading} onClick={more} className="mt-3 text-[14px] font-medium text-teal-700 hover:underline">{loading ? "Wird geladen …" : `Weitere ${n(Math.min(50, total - items.length))} zeigen →`}</button>
      )}
      {!wheel && footer}
    </div>
  );
}
