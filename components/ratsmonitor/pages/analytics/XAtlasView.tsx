import Link from "next/link";
import { useState } from "react";
import { Laden } from "./Laden";
import { Befund } from "./Befund";
import { Reveal } from "./Reveal";
import { DiffusionSearch } from "./DiffusionSearch";
import { useAnalyticsQuery } from "./useAnalyticsQuery";
import { useAnalysisRun } from "./useAnalysisRun";
import { RadarDrill } from "./RadarDrill";
import { STATUS } from "../../lib/constants";

/* plenara.X Atlas auf der einen Abfrage (GET /api/x?view=atlas, server/integrations/plenara-x-query.mjs): je Thema die
   Unterthemen, was geschieht, der Verlauf, die Orte und die jüngsten Vorgänge; ohne Thema die 10 Themen. Gezählt werden
   Vorgänge (gleiche Titel je Gebiet einmal), Formalien nie; das Thema ist dasselbe wie im Themenfilter der Suche. */
interface Row { key: string; name: string; count: number; base: number; share: number | null; ags?: string }
interface Item { id: string; title: string; region: string; date: string; status: string; stage: string | null; subs: string[]; times: number }
interface CompareRow { key: string; name: string; k: number; share: number; q1: number; median: number; q3: number; ratio: number | null; class: "mehr" | "weniger" | "ueblich" | null }
interface Compare { region: string; from: string; to: string; n: number; months: number; insufficient?: "items" | "months" | "group"; rule: { minItems: number; minMonths: number; minTopic: number }; group?: { label: string; n: number }; rows?: CompareRow[] }
interface Result { selection: { theme: string; sub: string; stage: string; q: string }; total: number; unread: number; parts: Row[]; stages: Row[]; months: Row[]; regions: Row[]; recent: Item[]; compare: Compare | null; facts: Fact[] }
interface Fact { kind: string; name: string; sum: { kind: string; name: string } | null; rows: (Row & { sum?: number })[] }

