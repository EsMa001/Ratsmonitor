import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useUi } from "../state/ui";
import { LENA_EXAMPLES, LENA_INTRO, askLena, germanDate, type LenaAnswer } from "../lib/lena";
import { PageHead, useOpenSearch } from "./blocks";

/* Lena: regelbasierte Assistentin. Verstehen und Antworten kommen aus POST /api/lena; hier nur der Dialog.
   Es wird nichts gespeichert; der Verlauf lebt nur, solange die Seite offen ist. */

interface Msg {
  id: number;
  from: "user" | "lena";
  text: string;
  answer?: LenaAnswer;
  chips?: string[];
  loading?: boolean;
  error?: string;
}

export function LenaPage() {
  const openSearch = useOpenSearch();
  const { openSaveDialog } = useUi();
  const [msgs, setMsgs] = useState<Msg[]>([{ id: 0, from: "lena", text: LENA_INTRO, chips: LENA_EXAMPLES }]);
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

  const ask = useCallback(async (question: string) => {
    const q = question.trim();
    if (!q) return;
    const userId = next.current++;
    const lenaId = next.current++;
    setMsgs((m) => [...m, { id: userId, from: "user", text: q }, { id: lenaId, from: "lena", text: "", loading: true }]);
    setText("");
    const ctl = new AbortController();
    live.current.add(ctl);
    try {
      const a = await askLena(q, ctl.signal);
      patch(lenaId, { loading: false, text: a.text, answer: a });
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      patch(lenaId, { loading: false, error: (e as Error).message || "Lena ist gerade nicht erreichbar." });
    } finally {
      live.current.delete(ctl);
    }
  }, []);

  const saveAlarm = (term: string) => {
    openSearch(term);
    window.setTimeout(openSaveDialog, 700);
  };

  /* Knöpfe unter einer Antwort: Suche öffnen und Alarm aus dem erkannten Thema, dazu die Links der Antwort */
  const actions = (a: LenaAnswer) => {
    const term = a.parsed.topic || a.parsed.place;
    const withSearch = !a.ask && ["suche", "stand"].includes(a.intent) && a.sources.length > 0;
    const withAlarm = !a.ask && ["suche", "stand", "alarm"].includes(a.intent) && !!term;
    return (
      <div className="mt-3 flex flex-wrap gap-2">
        {withSearch && (
          <button type="button" className="ri-btn ri-btn--ghost" onClick={() => openSearch(term)}>
            In der Suche öffnen
          </button>
        )}
        {withAlarm && (
          <button type="button" className="ri-btn ri-btn--ghost" onClick={() => saveAlarm(term)}>
            Als Alarm speichern
          </button>
        )}
        {a.links
          .filter((l) => !(withSearch || withAlarm) || !l.link.startsWith("/?q="))
          .map((l) => (
            <Link key={l.link + l.text} href={l.link} className="ri-btn ri-btn--ghost">
              {l.text}
            </Link>
          ))}
        {a.ask?.options.map((o) => (
          <button key={o.question} type="button" className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-[13px] text-slate-700 hover:border-slate-500" onClick={() => ask(o.question)}>
            {o.text}
          </button>
        ))}
      </div>
    );
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
                  {!!m.answer?.sources.length && (
                    <div className="mt-3">
                      <ul className="m-0 list-none divide-y divide-slate-200 p-0">
                        {m.answer.sources.map((h) => (
                          <li key={h.id} className="py-2">
                            <Link href={h.link} className="font-medium text-slate-900 underline-offset-2 hover:underline">
                              {h.title}
                            </Link>
                            <span className="mt-0.5 block text-[13px] text-slate-500">
                              {germanDate(h.date)}
                              {h.gemeinde ? " · " + h.gemeinde : ""}
                              {h.gremium ? " · " + h.gremium : ""} · {h.status}
                            </span>
                          </li>
                        ))}
                      </ul>
                      <p className="m-0 mt-2 text-[12px] text-slate-500">Die Originalunterlagen sind auf der Seite des jeweiligen Vorgangs verlinkt.</p>
                    </div>
                  )}
                  {m.answer && !m.loading && actions(m.answer)}
                  {m.chips && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {m.chips.map((c) => (
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
                maxLength={200}
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
