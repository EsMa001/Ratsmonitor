import { UPGRADE_TEXT, useTier } from "../lib/tier";
import { api, useMe } from "../lib/account";
import { areaOwners, calendarAgs, cleanAreas, type CalArea } from "../lib/calendarAreas";
import { AccountLoading, LoginRequired } from "../components/TierNotice";
import { CalendarFeed } from "../components/CalendarFeed";
import { useToast } from "../state/toast";
import { IconCalendarSync, IconDownload } from "../components/icons";
import { FilterSelect } from "../components/FilterSelect";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useClient, useHydrated } from "../lib/useClient";
import { useCatalog } from "../lib/catalog";
import { PageHead } from "../info/blocks";
import { useData } from "../state/data";
import { useAccount } from "../state/account";
import { norm } from "../lib/text";
import { IconBell, IconChevronLeft, IconChevronRight, IconX } from "../components/icons";
import { fetchJson } from "../lib/fetchJson";
import type { NotifyFreq } from "../types";

/* Gebiete des Kalenders stehen im Konto (/api/me/settings: calendar und die daraus gerechnete Schlüsselliste calendarAgs) */
interface CalSettings { areas: CalArea[] }
interface CalEvent { date: string; ags: string; place: string; committee: string; count: number; items: { id: string; title: string }[] }
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const RADII = [0, 10, 25, 50];
/* Eine Farbe je eigenem Gebiet, damit Termine verschiedener Orte unterscheidbar sind */
const AREA_COLORS = ["var(--rm-fill)", "var(--rm-link)", "var(--rm-no)", "var(--rm-ok2)", "var(--rm-c500)", "var(--rm-map2)", "var(--rm-warn)", "var(--rm-ok)"];

