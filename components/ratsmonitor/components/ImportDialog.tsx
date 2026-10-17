import { useEffect, useRef, useState } from "react";
import { api, useMe } from "../lib/account";
import { buildPayload, discardLocal, importLocal, localSummary, postponeImport, resultText, saveLocalFile, shouldAsk, useLocalData, type ImportResult } from "../lib/browserData";
import { useData } from "../state/data";

type Step = "ask" | "discard" | "done";

/**
 * Nach der Anmeldung: Daten aus diesem Browser (gespeicherte Suchen, Artikel, Kalender, Wochenbericht, Name) ins Konto
 * übernehmen? Ohne Klick wird nichts gesendet. „Später“ fragt in dieser Sitzung nicht wieder; die Kontoseite zeigt den
 * Rest weiter an (requirements/konten-konzept.md, Abschnitt 8). Einmal in der App eingebunden, wie GateDialog.
 */
export function ImportDialog() {
  const me = useMe();
  const local = useLocalData();
  const { geo, place, geoError } = useData();
  const [step, setStep] = useState<Step>("ask");
  const [closed, setClosed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const ref = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const want = !closed && (step === "done" || (me.ready && !!me.user && shouldAsk(local)));
  useEffect(() => {
    if (want && !ref.current?.open) ref.current?.showModal();
    else if (!want && ref.current?.open) ref.current.close();
  }, [want]);
  /* Nach jedem Schritt die neue Überschrift ansagen */
  useEffect(() => {
    if (want) heading.current?.focus();
  }, [step, want]);

  /* Für Abfragen und Umkreise braucht es die Karte; ohne Karte (Fehler) gehen die Daten ohne sie */
  const mapWait = !geo && !geoError && (local.searches.length > 0 || local.calendar.some((a) => a.km > 0));
  const later = () => {
    postponeImport();
    setClosed(true);
  };
  const take = async () => {
    setBusy(true);
    setError("");
    try {
      const server = await api<{ weekly?: boolean; weeklyDay?: number | null }>("/api/me/settings").catch(() => undefined);
      const payload = await buildPayload(local, geo, place, server);
      setResult(await importLocal(local, payload));
      setStep("done");
    } catch (e) {
      setError((e as Error).message || "Die Übernahme hat nicht geklappt.");
    } finally {
      setBusy(false);
    }
  };
  const skippedSearches = result ? local.searches.filter((s) => (result.searches?.invalid ?? []).includes(s.id)) : [];
  const skippedArticles = result ? local.articles.filter((a) => (result.articles?.missing ?? []).includes(a.id)) : [];

  return (
    <dialog
      ref={ref}
      onClose={() => (step === "done" ? setClosed(true) : later())}
      aria-labelledby="import-title"
      aria-describedby="import-text"
      className="w-[min(480px,calc(100vw-32px))] rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-pop backdrop:bg-slate-900/40"
    >
      {want && step === "ask" && (
        <>
          <h2 id="import-title" ref={heading} tabIndex={-1} className="m-0 text-[22px] font-semibold outline-none">
            Daten aus diesem Browser übernehmen?
          </h2>
          <p id="import-text" className="mb-0 mt-2 text-[14px] leading-relaxed text-slate-600">
            {localSummary(local)} in das Konto <strong className="font-semibold text-slate-900">{me.user?.email}</strong> übernehmen?
          </p>
          <p className="mb-0 mt-2 text-[14px] text-slate-500">Übernommene Einträge werden danach in diesem Browser gelöscht und stehen in Ihrem Konto.</p>
          {error && (
            <p role="alert" className="mb-0 mt-3 text-[14px] text-amber-700">
              {error}
            </p>
          )}
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <button type="button" disabled={busy || mapWait} onClick={() => void take()} className="btn-primary">
              {busy ? "Wird übernommen …" : mapWait ? "Karte wird geladen …" : "Übernehmen"}
            </button>
            <button type="button" disabled={busy} onClick={() => setStep("discard")} className="btn-secondary">
              Nicht übernehmen
            </button>
            <button type="button" disabled={busy} onClick={later} className="btn-secondary">
              Später
            </button>
          </div>
        </>
      )}
      {want && step === "discard" && (
        <>
          <h2 id="import-title" ref={heading} tabIndex={-1} className="m-0 text-[22px] font-semibold outline-none">
            Daten aus diesem Browser löschen?
          </h2>
          <p id="import-text" className="mb-0 mt-2 text-[14px] leading-relaxed text-slate-600">
            {localSummary(local)} werden nicht übernommen und in diesem Browser gelöscht. Sie können sie vorher als Datei sichern und später auf der Kontoseite übernehmen.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => void saveLocalFile(local, geo, place)} className="btn-secondary">
              Vorher als Datei sichern
            </button>
            <button
              type="button"
              onClick={() => {
                discardLocal();
                setClosed(true);
              }}
              className="btn-primary"
            >
              Löschen
            </button>
            <button type="button" onClick={() => setStep("ask")} className="btn-secondary">
              Zurück
            </button>
          </div>
        </>
      )}
      {want && step === "done" && result && (
        <>
          <h2 id="import-title" ref={heading} tabIndex={-1} className="m-0 text-[22px] font-semibold outline-none">
            Übernommen
          </h2>
          <p id="import-text" role="status" className="mb-0 mt-2 text-[14px] leading-relaxed text-slate-600">
            {resultText(result)}.
          </p>
          {(skippedSearches.length > 0 || skippedArticles.length > 0) && (
            <div className="mt-3 text-[14px] text-slate-600">
              <p className="m-0">Nicht übernommen (bleiben in diesem Browser, bis Sie sie auf der Kontoseite verwerfen):</p>
              <ul className="m-0 mt-1 list-disc pl-5">
                {skippedSearches.map((s) => (
                  <li key={s.id}>Suche „{s.name}“</li>
                ))}
                {skippedArticles.map((a) => (
                  <li key={a.id}>Artikel „{a.title}“ (Vorgang nicht mehr vorhanden)</li>
                ))}
              </ul>
            </div>
          )}
          <div className="mt-5 flex justify-end">
            <button type="button" onClick={() => setClosed(true)} className="btn-primary">
              Schließen
            </button>
          </div>
        </>
      )}
    </dialog>
  );
}
