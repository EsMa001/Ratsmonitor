import { ShareButton, shareLink } from "../components/ShareButton";
import { ContextMenu, type MenuItem } from "../components/ContextMenu";
import { useLongPress } from "../lib/useLongPress";
import { ArrowRight, Share, Trash2 } from "lucide-react";
import { searchToUrl } from "../lib/searchUrl";
import { INITIAL_SEARCH } from "../state/search";
import Link from "next/link";
import { useEffect, useState } from "react";
import { IconStar } from "../components/icons";
import { filterChips } from "../lib/savedSearch";
import { useAccount } from "../state/account";
import { useEntitlements } from "../lib/entitlements";
import { AccountLoading, LoginRequired, UsagePill } from "../components/TierNotice";
import { NOTIFY_LATER } from "../components/FollowButton";
import { PageHead } from "../info/blocks";
import { useData } from "../state/data";
import { useAppNav } from "../state/nav";
import { savedSearchQuery, useSearch } from "../state/search";
import { fetchJson } from "../lib/fetchJson";
import type { Article, SavedSearch } from "../types";
import { MONTH_SHORT, todayLocal } from "../lib/text";
import { useToast } from "../state/toast";
import { queue } from "../lib/queue";
import { api, useMe } from "../lib/account";
import { WEEK_DAYS } from "../lib/browserData";

type Item = { id: string; title: string; date: string; gemeinde: string; gremium: string; teaser: string; status: Article["status"] };
type Preview = { total: number; items: Item[] } | null;

/* Vorschauen nacheinander, höchstens vier zugleich */
const previews = queue(4);

