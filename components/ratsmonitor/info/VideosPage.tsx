import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { DarkCta, Ladefehler, PageHead } from "./blocks";
import { useDarkMode } from "../lib/useDarkMode";

/* Zwei Videos, beide aus der Video-Datenbank (docs/videos): das Kurzvideo (Pitch) und das vollständige Video mit allen Kapiteln.
   Dateien in public/videos/: <name>.mp4, .jpg (Vorschau), .vtt (Untertitel). Kapitelzeiten stammen aus docs/videos/fassungen/*.timeline.json
   (Sekunden); bei einer neuen Fassung hier die Zeiten und die Dauer nachziehen. */
const PITCH = "plenara-pitch";
const FULL = "plenara-komplett";
/* Im Dark Mode der App laufen die dunklen Fassungen (<name>-dunkel, gleiche Kapitelzeiten) */
const variant = (base: string, dark: boolean) => (dark ? `${base}-dunkel` : base);

type Chapter = { t: number; title: string; what: string };
const PLENARA: Chapter[] = [
  { t: 7, title: "Startseite", what: "Was in Ihren Kommunen beraten wird, an einem Ort." },
  { t: 38, title: "Suchen", what: "Ein Begriff, ganz Deutschland, sofort auf der Karte." },
  { t: 71, title: "Liste und Artikel", what: "Den Stand jedes Vorgangs auf einen Blick." },
  { t: 108, title: "Filter", what: "Eingrenzen, bis nur das Passende übrig bleibt." },
  { t: 140, title: "Alarme", what: "Nichts verpassen, ohne zu suchen." },
  { t: 168, title: "Export", what: "Aus der Suche wird Ihre Auswertung." },
  { t: 196, title: "Kalender", what: "Keine Sitzung verpassen." },
  { t: 218, title: "Konto", what: "Alles Gespeicherte an einem Ort." },
  { t: 242, title: "Datenabdeckung", what: "Ist Ihre Gemeinde dabei? Das sehen Sie offen." },
];
const ANALYSE: Chapter[] = [
  { t: 269, title: "Atlas", what: "Wie viel wo beraten wird, nach zehn Themen." },
  { t: 292, title: "Signale", what: "Einzelne Vorhaben mit Ort, Schritt und Quelle." },
  { t: 311, title: "Trends", what: "Begriffe, die gerade zunehmen." },
  { t: 332, title: "Fakten", what: "Werte aus den Vorlagen, je Gemeinde." },
  { t: 345, title: "Einblicke", what: "Gremien, Themennetz und Aktuelles." },
];
const ALL = [...PLENARA, ...ANALYSE, { t: 359, title: "Jetzt ausprobieren", what: "" }];
const LENGTH = 395;

/* plenara.X allein und je Anwenderseite ein Video (videos/plenarax.json, videos/anwender-*.json, je mit dunkler Fassung) */
const PLENARAX = "plenara-x";
const ANWENDER: { slug: string; name: string; text: string }[] = [
  { slug: "immobilien", name: "Immobilien", text: "Bebauungspläne finden, bevor Flächen am Markt sind." },
  { slug: "versorgung", name: "Versorgung", text: "Wärmeplanung und Netze früh im Blick." },
  { slug: "planung", name: "Planung", text: "Radwege und Bauprogramme der Region früh kennen." },
  { slug: "verbaende", name: "Verbände", text: "Ausschreibungen und Beschlüsse für Ihre Mitglieder einordnen." },
  { slug: "oeffentlichkeit", name: "Öffentlichkeit", text: "Den Haushalt und Beschlüsse vor der Sitzung kennen." },
];

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

