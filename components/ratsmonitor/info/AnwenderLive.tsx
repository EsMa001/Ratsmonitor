import { useEffect, useState } from "react";
import Link from "next/link";
import { HitPreview, PageHead, PlacePill } from "./blocks";
import type { Branche } from "./content";
import { Icon } from "./icons";
import { todayLocal } from "../lib/text";
import { IS_DEV } from "../lib/tier";
import { useDarkMode } from "../lib/useDarkMode";
import { XAuszug } from "./XAuszug";

/* Anwenderseite mit Live-Daten (Konzept requirements/anwender-seiten-konzept.md): handverlesene echte Vorgänge im Kopf,
   Zahl der letzten 30 Tage in ganz Deutschland aus der normalen Suche, Beleg für den Vorsprung an einem echten Plan,
   Rollen kurz, plenara.X als Links, Abschluss mit nächstem Schritt. Gilt für Seiten mit `beleg` in content.ts. */

const kurz = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(2, 4)}`;
const zahl = (n: number) => n.toLocaleString("de-DE");

/** Zahl der Vorgänge der letzten 30 Tage (ohne Formalien) zu einem Begriff in ganz Deutschland */
function useZahl(term: string) {
  const key = term;
  const [res, setRes] = useState<{ key: string; total: number | null } | null>(null);
  useEffect(() => {
    const c = new AbortController();
    const p = new URLSearchParams({ q: term, from: todayLocal(-30), to: todayLocal(), scope: "with", noformal: "1", part: "facets" });
    fetch(`/api/search?${p}`, { signal: c.signal }).then((r) => (r.ok ? (r.json() as Promise<{ total?: number }>) : Promise.reject(r.status)))
      .then((f) => setRes({ key, total: typeof f.total === "number" ? f.total : null }))
      .catch(() => { if (!c.signal.aborted) setRes({ key, total: null }); });
    return () => c.abort();
  }, [key, term]);
  return res?.key === key ? res : null;
}

/** Link in die echte Suche mit Begriff und den letzten 30 Tagen (dort lässt sie sich mit dem Herz merken) */
const suchLink = (term: string) => {
  const p = new URLSearchParams({ q: term });
  p.set("von", "@d30");
  return `/suche?${p}`;
};

/** Angebundene Gemeinden (wie Seite Datenabdeckung, /api/sources), für die Vertrauenszeile */
function useGemeinden() {
  const [n, setN] = useState<number | null>(null);
  useEffect(() => {
    const c = new AbortController();
    fetch("/api/sources", { signal: c.signal }).then((r) => (r.ok ? (r.json() as Promise<{ reach?: { municipalities?: { covered?: number } } }>) : null))
      .then((d) => { const v = d?.reach?.municipalities?.covered; if (typeof v === "number") setN(v); }).catch(() => {});
    return () => c.abort();
  }, []);
  return n;
}

/** Drei belegbare Punkte (Vorteile Stufe A: ganz Deutschland mit einem Begriff, Originalquelle, Stand jedes Vorgangs) */
function Vertrauen() {
  const n = useGemeinden();
  const punkte: [Parameters<typeof Icon>[0]["name"], React.ReactNode][] = [
    ["map", <>Ein Begriff, ganz Deutschland{n ? <>: <Link href="/datenabdeckung" className="text-teal-700 hover:underline">{zahl(n)} Gemeinden</Link></> : null}</>],
    ["fileText", "Jede Angabe mit Originalunterlage"],
    ["clock", "Stand jedes Vorgangs auf einen Blick"],
  ];
  return (
    <ul className="m-0 flex list-none flex-wrap gap-x-5 gap-y-1.5 p-0" style={{ marginTop: 14 }}>
      {punkte.map(([icon, text], i) => <li key={i} className="flex items-center gap-2 text-[14px] text-slate-700"><Icon name={icon} size={16} className="flex-none text-teal-700" />{text}</li>)}
    </ul>
  );
}

/* Kopfkarte: je Chip ein Signal der Branche (/api/x/teaser, vorgerechnet im nächtlichen Bau von x_signals); gezeigt wird der neueste
   Vorgang mit Schritt und eigener Kurzfassung aus der Vorlage (der Auszug sortiert solche nach vorn). Dieselbe Abfrage wie im plenara-Block. */
interface Vorhaben { id: string; date: string; title: string; place: string; phase: string; teaser: string }
const MON = ["JAN", "FEB", "MÄR", "APR", "MAI", "JUN", "JUL", "AUG", "SEP", "OKT", "NOV", "DEZ"];
function useVorhaben(id: string) {
  const [res, setRes] = useState<{ id: string; item: Vorhaben | false } | null>(null);
  useEffect(() => {
    const c = new AbortController();
    fetch(`/api/x/teaser?id=${encodeURIComponent(id)}`, { signal: c.signal }).then((r) => (r.ok ? (r.json() as Promise<{ items?: Vorhaben[] }>) : null))
      .then((d) => setRes({ id, item: d?.items?.find((i) => i.teaser) ?? d?.items?.[0] ?? false }))
      .catch(() => { if (!c.signal.aborted) setRes({ id, item: false }); });
    return () => c.abort();
  }, [id]);
  return res?.id === id ? res.item : null;
}

function Kopfkarte({ kopf, pick, setPick }: { kopf: [string, string][]; pick: number; setPick: (i: number) => void }) {
  const [id] = kopf[Math.min(pick, kopf.length - 1)];
  const m = useVorhaben(id);
  return (
    <div className="ri-pv" style={{ background: "none", border: "none", boxShadow: "none", padding: 0, marginTop: 24 }}>
      {m ? (
        <Link href={`/beschluss/${m.id}`} className="group" style={{ display: "block", color: "inherit", textDecoration: "none" }}>
          <div className="ri-pv__card transition-transform duration-300 group-hover:-translate-y-1" style={{ minHeight: 170, background: "linear-gradient(135deg, var(--rm-white,#ffffff) 0%, var(--rm-tint,#f1fbf9) 100%)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "52px minmax(0,1fr)", gap: 12 }}>
              <div aria-hidden="true" style={{ display: "flex", flexDirection: "column", alignItems: "center", borderRight: "1px solid var(--rm-c200,#e2e8f0)", paddingRight: 10, textAlign: "center" }}>
                <span style={{ fontSize: 22, fontWeight: 600, lineHeight: 1 }}>{Number(m.date.slice(8, 10))}</span>
                <span style={{ marginTop: 4, fontSize: 12, fontWeight: 600, letterSpacing: ".06em", color: "#0f766e" }}>{MON[Number(m.date.slice(5, 7)) - 1]}</span>
                <span style={{ fontSize: 12, color: "var(--rm-c500,#64748b)" }}>{m.date.slice(2, 4)}</span>
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}><PlacePill place={m.place} />{m.phase && <span style={{ fontSize: 14, color: "#0f766e", fontWeight: 600 }}>{m.phase}</span>}</div>
                <p className="line-clamp-2" style={{ margin: "10px 0 0", fontSize: 16, fontWeight: 600, lineHeight: 1.35, color: "var(--rm-c900,#0f172a)" }}>{m.title}</p>
                {m.teaser && <p className="line-clamp-3" style={{ margin: "8px 0 0", fontSize: 14, lineHeight: 1.5, color: "var(--rm-c700,#334155)" }}>{m.teaser}</p>}
                {m.teaser && <span style={{ display: "block", marginTop: 8, fontSize: 12, color: "var(--rm-c500,#64748b)" }}>Aus der Vorlage</span>}
              </div>
            </div>
          </div>
        </Link>
      ) : (
        <div className="ri-pv__card flex items-center text-[14px] text-slate-500" style={{ minHeight: 170 }}>{m === false ? "Gerade nichts Neues zu diesem Signal." : "Neuester Vorgang wird geladen …"}</div>
      )}
      <div style={{ marginTop: 16 }}>
        <span className="ri-pv__topics-label" style={{ display: "block", marginBottom: 8 }}>Signale</span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {kopf.map(([k, t], i) => <button key={k} type="button" aria-pressed={pick === i} onClick={() => setPick(i)} className={"rounded-full border px-3 py-1.5 text-[14px] " + (pick === i ? "border-teal-600 bg-teal-700 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-teal-600 hover:text-teal-700")}>{t}</button>)}
        </div>
      </div>
    </div>
  );
}

/** Live-Zeile im Kopf: Zahl der letzten 30 Tage in ganz Deutschland, als Link in die Suche */
function LiveZeile({ term }: { term: string }) {
  const z = useZahl(term);
  const wo = "in ganz Deutschland";
  return (
    <p className="m-0 text-[14px] text-slate-500" aria-live="polite" style={{ marginTop: 12 }}>
      {!z ? "Letzte 30 Tage …" : z.total === null ? <>Letzte 30 Tage {wo}</> : <>Letzte 30 Tage {wo}: <Link href={suchLink(term)} className="font-semibold text-teal-700 hover:underline">{zahl(z.total)} {z.total === 1 ? "Vorgang" : "Vorgänge"} zu „{term}“ →</Link></>}
    </p>
  );
}

/** Beleg: ein echter Vorgang, jede Sitzung mit Datum und Link */
function Beleg({ b }: { b: NonNullable<Branche["beleg"]> }) {
  const first = b.schritte[0].d, last = b.schritte[b.schritte.length - 1].d;
  const monate = Math.round((Date.parse(last) - Date.parse(first)) / 2629800000);
  return (
    <section className="ri-sec">
      <h2 className="ri-h2">{b.ueberschrift ?? `Vom ersten Beschluss bis zur Satzung: ${monate} Monate`}</h2>
      <p className="ri-sub">{b.text ?? `${b.titel} in ${b.ort}: vom ersten Beschluss bis zur Satzung.`} Jeder Schritt mit Datum, Gremium und Originalunterlage.</p>
      <ol className={`m-0 mt-6 grid list-none gap-0 p-0 ${["", "", "sm:grid-cols-2", "sm:grid-cols-3", "sm:grid-cols-4"][Math.min(b.schritte.length, 4)]}`}>
        {b.schritte.map((s, i) => (
          <li key={s.href} className="relative border-l-2 border-teal-600 pb-6 pl-5 sm:border-l-0 sm:border-t-2 sm:pb-0 sm:pl-0 sm:pr-6 sm:pt-5">
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

export function AnwenderLivePage({ b }: { b: Branche }) {
  const term = b.keywords[0];
  const [pick, setPick] = useState(0);
  const dark = useDarkMode();
  const href = suchLink(term);
  return (
    <>
      {/* Kopf: Live-Zahl; rechts handverlesene echte Vorgänge mit den Themen „Auch im Blick“. Einleitung nur ab Tablet (mobil steht das Beispiel so im ersten Bild) */}
      <PageHead icon={b.icon} label="Anwender" name={b.name} title={b.title} lead={<span className="max-sm:hidden">{b.intro}</span>}
        aside={b.kopf ? <Kopfkarte kopf={b.kopf} pick={pick} setPick={setPick} /> : <HitPreview example={(b.examples ?? [])[pick] ?? b.example} topics={b.watch} active={pick} onPick={setPick} />}>
        <div className="ri-actions">
          <LiveZeile term={term} />
          <Vertrauen />
        </div>
      </PageHead>

      {b.xauszug && <XAuszug name={b.name} auszuege={b.xauszug} />}

      {b.beleg && <Beleg b={b.beleg} />}

      {/* Video der Seite (Feld `video` in content.ts: Pfad ohne Endung, .mp4/.jpg/.vtt), direkt nach dem Beleg. Im Dark Mode die dunkle
         Fassung (<Pfad>-dunkel). Ohne Video nur im Dev-Server ein kleiner Platzhalter. */}
      {(b.video || IS_DEV) && (
        <section className="ri-sec ri-sec--tight">
          <div className="grid items-center gap-x-12 gap-y-6 lg:grid-cols-[minmax(0,1fr)_440px]">
            <div>
              <h2 className="ri-h2">In einer Minute: Plenara für {b.name}</h2>
              <p className="ri-sub">Suchen, Stand verfolgen, Treffer merken, mit einem Begriff aus Ihrem Alltag.</p>
            </div>
            {b.video
              ? <video key={dark ? "d" : "h"} controls preload="metadata" playsInline poster={`${b.video}${dark ? "-dunkel" : ""}.jpg`} className="aspect-video w-full rounded-xl bg-slate-100" aria-label={`Video: Plenara für ${b.name}`}>
                  <source src={`${b.video}${dark ? "-dunkel" : ""}.mp4`} type="video/mp4" />
                  <track kind="subtitles" src={`${b.video}${dark ? "-dunkel" : ""}.vtt`} srcLang="de" label="Deutsch" />
                </video>
              : <div className="flex aspect-video w-full items-center justify-center rounded-xl border-2 border-dashed border-slate-200 p-4 text-center text-[14px] text-slate-500">Video „{b.name}“ (nur im Dev sichtbar)</div>}
          </div>
        </section>
      )}

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
          <Link href={href} className="inline-flex h-12 items-center gap-2 rounded-full bg-slate-900 px-6 text-[16px] font-medium text-white hover:bg-slate-800">
            „{term}“ in der Suche ansehen <span aria-hidden="true">→</span>
          </Link>
        </div>
        <p className="m-0 text-[14px] text-slate-500" style={{ marginTop: 12 }}>Kostenlos und ohne Anmeldung. <Link href="/preise" className="text-teal-700 hover:underline">Preise</Link></p>
        <p className="m-0 text-[18px] text-slate-500" style={{ marginTop: 40 }}>Besser verstehen, was vor Ort beraten wird.</p>
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
