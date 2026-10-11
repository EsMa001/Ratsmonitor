import { useState } from "react";
import { Reveal } from "./Reveal";
import { STATUS } from "../../lib/constants";
import { RadarDrill } from "./RadarDrill";

/* Kopfmodule der Themenradare mit Werten aus den Unterlagen (server/integrations/analytics-radar-extra.mjs):
   Hebesätze (Haushalt und Steuern), Abwasser- und Wassergebühren (Gebührenradar), Stand der Wärmeplanung (Klimaradar),
   Zuschüsse an Vereine und Träger (Vereine und Soziales). */
interface RateItem { id: string; title: string; region: string; date: string; status: string; from: number | null; to: number; unit: string }
interface RateBlock { name: string; regions: number; min: number | null; max: number | null; lands: { land: string; regions: number; median: number | null }[]; up: number; down: number; unit: string; items: RateItem[] }
interface HeatRegion { id: string; title: string; region: string; date: string; status: string; step: string }
interface Grant { id: string; title: string; region: string; date: string; status: string; purpose: string; euro: number }
export type Extra =
  | { kind: "hebesatz" | "fee_rate"; blocks: RateBlock[] }
  | { kind: "heat_plan"; steps: { name: string; regions: number }[]; regions: HeatRegion[]; total: number; topics: number }
  | { kind: "grant"; topics: number; regions: number; euro: number; amounts: number; median: number | null; purposes: { name: string; n: number; approved: number; regions: number; euro: number; amounts: number }[]; largest: Grant[] };

const n = (v: number) => v.toLocaleString("de-DE");
const euro = (v: number) => `${v.toLocaleString("de-DE", { maximumFractionDigits: 0 })} €`;
const DAY = new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "short", year: "2-digit" });
const statusLabel = (id: string) => STATUS.find((s) => s.id === id)?.label ?? "";
const SHOW = 8;

function Row({ href, title, sub, right }: { href: string; title: string; sub: string; right: React.ReactNode }) {
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 border-b border-slate-200 py-3">
      <a href={href} className="min-w-0 text-slate-900 no-underline hover:text-teal-700">
        <span className="block truncate text-[16px]">{title}</span>
        <span className="block truncate text-[12px] text-slate-500">{sub}</span>
      </a>
      <span className="self-center text-right text-[14px] tabular-nums">{right}</span>
    </li>
  );
}

function More<T>({ items, render }: { items: T[]; render: (x: T) => React.ReactNode }) {
  const [all, setAll] = useState(false);
  return (
    <>
      <ol className="m-0 mt-3 list-none border-t border-slate-200 p-0">{(all ? items : items.slice(0, SHOW)).map(render)}</ol>
      {items.length > SHOW && <button type="button" onClick={() => setAll(!all)} className="mt-2 text-[14px] text-teal-700 hover:underline">{all ? "Weniger zeigen" : `Alle ${n(items.length)} zeigen`}</button>}
    </>
  );
}

