import { FilterSelect } from "../components/FilterSelect";
import Link from "next/link";
import { useEffect, useState } from "react";
import { IconBell, IconHeart, IconX } from "../components/icons";
import { filterChips } from "../lib/savedSearch";
import { useAccount } from "../state/account";
import { readProfile } from "./ProfilePage";
import { useEntitlements } from "../lib/entitlements";
import { LoginRequired, UsagePill } from "../components/TierNotice";
import { PageHead } from "../info/blocks";
import { useData } from "../state/data";
import { useAppNav } from "../state/nav";
import { savedSearchQuery, useSearch } from "../state/search";
import { fetchJson } from "../lib/fetchJson";
import type { Article, NotifyFreq, SavedSearch } from "../types";
import { MONTH_SHORT, todayLocal } from "../lib/text";
import { digestMail, type DigestPart, type MailItem } from "../lib/mails";
import { useToast } from "../state/toast";

type Item = { id: string; title: string; date: string; gemeinde: string; gremium: string; teaser: string; status: Article["status"] };
type Preview = { total: number; items: Item[] } | null;

/** Die neuesten Treffer einer gespeicherten Suche, mit genau der Abfrage, die beim Öffnen läuft (savedSearchQuery) */
function usePreview(s: SavedSearch): Preview | "error" {
  const { geo, place } = useData();
  const [data, setData] = useState<Preview | "error">(null);
  /* Neu laden, wenn sich die Suche ändert (nicht bei Benachrichtigung oder „zuletzt gesehen“) */
  const what = JSON.stringify({ ...s, id: "", name: "", notify: null, lastSeen: "", created: "" });
  useEffect(() => {
    if (!geo || !place) return;
    const ctrl = new AbortController();
    savedSearchQuery(s, geo, place)
      .then((q) => (q === null ? Promise.reject(new Error("karte")) : fetchJson<{ total?: number; articles?: Item[] }>(`/api/search?${q}&page=1`, { signal: ctrl.signal })))
      .then((r) => setData({ total: r.total ?? 0, items: (r.articles ?? []).slice(0, 10) }))
      .catch(() => !ctrl.signal.aborted && setData("error"));
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [what, geo, place]);
  return data;
}

function SavedCard({ s }: { s: SavedSearch }) {
  const { geo } = useData();
  const { saved, updateSaved, removeSaved, restoreSaved } = useAccount();
  const toast = useToast();
  const search = useSearch();
  const { goOverview } = useAppNav();
  const preview = usePreview(s);
  const n = s.notify;
  const set = (patch: Partial<SavedSearch["notify"]>) => updateSaved(s.id, { notify: { ...n, ...patch } });
  const { allow, limits } = useEntitlements();
  const profile = readProfile();
  /* Weitere Empfänger gelten je Suche; ältere Einstellungen aus dem Konto werden übernommen */
  const extra = limits.emails > 1 ? (n.recipients ?? profile.recipients ?? []) : [];
  const [draft, setDraft] = useState("");
  const addRecipient = () => {
    const v = draft.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || extra.includes(v) || extra.length >= limits.emails - 1) return;
    set({ recipients: [...extra, v] });
    setDraft("");
  };
  const chips = filterChips({ q: s.q, text: s.text, area: s.area, areaSrc: s.areaSrc, radius: s.radius, thema: s.thema, monat: s.monat, von: s.von, bis: s.bis, scope: s.scope, more: s.more, status: s.status, level: s.level }, geo);
  const ok = preview && preview !== "error" ? preview : null;
  const fresh = ok ? ok.items.filter((a) => a.date > s.lastSeen).length : 0;
  const open = () => {
    if (search.applySaved(s)) {
      updateSaved(s.id, { lastSeen: todayLocal() });
      goOverview();
    }
  };
  /* Entfernen mit „Rückgängig“: samt Benachrichtigung und Empfängern wiederherstellbar */
  const remove = () => {
    const index = saved.findIndex((x) => x.id === s.id);
    removeSaved(s.id);
    toast("Gespeicherte Suche entfernt.", { label: "Rückgängig", run: () => restoreSaved(s, index) });
  };
  const iconBtn = "grid h-9 w-9 flex-none place-items-center rounded-full transition-colors hover:bg-slate-100";

  return (
    <article className="border-b border-slate-200 py-4 last:border-b-0">
      {/* Kopf wie bei gespeicherten Artikeln: Herz entfernt die Suche, Glocke schaltet Benachrichtigungen */}
      <div className="flex items-start gap-3">
        <button type="button" onClick={remove} title="Gespeicherte Suche entfernen" aria-label="Gespeicherte Suche entfernen" className={`${iconBtn} -ml-2 text-teal-700`}>
          <IconHeart size={20} filled />
        </button>
        <div className="min-w-0 flex-1">
          <button type="button" onClick={open} className="block max-w-full truncate text-left text-[16px] font-semibold text-slate-900 hover:text-teal-700">
            {s.name}
          </button>
          <p className="m-0 mt-0.5 text-[14px] text-slate-500">
            {ok ? `${ok.total.toLocaleString("de-DE")} Treffer` : preview === "error" ? "Treffer nicht verfügbar" : "Lädt …"}
            {fresh > 0 && <span className="text-teal-700"> · {fresh} neu</span>}
            {chips.length > 0 && <> · {chips.map((c) => c.value).join(" · ")}</>}
          </p>
        </div>
        <button
          type="button"
          aria-pressed={!!n.mail}
          title={n.mail ? "Benachrichtigung ausschalten" : "Bei neuen Treffern benachrichtigen"}
          aria-label={n.mail ? "Benachrichtigung ausschalten" : "Bei neuen Treffern benachrichtigen"}
          onClick={() => {
            if (!n.mail && !allow("notifications")) return;
            set({ mail: !n.mail, email: n.email || profile.email });
          }}
          className={`${iconBtn} -mr-2 ${n.mail ? "text-teal-700" : "text-slate-500"}`}
        >
          <IconBell size={20} filled={!!n.mail} />
        </button>
      </div>

      {/* Drei aktuelle Treffer im Stil der Trefferliste, nur kleiner */}
      {ok && ok.items.length > 0 && (
        <ul className="m-0 mt-3 list-none p-0 pl-9">
          {ok.items.slice(0, 3).map((a) => (
            <li key={a.id} className="border-t border-slate-100 first:border-t-0">
              <Link href={`/beschluss/${a.id}`} className="group flex gap-3 py-2.5 no-underline">
                <span className="flex w-9 flex-none flex-col items-center border-r border-slate-200 pr-3 leading-tight">
                  <span className="text-[16px] font-semibold text-slate-900">{Number(a.date.slice(8, 10))}</span>
                  <span className="text-[12px] font-semibold uppercase text-teal-700">{MONTH_SHORT[Number(a.date.slice(5, 7)) - 1]}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-slate-900 group-hover:text-teal-700">{a.title}</span>
                    {a.date > s.lastSeen && <span className="flex-none text-[12px] text-teal-700">neu</span>}
                  </span>
                  <span className="block truncate text-[12px] text-slate-500">
                    {[a.gemeinde, a.gremium].filter(Boolean).join(" · ")}
                  </span>
                  {a.teaser && <span className="mt-0.5 line-clamp-2 block text-[12px] leading-snug text-slate-500">{a.teaser}</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {ok && !ok.items.length && <p className="m-0 mt-2 pl-9 text-[14px] text-slate-500">Aktuell keine Treffer.</p>}

      {/* Einstellungen der Benachrichtigung nur, wenn sie an ist */}
      {n.mail && (
        <div className="mt-3 flex flex-wrap items-center gap-2 pl-9 text-[14px] text-slate-500">
          <FilterSelect
            id={`freq-${s.id}`}
            label="Häufigkeit"
            allLabel=""
            value={n.freq}
            options={[
              { value: "instant", label: "Sofort" },
              { value: "daily", label: "Täglich" },
              { value: "weekly", label: "Wöchentlich" },
            ]}
            onChange={(v) => set({ freq: v as NotifyFreq })}
            size="sm"
            highlight={false}
          />
          {profile.email && <span>an {profile.email}</span>}
          {limits.emails > 1 && (
            <>
              {extra.map((r) => (
                <button key={r} type="button" aria-label={`Empfänger ${r} entfernen`} onClick={() => set({ recipients: extra.filter((x) => x !== r) })} className="inline-flex h-7 items-center gap-1.5 rounded-full bg-teal-50 pl-2.5 pr-1.5 text-[12px] text-teal-700">
                  {r}
                  <IconX size={14} />
                </button>
              ))}
              {extra.length < limits.emails - 1 && (
                <form onSubmit={(e) => { e.preventDefault(); addRecipient(); }} className="flex items-center gap-1">
                  <input type="email" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="weitere E-Mail" aria-label="Weitere E-Mail-Adresse" className="h-8 w-[170px] rounded-full bg-[#f8f9fa] px-3 text-[14px] outline-none focus:shadow-focus" />
                  <button type="submit" className="h-8 rounded-full px-2.5 text-[14px] text-teal-700 hover:bg-slate-100">Hinzufügen</button>
                </form>
              )}
            </>
          )}
        </div>
      )}
    </article>
  );
}

export function SavedSearchesPage() {
  const { saved, ready } = useAccount();
  const { tier, used, max } = useEntitlements();
  if (tier === "guest")
    return (
      <>
        <PageHead icon="search" label="Suchen" name="Gespeicherte Suchen" />
        <section className="ri-sec ri-sec--tight">
          <LoginRequired title="Suchen speichern" text="Melden Sie sich kostenlos an, um Suchen zu speichern und über neue Treffer informiert zu werden." />
        </section>
      </>
    );
  return (
    <>
      <PageHead icon="search" label="Suchen" name={`Gespeicherte Suchen${ready && saved.length ? ` (${saved.length})` : ""}`} title={<>Ihre Themen.<br />Immer im Blick.</>} lead="Neue Treffer auf einen Blick. Benachrichtigungen und Empfänger legen Sie pro Suche fest.">
        <div className="mt-4 flex flex-wrap gap-2">
          <UsagePill label="Suchen" used={used.searches} max={max.searches} />
          <UsagePill label="Benachrichtigungen" used={used.notifications} max={max.notifications} />
        </div>
      </PageHead>
      <section className="ri-sec ri-sec--tight">
      {ready && saved.length > 0 && <WeeklyReport saved={saved} />}

      {ready && !saved.length && (
        <div className="flex flex-col items-center px-6 py-10 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-teal-50 text-teal-700">
            <IconHeart size={26} />
          </span>
          <h2 className="mb-1 mt-4 text-[18px] font-semibold">Noch keine gespeicherten Suchen</h2>
          <p className="m-0 max-w-[44ch] text-slate-500">Suchen oder filtern Sie in der Übersicht und tippen Sie auf das Herz neben dem Suchfeld.</p>
          {/* Beispiele, wie eine nützliche gespeicherte Suche aussieht */}
          <div className="mt-5 w-full max-w-[520px] text-left">
            <p className="m-0 text-[12px] font-semibold uppercase tracking-wide text-slate-500">Beispiele</p>
            <ul className="m-0 mt-2 flex list-none flex-col p-0 text-[14px] text-slate-600">
              {[
                ["„Bebauungsplan“", "im Kreis Coesfeld, Status: Beschlossen"],
                ["„Windenergie, Photovoltaik“", "im Umkreis von 30 km um Münster"],
                ["Thema Bildung & Betreuung", "in der Stadt Köln, letzte 3 Monate"],
              ].map(([what, where]) => (
                <li key={what} className="border-b border-slate-200 py-2.5 last:border-b-0">
                  <span className="text-slate-900">{what}</span> {where}
                </li>
              ))}
            </ul>
          </div>
          <Link className="btn-primary mt-5" href="/suche">
            Zur Suche
          </Link>
        </div>
      )}

      <div className="flex flex-col border-t border-slate-200">
        {saved.map((s) => (
          <SavedCard key={s.id} s={s} />
        ))}
      </div>
      </section>
    </>
  );
}

const WEEKLY = "ratsmonitor:weekly:v1";
const WEEKLY_DAY = "ratsmonitor:weekly-day:v1";
const DAYS = ["Täglich", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
/** Wochenbericht: täglich oder an einem frei wählbaren Wochentag (Standard Montag) eine Mail mit den neuen Treffern aller gespeicherten Suchen der letzten 7 Tage.
 *  Im Testmodus landet der Bericht im Test-Postfach (Knopf „Jetzt erzeugen“). */
function WeeklyReport({ saved }: { saved: SavedSearch[] }) {
  const [on, setOn] = useState(false);
  const [day, setDay] = useState("Montag");
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const { geo, place } = useData();
  const weekday = day;
  useEffect(() => {
    try {
      setOn(localStorage.getItem(WEEKLY) === "1");
      const d = localStorage.getItem(WEEKLY_DAY);
      if (d && DAYS.includes(d)) setDay(d);
    } catch {}
  }, []);
  const pickDay = (d: string) => {
    setDay(d);
    try {
      localStorage.setItem(WEEKLY_DAY, d);
    } catch {}
  };
  const toggle = () => {
    setOn(!on);
    try {
      localStorage.setItem(WEEKLY, on ? "0" : "1");
    } catch {}
  };
  const build = async () => {
    setBusy(true);
    const day = (n: number) => todayLocal(-n);
    const parts: DigestPart[] = [];
    for (const s of saved) {
      /* Dieselbe Abfrage wie beim Öffnen der Suche, nur auf die letzten 7 Tage begrenzt */
      const q = geo && place ? await savedSearchQuery(s, geo, place) : null;
      if (q === null) continue;
      const p = new URLSearchParams(q);
      p.set("from", day(7));
      p.set("to", day(0));
      p.delete("month");
      p.set("sort", "desc");
      p.set("page", "1");
      try {
        const r = await fetchJson<{ total?: number; articles?: MailItem[] }>("/api/search?" + p);
        parts.push({ id: s.id, name: s.name, total: r.total ?? 0, top: (r.articles ?? []).slice(0, 3) });
      } catch {}
    }
    try {
      digestMail(readProfile().email || "Ihre Adresse", day(7), day(0), parts, weekday);
      toast("Wochenbericht liegt im Test-Postfach.");
    } catch {
      toast("Der Wochenbericht konnte nicht erstellt werden.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mb-6 flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-slate-200 pb-5 text-[14px]">
      <span className="font-semibold text-slate-900">Wochenbericht</span>
      <span className="text-slate-500">Alle neuen Treffer Ihrer Suchen in einer E-Mail, täglich oder an dem Wochentag, den Sie wählen:</span>
      <select aria-label="Rhythmus des Wochenberichts" value={day} onChange={(e) => pickDay(e.target.value)} className="h-8 rounded-md border border-slate-300 bg-white px-2 text-[14px] text-slate-800">
        {DAYS.map((d) => (
          <option key={d} value={d}>
            {d === "Täglich" ? "Jeden Tag" : `Jeden ${d}`}
          </option>
        ))}
      </select>
      <button type="button" role="switch" aria-checked={on} aria-label="Wochenbericht" onClick={toggle} className={`relative h-6 w-10 flex-none rounded-full transition-colors ${on ? "bg-teal-600" : "bg-slate-300/80"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-[left] ${on ? "left-[18px]" : "left-0.5"}`} />
      </button>
      <button type="button" disabled={busy} onClick={build} className="text-teal-700 hover:underline disabled:opacity-50">
        {busy ? "Wird erstellt …" : "Jetzt erzeugen (Test-Postfach) →"}
      </button>
    </div>
  );
}
