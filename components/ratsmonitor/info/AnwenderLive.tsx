import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { PageHead } from "./blocks";
import type { Branche } from "./content";
import { Icon } from "./icons";
import { IS_DEV } from "../lib/tier";
import { useDarkMode } from "../lib/useDarkMode";
import { XAuszug } from "./XAuszug";

/* Anwenderseite mit Live-Daten (Konzept requirements/anwender-seiten-konzept.md): handverlesene echte Vorgänge im Kopf,
   Zahl der letzten 30 Tage in ganz Deutschland aus der normalen Suche, Beleg für den Vorsprung an einem echten Plan,
   Rollen kurz, plenara.X als Links, Abschluss mit nächstem Schritt. Gilt für Seiten mit `beleg` in content.ts. */

const kurz = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(2, 4)}`;

/** Link in die echte Suche mit Begriff und den letzten 30 Tagen (dort lässt sie sich mit dem Herz merken) */
const suchLink = (term: string) => {
  const p = new URLSearchParams({ q: term });
  p.set("von", "@d30");
  return `/suche?${p}`;
};

/** Beleg: ein echter Vorgang, jede Sitzung mit Datum und Link */
function Beleg({ b }: { b: NonNullable<Branche["beleg"]> }) {
  const first = b.schritte[0].d, last = b.schritte[b.schritte.length - 1].d;
  const monate = Math.round((Date.parse(last) - Date.parse(first)) / 2629800000);
  return (
    <section className="ri-sec">
      <h2 className="ri-h2">{b.ueberschrift ?? `Vom ersten Beschluss bis zur Satzung: ${monate} Monate`}</h2>
      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
        {b.text ? <span className="text-[16px] text-slate-700">{b.text}</span> : <><span className="text-[16px] font-semibold text-slate-900">{b.titel}</span><span className="text-[16px] text-slate-500">{b.ort}</span></>}
      </div>
      <ol className={`relative m-0 mt-10 grid list-none gap-x-10 p-0 sm:before:absolute sm:before:inset-x-0 sm:before:top-0 sm:before:h-0.5 sm:before:bg-teal-600 ${["", "", "sm:grid-cols-2", "sm:grid-cols-3", "sm:grid-cols-4"][Math.min(b.schritte.length, 4)]}`}>
        {b.schritte.map((s, i) => (
          <li key={s.href} className="relative border-l-2 border-teal-600 pb-6 pl-5 sm:border-l-0 sm:pb-0 sm:pl-0 sm:pt-5">
            <span aria-hidden="true" className="absolute -left-[7px] top-0 h-3 w-3 rounded-full bg-teal-600 sm:-top-[7px] sm:left-0" />
            <p className="m-0 text-[14px] font-semibold text-teal-700">{kurz(s.d)}{i === 0 ? " · hier erstmals sichtbar" : ""}</p>
            <p className="m-0 mt-1 text-[16px] font-semibold text-slate-900">{s.label}</p>
            <p className="m-0 mt-1 text-[14px] text-slate-500">{s.gremium}</p>
            <Link href={s.href} className="mt-1 inline-block text-[14px] text-teal-700 hover:underline">Vorgang mit Quelle →</Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Video im Laptop-Rahmen, rechts die Kapitel (`<video>.kapitel.json` aus der Zeitleiste des Videos); ein Klick springt im Video dorthin */
function VideoMitKapiteln({ b, dark }: { b: Branche; dark: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [kap, setKap] = useState<{ titel: string; start: number }[]>([]);
  const [aktiv, setAktiv] = useState(0);
  useEffect(() => {
    if (!b.video) return;
    const c = new AbortController();
    fetch(`${b.video}.kapitel.json`, { signal: c.signal }).then((r) => (r.ok ? (r.json() as Promise<{ titel: string; start: number }[]>) : [])).then(setKap).catch(() => {});
    return () => c.abort();
  }, [b.video]);
  const gehe = (i: number) => { const v = ref.current; if (!v) return; v.currentTime = kap[i].start; void v.play().catch(() => {}); };
  const zeit = () => { const t = ref.current?.currentTime ?? 0; let i = 0; kap.forEach((k, j) => { if (t >= k.start - 0.2) i = j; }); setAktiv(i); };
  const suffix = dark ? "-dunkel" : "";
  return (
    <div className="flex flex-col items-center gap-8 lg:flex-row lg:items-center lg:gap-12">
      <div className="w-full max-w-[680px] lg:flex-none">
        <div className="rounded-t-2xl border-[10px] border-b-0 border-slate-800 bg-slate-800">
          {b.video
            ? <video ref={ref} key={suffix} controls preload="metadata" playsInline onTimeUpdate={zeit} poster={`${b.video}${suffix}.jpg`} className="block aspect-video w-full rounded-md bg-slate-100" aria-label={`Video: Plenara für ${b.name}`}>
                <source src={`${b.video}${suffix}.mp4`} type="video/mp4" />
                <track kind="subtitles" src={`${b.video}${suffix}.vtt`} srcLang="de" label="Deutsch" />
              </video>
            : <div className="flex aspect-video w-full items-center justify-center rounded-md bg-slate-100 p-4 text-[14px] text-slate-500">Video „{b.name}“ (nur im Dev sichtbar)</div>}
        </div>
        <div className="mx-[-3%] h-3 rounded-b-2xl bg-slate-300" style={{ boxShadow: "inset 0 -2px 0 var(--rm-c400)" }} />
      </div>
      {kap.length > 0 && (
        <ol className="m-0 w-full max-w-[680px] list-none p-0 lg:max-w-none lg:flex-1">
          {kap.map((k, i) => (
            <li key={k.titel}>
              <button type="button" onClick={() => gehe(i)} aria-current={aktiv === i} className={"flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left text-[16px] leading-snug " + (aktiv === i ? "bg-teal-50 font-semibold text-slate-900" : "text-slate-700 hover:bg-slate-50")}>
                <span className={"mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full text-[13px] font-semibold " + (aktiv === i ? "bg-teal-700 text-white" : "bg-slate-100 text-slate-700")}>{i + 1}</span>
                {k.titel}
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function AnwenderLivePage({ b }: { b: Branche }) {
  const term = b.keywords[0];
  const [dark] = useDarkMode();
  const href = suchLink(term);
  return (
    <>
      {/* Kopf: Einleitung nur ab Tablet */}
      <PageHead icon={b.icon} label="Anwender" name={b.name} title={b.title} lead={<span className="max-sm:hidden">{b.intro}</span>} />

      {b.xauszug && <XAuszug name={b.name} auszuege={b.xauszug} text={b.xtext} />}

      {/* Video der Seite (Feld `video` in content.ts: Pfad ohne Endung, .mp4/.jpg/.vtt), direkt nach dem Auszug. Im Dark Mode die dunkle
         Fassung (<Pfad>-dunkel). Ohne Video nur im Dev-Server ein kleiner Platzhalter. */}
      {(b.video || IS_DEV) && (
        <section className="ri-sec ri-sec--tight">
          <div className="mx-auto max-w-[1100px]">
            <h2 className="ri-h2" style={{ margin: "0 auto 32px", fontSize: 34, textAlign: "center" }}>Plenara für {b.name} in einer Minute</h2>
            <VideoMitKapiteln b={b} dark={dark} />
          </div>
        </section>
      )}

      {b.beleg && <Beleg b={b.beleg} />}


      {/* Rollen: je Rolle ein konkreter Nutzen (Überschrift und Satz) und ein Suchlink */}
      <section className="ri-sec ri-sec--tight">
        <h2 className="ri-h2">Für Ihre Rolle</h2>
        <div className="grid gap-x-10 gap-y-10 sm:grid-cols-3" style={{ marginTop: 24 }}>
          {(b.rollen ?? []).map((rolle) => {
            const n = b.benefits.find(([, , , , r]) => r === rolle.name);
            return (
              <div key={rolle.name}>
                <div className="flex items-center gap-3">
                  <span className="ri-tl__icon"><Icon name={rolle.icon} size={18} /></span>
                  <h3 className="m-0 text-[18px] font-semibold text-slate-900">{rolle.name}</h3>
                </div>
                {n && <>
                  <p className="m-0 mt-3 text-[16px] font-semibold text-slate-900">{n[1]}</p>
                  <p className="m-0 mt-1 text-[16px] leading-relaxed text-slate-500">{n[2]}</p>
                  <Link href={suchLink(n[3])} className="mt-1 inline-block py-1 text-[14px] text-teal-700 hover:underline">Suche „{n[3]}“ →</Link>
                </>}
              </div>
            );
          })}
        </div>
      </section>

      {/* Abschluss: ein Satz, eine Handlung, Slogan */}
      <section className="ri-sec">
        <p className="m-0 max-w-[720px] text-[28px] font-semibold leading-tight text-slate-900">{b.closing}</p>
        <div style={{ marginTop: 24 }}>
          <Link href={href} className="inline-flex h-12 items-center gap-2 rounded-full bg-teal-700 px-6 text-[16px] font-medium text-white hover:bg-teal-800">
            „{term}“ in der Suche ansehen <span aria-hidden="true">→</span>
          </Link>
        </div>
        <p className="m-0 text-[14px] text-slate-500" style={{ marginTop: 12 }}>Kostenlos und ohne Anmeldung. <Link href="/preise" className="text-teal-700 hover:underline">Preise</Link></p>
      </section>

      {/* plenara.X: schmale Zeile am Ende (Tarif Enterprise) */}
      {b.plenarax && (
        <section className="ri-sec ri-sec--tight">
          <p className="m-0 text-[14px] text-slate-500">
            <span className="font-semibold text-slate-900">Mehr mit plenara.X</span> (Tarif Enterprise):{" "}
            {b.plenarax.map(([titel, , link], i) => <span key={link}>{i ? " · " : ""}<Link href={link} className="text-teal-700 hover:underline">{titel} →</Link></span>)}
          </p>
        </section>
      )}
    </>
  );
}
