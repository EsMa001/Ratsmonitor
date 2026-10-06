import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { DarkCta, PageHead } from "./blocks";

/* Pro Video liegen in public/videos/: <name>.mp4, <name>.jpg (Vorschaubild) und <name>.vtt (Untertitel). Es genügt `file: "<name>"`. Optional `mobile: "<name>-mobil"` für ein eigenes Hochformat-Video auf dem Handy (unter 768 px). */
type Video = { title: string; text: string; file?: string; mobile?: string };

/* Videos hier eintragen: file = Dateiname ohne Endung. Ohne file zeigt die Karte „Video folgt“. */
const GROUPS: { group: string; lead: string; items: Video[] }[] = [
  {
    group: "Erklärvideos",
    lead: "So nutzen Sie die Plattform Schritt für Schritt.",
    items: [
      { title: "Erste Suche und Karte", text: "Nach einem Begriff suchen, Treffer auf der Karte sehen, filtern und Artikel öffnen.", file: "erste-suche", mobile: "erste-suche-mobil" },
      { title: "Filter und Zeitraum", text: "Ergebnisse nach Thema, Status und Zeitraum eingrenzen.", mobile: "filter-zeitraum-mobil" },
      { title: "Alarme einrichten", text: "Suchen speichern und per E-Mail benachrichtigt werden.", mobile: "alarme-einrichten-mobil" },
      { title: "Exakter Begriff und mehrere Wörter", text: "Ganze Wörter finden und Suchbegriffe mit „oder“ kombinieren.", mobile: "exakter-begriff-mobil" },
      { title: "Die Karte im Detail", text: "Flächen, Heatmap und Punkte, Zoomen und Trefferzahlen je Gebiet.", mobile: "karte-im-detail-mobil" },
      { title: "Trefferliste und Sortierung", text: "Treffer sortieren, die Ansicht wechseln und Artikel öffnen.", mobile: "trefferliste-sortierung-mobil" },
      { title: "Artikel speichern und teilen", text: "Beschlüsse merken, teilen und später im Konto wiederfinden.", mobile: "artikel-speichern-teilen-mobil" },
      { title: "Export als PDF, Excel und CSV", text: "Treffer und einzelne Artikel exportieren oder drucken.", mobile: "export-mobil" },
      { title: "Kalender und Sitzungen", text: "Anstehende Sitzungen im Blick behalten.", mobile: "kalender-sitzungen-mobil" },
      { title: "Postfach und Wochenbericht", text: "Benachrichtigungen lesen und den Wochenbericht verstehen.", mobile: "postfach-wochenbericht-mobil" },
      { title: "Konto und Profil", text: "Anmelden, Profil pflegen und Einstellungen anpassen.", mobile: "konto-profil-mobil" },
      { title: "Datenabdeckung prüfen", text: "Sehen, welche Orte und Gremien enthalten sind und wie aktuell der Stand ist.", mobile: "datenabdeckung-mobil" },
    ],
  },
  {
    group: "Vorstellung",
    lead: "Kurz gezeigt, was die Plattform für Ihre Region leistet.",
    items: [
      { title: "Politik vor Ort im Blick", text: "Der Überblick in unter einer Minute.", mobile: "politik-vor-ort-mobil" },
      { title: "Für Unternehmen und Verbände", text: "Frühzeitig wissen, was in den Räten beraten wird.", mobile: "unternehmen-verbaende-mobil" },
    ],
  },
];

const isPhone = () => window.matchMedia("(max-width: 767px)").matches;
const baseOf = (v: Video, phone: boolean) => `/videos/${phone && v.mobile ? v.mobile : v.file}`;
const hasVideo = (v: Video, phone: boolean) => !!(phone ? v.mobile || v.file : v.file);

/* Lädt nichts, bis jemand auf das Vorschaubild klickt. Dann läuft das Video direkt in der Karte (Vollbild über das Symbol im Player).
   Untertitel sind aus und lassen sich im Player (CC) einschalten. Handy (unter 768 px): kleine Vorschau neben dem Text,
   nach dem Tippen klappt die Karte auf. Mit `mobile` gibt es auf dem Handy ein eigenes Hochformat-Video.
   Nach dem Ende wird das nächste Video vorgeschlagen. */
