import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMe } from "../../lib/account";
import { useSignedInHint } from "../../lib/signedInHint";
import { useData } from "../../state/data";
import { removePhrase } from "../../lib/place";
import { IS_DEV, setTier } from "../../lib/tier";
import { PageBand } from "../analytics/PageBand";
import { AboModels } from "../../components/AboModels";
import { FilterSelect } from "../../components/FilterSelect";
import { SearchModeSwitch } from "../../components/SearchModeSwitch";
import { openGate } from "../../components/GateDialog";
import { IconPin, IconSearch, IconX } from "../../components/icons";
import { DocumentRow } from "./DocumentRow";
import { ARTS, PAGE_MAX, ZEITEN, docsHref, readDocQuery, useDocSearch, type DocHit, type DocQuery } from "./useDocSearch";

/**
 * Dokumentsuche (Pro, /dokumente; Konzept requirements/dokumentsuche-konzept.md): sucht in den Texten der Hauptdokumente und
 * zeigt je Dokument die Fundstellen mit Seite. Die Seite ist für alle aufrufbar (verlinkbar aus Preisseite, Mails, Social Media):
 * ohne Pro mit festem Beispiel und Hinweis, Enter öffnet dann den Hinweis statt zu suchen (keine Anfrage an die Route).
 * Abfrage in der Adresse (useDocSearch.ts); Ort wie in der Suche aus dem Text erkannt (lib/place.ts), als Chip.
 */
export function DokumentePage() {
  const me = useMe();
  const signedIn = useSignedInHint();
  const router = useRouter();
  const query = readDocQuery(new URLSearchParams(useSearchParams().toString()));
  const allowed = me.ready && me.features.fulltext;
  const { result, error, status, loading } = useDocSearch(allowed ? query : null);
  const go = (next: Partial<DocQuery>) => router.push(docsHref({ ...query, seite: 1, ...next }), { scroll: false });
  /* Gesperrt: ohne Pro, oder der Server sagt es (Stufe gerade gewechselt) */
  const locked = (me.ready && !allowed) || status === 403;
  const waiting = !me.ready && signedIn !== false;
  return (
    <main id="inhalt" className="w-full px-[max(1vw,16px)] pb-12 text-slate-900">
      {/* Wie die plenara.X-Seiten: am Desktop ein schmales Band (Titel links, Umschalter rechts; analytics.css), der Satz darunter */}
      <PageBand compact logo={false}>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <h1 className="m-0 flex items-baseline gap-2.5 text-[28px] font-semibold leading-tight">
            Dokumentsuche
            <span className="rounded-md bg-slate-100 px-1.5 pb-[3px] pt-[2px] text-[12px] font-semibold leading-none text-slate-700">Pro</span>
          </h1>
          <SearchModeSwitch mode="dokumente" className="order-4 sm:ml-auto" />
        </div>
      </PageBand>
      <p className="m-0 mb-4 max-w-[760px] text-[16px] leading-relaxed text-slate-700">
        Findet Begriffe in den Texten der Sitzungsunterlagen, nicht nur in Titeln: mit Seitenzahl, Textstelle und Link zum Original.
      </p>
      <SearchForm query={query} onSearch={(q, ort) => (locked ? openGate({ feature: "fulltext", needs: "pro" }) : go({ q, ort }))} onClearPlace={() => go({ ort: "" })} />
      {waiting ? (
        <div aria-busy="true" className="min-h-[40vh]" />
      ) : locked ? (
        <Preview />
      ) : (
        <section aria-label="Dokumente" className="mt-5 max-w-[960px]">
          <Toolbar query={query} total={result?.total} capped={!!result?.capped} loading={loading} onChange={go} />
          {error && <p role="alert" className="m-0 mt-4 text-[14px] text-amber-800">{status === 503 ? "Die Dokumentsuche ist auf diesem Server noch nicht eingerichtet." : error}</p>}
          {!query.q.trim() && <Hilfe />}
          {result && !loading && result.documents.length === 0 && !error && (
            <p className="m-0 mt-4 text-[16px] text-slate-700">Keine Dokumente gefunden. Weniger Wörter, eine andere Schreibweise oder ein größeres Gebiet helfen meist.</p>
          )}
          {result && result.documents.length > 0 && (
            <ol aria-busy={loading} className={`m-0 list-none p-0 ${loading ? "opacity-60" : ""}`}>
              {result.documents.map((d) => <DocumentRow key={d.id} doc={d} />)}
            </ol>
          )}
          {result && <Pages query={query} total={result.total} size={result.pageSize} onPage={(seite) => { router.push(docsHref({ ...query, seite }), { scroll: false }); window.scrollTo({ top: 0 }); }} />}
        </section>
      )}
    </main>
  );
}