function Player({ base, poster, label, onTime, seekRef }: { base: string; poster: string; label: string; onTime?: (t: number) => void; seekRef?: React.MutableRefObject<((t: number) => void) | null> }) {
  const [on, setOn] = useState(false);
  const [fehler, setFehler] = useState(false);
  const ref = useRef<HTMLVideoElement>(null);
  const pending = useRef<number | null>(null);
  const seek = (t: number) => {
    const v = ref.current;
    if (v) { v.currentTime = t; void v.play(); } else { pending.current = t; setOn(true); }
  };
  useEffect(() => { if (seekRef) seekRef.current = seek; });
  return (
    <div className="relative overflow-hidden rounded-2xl bg-slate-900 shadow-lg">
      {on ? (
        <>
        <video key={base} ref={ref} controls autoPlay playsInline preload="auto" poster={`/videos/${poster}.jpg`} src={`/videos/${base}.mp4`}
          onLoadedMetadata={() => { if (pending.current !== null && ref.current) { ref.current.currentTime = pending.current; pending.current = null; } }}
          onError={() => setFehler(true)} onTimeUpdate={(e) => onTime?.(e.currentTarget.currentTime)} className="block aspect-video w-full bg-slate-900">
          <track kind="captions" srcLang="de" label="Deutsch" src={`/videos/${base}.vtt`} />
        </video>
        {fehler && <div className="bg-white px-4 py-3"><Ladefehler text="Das Video konnte nicht geladen werden." onRetry={() => { setFehler(false); setOn(false); }} /></div>}
        </>
      ) : (
        <button type="button" onClick={() => setOn(true)} aria-label={label} className="group relative block aspect-video w-full cursor-pointer border-0 bg-slate-900 p-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/videos/${poster}.jpg`} alt="" decoding="async" className="h-full w-full object-cover" />
          <span className="absolute inset-0 bg-slate-900/25 transition group-hover:bg-slate-900/10" />
          <span className="absolute left-1/2 top-1/2 flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 shadow-lg transition group-hover:scale-105 max-md:h-14 max-md:w-14">
            <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="var(--rm-c900)" /></svg>
          </span>
        </button>
      )}
    </div>
  );
}

