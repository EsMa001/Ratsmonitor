import { kurz } from "../../components/ChipRail";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { THEMES, SUBTOPICS } from "@/shared/themes.mjs";
import { Laden } from "./Laden";
import { Befund, Fehler } from "./Befund";
import { Folgen, Kennzahlen, ZeitPills, useOrtInAdresse, weekAgo, zeitText } from "./Kennzahlen";
import { usePhone } from "../../lib/usePhone";
import { ChevronDown, ChevronUp, MapPin } from "lucide-react";
import { DiffusionSearch } from "./DiffusionSearch";
import { useAnalyticsQuery } from "./useAnalyticsQuery";
import { useAnalysisRun } from "./useAnalysisRun";
import { RadarDrill } from "./RadarDrill";
import { MapWheels } from "./MapWheels";
import { ListSkeleton } from "./ListSkeleton";
import { plural } from "../../lib/text";
import { prettyTerm } from "../../lib/terms";
import { ThemeIcon } from "../../components/icons";
import { SubtopicIcon } from "../../components/SubtopicIcon";
import { pctText as pct } from "../../lib/format";
import { MethodikNote } from "./Methodik";
import { Row, Result, Level, n, MIN_BASE, isRest, restLast, Bars, Hint, OrtImVergleich, AtlasExtra, PartList, PlaceChip } from "./AtlasParts";
import { AtlasMap } from "./AtlasMap";

/* plenara.X Atlas auf der einen Abfrage (GET /api/x?view=atlas, server/integrations/plenara-x-query.mjs): je Thema die
   Unterthemen, der Verlauf, die Orte und die jüngsten Vorgänge; ohne Thema die 10 Themen. Gezählt werden
   Vorgänge (gleiche Titel je Gebiet einmal), Formalien nie; das Thema ist dasselbe wie im Themenfilter der Suche. */
/**
 * theme: eines der 10 Themen oder "" (alle); sub: Unterthema oder "".
 * term: Suchbegriff aus einem geteilten Link (?q=), wird beim Öffnen einmal in die Suche übernommen.
 */
/* Werte aus den Unterlagen zeigt der Atlas seit 14.10.26 nicht mehr (Konzept docs/produkt/plenara-x-fakten-konzept.md): Signale
   haben die Seite /analytics/signale, Vergleichswerte kommen in den Ortsvergleich. Regeln, Daten und by=fact bleiben; true zeigt sie wieder. */
const SHOW_FACTS = false;