/** Kalender: alle Sitzungstermine in den eigenen Gebieten (Orte, optional mit Umkreis), schlicht als Monatsansicht */
export function KalenderPage() {
  const { limits, ready: tierReady } = useTier();
  const me = useMe();
  const toast = useToast();
  const { geo } = useData();
  const { saved } = useAccount();
  /* Gebiete aus dem Konto, je Konto und Kontostand geladen */
  const key = me.user && limits.calendar ? `${me.user.id}:${me.rev}` : "";
  const [stored, setStored] = useState<{ key: string; areas: CalArea[]; agsSent: string[]; mail: boolean; freq: NotifyFreq } | null>(null);
  useEffect(() => {
    if (!key) return;
    let live = true;
    api<{ calendar?: unknown; calendarAgs?: string[]; calendarMail?: boolean; calendarFreq?: NotifyFreq }>("/api/me/settings").then(
      (d) => live && setStored({ key, areas: cleanAreas(d.calendar), agsSent: Array.isArray(d.calendarAgs) ? d.calendarAgs : [], mail: !!d.calendarMail, freq: d.calendarFreq || "daily" }),
      () => live && setStored({ key, areas: [], agsSent: [], mail: false, freq: "daily" }),
    );
    return () => {
      live = false;
    };
  }, [key]);
  const loaded = !!key && stored?.key === key;
  const cfg: CalSettings = useMemo(() => ({ areas: loaded && stored ? stored.areas : [] }), [loaded, stored]);
  /* Speichern im Konto: Gebiete und die im Browser gerechnete Schlüsselliste (mit Umkreis); bei Fehler zurück */
  const save = (next: CalSettings) => {
    if (!stored) return;
    const before = stored;
    const ags = calendarAgs(next.areas, geo);
    setStored({ ...stored, areas: next.areas, agsSent: ags });
    api("/api/me/settings", { method: "PUT", body: { calendar: next.areas, calendarAgs: ags } }).catch((e: Error) => {
      setStored(before);
      toast(e.message);
    });
  };
  /* E-Mail bei neuen Sitzungen in den Gebieten (server/accounts/notify.mjs); bei Fehler zurück */
  const saveMail = (next: { mail: boolean; freq: NotifyFreq }) => {
    if (!stored) return;
    const before = stored;
    setStored({ ...stored, ...next });
    api("/api/me/settings", { method: "PUT", body: { calendarMail: next.mail, calendarFreq: next.freq } }).catch((e: Error) => {
      setStored(before);
      toast(e.message);
    });
  };
  /* Umkreise ohne Karte gespeichert (nur die Mitte): sobald die Karte da ist, die volle Liste nachtragen */
  useEffect(() => {
    if (!loaded || !stored || !geo || !stored.areas.some((a) => a.km)) return;
    const ags = calendarAgs(stored.areas, geo);
    if (ags.length === stored.agsSent.length && ags.every((x, i) => x === stored.agsSent[i])) return;
    api("/api/me/settings", { method: "PUT", body: { calendarAgs: ags } }).then(() => setStored((s) => (s ? { ...s, agsSent: ags } : s)), () => {});
  }, [loaded, stored, geo]);

  /* Datum gibt es erst im Browser: nach dem Hydrieren einmal beim Rendern übernehmen */
  const hydrated = useHydrated();
  const [ready, setReady] = useState(false);
  /* Monat und gewählter Tag; erst im Browser bestimmen (Server kennt die Zeitzone der Nutzer nicht) */
  const today = useClient(() => iso(new Date()), "");
  const [month, setMonth] = useState(() => new Date(2000, 0, 1));
  const [day, setDay] = useState("");
  if (hydrated && !ready) {
    const d = new Date();
    setReady(true);
    setDay(iso(d));
    setMonth(new Date(d.getFullYear(), d.getMonth(), 1));
  }

  /* Alle Gebietsschlüssel inkl. Umkreis, jeweils dem eigenen Gebiet (Farbe) zugeordnet */
  const owner = useMemo(() => areaOwners(cfg.areas, geo), [cfg.areas, geo]);
  const agsList = useMemo(() => [...owner.keys()], [owner]);
  /* Termin → Farbe: exakter Schlüssel, sonst der übergeordnete Kreis */
  const colorOf = (ags: string) => {
    const i = owner.get(ags) ?? owner.get(ags.slice(0, 5)) ?? 0;
    return AREA_COLORS[i % AREA_COLORS.length];
  };

  /* Termine des sichtbaren Monats laden */
  /* Ergebnis je Abfrage (Gebiete und Monat); solange die aktuelle fehlt, lädt sie */
  const from = iso(month), to = iso(new Date(month.getFullYear(), month.getMonth() + 1, 0));
  const calUrl = agsList.length && today ? `/api/calendar?ags=${agsList.join(",")}&from=${from}&to=${to}` : "";
  const [got, setGot] = useState<{ url: string; events: CalEvent[]; error: boolean }>({ url: "", events: [], error: false });
  const events = useMemo(() => (calUrl && got.url === calUrl ? got.events : []), [calUrl, got]);
  const state = !calUrl ? "idle" : got.url !== calUrl ? "loading" : got.error ? "error" : "idle";
  useEffect(() => {
    if (!calUrl) return;
    const ctrl = new AbortController();
    fetchJson<{ events?: CalEvent[] }>(calUrl, { signal: ctrl.signal })
      .then((d) => setGot({ url: calUrl, events: d.events ?? [], error: false }))
      .catch(() => !ctrl.signal.aborted && setGot({ url: calUrl, events: [], error: true }));
    return () => ctrl.abort();
  }, [calUrl]);

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
  /* Kommende Tage mit Terminen (ruhiger Fluss unter „Heute“) */
  const upcoming = [...byDay.keys()].filter((k) => k > today && (byDay.get(k) ?? []).length > 0).sort().slice(0, 5);

  /* Gebiet hinzufügen: Namenssuche über alle auswählbaren Gebiete */
  const [find, setFind] = useState("");
  const [km, setKm] = useState(0);
  /* Gebietskatalog erst laden, wenn jemand ein Gebiet sucht oder Gebiete eingetragen sind (Namen ohne Karte) */
  const regions = useCatalog(find.trim().length >= 2 || cfg.areas.length > 0);
  const matches = useMemo(() => {
    const q = norm(find.trim());
    if (q.length < 2 || !regions) return [];
    return regions.filter((r) => norm(r.name).includes(q)).slice(0, 6);
  }, [find, regions]);
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
  const regionName = (ags: string) => geo?.info(ags).name ?? regions?.find((r) => r.ags === ags)?.name ?? ags;

  /* Nur Plus: alle anderen sehen, was der Kalender kann, und den Weg zur Stufe */
  const head = <PageHead icon="calendar" label="Kalender" name="Sitzungskalender" />;
  if (!tierReady) return <>{head}<section className="ri-sec ri-sec--tight"><AccountLoading /></section></>;
  if (!me.user) return <>{head}<section className="ri-sec ri-sec--tight"><LoginRequired title="Sitzungskalender" text="Melden Sie sich an. Der Sitzungskalender ist Teil von Plus." /></section></>;
  if (!limits.calendar) return <KalenderTeaser />;
  if (!loaded) return <>{head}<section className="ri-sec ri-sec--tight"><AccountLoading /></section></>;
  return (
    <>
      <PageHead icon="calendar" label="Kalender" name="Sitzungskalender" title={<>Alle Termine. In Ihren Gebieten.</>} lead="Rats- und Ausschusssitzungen Ihrer Orte, auch mit Umkreis." />
      {!today ? <section className="ri-sec ri-sec--tight"><p className="text-slate-500">Kalender wird geladen …</p></section> : (
      <section className="ri-sec ri-sec--tight">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          {/* Monatsansicht */}
          <div className="min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h2 className="m-0 min-w-0 truncate text-[22px] max-sm:text-[18px] font-semibold capitalize text-slate-900">{monthLabel}</h2>
              <div className="flex items-center gap-1">
                <button type="button" aria-label="Vorheriger Monat" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="grid h-9 w-9 max-sm:h-11 max-sm:w-11 place-items-center rounded-full text-slate-600 hover:bg-slate-100">
                  <IconChevronLeft size={20} />
                </button>
                <button type="button" onClick={() => { const d = new Date(); setMonth(new Date(d.getFullYear(), d.getMonth(), 1)); setDay(today); }} className="h-9 w-[92px] max-sm:w-[76px] rounded-full text-center text-[14px] text-teal-700 hover:bg-slate-100" title="Zurück zu heute">
                  {month.toLocaleDateString("de-DE", { month: "long" })}
                </button>
                <button type="button" aria-label="Nächster Monat" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="grid h-9 w-9 max-sm:h-11 max-sm:w-11 place-items-center rounded-full text-slate-600 hover:bg-slate-100">
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
                    className={`flex h-16 flex-col items-center justify-start gap-1 border-b border-slate-100 pt-2 transition-colors hover:bg-slate-50 ${d === today ? "bg-amber-50/80" : sel ? "bg-teal-50/60" : ""} ${d < today ? "opacity-60" : ""}`}>
                    <span className={`grid h-7 w-7 place-items-center rounded-full text-[14px] ${d === today ? "bg-amber-600 font-semibold text-white shadow-[0_0_0_4px_rgba(200,115,47,.18)]" : sel ? "text-teal-700" : "text-slate-900"}`}>{Number(d.slice(8))}</span>
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
            {day === today ? (
              /* Heute im Fokus: groß und warm, danach ruhig die kommenden Tage */
              <div className="rounded-[22px] border border-amber-200 bg-gradient-to-br from-amber-50 to-white px-5 py-4">
                <p className="m-0 text-[12px] font-semibold uppercase tracking-wide text-amber-700">Heute</p>
                <h2 className="m-0 mt-0.5 text-[28px] font-semibold capitalize leading-tight text-slate-900 max-sm:text-[22px]">{dayLabel}</h2>
                <p className="m-0 mt-1 text-[14px] text-slate-600">{dayEvents.length ? `${dayEvents.length} ${dayEvents.length === 1 ? "Sitzung" : "Sitzungen"} in deinen Gebieten` : "Heute keine Sitzungen in deinen Gebieten."}</p>
              </div>
            ) : <h2 className="m-0 text-[18px] font-semibold text-slate-900">{dayLabel}</h2>}
            {!cfg.areas.length && (
              <p className="mt-3 text-slate-500">
                Noch keine Gebiete gewählt.{" "}
                <button type="button" onClick={() => document.querySelector<HTMLInputElement>('[aria-label="Ort oder Kreis hinzufügen"]')?.focus()} className="text-teal-700 hover:underline">
                  Erstes Gebiet hinzufügen →
                </button>
              </p>
            )}
            {cfg.areas.length > 0 && !dayEvents.length && day !== today && <p className="mt-3 text-slate-500">An diesem Tag keine Sitzungen in Ihren Gebieten.</p>}
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
                        <Link href={`/beschluss/${it.id}`} className="text-slate-600 no-underline hover:text-teal-700">{it.title}</Link>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
            {day === today && upcoming.length > 0 && (
              <div className="mt-6">
                <h3 className="m-0 text-[12px] font-semibold uppercase tracking-wide text-slate-500">Danach</h3>
                <ol className="m-0 mt-2 list-none border-l border-slate-200 p-0 pl-4">
                  {upcoming.map((d) => (
                    <li key={d} className="relative pb-4 last:pb-0">
                      <i aria-hidden="true" className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border border-slate-300 bg-white" />
                      <button type="button" onClick={() => setDay(d)} className="m-0 border-0 bg-transparent p-0 text-left text-[14px] font-semibold capitalize text-slate-700 hover:text-teal-700">{new Date(d + "T00:00:00").toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" })}</button>
                      {(byDay.get(d) ?? []).slice(0, 3).map((e) => <p key={e.ags + e.committee} className="m-0 text-[14px] text-slate-500">{e.committee || "Sitzung"} · {e.place}</p>)}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        </div>
      </section>
      )}

      {/* Meine Gebiete */}
      <section className="ri-sec ri-sec--tight">
        <div className="max-w-[640px]">
          <div>
            <h2 className="m-0 text-[18px] font-semibold text-slate-900">Meine Gebiete</h2>
            <ul className="m-0 mt-3 list-none p-0">
              {cfg.areas.map((a, i) => (
                <li key={a.ags + a.km} className="flex items-center gap-3 border-b border-slate-200 py-2.5">
                  <i aria-hidden="true" className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: AREA_COLORS[i % AREA_COLORS.length] }} />
                  <span className="min-w-0 flex-1 text-slate-900">{a.name}{a.km ? <span className="text-slate-500"> · Umkreis {a.km} km</span> : null}</span>
                  <button type="button" aria-label={`${a.name} entfernen`} onClick={() => save({ ...cfg, areas: cfg.areas.filter((_, k) => k !== i) })} className="grid h-8 w-8 max-sm:h-11 max-sm:w-11 place-items-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900">
                    <IconX />
                  </button>
                </li>
              ))}
            </ul>
            <div className="relative mt-4 flex flex-wrap items-center gap-2">
              <input autoComplete="off" value={find} onChange={(e) => setFind(e.target.value)} placeholder="Ort oder Kreis hinzufügen …" aria-label="Ort oder Kreis hinzufügen" className="h-11 min-w-0 flex-1 basis-[220px] rounded-xl bg-slate-50 px-4 text-[16px] outline-none placeholder:text-slate-400 focus:bg-white focus:shadow-focus" />
              <FilterSelect
                id="k-umkreis"
                label="Umkreis"
                allLabel=""
                value={String(km)}
                options={RADII.map((r) => ({ value: String(r), label: r ? `+ ${r} km Umkreis` : "Ohne Umkreis" }))}
                onChange={(v) => setKm(+v)}
                size="sm"
                highlight={false}
                className="[&_button]:h-11 [&_button]:w-auto [&_button]:min-w-[170px]"
              />
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
        </div>
      </section>

      {/* Benachrichtigung, Abo (aktualisiert sich) oder einmalige Datei: drei gleich aufgebaute Spalten */}
      {agsList.length > 0 && (
        <section className="ri-sec ri-sec--tight">
          <h2 className="m-0 text-[18px] font-semibold text-slate-900">Auf dem Laufenden bleiben</h2>
          <p className="m-0 mt-1 text-slate-500">Per E-Mail informiert werden oder alle Sitzungen in Apple Kalender, Outlook oder Google Kalender übernehmen.</p>
          <div className="mt-6 grid grid-cols-1 gap-x-10 gap-y-8 md:grid-cols-3">
            <div className="border-t border-slate-200 pt-5">
              <IconBell size={28} className="text-teal-700" />
              <h3 className="m-0 mt-3 text-[16px] font-semibold text-slate-900">Per E-Mail benachrichtigen</h3>
              <p className="m-0 mt-1.5 text-[16px] leading-relaxed text-slate-500">
                Sie erhalten eine E-Mail, sobald in Ihren Gebieten <strong className="font-semibold text-slate-900">neue Sitzungen angesetzt</strong> werden, sofort, täglich oder wöchentlich.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3 text-[14px]">
                <button type="button" role="switch" aria-checked={!!stored?.mail} aria-label="Benachrichtigung per E-Mail" disabled={!loaded} onClick={() => stored && saveMail({ mail: !stored.mail, freq: stored.freq })} className={`relative h-6 w-10 flex-none rounded-full transition-colors ${stored?.mail ? "bg-teal-600" : "bg-slate-200"}`}>
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-[left] ${stored?.mail ? "left-[18px]" : "left-0.5"}`} />
                </button>
                {stored?.mail ? (
                  <FilterSelect
                    id="cal-mail-freq"
                    label="Häufigkeit"
                    allLabel=""
                    value={stored.freq}
                    options={[
                      { value: "instant", label: "Sofort" },
                      { value: "daily", label: "Täglich" },
                      { value: "weekly", label: "Wöchentlich" },
                    ]}
                    onChange={(v) => saveMail({ mail: true, freq: v as NotifyFreq })}
                    size="sm"
                    highlight={false}
                  />
                ) : (
                  <span className="text-slate-500">Aus</span>
                )}
              </div>
            </div>

            <div className="border-t border-slate-200 pt-5">
              <IconCalendarSync size={28} className="text-teal-700" />
              <h3 className="m-0 mt-3 text-[16px] font-semibold text-slate-900">Kalender abonnieren</h3>
              <p className="m-0 mt-1.5 text-[16px] leading-relaxed text-slate-500">
                Ihre Sitzungen erscheinen als eigener Kalender in Ihrer App und <strong className="font-semibold text-slate-900">aktualisieren sich automatisch</strong>: neue oder verschobene Termine kommen von selbst dazu. Empfohlen.
              </p>
              <CalendarFeed />
            </div>
            <div className="border-t border-slate-200 pt-5">
              <IconDownload size={28} className="text-teal-700" />
              <h3 className="m-0 mt-3 text-[16px] font-semibold text-slate-900">Als Datei herunterladen</h3>
              <p className="m-0 mt-1.5 text-[16px] leading-relaxed text-slate-500">
                Eine .ics-Datei mit den Terminen der letzten 30 Tage und der nächsten sechs Monate, zum einmaligen Import oder Weitergeben. Sie aktualisiert sich nicht; erneut importiert entstehen keine doppelten Termine.
              </p>
              <a href={`/api/calendar/ics?download=1&ags=${agsList.join(",")}`} className="mt-4 inline-flex h-11 items-center gap-1.5 text-[14px] font-medium text-teal-700 no-underline hover:underline">
                Datei herunterladen →
              </a>
            </div>
          </div>
        </section>
      )}

    </>
  );
}

const CAL_POINTS: [string, string][] = [
  ["Alle Sitzungen auf einen Blick", "Alle Sitzungen Ihrer Orte in einer Monatsansicht."],
  ["Gebiete mit Umkreis", "Orte oder Kreise festlegen, auf Wunsch mit Umkreis."],
  ["Farbe je Gebiet", "Jedes Gebiet hat eine eigene Farbe."],
  ["Tagesordnung vorab", "Zu jedem Termin die beratenen Vorgänge, bevor entschieden wird."],
];

/** Kalender für Stufen ohne Kalender: was er kann, und der Weg zu Plus */
function KalenderTeaser() {
  return (
    <>
      <PageHead icon="calendar" label="Kalender" name="Sitzungskalender" title={<>Alle Termine. In Ihren Gebieten.</>} lead="Der Sitzungskalender ist Teil von Plus." />
      <section className="ri-sec ri-sec--tight">
        <h2 className="ri-h2">Was der Kalender kann</h2>
        <div className="ri-points ri-points--2">
          {CAL_POINTS.map(([t, p], i) => (
            <div key={t} className="ri-point">
              <span className="ri-point__num">0{i + 1}</span>
              <h3>{t}</h3>
              <p>{p}</p>
            </div>
          ))}
        </div>
        <div className="ri-actions ri-actions--far">
          <Link href="/kontakt" className="ri-btn ri-btn--dark">
            Plus: {UPGRADE_TEXT}
          </Link>
          <Link href="/preise" className="ri-btn ri-btn--light">
            Preise vergleichen
          </Link>
        </div>
      </section>
    </>
  );
}