/** Die neuesten Treffer einer gespeicherten Suche, mit genau der Abfrage, die beim Öffnen läuft (savedSearchQuery) */
function usePreview(s: SavedSearch): Preview | "error" {
  const { geo, place } = useData();
  const { noteQuery } = useAccount();
  const [data, setData] = useState<Preview | "error">(null);
  /* Neu laden, wenn sich die Suche ändert (nicht bei Benachrichtigung, „zuletzt gesehen“ oder Kontofeldern) */
  const what = JSON.stringify({ ...s, id: "", name: "", notify: null, lastSeen: "", created: "", active: null, position: null, query: null });
  useEffect(() => {
    if (!geo || !place) return;
    const ctrl = new AbortController();
    savedSearchQuery(s, geo, place)
      /* Fehlte die Abfrage beim Speichern (Karte noch nicht geladen), wird sie jetzt im Konto nachgetragen */
      .then((q) => {
        if (q !== null && !s.query) noteQuery(s, q);
        return q;
      })
      .then((q) => (q === null ? Promise.reject(new Error("karte")) : previews(() => fetchJson<{ total?: number; articles?: Item[] }>(`/api/search?${q}&page=1`, { signal: ctrl.signal }), ctrl.signal)))
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
  const chips = filterChips({ q: s.q, text: s.text, area: s.area, areaSrc: s.areaSrc, radius: s.radius, thema: s.thema, monat: s.monat, von: s.von, bis: s.bis, scope: s.scope, more: s.more, status: s.status, level: s.level }, geo);
  const ok = preview && preview !== "error" ? preview : null;
  const fresh = ok ? ok.items.filter((a) => a.date > s.lastSeen).length : 0;
  const open = () => {
    if (search.applySaved(s)) {
      void updateSaved(s.id, { lastSeen: todayLocal() });
      goOverview();
    }
  };
  /* Entfernen mit „Rückgängig“: samt vorgemerkter Benachrichtigung und Listenplatz wiederherstellbar */
  const remove = async () => {
    const index = saved.findIndex((x) => x.id === s.id);
    const err = await removeSaved(s.id);
    if (err) return toast(err);
    toast("Gespeicherte Suche entfernt.", { label: "Rückgängig", run: () => void restoreSaved(s, index).then((e) => e && toast(e)) });
  };
  const shareUrl = `${typeof window === "undefined" ? "" : window.location.origin}/suche?${searchToUrl({ ...INITIAL_SEARCH, q: s.q || s.text, area: s.area, areaSrc: s.areaSrc, scope: s.scope ?? "only", thema: s.thema, monat: s.monat, von: s.von ?? "", bis: s.bis ?? "", status: s.status, level: s.level ?? "city", future: !!s.future, radius: s.radius ? { ags: s.radius.ags, km: s.radius.km, x: s.radius.x ?? 0, y: s.radius.y ?? 0 } : null })}`;
  const iconBtn = "grid h-9 w-9 flex-none place-items-center rounded-full transition-colors hover:bg-slate-100";

  /* Handy: langer Druck öffnet ein Menü (Öffnen, Teilen, Entfernen) */
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const press = useLongPress(setMenu);
  const items: MenuItem[] = [
    { label: "Suche öffnen", icon: <ArrowRight size={18} strokeWidth={1.5} />, onSelect: open },
    { label: "Teilen", icon: <Share size={18} strokeWidth={1.5} />, onSelect: () => void shareLink(s.name, shareUrl).then((r) => r === "copied" && toast("Link kopiert.")) },
    { label: "Entfernen", icon: <Trash2 size={18} strokeWidth={1.5} />, danger: true, onSelect: () => void remove() },
  ];
  return (
    <>
    <article className="border-b border-slate-200 py-4 last:border-b-0" {...press.handlers}>
      {/* Kopf wie bei gespeicherten Artikeln: Stern entfernt die Suche (E-Mail-Glocke folgt mit den Benachrichtigungen) */}
      <div className="flex items-start gap-3">
        <button type="button" onClick={() => void remove()} title="Gespeicherte Suche entfernen" aria-label="Gespeicherte Suche entfernen" className={`${iconBtn} -ml-2 text-teal-700`}>
          <IconStar size={20} filled />
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
          {s.active === false && <p className="m-0 mt-0.5 text-[12px] text-amber-800">Nicht aktiv: über der Grenze Ihrer Stufe gespeichert.</p>}
        </div>
        <ShareButton title={s.name} url={shareUrl} className="-mr-1" />
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

      {/* Vorgemerkte Benachrichtigung (z. B. aus der Übernahme): Häufigkeit nur anzeigen, verschickt wird noch nichts */}
      {n.mail && (
        <p className="m-0 mt-3 pl-9 text-[14px] text-slate-500">
          Vorgemerkt: {n.freq === "instant" ? "sofort" : n.freq === "weekly" ? "wöchentlich" : "täglich"}. {NOTIFY_LATER}.
        </p>
      )}
    </article>
    {menu && <ContextMenu pos={menu} items={items} label={s.name} onClose={() => setMenu(null)} />}
    </>
  );
}

export function SavedSearchesPage() {
  const { saved, ready } = useAccount();
  const { tier, ready: tierReady, signedIn, used, max } = useEntitlements();
  /* Ohne Anmeldung bzw. ohne freigeschaltete Stufe: Hinweis; gespeicherte Suchen eines Kontos bleiben sichtbar */
  if (!tierReady || (tier === "guest" && (!signedIn || (ready && !saved.length))))
    return (
      <>
        <PageHead icon="search" label="Suchen" name="Meine Suchen" />
        <section className="ri-sec ri-sec--tight">
          {tierReady ? <LoginRequired title="Suchen speichern" text="Melden Sie sich an, um Suchen zu speichern." /> : <AccountLoading />}
        </section>
      </>
    );
  return (
    <>
      <PageHead icon="search" label="Suchen" name={`Meine Suchen${ready && saved.length ? ` (${saved.length})` : ""}`} title={<>Ihre Themen. Immer im Blick.</>} lead="Neue Treffer auf einen Blick, gespeichert in Ihrem Konto.">
        <div className="mt-4 flex flex-wrap gap-2">
          <UsagePill label="Suchen" used={used.searches} max={max.searches} />
        </div>
      </PageHead>
      <section className="ri-sec ri-sec--tight">
      {!ready && <AccountLoading />}

      {ready && !saved.length && (
        <div className="flex flex-col items-center px-6 py-10 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-teal-50 text-teal-700">
            <IconStar size={26} />
          </span>
          <h2 className="mb-1 mt-4 text-[18px] font-semibold">Noch keine gespeicherten Suchen</h2>
          <p className="m-0 max-w-[44ch] text-slate-500">Suchen Sie in der Übersicht und tippen Sie auf den Stern neben dem Suchfeld.</p>
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
          <Link className="btn-primary mt-5 max-sm:flex max-sm:h-12 max-sm:w-full max-sm:justify-center" href="/suche">
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

/** Wochenbericht: alle neuen Treffer der gespeicherten Suchen in einer E-Mail, täglich oder am gewählten Wochentag.
 *  Folgt mit den E-Mail-Benachrichtigungen: die Einstellung aus dem Konto (/api/me/settings) wird nur angezeigt. */
export function WeeklyReport({ bare = false }: { /** ohne eigene Überschrift (steht schon über dem Abschnitt) */ bare?: boolean } = {}) {
  const me = useMe();
  const key = me.user ? `${me.user.id}:${me.rev}` : "";
  const [got, setGot] = useState<{ key: string; weekly: boolean; day: number | null } | null>(null);
  useEffect(() => {
    if (!key) return;
    let live = true;
    api<{ weekly?: boolean; weeklyDay?: number | null }>("/api/me/settings").then(
      (d) => live && setGot({ key, weekly: !!d.weekly, day: typeof d.weeklyDay === "number" ? d.weeklyDay : null }),
      () => {},
    );
    return () => {
      live = false;
    };
  }, [key]);
  const s = got?.key === key ? got : null;
  const day = s?.day ?? 1;
  return (
    <div className="mb-6 flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-slate-200 pb-5 text-[14px]">
      <span className={bare ? "sr-only" : "font-semibold text-slate-900"}>Wochenbericht</span>
      <span className="text-slate-500">Alle neuen Treffer Ihrer Suchen in einer E-Mail, täglich oder an dem Wochentag, den Sie wählen:</span>
      <select aria-label="Rhythmus des Wochenberichts" aria-describedby="weekly-later" disabled value={String(day)} className="h-8 rounded-md border border-slate-200 bg-slate-50 px-2 text-[14px] text-slate-500">
        {[1, 2, 3, 4, 5, 6, 0].map((i) => (
          <option key={i} value={String(i)}>
            Jeden {WEEK_DAYS[i]}
          </option>
        ))}
      </select>
      <button type="button" role="switch" aria-checked={!!s?.weekly} aria-disabled="true" aria-label="Wochenbericht" aria-describedby="weekly-later" className={`relative h-6 w-10 flex-none cursor-default rounded-full ${s?.weekly ? "bg-teal-600/40" : "bg-slate-200"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow ${s?.weekly ? "left-[18px]" : "left-0.5"}`} />
      </button>
      <span id="weekly-later" className="text-slate-500">
        {s?.weekly ? "Vorgemerkt. " : ""}
        {NOTIFY_LATER}.
      </span>
    </div>
  );
}