function Clip({ base, next, onNext, className }: { base: string; next?: Video; onNext: () => void; className: string }) {
  const [ended, setEnded] = useState(false);
  const ref = useRef<HTMLVideoElement>(null);
  return (
    <div className="relative">
      <video ref={ref} key={base} controls autoPlay playsInline preload="auto" poster={`${base}.jpg`} src={`${base}.mp4`} onPlay={() => setEnded(false)} onEnded={() => setEnded(true)} className={`${className} [&:-webkit-full-screen]:object-cover [&:fullscreen]:object-cover`}>
        <track kind="captions" srcLang="de" label="Deutsch" src={`${base}.vtt`} />
      </video>
      {ended && next && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-[inherit] bg-slate-900/85 p-4 text-center text-white">
          <p className="m-0 text-[14px] text-slate-300">Als Nächstes</p>
          <p className="m-0 text-[18px] font-semibold">{next.title}</p>
          <button type="button" onClick={onNext} className="cursor-pointer rounded-full border-0 bg-white px-5 py-2 text-[16px] font-semibold text-slate-900">Abspielen →</button>
          <button type="button" onClick={() => { setEnded(false); void ref.current?.play(); }} className="cursor-pointer border-0 bg-transparent p-0 text-[14px] text-slate-300 underline">Noch einmal ansehen</button>
        </div>
      )}
    </div>
  );
}

function Card({ v, active, phone, next, onPlay, onNext }: { v: Video; active: boolean; phone: boolean; next?: Video; onPlay: () => void; onNext: () => void }) {
  const box = useRef<HTMLElement>(null);
  useEffect(() => {
    if (active && phone) box.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [active, phone]);
  const onlyMobile = !v.file && !!v.mobile;
  const open = active && hasVideo(v, phone);
  /* Nur Handy-Video vorhanden: am Computer „Video folgt“, auf dem Handy die Vorschau */
  const placeholder = <div className={`flex aspect-video w-full items-center justify-center rounded-xl bg-[#f8f9fa] text-[14px] text-slate-500 max-md:aspect-square max-md:text-[12px] ${onlyMobile ? "max-md:hidden" : ""}`}>Video folgt</div>;
  const thumb = (
    <button type="button" onClick={onPlay} aria-label={`Video abspielen: ${v.title}`} className={`group relative block aspect-video w-full cursor-pointer overflow-hidden rounded-xl border-0 bg-slate-900 p-0 max-md:aspect-square ${onlyMobile ? "md:hidden" : ""}`}>
      <picture>
        {v.mobile && v.file && <source media="(max-width: 767px)" srcSet={`/videos/${v.mobile}.jpg`} />}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/videos/${v.file ?? v.mobile}.jpg`} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover object-top" />
      </picture>
      <span className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow-md transition group-hover:scale-105 max-md:h-9 max-md:w-9">
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="#0f172a" /></svg>
      </span>
    </button>
  );
  return (
    <figure ref={box} className={`m-0 scroll-mt-20 ${open ? "" : "max-md:flex max-md:items-start max-md:gap-4"}`}>
      <div className={open ? "" : "max-md:w-24 max-md:shrink-0"}>
        {!v.file && !v.mobile ? (
          placeholder
        ) : open ? (
          <Clip base={baseOf(v, phone)} next={next} onNext={onNext} className="mx-auto block aspect-video w-full rounded-xl bg-slate-900 max-md:aspect-auto max-md:max-h-[78vh] max-md:w-auto max-md:max-w-full" />
        ) : onlyMobile ? (
          <>
            {placeholder}
            {thumb}
          </>
        ) : (
          thumb
        )}
      </div>
      <figcaption className={`mt-3 ${open ? "" : "max-md:mt-0"}`}>
        <h3 className="m-0 text-[16px] font-semibold text-slate-900">{v.title}</h3>
        <p className="m-0 mt-1 text-[14px] text-slate-500">{v.text}</p>
      </figcaption>
    </figure>
  );
}

export function VideosPage() {
  const [active, setActive] = useState<string | null>(null);
  const [phone, setPhone] = useState(false);
  const playable = GROUPS.flatMap((g) => g.items).filter((v) => hasVideo(v, phone));
  const play = (title: string) => { setPhone(isPhone()); setActive(title); };
  const nextOf = (title: string) => playable[playable.findIndex((v) => v.title === title) + 1];
  return (
    <>
      <PageHead icon="circlePlay" label="Informationen" name="Videos" title="Videos" lead="Erklärvideos zur Nutzung und kurze Vorstellungsvideos." />
      <section className="ri-sec">
        {GROUPS.map((g) => (
          <div key={g.group} className="mb-12">
            <h2 className="m-0 text-[22px] font-semibold text-slate-900">{g.group}</h2>
            <p className="mb-6 mt-1 text-[16px] text-slate-500">{g.lead}</p>
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {g.items.map((v) => (
                <Card key={v.title} v={v} active={active === v.title} phone={phone} next={nextOf(v.title)} onPlay={() => play(v.title)} onNext={() => { const n = nextOf(v.title); if (n) play(n.title); }} />
              ))}
            </div>
          </div>
        ))}
      </section>
      <DarkCta title="Fragen zu den Videos?" sub="Schreiben Sie uns, wir antworten in der Regel innerhalb eines Werktags." action={<Link href="/kontakt" className="ri-btn ri-btn--inv">Kontakt aufnehmen</Link>} />
    </>
  );
}
