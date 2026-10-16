import { useEffect, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { Bell } from "lucide-react";
import { useClient } from "../../lib/useClient";
import { useUi } from "../../state/ui";

const n = (v: number) => v.toLocaleString("de-DE");

/** Datum der letzten 7 Tage (bis heute): für „neu“ in Listen und „+N in den letzten 7 Tagen“ */
export const weekAgo = () => { const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().slice(0, 10); };
export const isNew = (iso: string) => { const d = String(iso || "").slice(0, 10), today = new Date().toISOString().slice(0, 10); return d >= weekAgo() && d <= today; };
/** Kleines „neu“ in Petrol (Sitzung der letzten 7 Tage) */
export const NeuMark = ({ date }: { date: string }) => (isNew(date) ? <span className="mr-1.5 font-semibold text-teal-700">neu</span> : null);

/**
 * Antwort als große Kennzahlen (Atlas, Signale): Zahl groß in Petrol, Bedeutung klein darunter; daneben, wie viele Vorgänge
 * in den letzten 7 Tagen beraten wurden (Sitzungsdatum; nicht der Abruf: ein spät gefundener alter Bericht ist nicht neu). Darunter in einer Zeile, worauf sich die Zahlen beziehen.
 */
export function Kennzahlen({ items, week, children }: { items: { value: string; label: string }[]; week?: number | null; children?: ReactNode }) {
  return (
    <div className="mt-4">
      {/* Handy: zwei Zahlen je Reihe und etwas kleiner, sonst stehen vier große Zahlen untereinander */}
      <div className="grid grid-cols-2 items-end gap-x-6 gap-y-3 sm:flex sm:flex-wrap sm:gap-x-10">
        {items.map((k) => (
          <div key={k.label}>
            <p className="m-0 text-[32px] font-semibold leading-none tabular-nums text-teal-700 sm:text-[44px]">{k.value}</p>
            <p className="m-0 mt-1 text-[14px] text-slate-500">{k.label}</p>
          </div>
        ))}
        {week ? <p className="col-span-2 m-0 justify-self-start rounded-full sm:mb-6 bg-teal-50 px-3 py-1 text-[14px] font-medium text-teal-800">+{n(week)} in den letzten 7 Tagen beraten</p> : null}
      </div>
      {children && <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-[16px] text-slate-700">{children}</div>}
    </div>
  );
}

/**
 * Stufen der Karte nach Vierteln der Werte (statt fester 1, 2, 3–4, 5+, bei denen über ganz Deutschland fast alles in der
 * obersten Stufe landet): je ein Viertel der Gebiete mit Vorgängen je Stufe. Gibt die Stufe je Wert und die Legende.
 */
export function countScale(values: number[]): { level: (v: number) => number; legend: string[] } {
  const s = values.filter((v) => v > 0).sort((a, b) => a - b);
  if (!s.length) return { level: () => 0, legend: ["1 Vorgang", "2 Vorgänge", "3 bis 4 Vorgänge", "5 und mehr"] };
  const q = (p: number) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  const c = [q(0.25), q(0.5), q(0.75)];
  for (let i = 1; i < 3; i++) if (c[i] <= c[i - 1]) c[i] = c[i - 1] + 1;
  const range = (lo: number, hi: number) => (lo >= hi ? `${n(hi)}` : `${n(lo)} bis ${n(hi)}`);
  return {
    level: (v) => (v <= 0 ? 0 : v <= c[0] ? 1 : v <= c[1] ? 2 : v <= c[2] ? 3 : 4),
    legend: [range(1, c[0]), range(c[0] + 1, c[1]), range(c[1] + 1, c[2]), `über ${n(c[2])}`].map((l) => `${l} Vorgänge`),
  };
}

/** Zeitraum als kleine Pillen in der Bezugszeile (Atlas und Signale gleich): Monate zurück ab heute, "" bzw. "alle" = alles */
export function ZeitPills({ value, all = "", onPick }: { value: string; all?: string; onPick: (v: string) => void }) {
  const opts: [string, string][] = [["3", "3 Monate"], ["6", "6 Monate"], ["12", "12 Monate"], [all, "Alles"]];
  return (
    <span className="inline-flex flex-wrap gap-1 print:hidden" role="group" aria-label="Zeitraum">
      {opts.map(([k, l]) => <button key={k || "alle"} type="button" aria-pressed={k === value} onClick={() => onPick(k)}
        className={`inline-flex h-7 items-center rounded-full border px-2.5 text-[14px] ${k === value ? "border-teal-700 bg-teal-700 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"}`}>{l}</button>)}
    </span>
  );
}

/**
 * Gewählter Ort in der Adresse (?ort=<Schlüssel>), damit sich jede Ansicht als Link teilen lässt: beim Öffnen setzt ?ort den Ort
 * der Suche; ändert sich der Ort (oder die Adresse durch eine andere Auswahl), wird ?ort nachgezogen, ohne neuen Verlaufseintrag.
 */
export function useOrtInAdresse(area: string, setArea: (ags: string) => void) {
  const params = useSearchParams().toString();
  const pending = useRef<string | null>(null), started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const o = new URLSearchParams(window.location.search).get("ort") ?? "";
    if (/^\d{5,9}$/.test(o) && o !== area) { pending.current = o; setArea(o); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (pending.current !== null) { if (area !== pending.current) return; pending.current = null; }
    const u = new URL(window.location.href);
    if ((u.searchParams.get("ort") ?? "") === area) return;
    if (area) u.searchParams.set("ort", area); else u.searchParams.delete("ort");
    window.history.replaceState(window.history.state, "", u.toString());
  }, [area, params]);
}

/** Umschalter für die Sortierung einer Liste (Trends, Fakten): helle Fläche, gewählte Wahl weiß hervorgehoben */
export function Segmented<K extends string>({ options, value, onPick, label }: { options: [K, string, string?][]; value: K | ""; onPick: (k: K) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex max-w-full overflow-x-auto rounded-full bg-slate-100 p-1">
      {options.map(([k, l, hint]) => <button key={k} role="tab" type="button" aria-selected={k === value} title={hint} onClick={() => onPick(k)}
        className={`h-8 shrink-0 whitespace-nowrap rounded-full px-3 text-[14px] ${k === value ? "bg-white font-semibold text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}>{l}</button>)}
    </div>
  );
}

/* Eigener Ort, im Browser gemerkt (nur Bequemlichkeit, kein Konto nötig) */
const MEIN_ORT = "plenara.meinOrt";
const readOrt = (): { ags: string; name: string } | null => { try { const v = JSON.parse(localStorage.getItem(MEIN_ORT) || "null"); return v?.ags ? v : null; } catch { return null; } };

/**
 * „Mein Ort“: Ist ein Ort gewählt, lässt er sich merken (Stern); ist keiner gewählt, setzt ein Klick den gemerkten Ort.
 * current: der gewählte Ort (Schlüssel und Name) oder null.
 */
export function MeinOrt({ current, onApply }: { current: { ags: string; name: string } | null; onApply: (ags: string) => void }) {
  /* Gemerkter Ort aus dem Browser (beim Hydrieren leer), nach dem Merken der neue Wert */
  const stored = useClient(() => { try { return localStorage.getItem(MEIN_ORT) || ""; } catch { return ""; } }, "");
  const [own, setSaved] = useState<{ ags: string; name: string } | null | undefined>(undefined);
  const saved = own !== undefined ? own : stored ? readOrt() : null;
  const save = (v: { ags: string; name: string } | null) => { try { if (v) localStorage.setItem(MEIN_ORT, JSON.stringify(v)); else localStorage.removeItem(MEIN_ORT); } catch { /* ohne Speicher geht es auch */ } setSaved(v); };
  if (current) {
    const mine = saved?.ags === current.ags;
    return <button type="button" onClick={() => save(mine ? null : current)} aria-pressed={mine} className="inline-flex h-7 items-center gap-1 rounded-full px-2 text-[14px] text-teal-700 hover:bg-teal-50 print:hidden">
      <span aria-hidden="true">{mine ? "★" : "☆"}</span>{mine ? "Mein Ort" : "Als meinen Ort merken"}</button>;
  }
  return saved ? <button type="button" onClick={() => onApply(saved.ags)} className="inline-flex h-7 items-center gap-1 rounded-full px-2 text-[14px] text-teal-700 hover:bg-teal-50 print:hidden"><span aria-hidden="true">★</span>Mein Ort: {saved.name} →</button> : null;
}

/**
 * „Folgen“: speichert die aktuelle Suche (Begriff, Ort, Filter, Thema) im Konto, dort mit Mail-Benachrichtigung bei neuen
 * Vorgängen (derselbe Dialog wie „Suche speichern“). before: vorher die Auswahl der Seite in die Suche übernehmen (Atlas: Thema).
 */
export function Folgen({ before, hint }: { before?: () => void; hint?: string }) {
  const { openSaveDialog } = useUi();
  return <button type="button" title={hint ?? "Neue Vorgänge zu dieser Auswahl per Mail"} onClick={() => { before?.(); setTimeout(openSaveDialog, 0); }}
    className="inline-flex h-7 items-center gap-1.5 rounded-full border border-teal-700 px-3 text-[14px] font-medium text-teal-700 hover:bg-teal-50 print:hidden">
    <Bell size={14} strokeWidth={1.5} aria-hidden="true" />Folgen</button>;
}
