import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useUi } from "../state/ui";
import { LENA_EXAMPLES, LENA_INTRO, SEARCH_HINT, STATUS_WORD, plan, type LenaPlan } from "../lib/lena";
import { FAQ } from "./content";
import { PageHead, useOpenSearch } from "./blocks";

/* Lena: regelbasierte Assistentin. Die Regeln stehen in lib/lena.ts, hier nur Dialog und Abruf der Treffer (/api/search).
   Es wird nichts gespeichert; der Verlauf lebt nur, solange die Seite offen ist. */

interface Hit {
  id: string;
  date: string;
  status: string;
  title: string;
  gremium?: string;
  gemeinde?: string;
}

interface Msg {
  id: number;
  from: "user" | "lena";
  text: string;
  plan?: LenaPlan;
  hits?: Hit[];
  total?: number;
  loading?: boolean;
  error?: string;
  note?: string;
}

const germanDate = (iso: string) => iso.slice(0, 10).split("-").reverse().join(".");
const MAX_HITS = 5;

async function fetchHits(p: LenaPlan, signal: AbortSignal) {
  const base = new URLSearchParams({ q: p.q ?? "", sort: "desc", page: "1" });
  if (p.status) base.set("status", p.status);
  if (p.from) base.set("from", p.from);
  /* Trefferliste (erste Seite) und Gesamtzahl (Zähler) sind getrennte Teile der Suche; die Seite liefert keine Gesamtzahl */
  const call = async (part: "page" | "facets") => {
    const r = await fetch("/api/search?" + new URLSearchParams({ ...Object.fromEntries(base), part }), { signal });
    const d = (await r.json().catch(() => ({}))) as { articles?: Hit[]; total?: number; hasMore?: boolean; error?: string };
    if (!r.ok) throw new Error(d.error || "Die Suche ist gerade nicht erreichbar.");
    return d;
  };
  const [page, facets] = await Promise.all([call("page"), call("facets").catch(() => null)]);
  const articles = page.articles ?? [];
  const total = typeof facets?.total === "number" ? facets.total : page.hasMore ? undefined : articles.length;
  return { hits: articles.slice(0, MAX_HITS), total, more: !!page.hasMore };
}

