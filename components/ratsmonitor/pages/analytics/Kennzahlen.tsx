import type { ReactNode } from "react";

const n = (v: number) => v.toLocaleString("de-DE");

/** Datum der letzten 7 Tage (bis heute): für „neu“ in Listen und „+N in den letzten 7 Tagen“ */
export const weekAgo = () => { const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().slice(0, 10); };
export const isNew = (iso: string) => { const d = String(iso || "").slice(0, 10), today = new Date().toISOString().slice(0, 10); return d >= weekAgo() && d <= today; };
/** Kleines „neu“ in Petrol (Sitzung der letzten 7 Tage) */
export const NeuMark = ({ date }: { date: string }) => (isNew(date) ? <span className="mr-1.5 font-semibold text-teal-700">neu</span> : null);

/**
 * Antwort als große Kennzahlen (Atlas, Signale): Zahl groß in Petrol, Bedeutung klein darunter; daneben, wie viele Vorgänge
 * in den letzten 7 Tagen beraten wurden. Darunter in einer Zeile, worauf sich die Zahlen beziehen.
 */
export function Kennzahlen({ items, week, children }: { items: { value: string; label: string }[]; week?: number | null; children?: ReactNode }) {
  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-end gap-x-10 gap-y-3">
        {items.map((k) => (
          <div key={k.label}>
            <p className="m-0 text-[44px] font-semibold leading-none tabular-nums text-teal-700">{k.value}</p>
            <p className="m-0 mt-1 text-[14px] text-slate-500">{k.label}</p>
          </div>
        ))}
        {week ? <p className="m-0 mb-6 rounded-full bg-teal-50 px-3 py-1 text-[14px] font-medium text-teal-800">+{n(week)} in den letzten 7 Tagen</p> : null}
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
