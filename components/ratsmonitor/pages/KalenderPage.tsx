import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { REGIONS } from "@/shared/regions";
import { PageHead } from "../info/blocks";
import { useData } from "../state/data";
import { useAccount } from "../state/account";
import { norm } from "../lib/text";
import { IconBell, IconChevronLeft, IconChevronRight, IconX } from "../components/icons";
import type { NotifyFreq } from "../types";

/* Gebiete und Benachrichtigung des Kalenders; vorerst nur in diesem Browser gespeichert */
interface CalArea { ags: string; name: string; km: number }
interface CalSettings { areas: CalArea[]; mail: boolean; freq: NotifyFreq }
interface CalEvent { date: string; ags: string; place: string; committee: string; count: number; items: { id: string; title: string }[] }
const KEY = "rm-calendar:v1";
const EMPTY: CalSettings = { areas: [], mail: false, freq: "weekly" };
const read = (): CalSettings => {
  try {
    return { ...EMPTY, ...JSON.parse(localStorage.getItem(KEY) || "{}") };
  } catch {
    return EMPTY;
  }
};
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const RADII = [0, 10, 25, 50];
/* Eine Farbe je eigenem Gebiet, damit Termine verschiedener Orte unterscheidbar sind */
const AREA_COLORS = ["#0d9488", "#6366f1", "#f59e0b", "#e11d48", "#0ea5e9", "#8b5cf6", "#65a30d", "#ea580c"];

