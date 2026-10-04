import Link from "next/link";
import { useEffect, useState } from "react";
import { IconHeart, IconX } from "../components/icons";
import { filterChips } from "../lib/savedSearch";
import { fmtDate } from "../lib/text";
import { useAccount } from "../state/account";
import { readProfile } from "./ProfilePage";
import { useEntitlements } from "../lib/entitlements";
import { LoginRequired, UsagePill } from "../components/TierNotice";
import { PageHead } from "../info/blocks";
import { useData } from "../state/data";
import { useAppNav } from "../state/nav";
import { useSearch } from "../state/search";
import type { Article, NotifyFreq, SavedSearch } from "../types";
import { StatusBadge } from "../components/results/ArticleCard";
import { MONTH_SHORT } from "../lib/text";

type Item = { id: string; title: string; date: string; gemeinde: string; gremium: string; teaser: string; status: Article["status"] };
type Preview = { total: number; items: Item[] } | null;

/** Die drei neuesten Treffer einer gespeicherten Suche (Umkreissuchen ohne Umkreis-Einschränkung) */
function usePreview(s: SavedSearch): Preview | "error" {
  const [data, setData] = useState<Preview | "error">(null);
  useEffect(() => {
    const ctrl = new AbortController();
    const p = new URLSearchParams({
      q: s.text || "",
      area: s.area || "",
      scope: s.scope || "only",
      label: s.thema || "",
      month: s.monat || "",
      from: s.von || "",
      to: s.bis || "",
      status: s.status || "",
      level: s.level || "city",
      sort: "desc",
      page: "1",
    });
    fetch("/api/search?" + p, { signal: ctrl.signal })
      .then((r) => r.json() as Promise<{ total?: number; articles?: Item[] }>)
      .then((r) => setData({ total: r.total ?? 0, items: (r.articles ?? []).slice(0, 10) }))
      .catch(() => !ctrl.signal.aborted && setData("error"));
    return () => ctrl.abort();
  }, [s.text, s.area, s.scope, s.thema, s.monat, s.von, s.bis, s.status, s.level]);
  return data;
}

/** Ein/Aus-Schalter im Stil von iOS */
function Switch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={`relative h-[26px] w-[44px] flex-none rounded-full transition-colors duration-200 ${on ? "bg-teal-600" : "bg-slate-300"}`}
    >
      <span className={`absolute left-[3px] top-[3px] h-5 w-5 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,.3)] transition-transform duration-200 ${on ? "translate-x-[18px]" : ""}`} />
    </button>
  );
}

