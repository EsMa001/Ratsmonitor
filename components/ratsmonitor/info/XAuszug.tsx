import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { RegionMap } from "../pages/analytics/RegionMap";
import { pctText } from "../lib/format";

/* plenara.X auf den Anwenderseiten: fest gewählte Auszüge aus /api/x/teaser (server/integrations/plenara-x-teaser.mjs), nur die
   Zusammenfassung; Listen, Filter und Blättern bleiben im Werkzeug (Tarif Enterprise). Erster Auszug groß mit Karte, weitere klein. */

interface Phase { key: string; name: string; count: number }
interface SignalAuszug { id: string; signal: string; name: string; months: number; builtAt: string | null; total: number; placeCount: number; firstCount: number; phases: Phase[];
  places: { ags: string; count: number; members?: string[] }[]; items: { id: string; date: string; status: string; title: string; place: string; phase: string }[] }
interface WertAuszug { id: string; fakt: string; wert: string; name: string; unit: string; count: number; median: number | null; q1: number | null; q3: number | null; up: number; down: number }
interface NewsAuszug { id: string; news: true; items: { id: string; headline: string; place: string; committee: string; date: string; quote: string }[] }
interface TrendAuszug { id: string; trend: true; label: string; window: number; items: { term: string; count: number; ratio: number; regions: number; regionsPrev: number }[] }
interface NetzAuszug { id: string; netz: true; paths: number; items: { from: string; to: string; count: number; days: number }[] }
interface AusgangAuszug { id: string; ausgang: true; decided: number; approval: number | null; postponement: number | null; rejection: number | null; median: number | null; unanimous: number | null }
type Auszug = SignalAuszug | WertAuszug | NewsAuszug | TrendAuszug | NetzAuszug | AusgangAuszug;

const n = (v: number) => v.toLocaleString("de-DE");
const MON = ["JAN", "FEB", "MÄR", "APR", "MAI", "JUN", "JUL", "AUG", "SEP", "OKT", "NOV", "DEZ"];

function useAuszug(id: string) {
  const [res, setRes] = useState<{ id: string; data: Auszug | null } | null>(null);
  useEffect(() => {
    const c = new AbortController();
    fetch(`/api/x/teaser?id=${encodeURIComponent(id)}`, { signal: c.signal }).then((r) => (r.ok ? (r.json() as Promise<Auszug>) : null))
      .then((data) => setRes({ id, data })).catch(() => { if (!c.signal.aborted) setRes({ id, data: null }); });
    return () => c.abort();
  }, [id]);
  return res?.id === id ? res : null;
}

/** Punkte je Gemeinde wie auf der Signale-Seite (Verbände verteilen ihre Punkte auf die Mitglieder) */
function dotsOf(places: SignalAuszug["places"]) {
  const dots: Record<string, number> = {};
  for (const p of places) {
    const keys = p.ags.length === 8 ? [p.ags] : (p.members ?? []).filter((m) => m.length === 8);
    keys.forEach((a, i) => { const k = Math.floor(p.count / keys.length) + (i < p.count % keys.length ? 1 : 0); if (k) dots[a] = (dots[a] ?? 0) + k; });
  }
  return dots;
}