/** Suchfeld: Enter sucht; ein Ort im Text (außerhalb von Anführungszeichen) wird zum Chip wie in der Suche */
function SearchForm({ query, onSearch, onClearPlace }: { query: DocQuery; onSearch: (q: string, ort: string) => void; onClearPlace: () => void }) {
  const { place, geo } = useData();
  const [text, setText] = useState(query.q);
  /* Adresse geändert (Zurück, Umschalter): Feld beim Rendern nachziehen */
  const [seen, setSeen] = useState(query.q);
  if (seen !== query.q) {
    setSeen(query.q);
    setText(query.q);
  }
  const placeName = query.ort ? geo?.info(query.ort)?.name || query.ort : "";
  const submit = (e: FormEvent) => {
    e.preventDefault();
    let q = text.trim(), ort = query.ort;
    if (place && q) {
      const r = place.parse(q.replace(/"[^"]*"?/g, (m) => " ".repeat(m.length)), {}, {});
      if (r.place) {
        ort = r.place.ags;
        q = removePhrase(q, r.phraseRaw).trim();
      }
    }
    if (!q) return;
    /* Der Ort steht danach als Chip unter dem Feld, im Feld nur noch der Begriff */
    setText(q);
    onSearch(q, ort);
  };
  return (
    <form role="search" onSubmit={submit} className="max-w-[960px]">
      <div className="flex items-center gap-2">
        <label className="flex h-12 min-w-0 flex-1 items-center gap-2 rounded-full border border-slate-300 bg-white px-4 focus-within:border-teal-700">
          <span className="text-slate-500"><IconSearch size={18} /></span>
          <span className="sr-only">Begriff in den Dokumenten</span>
          <input
            type="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={200}
            enterKeyHint="search"
            placeholder="Begriff, etwa „kommunale Wärmeplanung“ Coesfeld"
            className="h-full min-w-0 flex-1 border-0 bg-transparent text-[16px] outline-none placeholder:text-slate-400"
          />
        </label>
        <button type="submit" className="btn-primary h-12 shrink-0 max-sm:px-4">Suchen</button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-[14px] text-slate-500">
        {placeName && (
          <button type="button" onClick={onClearPlace} aria-label={`Ort ${placeName} entfernen`} className="group inline-flex h-7 items-center gap-1.5 rounded-full border border-slate-200 bg-white pl-2.5 pr-1.5 font-medium text-slate-900">
            <span className="text-slate-500"><IconPin size={14} /></span>
            {placeName}
            <IconX size={14} className="text-slate-400 group-hover:text-slate-900" />
          </button>
        )}
        <span>
          <code className="font-sans text-slate-700">&quot;Phrase&quot;</code> genau so, <code className="font-sans text-slate-700">oder</code> eins von beiden,{" "}
          <code className="font-sans text-slate-700">-wort</code> ohne, <code className="font-sans text-slate-700">wort*</code> Wortanfang
        </span>
      </div>
    </form>
  );
}

/** Trefferzahl, Zeitraum, Dokumentart und Sortierung */
function Toolbar({ query, total, capped, loading, onChange }: { query: DocQuery; total?: number; capped: boolean; loading: boolean; onChange: (next: Partial<DocQuery>) => void }) {
  const count = total === undefined || loading ? "…" : `${capped ? "Mehr als " : ""}${total.toLocaleString("de-DE")} ${total === 1 && !capped ? "Dokument" : "Dokumente"}`;
  return (
    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-2 border-b border-slate-200 pb-3">
      <span aria-live="polite" className="mr-2 text-[14px] text-slate-600 max-sm:basis-full">
        {query.q.trim() ? count : "Noch keine Suche"}
        {capped && !loading && <span className="text-slate-500"> · die besten zuerst</span>}
      </span>
      <FilterSelect id="d-zeit" label="Zeitraum" allLabel="" value={query.zeit} options={ZEITEN} onChange={(v) => onChange({ zeit: v })} size="sm" look="text" highlight={!!query.zeit} />
      <FilterSelect id="d-art" label="Dokumentart" allLabel="Alle Dokumentarten" value={query.art} options={ARTS} onChange={(v) => onChange({ art: v })} size="sm" look="text" highlight={!!query.art} />
      <FilterSelect
        id="d-sort"
        label="Sortierung"
        allLabel=""
        value={query.sort}
        options={[{ value: "relevance", label: "Nach Relevanz", short: "Relevanz" }, { value: "desc", label: "Neueste zuerst", short: "Neueste" }]}
        onChange={(v) => onChange({ sort: v as DocQuery["sort"] })}
        size="sm"
        look="text"
        highlight={false}
        className="ml-auto [&_button]:w-auto [&_button]:min-w-0"
      />
    </div>
  );
}

/** Blättern: vor und zurück, höchstens PAGE_MAX Seiten */
function Pages({ query, total, size, onPage }: { query: DocQuery; total: number; size: number; onPage: (seite: number) => void }) {
  const last = Math.min(PAGE_MAX, Math.ceil(total / size));
  if (last <= 1) return null;
  const btn = "inline-flex h-10 items-center rounded-full px-4 text-[14px] font-medium text-teal-700 hover:text-teal-600 disabled:text-slate-400";
  return (
    <nav aria-label="Seiten" className="mt-4 flex items-center justify-between gap-3">
      <button type="button" className={btn} disabled={query.seite <= 1} onClick={() => onPage(query.seite - 1)}>← Zurück</button>
      <span className="text-[14px] text-slate-500">Seite {query.seite} von {last}{Math.ceil(total / size) > PAGE_MAX ? "; für weitere die Suche eingrenzen" : ""}</span>
      <button type="button" className={btn} disabled={query.seite >= last} onClick={() => onPage(query.seite + 1)}>Weiter →</button>
    </nav>
  );
}

/** Ohne Suchbegriff: was die Suchsprache kann */
function Hilfe() {
  const rows: [string, string][] = [
    ["Wärmeplanung Förderung", "beide Wörter auf einer Seite"],
    ["\"kommunale Wärmeplanung\"", "genau diese Wortfolge"],
    ["Kita oder Kindergarten", "eins der Wörter"],
    ["Radweg -Anlage", "ohne Dokumente, in denen „Anlage“ steht"],
    ["Wind*", "Wörter, die so beginnen (Windkraft, Windenergie …)"],
    ["Wärme NAHE Förderung", "höchstens zehn Wörter auseinander"],
  ];
  return (
    <dl className="m-0 mt-4 grid max-w-[640px] grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-6 gap-y-2 text-[14px]">
      {rows.map(([q, what]) => (
        <div key={q} className="contents">
          <dt className="font-semibold text-slate-900">{q}</dt>
          <dd className="m-0 text-slate-600">{what}</dd>
        </div>
      ))}
    </dl>
  );
}

/* Festes Beispiel für die Vorschau ohne Pro: erfundener Ort, deutlich als Beispiel beschriftet */
const BEISPIEL: DocHit[] = [
  {
    id: "b1", topicId: "", title: "Beschlussvorlage 2026/118", topicTitle: "Kommunale Wärmeplanung: Beauftragung und Zeitplan", gemeinde: "Beispielstadt", ags: "", gremium: "Ausschuss für Klima und Umwelt",
    date: "2026-09-17", art: "vorlage", url: "", docIndex: -1, pages: 14, hits: 6,
    snippets: [
      { page: 2, before: "… legt die Stadt bis Ende 2027 die ", hit: "kommunale Wärmeplanung", after: " vor; das Land fördert die Erstellung mit 90 Prozent …" },
      { page: 7, before: "… Fernwärme kommt nach der ", hit: "kommunalen Wärmeplanung", after: " vor allem für die Innenstadt und das Gewerbegebiet Nord in Frage …" },
    ],
  },
  {
    id: "b2", topicId: "", title: "Niederschrift der Sitzung", topicTitle: "", gemeinde: "Beispielgemeinde", ags: "", gremium: "Gemeinderat",
    date: "2026-06-24", art: "niederschrift", url: "", docIndex: -1, pages: 31, hits: 2,
    snippets: [{ page: 12, before: "… bittet um einen Bericht zum Stand der ", hit: "Wärmeplanung", after: " in der nächsten Sitzung; die Verwaltung sagt dies zu …" }],
  },
];

/** Vorschau ohne Pro: zwei feste Beispielzeilen, darunter das Abo-Modell Pro */
function Preview() {
  return (
    <section aria-label="Beispiel und Freischalten" className="mt-6 max-w-[960px]">
      <p className="m-0 text-[12px] font-semibold uppercase tracking-[.06em] text-slate-500">Beispiel</p>
      {/* Nur zur Ansicht: die Beispiele verlinken nirgendwohin */}
      <ol inert className="m-0 list-none border-t border-slate-200 p-0 [&_a]:pointer-events-none">
        {BEISPIEL.map((d) => <DocumentRow key={d.id} doc={d} />)}
      </ol>
      <div className="mt-6 max-w-[520px]">
        <p className="m-0 text-[16px] font-semibold text-slate-900">Die Dokumentsuche gehört zu Pro</p>
        <p className="m-0 mt-1 text-[14px] leading-relaxed text-slate-600">Sie durchsucht die Texte der Vorlagen, Beschlüsse und Niederschriften bundesweit, mit Ort, Zeitraum und Dokumentart.</p>
        <AboModels only={["pro"]} className="mt-4" />
        {IS_DEV && (
          <button type="button" onClick={() => setTier("pro")} className="mt-3 text-[12px] text-slate-500 underline underline-offset-2 hover:text-slate-700">
            Dev: als Pro fortfahren
          </button>
        )}
      </div>
    </section>
  );
}