function SavedCard({ s }: { s: SavedSearch }) {
  const { geo } = useData();
  const { updateSaved, removeSaved } = useAccount();
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
  const chips = filterChips({ q: s.q, text: s.text, area: s.area, areaSrc: s.areaSrc, radius: s.radius, thema: s.thema, monat: s.monat, von: s.von, bis: s.bis, scope: s.scope, status: s.status, level: s.level }, geo);
  const ok = preview && preview !== "error" ? preview : null;
  const fresh = ok ? ok.items.filter((a) => a.date > s.lastSeen).length : 0;
  const open = () => {
    if (search.applySaved(s)) {
      updateSaved(s.id, { lastSeen: new Date().toISOString().slice(0, 10) });
      goOverview();
    }
  };
  const iconBtn = "grid h-9 w-9 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900";

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card transition-shadow hover:shadow-pop">
      <header className="flex items-start gap-3 px-5 pb-3 pt-4">
        <span className="mt-0.5 grid h-10 w-10 flex-none place-items-center rounded-xl bg-teal-50 text-teal-600">
          <IconHeart size={19} filled />
        </span>
        <div className="min-w-0 flex-1">
          <button type="button" onClick={open} className="block max-w-full truncate text-left text-[16px] font-semibold text-slate-900 hover:text-teal-700">
            {s.name}
          </button>
          <p className="m-0 mt-0.5 flex items-center gap-2 text-[13px] text-slate-500">
            {ok ? `${ok.total.toLocaleString("de-DE")} Treffer` : preview === "error" ? "Treffer nicht verfügbar" : "Lädt …"}
            {fresh > 0 && <span className="rounded-full bg-amber-100 px-2 py-px text-[12px] font-semibold text-amber-800">{fresh} neu</span>}
          </p>
        </div>
        <div className="flex flex-none items-center">
          <button type="button" onClick={open} title="Suche öffnen" aria-label="Suche öffnen" className={iconBtn}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M7 17 17 7M8 7h9v9" />
            </svg>
          </button>
          <button type="button" onClick={() => removeSaved(s.id)} title="Entfernen" aria-label="Gespeicherte Suche entfernen" className={`${iconBtn} hover:!bg-rose-50 hover:!text-rose-600`}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
            </svg>
          </button>
        </div>
      </header>

      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-5 pb-3">
          {chips.map((c) => (
            <span key={c.key + (c.term ?? "")} className="rounded-md bg-slate-100 px-2 py-0.5 text-[12px] text-slate-600">
              {c.value}
            </span>
          ))}
        </div>
      )}

      {/* Vorschau wie die Startseite im Kleinen: Artikelkarten in einem scrollbaren Bereich */}
      <div className="scroll-thin flex max-h-[340px] flex-col overflow-y-auto border-t border-slate-100 px-[12px]">
        {preview === null && <p className="m-0 px-3 py-2 text-[13px] text-slate-400">Vorschau wird geladen …</p>}
        {ok && !ok.items.length && <p className="m-0 px-3 py-2 text-[13px] text-slate-400">Aktuell keine Treffer.</p>}
        {ok?.items.map((a) => {
          const [y, m, d] = a.date.split("-");
          return (
            <Link
              key={a.id}
              href={`/beschluss/${a.id}`}
              className="grid grid-cols-[46px_minmax(0,1fr)] gap-3 rounded-lg border-b border-slate-200 px-3 py-3 no-underline transition-colors last:border-b-0 hover:bg-slate-50"
            >
              <div className="flex flex-col items-center border-r border-slate-200 pr-3 pt-0.5 text-center">
                <span className="text-[18px] font-semibold leading-none text-slate-900">{Number(d) || "—"}</span>
                <span className="mt-1 text-[11px] font-semibold uppercase tracking-[.06em] text-teal-600">{MONTH_SHORT[Number(m) - 1]}</span>
                <span className="text-[11px] text-slate-500">{y}</span>
              </div>
              <div className="min-w-0">
                <div className="flex items-start gap-2">
                  <h3 className="m-0 min-w-0 flex-1 text-[15px] font-semibold leading-snug text-slate-900">{a.title}</h3>
                  {a.date > s.lastSeen && <span className="badge-new">neu</span>}
                </div>
                <p className="m-0 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] font-medium text-slate-500">
                  {[a.gemeinde, a.gremium].filter(Boolean).join(" · ")}
                  <StatusBadge status={a.status} />
                </p>
                {a.teaser && <p className="m-0 mt-1 line-clamp-2 text-[13px] leading-relaxed text-slate-600">{a.teaser}</p>}
              </div>
            </Link>
          );
        })}
      </div>

      <footer className="flex flex-wrap items-center gap-3 border-t border-slate-100 bg-slate-50/70 px-5 py-3">
        <label className="flex cursor-pointer items-center gap-3 text-[13px] font-medium text-slate-700">
          <Switch on={!!n.mail} onChange={(v) => { if (v && !allow("notifications")) return; set({ mail: v, email: n.email || profile.email }); }} />
          E-Mail bei neuen Treffern
        </label>
        {n.mail && (
          <select
            aria-label="Häufigkeit"
            value={n.freq}
            onChange={(e) => set({ freq: e.target.value as NotifyFreq })}
            className="h-8 rounded-full border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-700 outline-none focus:border-teal-600"
          >
            <option value="instant">Sofort</option>
            <option value="daily">Täglich</option>
            <option value="weekly">Wöchentlich</option>
          </select>
        )}
        {n.mail && profile.email && <span className="text-[12px] text-slate-500">an {profile.email}</span>}
        {n.mail && limits.emails > 1 && (
          <div className="flex w-full flex-wrap items-center gap-1.5">
            <span className="text-[12px] text-slate-500">Weitere Empfänger:</span>
            {extra.map((r) => (
              <button key={r} type="button" aria-label={`Empfänger ${r} entfernen`} onClick={() => set({ recipients: extra.filter((x) => x !== r) })} className="group inline-flex h-7 items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50 pl-2.5 pr-1.5 text-[12px] font-medium text-teal-700">
                {r}
                <IconX size={14} className="opacity-70 group-hover:opacity-100" />
              </button>
            ))}
            {extra.length < limits.emails - 1 && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  addRecipient();
                }}
                className="flex items-center gap-1"
              >
                <input type="email" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="z. B. team@firma.de" aria-label="Weitere E-Mail-Adresse" className="h-9 w-[200px] rounded-lg border border-slate-200 bg-white px-3 text-[13px] outline-none focus:border-teal-600 focus:shadow-focus" />
                <button type="submit" className="btn-secondary btn-sm">
                  Hinzufügen
                </button>
              </form>
            )}
          </div>
        )}
      </footer>
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

      {ready && !saved.length && (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-teal-50 text-teal-600">
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
          <Link className="btn-primary mt-5" href="/">
            Zur Suche
          </Link>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {saved.map((s) => (
          <SavedCard key={s.id} s={s} />
        ))}
      </div>
      </section>
    </>
  );
}