function Rates({ x }: { x: Extract<Extra, { kind: "hebesatz" | "fee_rate" }> }) {
  const tax = x.kind === "hebesatz";
  const fmt = (v: number) => (tax ? `${n(v)} %` : `${v.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`);
  const [pick, setPick] = useState(x.blocks[0]?.name ?? "");
  /* Klick auf Erhöhung oder Senkung zeigt nur diese Gebiete */
  const [change, setChange] = useState<"" | "up" | "down">("");
  const b = x.blocks.find((k) => k.name === pick) ?? x.blocks[0];
  if (!b) return null;
  const items = b.items.filter((i) => !change || (i.from !== null && (change === "up" ? i.to > i.from : i.to < i.from)));
  return (
    <Reveal><section className="mt-12">
      <h2 className="text-[22px] font-semibold">{tax ? "Hebesätze" : "Gebühren für Wasser und Abwasser"}</h2>
      <p className="mb-3 mt-1 max-w-[760px] text-[14px] text-slate-500">{tax
        ? "In den Unterlagen genannte Hebesätze, je Gemeinde der zuletzt genannte; bei Verbands- und Samtgemeinden gilt er für die Mitgliedsgemeinde, deren Rat berät. Abgelehnte Vorschläge zählen nicht. Mit „bisher“ ist eine Änderung genannt; ob sie beschlossen ist, zeigt der Status."
        : "In den Unterlagen genannte Gebührensätze je Kubik- oder Quadratmeter (netto oder brutto, wie genannt), je Gebiet der zuletzt genannte; abgelehnte Vorschläge und Nachkalkulationen zählen nicht. Mit „bisher“ ist eine Änderung genannt; ob sie beschlossen ist, zeigt der Status."}</p>
      {x.blocks.length > 1 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label={tax ? "Steuerart" : "Gebührenart"}>
          {x.blocks.map((k) => (
            <button key={k.name} type="button" aria-pressed={k.name === b.name} onClick={() => { setPick(k.name); setChange(""); }}
              className={`h-9 rounded-full border px-4 text-[14px] transition-colors ${k.name === b.name ? "border-teal-600 bg-teal-600 text-white" : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"}`}>{k.name}</button>
          ))}
        </div>
      )}
      <dl className="mt-5 grid grid-cols-2 gap-y-6 sm:grid-cols-4">
        {[["Gebiete mit Wert", n(b.regions)], b.lands.length === 1 ? [`Mitte (${b.lands[0].land})`, b.lands[0].median === null ? "–" : fmt(b.lands[0].median)] : ["Länder", n(b.lands.length)], ["Spanne", b.min === null ? "–" : `${fmt(b.min)} bis ${fmt(b.max ?? b.min)}`]].map(([k, v], i) => (
          <div key={k} className={`px-4 ${i % 2 ? "border-l border-slate-200" : ""} ${i ? "sm:border-l sm:border-slate-200" : "sm:pl-0"}`}><dt className="text-[12px] text-slate-500">{k}</dt><dd className="mt-1 text-[18px] font-semibold tabular-nums sm:text-[22px]">{v}</dd></div>
        ))}
        <div className="border-l border-slate-200 px-4"><dt className="text-[12px] text-slate-500">Erhöhung / Senkung</dt><dd className="mt-1 flex gap-1 text-[18px] font-semibold tabular-nums sm:text-[22px]">
          {(["up", "down"] as const).map((c, i) => <span key={c}>{i > 0 && <span className="mr-1 text-slate-400">/</span>}<button type="button" aria-pressed={change === c} disabled={!(c === "up" ? b.up : b.down)} onClick={() => setChange(change === c ? "" : c)} className={`rounded px-1 ${change === c ? "bg-teal-600 text-white" : "text-teal-700 underline decoration-dotted underline-offset-4 disabled:text-slate-900 disabled:no-underline"}`}>{n(c === "up" ? b.up : b.down)}</button></span>)}
        </dd></div>
      </dl>
      {b.lands.length > 1 && <p className="mt-4 text-[14px] text-slate-500"><span className="text-slate-700">Mitte je Land</span> (Grundsteuermodelle und Gebührenordnungen sind je Land verschieden, daher kein gemeinsamer Wert): {b.lands.map((l) => `${l.land} ${l.median === null ? "–" : fmt(l.median)} (${n(l.regions)})`).join(" · ")}</p>}
      {change && <p className="mt-4 text-[14px] text-slate-500">Nur Gebiete mit {change === "up" ? "Erhöhung" : "Senkung"}. <button type="button" onClick={() => setChange("")} className="text-teal-700 hover:underline">Alle zeigen</button></p>}
      <More key={`${b.name}|${change}`} items={items} render={(i) => (
        <Row key={i.id} href={`/beschluss/${i.id}`} title={i.region} sub={`${DAY.format(new Date(i.date))} · ${i.title}`}
          right={<><b className="font-semibold">{i.from ? `${fmt(i.from)} → ${fmt(i.to)}` : fmt(i.to)}</b>{statusLabel(i.status) && <span className="block text-[12px] text-slate-500">{statusLabel(i.status)}</span>}</>} />
      )} />
    </section></Reveal>
  );
}

function Heat({ x }: { x: Extract<Extra, { kind: "heat_plan" }> }) {
  const max = Math.max(1, ...x.steps.map((s) => s.regions));
  /* Klick auf einen Schritt zeigt nur die Gebiete mit diesem Stand */
  const [step, setStep] = useState("");
  const regions = x.regions.filter((r) => !step || r.step === step);
  return (
    <Reveal><section className="mt-12">
      <h2 className="text-[22px] font-semibold">Stand der Wärmeplanung</h2>
      <p className="mb-3 mt-1 max-w-[760px] text-[14px] text-slate-500">{`${n(x.total)} Gebiete mit Vorgängen zur kommunalen Wärmeplanung, je Gebiet der weiteste genannte Schritt. „Beschlossen“ zählt nur, wenn der Beschluss des Wärmeplans den Status beschlossen hat. Klick auf einen Schritt zeigt die Gebiete.`}</p>
      <ol className="m-0 list-none border-t border-slate-200 p-0">
        {x.steps.map((s, i) => (
          <li key={s.name} className="border-b border-slate-200"><button type="button" disabled={!s.regions} aria-pressed={step === s.name} onClick={() => setStep(step === s.name ? "" : s.name)} className={`grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2.5 text-left sm:grid-cols-[260px_minmax(0,1fr)_100px] ${step === s.name ? "bg-teal-50/60" : "hover:bg-slate-50"}`}>
            <span className="truncate text-[16px]"><span className="mr-2 text-[12px] tabular-nums text-slate-500">{i + 1}</span>{s.name}</span>
            <span className="order-3 col-span-2 block h-[8px] overflow-hidden rounded-full bg-slate-100 sm:order-none sm:col-span-1"><span className={`block h-full rounded-full ${s.name === "Wärmeplan beschlossen" || s.name === "Umsetzung und Fortschreibung" ? "bg-teal-600" : "bg-teal-400"}`} style={{ width: `${(s.regions / max) * 100}%` }} /></span>
            <span className="text-right text-[14px] tabular-nums"><b className="font-semibold">{n(s.regions)}</b><span className="ml-1 text-slate-500">Gebiete</span></span>
          </button></li>
        ))}
      </ol>
      <h3 className="mt-6 text-[16px] font-semibold">{step ? `Gebiete: ${step}` : "Gebiete nach Stand"}</h3>
      {step && <button type="button" onClick={() => setStep("")} className="text-[14px] text-teal-700 hover:underline">Alle Schritte zeigen</button>}
      <More key={step} items={regions} render={(r) => (
        <Row key={r.id} href={`/beschluss/${r.id}`} title={r.region} sub={`${DAY.format(new Date(r.date))} · ${r.title}`} right={<span className="text-[12px] text-slate-700">{r.step}</span>} />
      )} />
    </section></Reveal>
  );
}