function ChapterList({ title, items, now, go }: { title: string; items: Chapter[]; now: number; go: (t: number) => void }) {
  return (
    <div>
      <h3 className="m-0 mb-2 text-[14px] font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      <ul className="m-0 list-none p-0">
        {items.map((c) => {
          const i = ALL.indexOf(c);
          const cur = now >= c.t && now < (ALL[i + 1]?.t ?? LENGTH);
          return (
            <li key={c.t}>
              <button type="button" onClick={() => go(c.t)} aria-current={cur || undefined}
                className={`flex w-full cursor-pointer items-baseline gap-3 rounded-lg border-0 px-3 py-2 text-left transition ${cur ? "bg-teal-50" : "bg-transparent hover:bg-slate-100"}`}>
                <span className="w-10 shrink-0 text-[14px] tabular-nums text-slate-500">{mmss(c.t)}</span>
                <span className="min-w-0">
                  <span className="block text-[14px] font-semibold text-slate-900">{c.title}</span>
                  <span className="block text-[14px] text-slate-500">{c.what}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function VideosPage() {
  const [dark] = useDarkMode();
  const [now, setNow] = useState(0);
  const ctlRef = useRef<((t: number) => void) | null>(null);
  const full = useRef<HTMLElement>(null);
  const go = (t: number) => {
    full.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    ctlRef.current?.(t);
  };
  return (
    <>
      <PageHead icon="circlePlay" label="Informationen" name="Videos" title={<>plenara in Bewegung. In Minuten erklärt.</>} lead="Besser verstehen, was vor Ort beraten wird. In unter einer Minute oder in acht Minuten." />
      <section className="ri-sec max-sm:!py-5">
        <div className="grid items-center gap-8 max-sm:gap-3 lg:grid-cols-[1fr_1fr] lg:gap-10">
          <Player base={variant(PITCH, dark)} poster={variant(PITCH, dark)} label="Kurzvideo abspielen: plenara in unter einer Minute" />
          <div className="max-sm:order-first">
            <p className="m-0 text-[14px] font-semibold uppercase tracking-wide text-teal-700">Unter 45 Sekunden</p>
            <h2 className="m-0 mt-1 text-[28px] font-semibold leading-tight max-md:text-[22px] text-slate-900">Was wird in Räten gerade beraten, das Ihr Vorhaben, Ihre Stadt oder Ihre Recherche betrifft?</h2>
            <p className="mb-0 mt-3 max-sm:mt-1.5 text-[16px] text-slate-600">Ein Begriff genügt, die Karte zeigt, wo beraten wird.</p>
          </div>
        </div>
      </section>
      <section className="ri-sec max-sm:!py-5" ref={full}>
        <p className="m-0 text-[14px] font-semibold uppercase tracking-wide text-teal-700">Gut sechs Minuten</p>
        <h2 className="m-0 mt-1 text-[22px] font-semibold text-slate-900">Alle Funktionen von plenara und plenara.X</h2>
        <p className="mb-6 max-sm:mb-3 mt-1 text-[16px] text-slate-500">Von der ersten Suche bis zur Analyse. Untertitel lassen sich im Player zuschalten.</p>
        <div className="grid items-start gap-8 lg:grid-cols-[1.1fr_1fr] lg:gap-8">
          <Player base={variant(FULL, dark)} poster={variant(FULL, dark)} label="Vollständiges Video abspielen" onTime={(t) => setNow(Math.floor(t))} seekRef={ctlRef} />
          <div className="grid gap-5 max-sm:hidden sm:grid-cols-2 lg:max-h-[34rem] lg:grid-cols-1 lg:overflow-y-auto">
            <ChapterList title="plenara" items={PLENARA} now={now} go={go} />
            <ChapterList title="plenara.X Analysen" items={ANALYSE} now={now} go={go} />
          </div>
          {/* Handy: die Kapitel erst auf Wunsch */}
          <details className="group rounded-2xl bg-slate-50 px-4 py-1 sm:hidden">
            <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between text-[16px] font-semibold text-slate-900 [&::-webkit-details-marker]:hidden">
              {PLENARA.length + ANALYSE.length} Kapitel zeigen
              <span aria-hidden="true" className="text-teal-700 transition-transform group-open:rotate-90">›</span>
            </summary>
            <div className="grid gap-5 pb-3">
              <ChapterList title="plenara" items={PLENARA} now={now} go={go} />
              <ChapterList title="plenara.X Analysen" items={ANALYSE} now={now} go={go} />
            </div>
          </details>
        </div>
      </section>
      <section className="ri-sec max-sm:!py-5">
        <h2 className="m-0 text-[22px] font-semibold text-slate-900">Weitere Videos</h2>
        <p className="mb-6 max-sm:mb-3 mt-1 text-[16px] text-slate-500">plenara.X und je Anwendergruppe ein kurzes Video mit einem passenden Begriff.</p>
        <div className="grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 max-sm:-mx-4 max-sm:flex max-sm:snap-x max-sm:snap-mandatory max-sm:scroll-px-4 max-sm:gap-3 max-sm:overflow-x-auto max-sm:px-4 max-sm:[scrollbar-width:none] max-sm:[&::-webkit-scrollbar]:hidden">
          {[{ base: PLENARAX, name: "plenara.X", text: "Atlas, Signale, Trends, Fakten und Einblicke.", href: "/analytics/atlas", link: "Zum Atlas" },
            ...ANWENDER.map((a) => ({ base: `plenara-anwender-${a.slug}`, name: a.name, text: a.text, href: `/anwender/${a.slug}`, link: `Zur Seite ${a.name}` }))].map((v) => (
            <div key={v.base} className="max-sm:w-[78%] max-sm:flex-none max-sm:snap-start">
              <Player base={variant(v.base, dark)} poster={variant(v.base, dark)} label={`Video abspielen: ${v.name}`} />
              <p className="m-0 mt-3 text-[16px] font-semibold text-slate-900">{v.name}</p>
              <p className="m-0 mt-0.5 text-[14px] text-slate-500">{v.text} <Link href={v.href} className="inline-block max-sm:py-3 text-teal-700 hover:underline">{v.link} →</Link></p>
            </div>
          ))}
        </div>
      </section>
      <DarkCta title="Gesehen, was plenara kann?" sub="Probieren Sie es mit Ihrem Thema aus oder schreiben Sie uns, wenn Sie Fragen haben." action={<Link href="/kontakt" className="ri-btn ri-btn--inv">Kontakt aufnehmen</Link>} />
    </>
  );
}