const n = (v: number) => v.toLocaleString("de-DE");
const pct = (v: number | null) => (v === null ? "–" : `${v.toLocaleString("de-DE")} %`);
const MONTH = new Intl.DateTimeFormat("de-DE", { month: "short", year: "2-digit" });
const day = (iso: string) => (/^\d{4}-\d{2}-\d{2}/.test(iso || "") ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(2, 4)}` : "");
const statusLabel = (id: string) => STATUS.find((s) => s.id === id)?.label ?? "";
/* Orte erst ab so vielen Sachvorgängen in der Rangliste nach Anteil (sonst führen Orte mit 2 von 3 Vorgängen) */
const MIN_BASE = 30;

/** Eine Balkenliste; Klick öffnet die Vorgänge hinter der Zahl */
function Bars({ rows, open, onOpen, drill, value = (r) => r.count, label = (r) => n(r.count), muted = () => false }: {
  rows: Row[]; open: string; onOpen: (key: string) => void; drill: (r: Row) => React.ReactNode;
  value?: (r: Row) => number; label?: (r: Row) => string; muted?: (r: Row) => boolean;
}) {
  const max = Math.max(1, ...rows.map(value));
  return (
    <ol className="m-0 list-none border-t border-slate-200 p-0">
      {rows.map((r) => (
        <li key={r.key} className="border-b border-slate-200">
          <button type="button" onClick={() => onOpen(r.key)} aria-expanded={open === r.key}
            className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 py-2.5 text-left sm:grid-cols-[260px_minmax(0,1fr)_120px]">
            <span className={`truncate text-[16px] ${muted(r) ? "text-slate-500" : ""}`}>{r.name}</span>
            <span className="order-3 col-span-2 block h-[8px] overflow-hidden rounded-full bg-slate-100 sm:order-none sm:col-span-1">
              <span className={`block h-full rounded-full ${muted(r) ? "bg-slate-300" : "bg-teal-600"}`} style={{ width: `${(value(r) / max) * 100}%` }} />
            </span>
            <span className="text-right text-[14px] font-semibold tabular-nums">{label(r)}</span>
          </button>
          {open === r.key && drill(r)}
        </li>
      ))}
    </ol>
  );
}

const KLASSE = { mehr: "häufiger als üblich", weniger: "seltener als üblich", ueblich: "im üblichen Bereich" };
const ZU_WENIG = { items: "zu wenige Sachvorgänge", months: "zu wenige Monate mit Sitzungen", group: "keine ausreichend große Vergleichsgruppe" };

/** Ort im Vergleich: Anteil je Unterthema (ohne Thema: je Thema) an allen Sachvorgängen des eigenen Rats, eingeordnet in der Gruppe */
function OrtImVergleich({ c, theme }: { c: Compare; theme: string }) {
  if (c.insufficient) return (
    <section className="mt-10"><h2 className="text-[22px] font-semibold">{c.region} im Vergleich</h2>
      <p className="mt-2 max-w-[760px] text-[16px]">Keine Einordnung möglich: {ZU_WENIG[c.insufficient]} ({n(c.n)} Sachvorgänge in {n(c.months)} Monaten; nötig sind {n(c.rule.minItems)} in {n(c.rule.minMonths)} Monaten).</p></section>
  );
  const rows = [...(c.rows ?? [])].sort((a, b) => (b.class === "mehr" ? 2 : b.class === "weniger" ? 1 : 0) - (a.class === "mehr" ? 2 : a.class === "weniger" ? 1 : 0) || b.share - a.share);
  return (
    <section className="mt-10">
      <h2 className="text-[22px] font-semibold">{c.region} im Vergleich</h2>
      <p className="mb-3 mt-1 max-w-[760px] text-[14px] text-slate-500">Anteil an allen {n(c.n)} Sachvorgängen des eigenen Rats in den letzten 12 Monaten, verglichen mit {n(c.group!.n)} {c.group!.label}. „Üblich“ ist die mittlere Hälfte der Gruppe; eingeordnet wird erst ab {n(c.rule.minTopic)} Vorgängen und nur bei klarem Abstand.</p>
      <ol className="m-0 list-none border-t border-slate-200 p-0">
        {rows.map((r) => (
          <li key={r.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 border-b border-slate-200 py-2.5 sm:grid-cols-[260px_minmax(0,1fr)_auto]">
            <span className="truncate text-[16px]">{r.name}</span>
            <span className="order-3 col-span-2 text-[12px] text-slate-500 sm:order-none sm:col-span-1">üblich {pct(r.q1)} bis {pct(r.q3)}</span>
            <span className="text-right text-[14px] tabular-nums"><b className="font-semibold">{pct(r.share)}</b>
              <span className={`ml-2 ${r.class === "mehr" || r.class === "weniger" ? "text-slate-900" : "text-slate-500"}`}>{r.class ? KLASSE[r.class] + (r.ratio ? ` (${r.ratio.toLocaleString("de-DE")}-fach)` : "") : `${n(r.k)} Vorgänge`}</span></span>
          </li>
        ))}
      </ol>
      {!theme && <p className="mt-2 text-[12px] text-slate-500">Thema wählen, um die Unterthemen zu vergleichen.</p>}
    </section>
  );
}

/** theme: eines der 10 Themen oder "" (alle); sub: Unterthema oder ""; stage: Wert von „Was geschieht“ oder "" */
export function XAtlasView({ theme, sub, stage, onTheme, onSub }: { theme: string; sub: string; stage: string; onTheme: (id: string) => void; onSub: (id: string) => void }) {
  const { query } = useAnalyticsQuery();
  const sel = [theme && `theme=${theme}`, sub && `sub=${sub}`, stage && `stage=${stage}`].filter(Boolean).join("&");
  const url = `/api/x?view=atlas${sel ? "&" + sel : ""}&${query}`;
  const { res, ranKey, loading, error, stale, run } = useAnalysisRun<Result>({ key: url, url, initial: true, onDone: () => setOpen("") });
  /* Aufgeklappte Liste: "stage:bau", "month:2026-05", "region:<id>", "theme:bauen" */
  const [open, setOpen] = useState("");
  const toggle = (key: string) => setOpen(open === key ? "" : key);
  const listBase = `/api/x?list=1${sel ? "&" + sel : ""}`;
  /* Filter der zuletzt ausgewerteten Abfrage ohne Auswahl und Ansicht (die stehen in listBase) */
  const listQuery = (() => { const p = new URLSearchParams(ranKey.split("?")[1] ?? ""); for (const k of ["view", "theme", "sub", "stage"]) p.delete(k); return p.toString(); })();
  const drill = (by: string, r: Row) => <RadarDrill base={listBase} query={listQuery} by={by} value={r.key} label={r.name} />;
  const opened = (by: string) => (open.startsWith(by + ":") ? open.slice(by.length + 1) : "");

  const parts = res?.parts ?? [];
  const regions = [...(res?.regions ?? [])].filter((r) => r.base >= MIN_BASE).sort((a, b) => (b.share ?? 0) - (a.share ?? 0)).slice(0, 15);
  const stages = (res?.stages ?? []).filter((s) => s.key !== "");
  const maxM = Math.max(1, ...(res?.months ?? []).map((m) => m.count));
  const month = opened("month");

  return (
    <section aria-label="Auswertung des Themas">
      <div className="mt-4 print:hidden"><DiffusionSearch play={loading ? "loading" : "idle"} onPlay={() => !loading && run()} onSubmit={() => run()} startLabel="Auswerten" /></div>
      {error && <p role="alert" className="mt-4 text-[14px] text-slate-900">{error}</p>}
      {stale && <p className="mt-3 text-[14px] text-slate-500">Suche oder Filter wurden geändert. Mit dem Start-Knopf neu auswerten.</p>}
      {loading && !res && <Laden text="Auswertung wird berechnet …" />}
      {res && (
        <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
          {res.total === 0 ? <p className="mt-10 text-[16px]">Für diese Auswahl gibt es keine Vorgänge.</p> : (
            <>
              <Befund>{`${n(res.total)} Vorgänge in ${n(res.regions.length)} Gebieten${res.selection.q ? ` zur Suche „${res.selection.q}“` : ""}.`}</Befund>

              {res.compare && <Reveal><OrtImVergleich c={res.compare} theme={theme} /></Reveal>}

              <Reveal><section className="mt-10">
                <h2 className="text-[22px] font-semibold">{theme ? "Unterthemen" : "Themen"}</h2>
                <p className="mb-3 mt-1 max-w-[760px] text-[14px] text-slate-500">{theme
                  ? "Ein Vorgang kann mehrere Unterthemen haben; erkannt am Titel, sonst an Betreff und Beschlussvorschlag. Klick wählt das Unterthema."
                  : "Vorgänge je Thema; das Thema ist dasselbe wie im Themenfilter der Suche. Klick wählt das Thema."}</p>
                {theme && sub && <button type="button" onClick={() => onSub("")} className="mb-3 text-[14px] font-medium text-teal-700 hover:underline">Alle Unterthemen zeigen →</button>}
                <Bars rows={parts} open="" onOpen={(k) => (theme ? onSub(k === sub ? "" : k) : onTheme(k))} drill={() => null} muted={(r) => r.key === "unklar"}
                  label={(r) => `${n(r.count)}${r.share !== null && theme ? ` · ${pct(r.share)}` : ""}`} />
              </section></Reveal>

              {stages.length > 1 && <Reveal><section className="mt-12">
                <h2 className="text-[22px] font-semibold">Was geschieht</h2>
                <p className="mb-3 mt-1 text-[14px] text-slate-500">Art der Vorgänge, aus dem Titel gelesen (Antrag, Planung, Vergabe, Bau …). Klick zeigt die Vorgänge.</p>
                <Bars rows={stages} open={opened("stage")} onOpen={(k) => toggle(`stage:${k}`)} drill={(r) => drill("stage", r)} muted={(r) => r.key === "sonst"} />
              </section></Reveal>}

              {res.months.length > 1 && <Reveal><section className="mt-12">
                <h2 className="text-[22px] font-semibold">Im Zeitverlauf</h2>
                <p className="mb-3 mt-1 text-[14px] text-slate-500">Vorgänge je Monat der Sitzung. Klick auf einen Monat zeigt seine Vorgänge.</p>
                <div className="flex h-[150px] items-end gap-1.5 border-b border-slate-200">
                  {res.months.map((m) => <button type="button" key={m.key} onClick={() => toggle(`month:${m.key}`)} aria-expanded={month === m.key} aria-label={`${MONTH.format(new Date(m.key + "-01"))}: ${n(m.count)} Vorgänge`}
                    className="flex h-full min-w-0 flex-1 items-end"><span className={`block w-full rounded-t ${month === m.key ? "bg-slate-900" : "bg-teal-600"}`} style={{ height: `${(m.count / maxM) * 100}%` }} /></button>)}
                </div>
                <div className="mt-1 flex gap-1.5 text-[12px] text-slate-500">{res.months.map((m) => <span key={m.key} className="min-w-0 flex-1 truncate text-center">{MONTH.format(new Date(m.key + "-01"))}</span>)}</div>
                {month && <div className="mt-3">{drill("month", res.months.find((m) => m.key === month)!)}</div>}
              </section></Reveal>}

              {res.facts.length > 0 && <Reveal><section className="mt-12">
                <h2 className="text-[22px] font-semibold">Werte aus den Unterlagen</h2>
                <p className="mb-1 mt-1 max-w-[760px] text-[14px] text-slate-500">Aus den Texten der Unterlagen gelesen; gezeigt wird nur, was in Stichproben zu mindestens 90 % stimmte. Klick zeigt die Vorgänge.</p>
                {res.facts.map((f) => (
                  <div key={f.kind} className="mt-6">
                    <h3 className="mb-2 text-[16px] font-semibold">{f.name}</h3>
                    <Bars rows={f.rows} open={opened("fact:" + f.kind)} onOpen={(k) => toggle(`fact:${f.kind}:${k}`)} drill={(r) => drill("fact:" + f.kind, r)}
                      label={(r) => `${n(r.count)}${f.sum ? ` · ${n((r as Row & { sum?: number }).sum ?? 0)} ${f.sum.name}` : ""}`} />
                  </div>
                ))}
              </section></Reveal>}

              {regions.length > 0 && <Reveal><section className="mt-12">
                <h2 className="text-[22px] font-semibold">Wo das Thema viel Raum hat</h2>
                <p className="mb-3 mt-1 max-w-[760px] text-[14px] text-slate-500">Anteil an allen Sachvorgängen des Gebiets (gleiche Filter), nur Gebiete mit mindestens {MIN_BASE} Sachvorgängen. Klick zeigt die Vorgänge.</p>
                <Bars rows={regions} open={opened("region")} onOpen={(k) => toggle(`region:${k}`)} drill={(r) => drill("region", r)} value={(r) => r.share ?? 0}
                  label={(r) => `${pct(r.share)} · ${n(r.count)}`} />
              </section></Reveal>}

              <Reveal><section className="mt-12">
                <h2 className="text-[22px] font-semibold">Jüngste Vorgänge</h2>
                <ol className="m-0 mt-3 list-none border-t border-slate-200 p-0">
                  {res.recent.map((r) => (
                    <li key={r.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 border-b border-slate-200 py-3">
                      <Link href={`/beschluss/${r.id}`} className="min-w-0 text-slate-900 no-underline hover:text-teal-800">
                        <span className="block truncate text-[16px]">{r.title}</span>
                        <span className="block truncate text-[12px] text-slate-500">{[r.region, day(r.date), r.times > 1 && `in ${r.times} Sitzungen`].filter(Boolean).join(" · ")}</span>
                      </Link>
                      <span className="self-center text-right text-[12px] text-slate-500">{statusLabel(r.status)}</span>
                    </li>
                  ))}
                </ol>
              </section></Reveal>

              <p className="mt-10 max-w-[900px] text-[12px] text-slate-500">Gezählt werden Vorgänge: derselbe Titel in mehreren Gremien eines Gebiets zählt einmal. Formalien, Sammelpunkte, Besetzungen und Fragestunden zählen nicht.{res.unread ? ` ${n(res.unread)} Vorgänge sind noch nicht mit ihren Unterlagen gelesen; sie zählen beim Thema, aber noch ohne Unterthema und ohne „Was geschieht“.` : ""}</p>
            </>
          )}
        </div>
      )}
    </section>
  );
}