/** Kalender: alle Sitzungstermine in den eigenen Gebieten (Orte, optional mit Umkreis), schlicht als Monatsansicht */
export function KalenderPage() {
  const { geo } = useData();
  const { saved } = useAccount();
  const [cfg, setCfg] = useState<CalSettings>(EMPTY);
  useEffect(() => setCfg(read()), []);
  const save = (next: CalSettings) => {
    setCfg(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {}
  };

  /* Monat und gewählter Tag; erst im Browser bestimmen (Server kennt die Zeitzone der Nutzer nicht) */
  const [today, setToday] = useState("");
  const [month, setMonth] = useState(() => new Date(2000, 0, 1));
  const [day, setDay] = useState("");
  useEffect(() => {
    const d = new Date();
    setToday(iso(d));
    setDay(iso(d));
    setMonth(new Date(d.getFullYear(), d.getMonth(), 1));
  }, []);

  /* Alle Gebietsschlüssel inkl. Umkreis, jeweils dem eigenen Gebiet (Farbe) zugeordnet */
  const owner = useMemo(() => {
    const out = new Map<string, number>();
    cfg.areas.forEach((a, i) => {
      if (!out.has(a.ags)) out.set(a.ags, i);
      if (a.km && geo) {
        const c = geo.center(a.ags);
        if (c) geo.within({ x: c.x, y: c.y, km: a.km }).set.forEach((x) => !out.has(x) && out.set(x, i));
      }
    });
    return out;
  }, [cfg.areas, geo]);
  const agsList = useMemo(() => [...owner.keys()], [owner]);
  /* Termin → Farbe: exakter Schlüssel, sonst der übergeordnete Kreis */
  const colorOf = (ags: string) => {
    const i = owner.get(ags) ?? owner.get(ags.slice(0, 5)) ?? 0;
    return AREA_COLORS[i % AREA_COLORS.length];
  };

  /* Termine des sichtbaren Monats laden */
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  useEffect(() => {
    if (!agsList.length || !today) return setEvents([]);
    const ctrl = new AbortController();
    const from = iso(month), to = iso(new Date(month.getFullYear(), month.getMonth() + 1, 0));
    setState("loading");
    fetch(`/api/calendar?ags=${agsList.join(",")}&from=${from}&to=${to}`, { signal: ctrl.signal })
      .then((r) => r.json() as Promise<{ events?: CalEvent[] }>)
      .then((d) => {
        setEvents(d.events ?? []);
        setState("idle");
      })
      .catch(() => !ctrl.signal.aborted && setState("error"));
    return () => ctrl.abort();
  }, [agsList, month, today]);

  const byDay = useMemo(() => {
    const m = new Map<string, CalEvent[]>();
    for (const e of events) m.set(e.date, [...(m.get(e.date) ?? []), e]);
    return m;
  }, [events]);

  /* Raster des Monats ab Montag */
  const cells = useMemo(() => {
    const first = (month.getDay() + 6) % 7;
    const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => iso(new Date(month.getFullYear(), month.getMonth(), i + 1)))];
  }, [month]);
  const dayEvents = byDay.get(day) ?? [];

  /* Gebiet hinzufügen: Namenssuche über alle auswählbaren Gebiete */
  const [find, setFind] = useState("");
  const [km, setKm] = useState(0);
  const matches = useMemo(() => {
    const q = norm(find.trim());
    if (q.length < 2) return [];
    return REGIONS.filter((r) => norm(r.name).includes(q)).slice(0, 6);
  }, [find]);
  const add = (ags: string, name: string, radius = km) => {
    if (cfg.areas.some((a) => a.ags === ags && a.km === radius)) return;
    save({ ...cfg, areas: [...cfg.areas, { ags, name, km: radius }] });
    setFind("");
  };
  /* Gespeicherte Suchen mit Ort oder Umkreis lassen sich übernehmen */
  const fromSaved = saved
    .map((s) => (s.radius ? { ags: s.radius.ags, km: s.radius.km } : s.area && s.area.length >= 5 ? { ags: s.area, km: 0 } : null))
    .filter((x): x is { ags: string; km: number } => !!x && !cfg.areas.some((a) => a.ags === x.ags && a.km === x.km))
    /* Jeder Ort (mit gleichem Umkreis) nur einmal vorschlagen */
    .filter((x, i, all) => all.findIndex((y) => y.ags === x.ags && y.km === x.km) === i);

  const monthLabel = month.toLocaleDateString("de-DE", { month: "long", year: "numeric" });
  const dayLabel = day ? new Date(day + "T00:00:00").toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" }) : "";
  const regionName = (ags: string) => geo?.info(ags).name ?? REGIONS.find((r) => r.ags === ags)?.name ?? ags;

  return (
    <>
      <PageHead icon="calendar" label="Kalender" name="Sitzungskalender" title={<>Alle Termine.<br />In Ihren Gebieten.</>} lead="Rats- und Ausschusssitzungen in den Orten, die Sie beobachten, auch mit Umkreis, etwa für Ihr Vertriebsgebiet." />
      {!today ? <section className="ri-sec ri-sec--tight"><p className="text-slate-500">Kalender wird geladen …</p></section> : (
      <section className="ri-sec ri-sec--tight">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          {/* Monatsansicht */}
          <div>
            <div className="flex items-center justify-between">
              <h2 className="m-0 text-[22px] font-semibold capitalize text-slate-900">{monthLabel}</h2>
              <div className="flex items-center gap-1">
                <button type="button" aria-label="Vorheriger Monat" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="grid h-9 w-9 place-items-center rounded-full text-slate-600 hover:bg-slate-100">
                  <IconChevronLeft size={20} />
                </button>
                <button type="button" onClick={() => { const d = new Date(); setMonth(new Date(d.getFullYear(), d.getMonth(), 1)); setDay(today); }} className="h-9 w-[92px] rounded-full text-center text-[14px] text-teal-600 hover:bg-slate-100" title="Zurück zu heute">
                  {month.toLocaleDateString("de-DE", { month: "long" })}
                </button>
                <button type="button" aria-label="Nächster Monat" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="grid h-9 w-9 place-items-center rounded-full text-slate-600 hover:bg-slate-100">
                  <IconChevronRight size={20} />
                </button>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-7 text-center text-[12px] text-slate-500">
              {WEEKDAYS.map((w) => (
                <div key={w} className="py-2">{w}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 border-t border-slate-200">
              {cells.map((d, i) => {
                if (!d) return <div key={"e" + i} className="h-16 border-b border-slate-100" />;
                const n = (byDay.get(d) ?? []).length;
                const sel = d === day;
                return (
                  <button key={d} type="button" onClick={() => setDay(d)} aria-pressed={sel} aria-label={`${d}: ${n} Sitzungen`}
                    className={`flex h-16 flex-col items-center justify-start gap-1 border-b border-slate-100 pt-2 transition-colors hover:bg-slate-50 ${sel ? "bg-teal-50/60" : ""}`}>
                    <span className={`grid h-7 w-7 place-items-center rounded-full text-[14px] ${d === today ? "bg-slate-900 text-white" : sel ? "text-teal-600" : "text-slate-900"}`}>{Number(d.slice(8))}</span>
                    {n > 0 && (
                      <span className="flex items-center gap-0.5" aria-hidden="true">
                        {[...new Set((byDay.get(d) ?? []).map((e) => colorOf(e.ags)))].slice(0, 4).map((c) => <i key={c} className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {state === "loading" && <p className="mt-3 text-[14px] text-slate-500">Termine werden geladen …</p>}
            {state === "error" && <p className="mt-3 text-[14px] text-slate-500">Termine konnten gerade nicht geladen werden.</p>}
          </div>

          {/* Termine des Tages */}
          <div>
            <h2 className="m-0 text-[18px] font-semibold text-slate-900">{dayLabel}</h2>
            {!cfg.areas.length && <p className="mt-3 text-slate-500">Fügen Sie unten Gebiete hinzu, um deren Termine zu sehen.</p>}
            {cfg.areas.length > 0 && !dayEvents.length && <p className="mt-3 text-slate-500">An diesem Tag keine Sitzungen in Ihren Gebieten.</p>}
            <ul className="m-0 mt-3 list-none p-0">
              {dayEvents.map((e) => (
                <li key={e.ags + e.committee} className="border-b border-slate-200 py-3 last:border-b-0">
                  <p className="m-0 flex items-center gap-2 font-semibold text-slate-900">
                    <i aria-hidden="true" className="h-2 w-2 flex-none rounded-full" style={{ background: colorOf(e.ags) }} />
                    {e.committee || "Sitzung"}
                  </p>
                  <p className="m-0 text-[14px] text-slate-500">{e.place} · {e.count} {e.count === 1 ? "Vorgang" : "Vorgänge"}</p>
                  <ul className="m-0 mt-1.5 list-none p-0">
                    {e.items.slice(0, 3).map((it) => (
                      <li key={it.id} className="truncate text-[14px]">
                        <Link href={`/beschluss/${it.id}`} className="text-slate-600 no-underline hover:text-teal-600">{it.title}</Link>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
      )}

      {/* Gebiete und Benachrichtigung */}
      <section className="ri-sec ri-sec--tight">
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <h2 className="m-0 text-[18px] font-semibold text-slate-900">Meine Gebiete</h2>
            <ul className="m-0 mt-3 list-none p-0">
              {cfg.areas.map((a, i) => (
                <li key={a.ags + a.km} className="flex items-center gap-3 border-b border-slate-200 py-2.5">
                  <i aria-hidden="true" className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: AREA_COLORS[i % AREA_COLORS.length] }} />
                  <span className="min-w-0 flex-1 text-slate-900">{a.name}{a.km ? <span className="text-slate-500"> · Umkreis {a.km} km</span> : null}</span>
                  <button type="button" aria-label={`${a.name} entfernen`} onClick={() => save({ ...cfg, areas: cfg.areas.filter((_, k) => k !== i) })} className="grid h-8 w-8 place-items-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900">
                    <IconX />
                  </button>
                </li>
              ))}
            </ul>
            <div className="relative mt-4 flex flex-wrap items-center gap-2">
              <input value={find} onChange={(e) => setFind(e.target.value)} placeholder="Ort oder Kreis hinzufügen …" aria-label="Ort oder Kreis hinzufügen" className="h-11 min-w-0 flex-1 basis-[220px] rounded-xl bg-[#f8f9fa] px-4 text-[16px] outline-none placeholder:text-slate-400 focus:bg-white focus:shadow-focus" />
              <label className="relative">
                <span className="sr-only">Umkreis</span>
                <select value={km} onChange={(e) => setKm(+e.target.value)} className="h-11 cursor-pointer appearance-none rounded-xl bg-[#f8f9fa] px-4 text-[14px] text-slate-600 outline-none">
                  {RADII.map((r) => <option key={r} value={r}>{r ? `+ ${r} km Umkreis` : "Ohne Umkreis"}</option>)}
                </select>
              </label>
              {matches.length > 0 && (
                <div className="popover absolute left-0 right-0 top-[calc(100%+6px)] z-10 p-1.5">
                  {matches.map((r) => (
                    <button key={r.id} type="button" onClick={() => add(r.ags, r.name)} className="block w-full rounded-lg px-3 py-2 text-left text-[14px] hover:bg-slate-100">
                      {r.name}{km ? <span className="text-slate-500"> + {km} km</span> : null}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {fromSaved.length > 0 && (
              <div className="mt-4">
                <p className="m-0 text-[14px] text-slate-500">Aus Ihren gespeicherten Suchen übernehmen:</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {fromSaved.map((x) => (
                    <button key={x.ags + x.km} type="button" onClick={() => add(x.ags, regionName(x.ags), x.km)} className="btn-secondary btn-sm">
                      + {regionName(x.ags)}{x.km ? ` · ${x.km} km` : ""}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div>
            <h2 className="m-0 text-[18px] font-semibold text-slate-900">Benachrichtigung</h2>
            <p className="mt-2 text-slate-500">Lassen Sie sich per E-Mail über neue Termine in Ihren Gebieten informieren.</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button type="button" aria-pressed={cfg.mail} onClick={() => save({ ...cfg, mail: !cfg.mail })} className={`inline-flex h-10 items-center gap-2 rounded-full px-4 text-[14px] transition-colors ${cfg.mail ? "bg-teal-50 text-teal-600" : "text-slate-600 hover:bg-slate-100"}`}>
                <IconBell size={18} />
                {cfg.mail ? "Benachrichtigung an" : "Benachrichtigung aus"}
              </button>
              {cfg.mail && (
                <select aria-label="Häufigkeit" value={cfg.freq} onChange={(e) => save({ ...cfg, freq: e.target.value as NotifyFreq })} className="h-10 cursor-pointer rounded-full bg-[#f8f9fa] px-4 text-[14px] text-slate-600 outline-none">
                  <option value="instant">Sofort</option>
                  <option value="daily">Täglich</option>
                  <option value="weekly">Wöchentlich</option>
                </select>
              )}
            </div>
            <p className="mt-3 text-[12px] text-slate-500">Hinweis: Der E-Mail-Versand ist noch nicht eingerichtet. Ihre Auswahl wird gespeichert und gilt, sobald er startet.</p>
          </div>
        </div>
      </section>
    </>
  );
}