function Grants({ x, radar, query }: { x: Extract<Extra, { kind: "grant" }>; radar: string; query: string }) {
  const max = Math.max(1, ...x.purposes.map((p) => p.n));
  const [open, setOpen] = useState("");
  return (
    <Reveal><section className="mt-12">
      <h2 className="text-[22px] font-semibold">Zuschüsse an Vereine und Träger</h2>
      <p className="mb-3 mt-1 max-w-[760px] text-[14px] text-slate-500">Vorgänge, in denen die Kommune selbst einen Zuschuss gewährt oder über ihre Vereins-, Sport- oder Kulturförderung berät. Das Thema „Vereinsförderung“ weiter unten zählt anders: dort genügt das Wort im Titel, hier muss ein Zuschuss an einen Verein oder Träger gemeint sein. Zweck aus dem Titel; Beträge nur, wo sie am Zuschuss genannt sind (ohne Höchstbeträge und Listen), daher eine Untergrenze. Klick auf einen Zweck zeigt die Vorgänge.</p>
      <dl className="mt-5 grid grid-cols-2 gap-y-6 sm:grid-cols-4">
        {[["Vorgänge", n(x.topics)], ["Gebiete", n(x.regions)], ["Genannte Beträge", euro(x.euro)], ["Mittlerer Betrag", x.median === null ? "–" : euro(x.median)]].map(([k, v], i) => (
          <div key={k} className={`px-4 ${i % 2 ? "border-l border-slate-200" : ""} ${i ? "sm:border-l sm:border-slate-200" : "sm:pl-0"}`}><dt className="text-[12px] text-slate-500">{k}</dt><dd className="mt-1 text-[18px] font-semibold tabular-nums sm:text-[22px]">{v}</dd></div>
        ))}
      </dl>
      <ol className="m-0 mt-6 list-none border-t border-slate-200 p-0">
        {x.purposes.map((p) => (
          <li key={p.name} className="border-b border-slate-200"><button type="button" aria-expanded={open === p.name} onClick={() => setOpen(open === p.name ? "" : p.name)} className={`grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 py-3 text-left sm:grid-cols-[260px_minmax(0,1fr)_220px] ${open === p.name ? "bg-teal-50/60" : "hover:bg-slate-50"}`}>
            <span className="truncate text-[16px]">{p.name}</span>
            <span className="order-3 col-span-2 block h-[8px] overflow-hidden rounded-full bg-slate-100 sm:order-none sm:col-span-1"><span className="block h-full rounded-full bg-teal-600" style={{ width: `${(p.n / max) * 100}%` }} /></span>
            <span className="text-right text-[14px] tabular-nums"><b className="font-semibold">{n(p.n)}</b><span className="ml-2 text-slate-500">{n(p.regions)} Gebiete</span>{p.amounts > 0 && <span className="block text-[12px] text-slate-500">{euro(p.euro)} aus {n(p.amounts)} Beträgen</span>}</span>
          </button>{open === p.name && <RadarDrill radar={radar} query={query} by="purpose" value={p.name} label={p.name} />}</li>
        ))}
      </ol>
      {x.largest.length > 0 && <>
        <h3 className="mt-6 text-[16px] font-semibold">Größte genannte Zuschüsse</h3>
        <More items={x.largest} render={(g) => (
          <Row key={g.id} href={`/beschluss/${g.id}`} title={g.title} sub={`${g.region} · ${DAY.format(new Date(g.date))} · ${g.purpose}`}
            right={<><b className="font-semibold">{euro(g.euro)}</b>{statusLabel(g.status) && <span className="block text-[12px] text-slate-500">{statusLabel(g.status)}</span>}</>} />
        )} />
      </>}
    </section></Reveal>
  );
}

/** Kopfmodul des Radars oder nichts */
export function RadarExtra({ extra, radar, query }: { extra: Extra | null | undefined; radar: string; query: string }) {
  if (!extra) return null;
  if (extra.kind === "heat_plan") return <Heat x={extra} />;
  if (extra.kind === "grant") return <Grants x={extra} radar={radar} query={query} />;
  return <Rates x={extra} />;
}
