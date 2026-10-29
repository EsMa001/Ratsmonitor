import { IS_DEV, priceShort, setTier } from "../../lib/tier";
import { AboModels } from "../../components/AboModels";
import { XKopf } from "./XKopf";
import { LiveThumb } from "../../info/BranchenLive";
import { ANALYSEN, NEU_NAME, type AnalyseId } from "../../info/branchen-enterprise";

/* Was eine gesperrte Analyse zeigt: Pfad, Analyse, Beispielbegriff der Vorschau und ein Satz dazu */
const VORSCHAU: Record<string, { id: AnalyseId; term: string; text: string; thumb?: false }> = {
  "/analytics/graph": { id: "graph", term: "Photovoltaik", text: "Zeigt, womit ein Thema zusammenhängt: verwandte Begriffe, Themenfelder, Gremien und Länder als Netz." },
  "/analytics/trends": { id: "trends", term: "Photovoltaik", text: "Zeigt, welche Begriffe gerade aufkommen, zunehmen oder verschwinden, mit Verlaufskurven." },
  "/analytics/vergleich": { id: "vergleich", term: "Köln und Dortmund", text: "Stellt zwei Orte nebeneinander: Themenprofil, Verlauf, aktivste Gremien und typische Begriffe." },
  "/analytics/beschluesse": { id: "beschluesse", term: "Photovoltaik", text: "Zeigt, wie Vorgänge stehen und ausgehen: Beschlussquote, Vertagungen, Ablehnungen und die Dauer bis zur Entscheidung." },
  "/analytics/atlas": { id: "atlas", term: "", thumb: false, text: "Zeigt, worüber wo beraten wird: zehn Themen auf der Karte, nach Ort, Monat und Status, mit den Vorgängen hinter jeder Zahl." },
  "/analytics/signale": { id: "signale", term: "", thumb: false, text: "Zeigt neue Ereignisse je Branche als Liste mit Ort, Stand und Quelle: was entsteht, bevor es in der Zeitung steht." },
  "/analytics/ausschreibungen": { id: "ausschreibungen", term: "", thumb: false, text: "Zeigt Ausschreibungen und Vergaben aus den Ratsunterlagen mit Ort, Stand und Quelle." },
  "/analytics/news": { id: "news", term: "", thumb: false, text: "Zeigt, was gerade berichtenswert ist: Vorgänge mit Ausgang, Streit oder ungewöhnlich viel Aufmerksamkeit." },
  "/analytics/fakten": { id: "fakten", term: "", thumb: false, text: "Zeigt belegte Einzelwerte aus den Unterlagen je Gemeinde auf der Karte, etwa Hebesätze." },
  "/analytics/fraktionen": { id: "fraktionen", term: "", thumb: false, text: "Zeigt, welche Fraktion was beantragt und wie die Anträge ausgehen." },
  "/analytics/gremien": { id: "gremien", term: "Photovoltaik", text: "Zeigt, welchen Weg Vorgänge durch die Gremien nehmen und wo sie entschieden werden." },
};

/** Hinweis statt Analyse für alle ohne Plus (der Server antwortet ihnen mit 403) */
export function AnalyticsLocked({ path = "" }: { path?: string }) {
  const v = VORSCHAU[path];
  /* Neue Seite plenara.X Trends unter der früheren Adresse der Trends: ihr Name, nicht „Alt: …“ */
  const title = v ? NEU_NAME[v.id] || ANALYSEN[v.id].name : "";
  return (
    <main id="inhalt" className="w-full px-[max(1vw,16px)] pb-12 text-slate-900">
      {/* Gleicher Kopf wie die Seite selbst (Titel und Frage); darunter, was Plus freischaltet */}
      <XKopf seite={(path.split("/").pop() || "atlas") as Parameters<typeof XKopf>[0]["seite"]} />
      <section aria-label="Freischalten" className="mt-2 max-w-[760px]">
        {v && <p className="m-0 text-[18px] leading-relaxed text-slate-700">{v.text}</p>}
        <p className="mt-3 text-[16px] text-slate-500">Die Analysen von plenara.X gehören zu Plus und Pro: alle Analysen für ganz Deutschland, ab {priceShort("plus")} im Monat.</p>
        {/* Wie an jeder Grenze: die Abo-Modelle */}
        <AboModels className="mt-5 max-w-[460px]" />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {IS_DEV && (
            <button type="button" onClick={() => setTier("plus")} className="ml-auto text-[12px] text-slate-500 underline underline-offset-2 hover:text-slate-700">
              Dev: als Plus fortfahren
            </button>
          )}
        </div>
      </section>
      {/* Live-Vorschau mit echten Daten, wo es eine gibt */}
      {v && v.thumb !== false && (
        <section className="mt-10 max-w-[420px]" aria-label={`Vorschau: ${title}`}>
          <LiveThumb id={v.id} term={v.term} />
          <p className="mt-3 text-[14px] text-slate-500">Die Vorschau zeigt echte Daten.</p>
        </section>
      )}
    </main>
  );
}