export function XAtlasView({ theme, sub, zeit = "", term, onTheme, onSub, onZeit }: { theme: string; sub: string; zeit?: string; term: string | null; onTheme: (id: string) => void; onSub: (id: string) => void; onZeit: (z: string) => void }) {
  const phone = usePhone();
  const [level, setLevel] = useState<Level>("city");
  const { query: baseQuery, search } = useAnalyticsQuery();
  /* Zeitraum der Seite (Monate zurück ab heute) ersetzt den der Suche nur, wenn die Suche selbst keinen hat (wie in den Signalen) */
  const query = (() => { const q = new URLSearchParams(baseQuery); /* Ein Themenfilter mit einer Kennung statt dem Namen (früher beim Speichern gesetzt) wäre ein ungültiger Suchfilter: weglassen */ const lab = q.get("label"); if (lab && lab !== "Sonstiges" && !THEMES.some((t: { name: string }) => t.name === lab)) q.delete("label"); if (zeit && !q.get("from")) { const d = new Date(); d.setMonth(d.getMonth() - Number(zeit)); q.set("from", d.toISOString().slice(0, 10)); } return q.toString(); })();
  const sel = [theme && `theme=${theme}`, sub && `sub=${sub}`].filter(Boolean).join("&");
  const url = `/api/x?view=atlas${sel ? "&" + sel : ""}&${query}`;
  const { res, ranKey, loading, error, stale, run } = useAnalysisRun<Result>({ key: url, url, initial: !term, onDone: () => { setOpen(""); setPart(null); setAll(null); } });
  /* Aufgeklappte Liste: "month:2026-05", "region:<id>", "map:<id>" */
  const [open, setOpen] = useState("");
  /* Aufgeklappte Zeile der Gliederung rechts: null = die erste (Start), "" = keine */
  const [part, setPart] = useState<string | null>(null);
  /* Ganze Liste unten statt der jüngsten Vorgänge: nach „Alle … zeigen“ */
  const [all, setAll] = useState<{ by: string; value: string; label: string } | null>(null);
  const bottomRef = useRef<HTMLElement>(null);
  /* Andere Auswahl (Thema, Unterthema): gleich neu rechnen; das alte Ergebnis bleibt abgeblendet stehen */
  const [ranSel, setRanSel] = useState(sel);
  if (ranSel !== sel) {
    setRanSel(sel);
    setOpen("");
    run();
  }
  /* Suche oder Filter geändert: nach kurzer Pause von selbst neu rechnen (Themenleiste und Filter verhalten sich gleich) */
  useEffect(() => {
    if (!stale || loading) return;
    const t = setTimeout(() => run(), 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stale, loading, url]);
  /* Begriff aus dem Link: in die Suche übernehmen und mit ihm rechnen (wie run() zusammen mit applySearch im selben Klick) */
  useEffect(() => {
    if (!term) return;
    search.applySearch(term);
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /* Mit gewähltem Unterthema: alle Unterthemen des Themas mit ihren Zahlen (dieselbe Abfrage ohne Unterthema, Gliederung nach
     Unterthema); die Antwort der Auswahl selbst zählte nur die Überschneidungen mit dem gewählten */
  const [sib, setSib] = useState<{ key: string; rows: Row[] | null } | null>(null);
  const listQuery = (() => { const p = new URLSearchParams(ranKey.split("?")[1] ?? ""); for (const k of ["view", "theme", "sub"]) p.delete(k); return p.toString(); })();
  useEffect(() => {
    if (!sub || !theme || !res) return;
    const c = new AbortController(), key = `${theme}|${listQuery}`;
    fetch(`/api/x?theme=${theme}&by=sub&${listQuery}`, { signal: c.signal }).then((r) => (r.ok ? (r.json() as Promise<{ rows?: Row[] }>) : null)).then((b) => setSib({ key, rows: Array.isArray(b?.rows) ? b.rows : null })).catch(() => {});
    return () => c.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [res, sub, theme]);
  /* Antwort nur zur aktuellen Auswahl verwenden (ohne Unterthema keine) */
  const siblings = sub && theme && res && sib?.key === `${theme}|${listQuery}` ? sib.rows : null;
  const [week, setWeek] = useState<number | null>(null);
  useEffect(() => {
    if (!res) return;
    const q = new URLSearchParams(listQuery); q.set("from", weekAgo());
    const c = new AbortController();
    fetch(`/api/x?by=theme${sel ? "&" + sel : ""}&${q}`, { signal: c.signal }).then((r) => (r.ok ? (r.json() as Promise<{ total?: number }>) : null)).then((b) => setWeek(typeof b?.total === "number" ? b.total : null)).catch(() => {});
    return () => c.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [res]);
  const toggle = (key: string) => setOpen(open === key ? "" : key);
  const listBase = `/api/x?list=1${sel ? "&" + sel : ""}`;
  /* Handy: die Vorgänge hinter einer Zeile als Walze (10 neueste, „Alle … zeigen“ am Ende) */
  const drill = (by: string, r: Row, label = r.name) => <RadarDrill base={listBase} query={listQuery} by={by} value={r.key} label={label} limit={phone ? 3 : undefined} onAll={phone ? () => showAll(by, r.key, label) : undefined} />;
  const opened = (by: string) => (open.startsWith(by + ":") ? open.slice(by.length + 1) : "");
  const [jump, setJump] = useState(0);
  /* „Alle … zeigen“ ist ein Schritt im Verlauf (#alle): Zurück schließt die Liste, statt die Seite zu verlassen */
  const showAll = (by: string, value: string, label: string) => {
    if (location.hash !== "#alle") history.pushState(history.state, "", location.pathname + location.search + "#alle");
    setAll({ by, value, label }); setJump((j) => j + 1);
  };
  const closeAll = () => { if (location.hash === "#alle") history.back(); else setAll(null); };
  useEffect(() => {
    const on = () => { if (location.hash !== "#alle") setAll(null); };
    window.addEventListener("popstate", on);
    return () => window.removeEventListener("popstate", on);
  }, []);
  /* Nach „Alle … zeigen“ zur Liste unten springen, wenn sie gezeichnet ist */
  useEffect(() => { if (jump) bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }, [jump]);

  const total = res?.total ?? 0;
  const themeName = theme ? THEMES.find((t: { id: string; name: string }) => t.id === theme)?.name ?? "" : "";
  /* Unterthemen im Atlas mit Kurznamen (shared/themes.mjs: short); Suche und Filter behalten den vollen Namen */
  const short = (r: Row) => ({ ...r, name: SUBTOPICS.find((x: { id: string; short: string }) => x.id === r.key)?.short ?? r.name });
  const subName = sub ? SUBTOPICS.find((s: { id: string; short: string }) => s.id === sub)?.short ?? "" : "";
  /* Gliederung rechts: ohne Thema die Themen, mit Thema seine Unterthemen (mit gewähltem Unterthema dieselbe Liste, das gewählte hervorgehoben) */
  const partBy = theme ? "sub" : "theme";
  const parts = restLast(sub && siblings ? siblings : res?.parts ?? []).map((p) => (theme ? short(p) : p));
  const firstPart = parts.find((p) => !isRest(p))?.key ?? "";
  const openPart = part === null ? (sub || firstPart) : part;
  /* Liste hinter einer Zeile: dieselbe Auswahl, aber ohne das gewählte Unterthema (sonst nur die Überschneidung) */
  /* Vorschau auf der Karte beim Überfahren einer Zeile (Thema oder Unterthema): deren Gebiete, nach kurzer Pause geladen */
  const [hoverKey, setHoverKey] = useState("");
  const [preview, setPreview] = useState<{ key: string; rows: Row[] } | null>(null);
  useEffect(() => {
    if (!hoverKey || isRest({ key: hoverKey } as Row)) return;
    const c = new AbortController();
    const t = setTimeout(() => {
      const p = new URLSearchParams(listQuery);
      fetch(`/api/x?by=region&${theme ? `theme=${theme}&sub=${hoverKey}` : `theme=${hoverKey}`}&${p}`, { signal: c.signal }).then((r) => (r.ok ? (r.json() as Promise<{ rows?: Row[] }>) : null))
        .then((b) => { if (b?.rows) setPreview({ key: hoverKey, rows: b.rows }); }).catch(() => {});
    }, 220);
    return () => { clearTimeout(t); c.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoverKey]);
  useOrtInAdresse(new URLSearchParams(baseQuery).get("area") ?? "", (a) => search.setArea(a, "ui"));
  /* Auf dem Handy steht der Inhalt des Unterthemas unter der Karte: nach der Wahl dorthin scrollen */
  const subRef = useRef<HTMLElement>(null);
  const lastSub = useRef(sub);
  useEffect(() => { if (sub && sub !== lastSub.current && window.innerWidth < 640) subRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); lastSub.current = sub; }, [sub, res]);
  const shownPreview = hoverKey && preview?.key === hoverKey ? preview : null;
  const partBase = `/api/x?list=1${theme ? "&theme=" + theme : ""}`;
  /* Mit Unterthema: Größe des Themas (für den Anteil) und die Unterthemen, die im selben Vorgang mit vorkommen (Antwort der Auswahl) */
  /* Zahl des Unterthemas sofort nach dem Klick: aus der Antwort des Themas (vor dem Klick schon da), sonst aus der Auswahl selbst */
  const [subCounts, setSubCounts] = useState<{ theme: string; rows: Row[] } | null>(null);
  if (res && !res.selection.sub && res.selection.theme && subCounts?.rows !== res.parts) setSubCounts({ theme: res.selection.theme, rows: res.parts });
  const known = subCounts?.theme === theme ? subCounts.rows : null;
  const subCount = sub ? (siblings ?? known)?.find((p) => p.key === sub)?.count ?? (res?.selection.sub === sub ? total : undefined) : undefined;
  const themeTotal = sub ? (siblings?.[0]?.base ?? known?.[0]?.base ?? 0) : 0;
  const together = sub && res?.selection.sub === sub ? restLast(res.parts).map(short).filter((p) => p.key !== sub && !isRest(p) && p.count > 0).slice(0, 6).map((p) => ({ ...p, share: total ? Math.round((1000 * p.count) / total) / 10 : null })) : [];
  const allRegions = res?.regions ?? [];
  /* Ohne Auswahl ist der Anteil überall 100 %, mit nur einem Gebiet (Ort gewählt) gibt es nichts zu vergleichen */
  const rankRegions = !!(theme || sub) && allRegions.length > 1;
  const regions = rankRegions ? allRegions.filter((r) => r.base >= MIN_BASE).sort((a, b) => (b.share ?? 0) - (a.share ?? 0)) : [];
  const [moreRegions, setMoreRegions] = useState(false);
  /* Antwortzeile: Auswahl, Vorgänge, Gebiete und (mit Thema) Anteil an allen Sachvorgängen derselben Gebiete */
  /* Name und Zahlen aus derselben Antwort: während neu gerechnet wird, passt die Zeile weiter zu den abgeblendeten Zahlen */
  const rt = res?.selection.theme ?? "", rs = res?.selection.sub ?? "";
  const what = [rt && THEMES.find((t: { id: string; name: string }) => t.id === rt)?.name, rs && SUBTOPICS.find((s: { id: string; short: string }) => s.id === rs)?.short].filter(Boolean).join(" › ");
  /* Mit Ort (Vergleich möglich): Ortssatz statt der allgemeinen Zeile */
  const cmp = res?.compare && !res.compare.insufficient ? res.compare : null;
  /* Gleicher Zeitraum wie der Vergleich (12 Monate); die Zahl der Auswahl steht in der Liste darunter */
  const placeRest = cmp ? `: ${n(cmp.n)} Sachvorgänge in den letzten 12 Monaten, verglichen mit ${n(cmp.group!.n)} ${cmp.group!.label}.` : "";
  /* Gewählter Ort (Filter der Suche): mit ✕ an der Antwortzeile, damit man ihn dort sieht und entfernen kann */
  const place = new URLSearchParams(ranKey.split("?")[1] ?? "").get("area") ? (cmp?.region ?? res?.compare?.region ?? (allRegions.length === 1 ? allRegions[0].name : "")) : "";

  /* Neue Auswahl rechnet noch: statt des alten Inhalts sofort pulsierende Kacheln */
  const pending = loading && !!res && ((res.selection.theme ?? "") !== (theme ?? "") || (res.selection.sub ?? "") !== (sub ?? ""));

  /* Handy: Thema und Unterthema als zwei Walzen auf der Karte */
  const mapChips = <MapWheels label="Thema" items={[{ id: "", label: "Alle Themen", icon: <ThemeIcon theme="alle" size={16} className="text-slate-500" /> }, ...THEMES.map((t: { id: string; name: string }) => ({ id: t.id, label: t.name, icon: <ThemeIcon theme={t.id} size={16} className="text-slate-500" /> }))]} value={theme} onPick={(id) => onTheme(id)}
    subs={theme ? SUBTOPICS.filter((x: { theme: string }) => x.theme === theme).map((x: { id: string; short: string }) => ({ id: x.id, label: x.short, icon: <SubtopicIcon id={x.id} size={14} className="text-slate-500" /> })) : undefined} subValue={sub} onSub={(id) => onSub(id)} />;

  return (
    <section aria-label="Auswertung des Themas">
      {/* Unterthemen als kleine Kacheln (Icon, Name), durch eine Linie in Petrol von den Themen getrennt; Handy 4 je Reihe */}
      {theme && <nav aria-label="Unterthema" className="rm-sub-std max-sm:hidden mt-2 border-t-2 border-teal-600 pt-2 print:hidden">
        <ul className="m-0 grid list-none grid-cols-4 gap-1 p-0 sm:flex sm:flex-wrap">
          {SUBTOPICS.filter((x: { theme: string }) => x.theme === theme).map((x: { id: string; short: string }) => {
            const on = x.id === sub;
            return <li key={x.id} className="flex sm:w-[100px]"><button type="button" aria-pressed={on} onClick={() => onSub(on ? "" : x.id)}
              className={`flex h-full min-h-[60px] w-full flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 text-center text-[12px] leading-tight max-sm:h-[46px] max-sm:min-h-0 max-sm:py-0 max-sm:gap-0 max-sm:px-0.5 max-sm:[hyphens:auto] max-sm:[overflow-wrap:anywhere] ${on ? "bg-teal-700 font-semibold text-white" : "bg-slate-50 text-slate-700 hover:bg-slate-100"}`}>
              <SubtopicIcon id={x.id} size={20} className={`max-sm:h-4 max-sm:w-4 ${on ? "text-white" : "text-slate-500"}`} />
              <span className="sm:line-clamp-none max-sm:line-clamp-2"><span className="max-sm:hidden">{x.short}</span><span className="sm:hidden">{kurz(x.short)}</span></span></button></li>;
          })}
        </ul>
      </nav>}
      <div className="mt-2 max-sm:mt-0 print:hidden"><DiffusionSearch filterUp noPlay follow={<Folgen heart before={() => { const nm = THEMES.find((t: { id: string; name: string }) => t.id === theme)?.name; if (nm) search.setThema(nm); }} hint="Auswahl unter Meine Suchen speichern" />} play={loading ? "loading" : "idle"} onPlay={() => !loading && run()} onSubmit={() => run()} startLabel="Auswerten" extra={<AtlasExtra level={level} onLevel={setLevel} />} /></div>
      {error && <Fehler onNochmal={() => run()}>{error}</Fehler>}
      {loading && !res && <Laden karte text="Auswertung wird berechnet …" />}
      {res && (
        <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"} aria-busy={loading}>
          {res.total === 0 ? <div role="status" className="mt-6 max-w-[760px] border-l-2 border-slate-300 py-1 pl-4">
            {/* Wie Leer (Befund.tsx), aber mit Knöpfen statt Tipp */}
            <p className="m-0 text-[18px] font-semibold leading-snug text-slate-900">Keine Vorgänge für diese Auswahl.</p>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[14px] font-medium text-teal-700">
              {sub && <button type="button" onClick={() => onSub("")}>Unterthema entfernen →</button>}
              {!sub && theme && <button type="button" onClick={() => onTheme("")}>Alle Themen zeigen →</button>}
              {new URLSearchParams(ranKey.split("?")[1] ?? "").get("area") && <button type="button" onClick={() => search.clearArea()}>Ganz Deutschland zeigen →</button>}
              {res.selection.q && <button type="button" onClick={() => search.applySearch("")}>Suchbegriff entfernen →</button>}
            </div>
          </div> : (
            <>
              {/* Mit Ort: der Ort als Chip mit ✕ am Satzanfang (dort sieht man ihn und kann ihn entfernen); sonst große Kennzahlen */}
              {place && cmp ? <Befund tight><PlaceChip name={place} onClear={() => search.clearArea()} />{placeRest}</Befund>
                : <Kennzahlen week={week} scope={[what || "Alle Themen", res.selection.q ? `„${prettyTerm(res.selection.q)}“` : "", place || ""].filter(Boolean).join(" · ")} period={zeitText(zeit)} items={[{ value: n(total), label: plural(total, "Vorgang", "Vorgänge") }]}>
                  {place && <PlaceChip name={place} onClear={() => search.clearArea()} />}
                  <span className="rm-zeit-std max-sm:hidden"><ZeitPills value={zeit} onPick={onZeit} /></span>
                </Kennzahlen>}

              {place && cmp && <div className="rm-zeit-std mt-2 max-sm:hidden"><ZeitPills value={zeit} onPick={onZeit} /></div>}
              {/* Links die Karte (halbe Breite, dafür höher), rechts die Listen zum Anklicken; ab 640 px nebeneinander, die Karte bleibt stehen */}
              <div className="rm-xsplit mt-4 max-sm:mt-2 grid grid-cols-1 gap-x-8 gap-y-8 max-sm:gap-y-4 min-[640px]:grid-cols-12">
                <div className="rm-xsplit-map min-w-0 min-[640px]:sticky min-[640px]:top-4 min-[640px]:col-span-6 min-[640px]:self-start">
                  {allRegions.length > 0 && <AtlasMap level={level} onLevel={setLevel} chips={mapChips} zeit={zeit} onZeit={onZeit} onPlace={(ags) => search.setArea(ags, "map")} regions={shownPreview ? shownPreview.rows : allRegions} preview={shownPreview ? (parts.find((p) => p.key === shownPreview.key)?.name ?? "") : undefined} facts={SHOW_FACTS && !shownPreview ? res.facts : []} listed={opened("map")} onList={(id) => toggle(`map:${id}`)} drill={(r) => drill("region", r)} />}
                </div>

                <div className="min-w-0 min-[640px]:col-span-6">
                  {pending && <ListSkeleton />}
                  <div className={pending ? "hidden" : undefined}>
                  {theme && <nav aria-label="Unterthema" className="rm-sub-wide print:hidden">
        <ul className="m-0 grid list-none grid-cols-4 gap-1 p-0 sm:flex sm:flex-wrap">
          {SUBTOPICS.filter((x: { theme: string }) => x.theme === theme).map((x: { id: string; short: string }) => {
            const on = x.id === sub;
            return <li key={x.id} className="flex sm:w-[100px]"><button type="button" aria-pressed={on} onClick={() => onSub(on ? "" : x.id)}
              className={`flex h-full min-h-[60px] w-full flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 text-center text-[12px] leading-tight max-sm:h-[46px] max-sm:min-h-0 max-sm:py-0 max-sm:gap-0 max-sm:px-0.5 max-sm:[hyphens:auto] max-sm:[overflow-wrap:anywhere] ${on ? "bg-teal-700 font-semibold text-white" : "bg-slate-50 text-slate-700 hover:bg-slate-100"}`}>
              <SubtopicIcon id={x.id} size={20} className={`max-sm:h-4 max-sm:w-4 ${on ? "text-white" : "text-slate-500"}`} />
              <span className="sm:line-clamp-none max-sm:line-clamp-2"><span className="max-sm:hidden">{x.short}</span><span className="sm:hidden">{kurz(x.short)}</span></span></button></li>;
          })}
        </ul>
      </nav>}
                  {res.compare && <OrtImVergleich c={res.compare} theme={theme} onPick={(k) => (theme ? onSub(sub === k ? "" : k) : onTheme(k))} />}

                  {sub ? <>
                    {/* Mit Unterthema: rechts sein Inhalt statt der Liste aller Unterthemen (zum Wechseln dienen die Pillen oben) */}
                    <section ref={subRef} className={`scroll-mt-4 ${res.compare ? "mt-8" : ""}`}>
                      <h2 className="flex items-center gap-2 text-[22px] font-semibold max-sm:text-[18px]"><ThemeIcon theme={theme} size={24} className="shrink-0 text-teal-700" />{subName}{place ? <span className="font-normal text-slate-500"> in {place}</span> : null}</h2>
                      <p className="mb-3 mt-1 text-[14px] text-slate-500">{subCount !== undefined ? `${n(subCount)} ${plural(subCount, "Vorgang", "Vorgänge")}${themeTotal ? `, ${pct(Math.round((1000 * subCount) / themeTotal) / 10)} von ${themeName}` : ""}. ` : ""}Die neuesten:</p>
                      <RadarDrill base={partBase} query={listQuery} by="sub" value={sub} label={subName} limit={all?.by === "sub" && all.value === sub ? undefined : 10} plain onAll={() => setAll({ by: "sub", value: sub, label: [themeName, subName].join(" › ") })} />
                      {all?.by === "sub" && all.value === sub && <button type="button" onClick={() => setAll(null)} className="mt-3 text-[14px] font-medium text-teal-700 hover:underline">Weniger zeigen</button>}
                      <p className="mt-3 text-[14px] text-slate-500">Wie es sich ausbreitet: <Link href={`/analytics/trends?begriff=${encodeURIComponent(subName)}`} className="font-medium text-teal-700 hover:underline">„{subName}“ in den Trends →</Link></p>
                    </section>
                  </> : <section className={res.compare ? "rm-sec-s" : ""}>
                    <h2 className="flex items-center gap-2 text-[22px] font-semibold max-sm:text-[18px]">{theme && <ThemeIcon theme={theme} size={24} className="text-teal-700" />}{theme ? <>Unterthemen<span className="max-sm:hidden"> von {themeName}</span></> : "Themen"}{place ? <span className="font-normal text-slate-500"> in {place}</span> : null}</h2>
                    <PartList rows={parts} icons={!theme} open={openPart} onHover={setHoverKey} selected={theme ? sub : ""} onOpen={(k) => setPart(openPart === k ? "" : k)}
                      label={(r) => (phone ? `${n(r.count)} ${plural(r.count, "Vorgang", "Vorgänge")}` : `${n(r.count)}${r.share !== null && theme && !sub ? ` · ${pct(r.share)}` : ""}`)}
                      drill={(r) => <RadarDrill base={partBase} query={listQuery} by={partBy} value={r.key} label={r.name} limit={all?.by === partBy && all.value === r.key ? undefined : theme ? 10 : 3} plain={!!theme}
                        onAll={() => setAll({ by: partBy, value: r.key, label: [themeName, r.name].filter(Boolean).join(" › ") })}
                        footer={isRest(r) ? null : <button type="button" onClick={() => (theme ? onSub(sub === r.key ? "" : r.key) : onTheme(r.key))} className="mt-2 block text-[14px] font-medium text-teal-700 hover:underline">
                          {theme && sub === r.key ? "Eingrenzung aufheben" : <>Auf „{r.name}“ eingrenzen<span className="max-sm:hidden"> →</span></>}</button>} />} />
                  </section>}

                  {rankRegions && <section className="rm-sec-s">
                    <h2 className="text-[22px] font-semibold max-sm:text-[18px]">Wo <span className="max-sm:hidden">{sub ? `„${subName}“` : `„${themeName}“`} </span>viel Raum hat</h2>
                    <div className="max-sm:hidden"><Hint>Anteil an allen Sachvorgängen des Gebiets (gleiche Filter), nur Gebiete mit mindestens {MIN_BASE} Sachvorgängen. Klick zeigt die Vorgänge.</Hint></div>
                    {regions.length ? <>
                      <Bars rows={regions.slice(0, moreRegions ? 15 : 5)} mode="expand" open={opened("region")} onOpen={(k) => toggle(`region:${k}`)} drill={(r) => drill("region", r)} value={(r) => r.share ?? 0}
                        label={(r) => (phone ? `${n(r.count)} ${plural(r.count, "Vorgang", "Vorgänge")}` : `${pct(r.share)} · ${n(r.count)}`)} />
                      {regions.length > 5 && <button type="button" aria-expanded={moreRegions} onClick={() => setMoreRegions(!moreRegions)} className="mt-2 text-[14px] font-medium text-teal-700 hover:underline max-sm:mt-3 max-sm:flex max-sm:w-full max-sm:items-center max-sm:gap-3 max-sm:rounded-xl max-sm:border max-sm:border-teal-600/30 max-sm:px-3 max-sm:py-2 max-sm:text-teal-800 max-sm:no-underline">
                        <span aria-hidden="true" className="grid h-8 w-8 flex-none place-items-center rounded-full bg-teal-50 text-teal-700 sm:hidden"><MapPin size={18} strokeWidth={1.6} /></span>
                        <span className="max-sm:flex-1 max-sm:text-left">{moreRegions ? "Weniger Orte" : <>Weitere Orte<span className="max-sm:hidden"> →</span></>}</span>
                        <span aria-hidden="true" className="flex-none text-teal-700 sm:hidden">{moreRegions ? <ChevronUp size={18} strokeWidth={1.6} /> : <ChevronDown size={18} strokeWidth={1.6} />}</span>
                      </button>}
                    </> : <p className="text-[14px] text-slate-500">Kein Gebiet hat genug Sachvorgänge für einen Vergleich.</p>}
                  </section>}
                  {!(theme || sub) && allRegions.length > 1 && <p className="mt-8 text-[14px] text-slate-500 max-sm:mt-5">Thema wählen, um zu sehen, wo es viel Raum hat.</p>}
                  {sub && together.length > 0 && <section className="rm-sec-s">
                    <h2 className="text-[22px] font-semibold max-sm:text-[18px]">Was oft zusammen auftaucht</h2>
                    <p className="mb-3 mt-1 text-[14px] text-slate-500 max-sm:hidden">Anteil der Vorgänge zu „{subName}“, die auch dieses Unterthema haben. Klick wechselt dorthin.</p>
                    <Bars rows={together} mode="select" onOpen={(k) => onSub(k)} value={(r) => r.count} label={(r) => pct(r.share)} />
                  </section>}
                  </div>
                </div>
              </div>

              {/* Ganze Liste nur nach „Alle … zeigen“; die neuesten Vorgänge stehen schon in der aufgeklappten Zeile rechts */}
              <section ref={bottomRef} className="scroll-mt-4">
                {all && !(all.by === "sub" || all.by === partBy) && <div className="rm-sec-m">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                    <h2 className="text-[22px] font-semibold max-sm:text-[18px]">Vorgänge: {all.label}</h2>
                    <button type="button" onClick={closeAll} className="text-[14px] font-medium text-teal-700 hover:underline">Schließen</button>
                  </div>
                  <div className="mt-3"><RadarDrill base={partBase} query={listQuery} by={all.by} value={all.value} label={all.label} /></div>
                </div>}
              </section>

              <MethodikNote>Gezählt werden Vorgänge: derselbe Titel in mehreren Gremien eines Gebiets zählt einmal. Formalien, Sammelpunkte, Besetzungen und Fragestunden zählen nicht.{res.unread ? ` ${n(res.unread)} Vorgänge sind noch nicht mit ihren Unterlagen gelesen; sie zählen beim Thema, aber noch ohne Unterthema.` : ""}</MethodikNote>
            </>
          )}
        </div>
      )}
    </section>
  );
}
