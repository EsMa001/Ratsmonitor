import { Reveal } from "./Reveal";

/* „Ist das viel oder wenig?“ für einen gewählten Ort (server/integrations/analytics-radar-norms.mjs): Anteil eines Themas an
   allen Sachvorgängen des eigenen Rats, mit Spanne, gegenüber der mittleren Hälfte vergleichbarer Gebiete. */
export interface NormTopic { name: string; k: number; share: number; lo: number; hi: number; q1: number; median: number; q3: number; ratio: number | null; class: "mehr" | "weniger" | "ueblich" | null }
export interface Norms {
  region: string; from: string; to: string; n: number; months: number; minItems: number; minMonths: number; minTopic: number;
  insufficient?: "items" | "months" | "group"; group?: { label: string; n: number }; topics?: NormTopic[];
}

const n = (v: number) => v.toLocaleString("de-DE");
const p = (v: number) => `${v.toLocaleString("de-DE", { maximumFractionDigits: 1 })} %`;
const datum = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("de-DE");
const CLASS: Record<string, [string, string]> = {
  mehr: ["häufiger als üblich", "bg-teal-50 text-teal-800"],
  weniger: ["seltener als üblich", "bg-slate-100 text-slate-800"],
  ueblich: ["im üblichen Bereich", "text-slate-500"],
};

/** Satz für den Befund oben: wie viele Themen häufiger oder seltener vorkommen */
export function normsSentence(x: Norms | null | undefined) {
  if (!x?.topics) return "";
  const more = x.topics.filter((t) => t.class === "mehr").map((t) => `„${t.name}“`), less = x.topics.filter((t) => t.class === "weniger").map((t) => `„${t.name}“`);
  if (!more.length && !less.length) return ` Im Vergleich mit ${n(x.group?.n ?? 0)} ähnlichen Gebieten liegt kein Thema klar über oder unter dem Üblichen.`;
  return ` Im Vergleich mit ${n(x.group?.n ?? 0)} ähnlichen Gebieten ${[more.length && `häufiger als üblich: ${more.join(", ")}`, less.length && `seltener als üblich: ${less.join(", ")}`].filter(Boolean).join("; ")}.`;
}

export function RadarNorms({ x }: { x: Norms }) {
  const union = /^(Verbandsgemeinde|Samtgemeinde|Amt|Verwaltungsgemeinschaft) /.test(x.region);
  const head = `Anteil an allen ${n(x.n)} Sachvorgängen ${union ? "der Räte" : "des Rats"} (${x.region}${union ? " mit den Mitgliedsgemeinden" : ""}; ohne Formalien, einzeln geführte Einwohnerfragen und doppelte Titel) vom ${datum(x.from)} bis ${datum(x.to)}`;
  if (x.insufficient) {
    return (
      <Reveal><section className="mt-12">
        <h2 className="text-[22px] font-semibold">Im Vergleich: viel oder wenig?</h2>
        <p className="mt-1 max-w-[760px] text-[14px] text-slate-500">{x.insufficient === "group"
          ? "Für dieses Gebiet gibt es zu wenige vergleichbare Gebiete mit vollständigen Unterlagen."
          : `Für einen Vergleich reichen die Unterlagen nicht: ${n(x.n)} Sachvorgänge in ${n(x.months)} Monaten mit Sitzungen; nötig sind mindestens ${n(x.minItems)} Vorgänge und ${x.minMonths} Monate in den letzten 12 Monaten.`}</p>
      </section></Reveal>
    );
  }
  const topics = [...(x.topics ?? [])].sort((a, b) => b.share - a.share);
  const max = Math.max(0.5, ...topics.map((t) => Math.max(t.hi, t.q3)));
  const at = (v: number) => `${(v / max) * 100}%`;
  return (
    <Reveal><section className="mt-12">
      <h2 className="text-[22px] font-semibold">Im Vergleich: viel oder wenig?</h2>
      <p className="mb-3 mt-1 max-w-[760px] text-[14px] text-slate-500">{`${head}, verglichen mit ${n(x.group?.n ?? 0)} ${x.group?.label}. Grauer Bereich: mittlere Hälfte dieser Gebiete; Punkt mit Linie: ${x.region} mit Spanne. Eingeordnet wird erst ab ${x.minTopic} Vorgängen.`}</p>
      <ol className="m-0 list-none border-t border-slate-200 p-0">
        {topics.map((t) => {
          const [label, cls] = t.class ? CLASS[t.class] : ["zu wenige Vorgänge", "text-slate-400"];
          return (
            <li key={t.name} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 border-b border-slate-200 py-3 sm:grid-cols-[240px_minmax(0,1fr)_190px]">
              <span className="truncate text-[16px]">{t.name}</span>
              <span className="order-3 col-span-2 sm:order-none sm:col-span-1">
                <span className="relative block h-[14px]" role="img" aria-label={`${t.name}: ${p(t.share)}, vergleichbare Gebiete mittlere Hälfte ${p(t.q1)} bis ${p(t.q3)}`}>
                  <span className="absolute inset-x-0 top-[6px] h-[2px] rounded bg-slate-100" />
                  <span className="absolute top-[3px] h-[8px] rounded bg-slate-200" style={{ left: at(t.q1), width: `calc(${at(t.q3 - t.q1)} + 2px)` }} />
                  <span className="absolute top-[1px] h-[12px] w-[2px] bg-slate-400" style={{ left: at(t.median) }} />
                  <span className="absolute top-[6px] h-[2px] bg-teal-600/50" style={{ left: at(t.lo), width: at(t.hi - t.lo) }} />
                  <span className="absolute top-[2px] -ml-[5px] h-[10px] w-[10px] rounded-full bg-teal-600 ring-2 ring-white" style={{ left: at(t.share) }} />
                </span>
              </span>
              <span className="text-right text-[14px] tabular-nums"><b className="font-semibold">{p(t.share)}</b><span className={`ml-2 rounded-full px-2 py-0.5 text-[12px] ${cls}`}>{label}</span></span>
              <span className="order-4 col-span-2 text-[12px] text-slate-500 sm:col-span-3">{`${n(t.k)} von ${n(x.n)} Vorgängen (Spanne ${p(t.lo)} bis ${p(t.hi)}) · vergleichbare Gebiete: Mitte ${p(t.median)}, mittlere Hälfte ${p(t.q1)} bis ${p(t.q3)}${t.ratio !== null ? ` · ${t.ratio.toLocaleString("de-DE")}-fach der Mitte` : ""}`}</span>
            </li>
          );
        })}
      </ol>
      <p className="mt-3 max-w-[900px] text-[12px] text-slate-500">Gezählt wird, wie oft ein Thema in den Ratsunterlagen vorkommt, nicht, was umgesetzt wurde: Ein Vorhaben, das mehrfach vertagt wird, zählt öfter. Manche Aufgaben liegen oft beim Kreis (etwa Jugendhilfe, Kita-Bedarfsplanung, ÖPNV); dann steht im Gemeinderat wenig, ohne dass vor Ort wenig geschieht. Die Spanne zeigt, wie stark die Zahl bei so wenigen Vorgängen zufällig schwanken kann.</p>
    </section></Reveal>
  );
}