function SignalBlock({ a, label }: { a: SignalAuszug; label: string }) {
  /* Die Karte steht bündig zur Überschrift des Abschnitts: Abstand von dort bis zu diesem Block nach oben ziehen (nur ab lg, wo sie rechts steht) */
  const wrap = useRef<HTMLDivElement>(null);
  const [hoch, setHoch] = useState(0);
  useLayoutEffect(() => {
    const messen = () => {
      const h = wrap.current?.closest("section")?.querySelector("h2");
      setHoch(h && wrap.current ? Math.max(0, Math.round(wrap.current.getBoundingClientRect().top - h.getBoundingClientRect().top)) : 0);
    };
    messen();
    window.addEventListener("resize", messen);
    return () => window.removeEventListener("resize", messen);
  }, [a]);
  return (
    <div ref={wrap} className="grid items-start gap-x-12 gap-y-8 lg:grid-cols-[minmax(0,1fr)_420px]">
      <div>
        <p className="m-0 flex flex-wrap items-baseline gap-x-3">
          <span className="text-[44px] font-semibold leading-none text-teal-700 tabular-nums">{n(a.total)}</span>
          <span className="text-[18px] text-slate-900">{label} in {n(a.placeCount)} Kommunen, letzte {a.months} Monate</span>
        </p>
        {a.firstCount > 0 && <p className="m-0 mt-2 text-[14px] text-slate-500">{n(a.firstCount)} {a.firstCount === 1 ? "Ort berät" : "Orte beraten"} das Thema zum ersten Mal.</p>}
        {a.items.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <p className="m-0 text-[14px] font-semibold text-slate-900">Neueste Vorhaben</p>
            <ul className="m-0 mt-1 list-none p-0">
              {a.items.map((it) => (
                <li key={it.id} className="grid grid-cols-[44px_minmax(0,1fr)] gap-3 border-b border-slate-200 py-2.5">
                  {/* Datum links wie in der Trefferliste der Suche (ArticleCard) */}
                  <span aria-hidden="true" className="flex flex-col items-center border-r border-slate-200 pr-2 text-center">
                    <span className="text-[22px] font-semibold leading-none">{Number(it.date.slice(8, 10))}</span>
                    <span className="mt-1 text-[12px] font-semibold tracking-[.06em] text-teal-700">{MON[Number(it.date.slice(5, 7)) - 1]}</span>
                    <span className="text-[12px] text-slate-500">{it.date.slice(2, 4)}</span>
                  </span>
                  <span className="min-w-0">
                    <Link href={`/beschluss/${it.id}`} className="line-clamp-2 text-[16px] text-slate-900 hover:text-teal-700">{it.title}</Link>
                    <span className="mt-0.5 block text-[14px] text-slate-500">{[it.place, it.phase].filter(Boolean).join(" · ")}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <Link href={`/analytics/signale?signal=${a.signal}`} className="mt-4 inline-block text-[16px] text-teal-700 hover:underline">Alle Vorhaben in plenara.X Signale →</Link>
      </div>
      <div className="lg:mt-[var(--hoch)]" style={{ "--hoch": `${-hoch}px` } as CSSProperties}>
        <RegionMap level="city" levels={{}} dots={dotsOf(a.places)} colors={["var(--rm-fill)"]} picked="" onPick={() => {}} legend={["1 Punkt = 1 Vorhaben"]} label={`Karte: ${label} je Gemeinde`} />
      </div>
    </div>
  );
}

const pct = (v: number | null) => pctText(v, 1);
const Gross = ({ zahl, text }: { zahl: string; text: React.ReactNode }) => (
  <p className="m-0 flex flex-wrap items-baseline gap-x-3"><span className="text-[44px] font-semibold leading-none text-teal-700 tabular-nums">{zahl}</span><span className="text-[18px] text-slate-900">{text}</span></p>
);
const Mehr = ({ href, children }: { href: string; children: React.ReactNode }) => <Link href={href} className="mt-4 inline-block text-[16px] text-teal-700 hover:underline">{children} →</Link>;
const Datum = ({ iso }: { iso: string }) => (
  <span aria-hidden="true" className="flex flex-col items-center border-r border-slate-200 pr-2 text-center">
    <span className="text-[22px] font-semibold leading-none">{Number(iso.slice(8, 10))}</span>
    <span className="mt-1 text-[12px] font-semibold tracking-[.06em] text-teal-700">{MON[Number(iso.slice(5, 7)) - 1]}</span>
    <span className="text-[12px] text-slate-500">{iso.slice(2, 4)}</span>
  </span>
);

function WertBlock({ a }: { a: WertAuszug }) {
  if (a.median === null) return <p className="m-0 text-[16px] text-slate-500">Noch keine Werte.</p>;
  return (
    <div>
      <Gross zahl={`${n(a.median)} ${a.unit}`} text={<>Median {a.name} · {a.wert}</>} />
      <p className="m-0 mt-2 text-[16px] text-slate-700">Üblich <b className="font-semibold text-slate-900">{n(a.q1!)} bis {n(a.q3!)} {a.unit}</b> <span className="text-slate-500">· {n(a.count)} Gemeinden mit Wert aus den Vorlagen{a.up + a.down > 0 ? `, seit dem vorigen Wert ${a.up} höher, ${a.down} niedriger` : ""}</span></p>
      <Mehr href={`/analytics/fakten?fakt=${a.fakt}&wert=${encodeURIComponent(a.wert)}`}>Karte aller Gemeinden in plenara.X Fakten</Mehr>
    </div>
  );
}

function NewsBlock({ a }: { a: NewsAuszug }) {
  return (
    <div>
      <ul className="m-0 list-none p-0">
        {a.items.map((it) => (
          <li key={it.id} className="grid grid-cols-[44px_minmax(0,1fr)] gap-3 border-b border-slate-200 py-3">
            <Datum iso={it.date} />
            <span className="min-w-0">
              <Link href={`/beschluss/${it.id}`} className="line-clamp-2 text-[16px] font-semibold text-slate-900 hover:text-teal-700">{it.headline}</Link>
              {it.quote && <span className="mt-1 line-clamp-2 block text-[14px] text-slate-700">„{it.quote}“</span>}
              <span className="mt-0.5 block text-[14px] text-slate-500">{[it.place, it.committee].filter(Boolean).join(" · ")}</span>
            </span>
          </li>
        ))}
      </ul>
      <Mehr href="/analytics/news">Alle Meldungen in plenara.X Aktuelles</Mehr>
    </div>
  );
}

function TrendBlock({ a }: { a: TrendAuszug }) {
  const top = a.items[0];
  if (!top) return <p className="m-0 text-[16px] text-slate-500">Gerade kein deutlicher Anstieg.</p>;
  return (
    <div>
      <Gross zahl={`×${top.ratio.toLocaleString("de-DE", { maximumFractionDigits: 1 })}`} text={<>„{top.term}“ in den letzten {a.window} Tagen gegenüber den {a.window} davor{a.label ? ` (${a.label})` : ""}</>} />
      <ul className="m-0 mt-4 list-none p-0">
        {a.items.map((x) => (
          <li key={x.term} className="flex items-baseline justify-between gap-3 border-b border-slate-200 py-2 text-[16px]">
            <span className="min-w-0 truncate text-slate-900">{x.term.charAt(0).toUpperCase() + x.term.slice(1)} <span className="text-[14px] text-slate-500">{n(x.count)} Vorgänge</span></span>
            <span className="flex-none text-[14px] tabular-nums text-slate-500"><b className="font-semibold text-teal-700">×{x.ratio.toLocaleString("de-DE", { maximumFractionDigits: 1 })}</b> · +{n(Math.max(0, x.regions - x.regionsPrev))} Gebiete</span>
          </li>
        ))}
      </ul>
      <Mehr href="/analytics/trends">Alle Begriffe in plenara.X Trends</Mehr>
    </div>
  );
}

function NetzBlock({ a }: { a: NetzAuszug }) {
  return (
    <div>
      <Gross zahl={n(a.paths)} text="Vorgänge liefen durch mehrere Gremien" />
      <p className="m-0 mt-4 text-[14px] font-semibold text-slate-900">Häufigste Wege, Tage im Mittel bis zum nächsten Gremium</p>
      <ul className="m-0 mt-1 list-none p-0">
        {a.items.map((e) => (
          <li key={e.from + e.to} className="flex items-baseline justify-between gap-3 border-b border-slate-200 py-2 text-[16px]">
            <span className="min-w-0 text-slate-900">{e.from} → {e.to} <span className="text-[14px] text-slate-500">{n(e.count)} Vorgänge</span></span>
            <span className="flex-none text-[14px] font-semibold tabular-nums text-teal-700">{n(e.days)} Tage</span>
          </li>
        ))}
      </ul>
      <Mehr href="/analytics/gremien">Alle Wege in plenara.X Gremien</Mehr>
    </div>
  );
}

function AusgangBlock({ a }: { a: AusgangAuszug }) {
  return (
    <div>
      <Gross zahl={pct(a.approval)} text={`der ${n(a.decided)} entschiedenen Vorgänge beschlossen`} />
      <ul className="m-0 mt-4 grid list-none gap-x-8 gap-y-2 p-0 text-[16px] sm:grid-cols-2">
        <li><b className="font-semibold text-slate-900">{pct(a.postponement)}</b> <span className="text-slate-500">vertagt</span></li>
        <li><b className="font-semibold text-slate-900">{pct(a.rejection)}</b> <span className="text-slate-500">abgelehnt</span></li>
        {a.median !== null && <li><b className="font-semibold text-slate-900">{n(a.median)} Tage</b> <span className="text-slate-500">im Mittel bis zur Entscheidung</span></li>}
        {a.unanimous !== null && <li><b className="font-semibold text-slate-900">{pct(a.unanimous)}</b> <span className="text-slate-500">einstimmig, wo das Ergebnis bekannt ist</span></li>}
      </ul>
      <Mehr href="/analytics/beschluesse">Mehr in plenara.X Ausgang</Mehr>
    </div>
  );
}

function Block({ id, label }: { id: string; label: string }) {
  const r = useAuszug(id);
  if (!r) return <div className="h-72 animate-pulse rounded-xl bg-slate-50" aria-hidden="true" />;
  const a = r.data;
  if (!a) return <p className="m-0 text-[16px] text-slate-500">Gerade nicht erreichbar.</p>;
  if ("fakt" in a) return <WertBlock a={a} />;
  if ("news" in a) return <NewsBlock a={a} />;
  if ("trend" in a) return <TrendBlock a={a} />;
  if ("netz" in a) return <NetzBlock a={a} />;
  if ("ausgang" in a) return <AusgangBlock a={a} />;
  return <SignalBlock a={a} label={label} />;
}

/** Block „Was plenara für … zeigt“: auszuege = [Schlüssel, Bezeichnung]; Chips wechseln den gezeigten Auszug */
export function XAuszug({ name, auszuege }: { name: string; auszuege: [string, string, string?][] }) {
  const [sel, setSel] = useState(0);
  const [id, label] = auszuege[Math.min(sel, auszuege.length - 1)];
  return (
    <section className="ri-sec">
      <h2 className="ri-h2">Was plenara für {name} zeigt</h2>
      <p className="ri-sub">Aus den Vorlagen aller Räte, jede Zahl mit den Vorgängen dahinter.</p>
      {auszuege.length > 1 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Auszug wählen" style={{ marginTop: 16 }}>
          {auszuege.map(([k, l, chip], i) => <button key={k} type="button" aria-pressed={sel === i} onClick={() => setSel(i)} className={"rounded-full border px-3 py-1.5 text-[14px] " + (sel === i ? "border-teal-600 bg-teal-700 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-teal-600 hover:text-teal-700")}>{chip ?? l}</button>)}
        </div>
      )}
      <div style={{ marginTop: 24 }}><Block key={id} id={id} label={label} /></div>
    </section>
  );
}
