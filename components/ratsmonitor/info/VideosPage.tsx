import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { DarkCta, PageHead } from "./blocks";
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
  { t: 140, title: "Alarme", what: "Per E-Mail informiert werden, ohne zu suchen." },
  { t: 178, title: "Export", what: "Aus der Suche wird Ihre Auswertung." },
  { t: 206, title: "Kalender", what: "Keine Sitzung verpassen." },
  { t: 229, title: "Konto", what: "Alles Gespeicherte an einem Ort." },
  { t: 252, title: "Datenabdeckung", what: "Ist Ihre Gemeinde dabei? Das sehen Sie offen." },
];
const ANALYSE: Chapter[] = [
  { t: 280, title: "Ausbreitung", what: "Sehen, wie sich ein Thema ausbreitet." },
  { t: 320, title: "Entscheidungen", what: "Wie Vorgänge ausgehen." },
  { t: 352, title: "Trends", what: "Neues früh erkennen." },
  { t: 374, title: "Orte vergleichen", what: "Zwei Kommunen nebeneinander." },
  { t: 401, title: "Zusammenhänge", what: "Themen und Orte als Netz." },
  { t: 427, title: "Weg durch die Gremien", what: "Wie ein Thema durch die Gremien läuft." },
];
const ALL = [...PLENARA, ...ANALYSE, { t: 457, title: "Jetzt ausprobieren", what: "" }];
const LENGTH = 492;

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

function Player({ base, poster, label, onTime, seekRef }: { base: string; poster: string; label: string; onTime?: (t: number) => void; seekRef?: React.MutableRefObject<((t: number) => void) | null> }) {
  const [on, setOn] = useState(false);
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
        <video key={base} ref={ref} controls autoPlay playsInline preload="auto" poster={`/videos/${poster}.jpg`} src={`/videos/${base}.mp4`}
          onLoadedMetadata={() => { if (pending.current !== null && ref.current) { ref.current.currentTime = pending.current; pending.current = null; } }}
          onTimeUpdate={(e) => onTime?.(e.currentTarget.currentTime)} className="block aspect-video w-full bg-slate-900">
          <track kind="captions" srcLang="de" label="Deutsch" src={`/videos/${base}.vtt`} />
        </video>
      ) : (
        <button type="button" onClick={() => setOn(true)} aria-label={label} className="group relative block aspect-video w-full cursor-pointer border-0 bg-slate-900 p-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/videos/${poster}.jpg`} alt="" decoding="async" className="h-full w-full object-cover" />
          <span className="absolute inset-0 bg-slate-900/25 transition group-hover:bg-slate-900/10" />
          <span className="absolute left-1/2 top-1/2 flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 shadow-lg transition group-hover:scale-105 max-md:h-14 max-md:w-14">
            <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="#0f172a" /></svg>
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

const HOOKS: { title: string; text: string; t: number }[] = [
  { title: "Früher erfahren, was beraten wird", text: "Ein Begriff, und die Karte zeigt, wo darüber beraten wird.", t: 38 },
  { title: "Alarme statt tägliches Suchen", text: "plenara meldet sich per E-Mail, wenn es Neues gibt.", t: 140 },
  { title: "Stand jedes Vorgangs auf einen Blick", text: "Der Verlauf steht schon in der Trefferliste.", t: 71 },
  { title: "Wie sich ein Thema ausbreitet", text: "plenara.X zeigt Ausbreitung, Entscheidungen und Trends.", t: 280 },
];

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
      <PageHead icon="circlePlay" label="Informationen" name="Videos" title="plenara in Bewegung" lead="Besser verstehen, was vor Ort beraten wird. In unter einer Minute oder in acht Minuten." />
      <section className="ri-sec">
        <div className="grid items-center gap-8 lg:grid-cols-[1.4fr_1fr] lg:gap-12">
          <Player base={variant(PITCH, dark)} poster={variant(PITCH, dark)} label="Kurzvideo abspielen: plenara in unter einer Minute" />
          <div>
            <p className="m-0 text-[14px] font-semibold uppercase tracking-wide text-teal-700">Unter 45 Sekunden</p>
            <h2 className="m-0 mt-1 text-[26px] font-semibold leading-tight max-md:text-[21px] text-slate-900">Was wird in Räten gerade beraten, das Ihr Vorhaben, Ihre Stadt oder Ihre Recherche betrifft?</h2>
            <p className="mb-0 mt-3 text-[16px] text-slate-600">Für Kommunen, Unternehmen, Verbände, Medien und Bürger: Ein Begriff genügt, die Karte zeigt, wo darüber beraten wird, und jede Angabe führt zur Originalunterlage.</p>
          </div>
        </div>
      </section>
      <section className="ri-sec">
        <h2 className="m-0 text-[22px] font-semibold text-slate-900">Was Sie sehen werden</h2>
        <p className="mb-6 mt-1 text-[16px] text-slate-500">Ein Klick springt direkt zur passenden Stelle im ganzen Video.</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {HOOKS.map((h) => (
            <button key={h.title} type="button" onClick={() => go(h.t)} className="cursor-pointer rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-teal-600 hover:shadow-md">
              <span className="block text-[16px] font-semibold text-slate-900">{h.title}</span>
              <span className="mt-1 block text-[14px] text-slate-500">{h.text}</span>
              <span className="mt-3 block text-[14px] font-semibold text-teal-700">Ab {mmss(h.t)} ansehen →</span>
            </button>
          ))}
        </div>
      </section>
      <section className="ri-sec" ref={full}>
        <p className="m-0 text-[14px] font-semibold uppercase tracking-wide text-teal-700">Rund acht Minuten</p>
        <h2 className="m-0 mt-1 text-[22px] font-semibold text-slate-900">Alle Funktionen von plenara und plenara.X</h2>
        <p className="mb-6 mt-1 text-[16px] text-slate-500">Von der ersten Suche bis zur Analyse. Untertitel lassen sich im Player zuschalten.</p>
        <div className="grid items-start gap-8 lg:grid-cols-[1.5fr_1fr] lg:gap-10">
          <Player base={variant(FULL, dark)} poster={variant(FULL, dark)} label="Vollständiges Video abspielen" onTime={(t) => setNow(Math.floor(t))} seekRef={ctlRef} />
          <div className="grid gap-5 sm:grid-cols-2 lg:max-h-[34rem] lg:grid-cols-1 lg:overflow-y-auto">
            <ChapterList title="plenara" items={PLENARA} now={now} go={go} />
            <ChapterList title="plenara.X Analysen" items={ANALYSE} now={now} go={go} />
          </div>
        </div>
      </section>
      <DarkCta title="Gesehen, was plenara kann?" sub="Probieren Sie es mit Ihrem Thema aus oder schreiben Sie uns, wenn Sie Fragen haben." action={<Link href="/kontakt" className="ri-btn ri-btn--inv">Kontakt aufnehmen</Link>} />
    </>
  );
}