export function LenaPage() {
  const faq = useMemo(() => FAQ.flatMap((g) => g.items), []);
  const openSearch = useOpenSearch();
  const { openSaveDialog } = useUi();
  const [msgs, setMsgs] = useState<Msg[]>([{ id: 0, from: "lena", text: LENA_INTRO, plan: { kind: "gruss", text: LENA_INTRO, chips: LENA_EXAMPLES } }]);
  const [text, setText] = useState("");
  const next = useRef(1);
  const live = useRef(new Set<AbortController>());
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const set = live.current;
    return () => set.forEach((c) => c.abort());
  }, []);
  useEffect(() => {
    if (msgs.length > 1) end.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [msgs]);

  const patch = (id: number, change: Partial<Msg>) => setMsgs((m) => m.map((x) => (x.id === id ? { ...x, ...change } : x)));

  const ask = useCallback(
    async (question: string) => {
      const q = question.trim();
      if (!q) return;
      const p = plan(q, faq);
      const userId = next.current++;
      const lenaId = next.current++;
      const needsSearch = p.kind === "suche" || p.kind === "stand" || p.kind === "abdeckung";
      setMsgs((m) => [...m, { id: userId, from: "user", text: q }, { id: lenaId, from: "lena", text: p.text, plan: p, loading: needsSearch }]);
      setText("");
      if (!needsSearch) return;
      const ctl = new AbortController();
      live.current.add(ctl);
      try {
        const { hits, total, more } = await fetchHits(p, ctl.signal);
        if (p.kind === "abdeckung") {
          const newest = hits[0]?.date;
          patch(lenaId, {
            loading: false,
            hits: [],
            total,
            text: total || hits.length
              ? `Zu „${p.place}“ liegen ${total === undefined ? "mehr als " + hits.length : total.toLocaleString("de-DE")} Einträge vor${newest ? ", der jüngste vom " + germanDate(newest) : ""}. Das ist das Ergebnis einer Suche nach dem Ortsnamen, die Datenabdeckung zeigt die Gebiete im Einzelnen.`
              : `Zu „${p.place}“ habe ich keine Einträge gefunden. Möglicherweise ist das Gebiet noch nicht angebunden. Die Datenabdeckung zeigt den Stand je Gebiet, mit der Kontaktseite können Sie es melden.`,
          });
        } else if (!total && !hits.length && !more) {
          patch(lenaId, {
            loading: false,
            hits: [],
            total: 0,
            text: `Zu „${p.q}“ habe ich keine Einträge gefunden${p.status ? " mit dem Stand „" + STATUS_WORD[p.status] + "“" : ""}.`,
            note: "Versuchen Sie ein kürzeres Stichwort oder lassen Sie den Ort weg. Sie können auch einen Alarm einrichten, dann erfahren Sie es, sobald etwas dazu eingeht.",
          });
        } else {
          patch(lenaId, {
            loading: false,
            hits,
            total,
            note: p.place ? undefined : SEARCH_HINT,
          });
        }
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        patch(lenaId, { loading: false, error: (e as Error).message || "Die Suche ist gerade nicht erreichbar." });
      } finally {
        live.current.delete(ctl);
      }
    },
    [faq],
  );

  const saveAlarm = (term: string) => {
    openSearch(term);
    window.setTimeout(openSaveDialog, 700);
  };

  return (
    <>
      <PageHead
        icon="search"
        label="Funktionen"
        name="Lena"
        title="Fragen Sie Lena."
        lead="Lena sucht Vorgänge und Beschlüsse, nennt den Stand, erklärt Begriffe und richtet Alarme ein. Sie antwortet nur mit dem, was in den Unterlagen steht, mit Verweis auf die Originalquelle."
      />
      <section className="ri-sec">
        <div className="mx-auto max-w-[760px]">
          <div role="log" aria-live="polite" aria-label="Gespräch mit Lena" className="flex flex-col gap-4">
            {msgs.map((m) => (
              <div key={m.id} className={m.from === "user" ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={
                    m.from === "user"
                      ? "max-w-[85%] rounded-2xl rounded-br-md bg-slate-900 px-4 py-3 text-[15px] text-white"
                      : "w-full max-w-[92%] rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-3 text-[15px] text-slate-800"
                  }
                >
                  {m.from === "lena" && <span className="mb-1 block text-[12px] font-semibold uppercase tracking-wide text-slate-500">Lena</span>}
                  {m.loading ? <p className="m-0 text-slate-500">Ich suche …</p> : m.text && <p className="m-0">{m.text}</p>}
                  {m.error && (
                    <p role="alert" className="m-0 mt-2 text-rose-700">
                      {m.error}
                    </p>
                  )}
                  {!!m.hits?.length && (
                    <div className="mt-3">
                      <p className="m-0 mb-2 text-[13px] text-slate-500">
                        {m.total && m.total > m.hits.length ? `Die ${m.hits.length} neuesten von ${m.total.toLocaleString("de-DE")} Einträgen` : `${m.hits.length} ${m.hits.length === 1 ? "Eintrag" : "Einträge"}`}
                      </p>
                      <ul className="m-0 list-none divide-y divide-slate-200 p-0">
                        {m.hits.map((h) => (
                          <li key={h.id} className="py-2">
                            <Link href={`/beschluss/${h.id}`} className="font-medium text-slate-900 underline-offset-2 hover:underline">
                              {h.title}
                            </Link>
                            <span className="mt-0.5 block text-[13px] text-slate-500">
                              {germanDate(h.date)}
                              {h.gemeinde ? " · " + h.gemeinde : ""}
                              {h.gremium ? " · " + h.gremium : ""} · {STATUS_WORD[h.status] ?? "Stand offen"}
                            </span>
                          </li>
                        ))}
                      </ul>
                      <p className="m-0 mt-2 text-[12px] text-slate-500">Die Originalunterlagen sind auf der Seite des jeweiligen Vorgangs verlinkt.</p>
                    </div>
                  )}
                  {m.note && <p className="m-0 mt-3 text-[13px] text-slate-600">{m.note}</p>}
                  {m.plan && !m.loading && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {m.plan.searchTerm && (m.plan.kind === "suche" || m.plan.kind === "stand") && !!m.hits?.length && (
                        <button type="button" className="ri-btn ri-btn--ghost" onClick={() => openSearch(m.plan!.searchTerm)}>
                          In der Suche öffnen
                        </button>
                      )}
                      {m.plan.searchTerm && (m.plan.kind === "suche" || m.plan.kind === "stand" || m.plan.kind === "alarm") && (
                        <button type="button" className="ri-btn ri-btn--ghost" onClick={() => saveAlarm(m.plan!.searchTerm!)}>
                          Als Alarm speichern
                        </button>
                      )}
                      {m.plan.links?.map((l) => (
                        <Link key={l.href + l.label} href={l.href} className="ri-btn ri-btn--ghost">
                          {l.label}
                        </Link>
                      ))}
                      {m.plan.chips?.map((c) => (
                        <button key={c} type="button" className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-[13px] text-slate-700 hover:border-slate-500" onClick={() => ask(c)}>
                          {c}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={end} />
          </div>
          <form
            className="mt-6 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              ask(text);
            }}
          >
            <label className="relative block flex-1">
              <span className="sr-only">Ihre Frage an Lena</span>
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={300}
                placeholder="Zum Beispiel: Was gibt es zu Photovoltaik in Billerbeck?"
                className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-[15px] text-slate-900 placeholder:text-slate-400"
              />
            </label>
            <button type="submit" className="ri-btn" disabled={!text.trim()}>
              Fragen
            </button>
          </form>
          <p className="mt-4 text-[13px] text-slate-500">
            Lena ist regelbasiert und versteht einfache Fragen. Sie gibt keine Rechts- oder Finanzberatung, maßgeblich sind die Originalunterlagen der Kommunen. Ihre Fragen werden nicht gespeichert.
          </p>
        </div>
      </section>
    </>
  );
}
