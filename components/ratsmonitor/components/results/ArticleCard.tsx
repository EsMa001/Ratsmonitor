import { memo, useRef, useState, type ReactNode } from "react";
import { ArrowRight, Bookmark, Share } from "lucide-react";
import { ContextMenu, type MenuItem } from "../ContextMenu";
import { shareLink } from "../ShareButton";
import { useLongPress } from "../../lib/useLongPress";
import { STATUS_BY_ID, shownThema } from "../../lib/constants";
import { MONTH_SHORT, fmtDate, highlightSegments, todayLocal } from "../../lib/text";
import type { Article } from "../../types";
import { SaveArticleButton } from "../SaveArticleButton";
import { prefetchDetail } from "../../lib/topicCache";
import { toggleSavedArticle, useSavedArticles } from "../../lib/savedArticles";
import { useEntitlements } from "../../lib/entitlements";
import { useToast } from "../../state/toast";
import { useSwipe } from "../../lib/useSwipe";

export function Highlight({ text, terms }: { text: string; terms: string[] }) {
  return (
    <>
      {highlightSegments(text, terms).map((s, i) => (s.hl ? <mark key={i}>{s.text}</mark> : <span key={i}>{s.text}</span>))}
    </>
  );
}


interface Props {
  article: Article;
  index: number;
  terms: string[];
  onOpen: (a: Article) => void;
  onHover: (ags: string) => void;
  /** kompakte Ansicht: nur Datum, Titel, Ort und Gremium */
  compact?: boolean;
  /** Zusatzzeile unter Ort und Gremium (plenara.X Signale: Stand und Kennzahlen) */
  extra?: ReactNode;
}

/** Eintrag der Ergebnisliste: Überschrift, Unterzeile, Zusammenfassung; die ganze Karte ist klickbar */
export const ArticleCard = memo(function ArticleCard({ article: a, index, terms, onOpen, onHover, compact = false, extra }: Props) {
  const [y, m, d] = a.date.split("-");
  const sub = [a.gemeinde, a.gremium].filter(Boolean).join(" · ");
  const thema = shownThema(a.thema);
  /* Vorladen der Detailseite: nach kurzem Verweilen mit der Maus oder dem Finger, nicht bei jedem Überstreichen der Liste
     und nicht beim Wischen (touchmove bricht ab) */
  const warm = useRef(0);
  const later = () => { clearTimeout(warm.current); warm.current = window.setTimeout(() => prefetchDetail(a.id), 150); };
  const stop = () => clearTimeout(warm.current);
  /* Handy: nach links wischen merkt den Artikel vor (oder nimmt ihn wieder heraus), wie das Lesezeichen */
  const saved = useSavedArticles().some((x) => x.id === a.id);
  const { allow } = useEntitlements();
  const toast = useToast();
  const swipe = useSwipe((dir) => {
    if (dir !== -1) return;
    if (!saved && !allow("bookmarks")) return;
    void toggleSavedArticle({ id: a.id, title: a.title, date: a.date, gemeinde: a.gemeinde, teaser: a.teaser }).then((err) => toast(err || (saved ? "Aus gespeicherten Artikeln entfernt" : "Artikel gespeichert")));
  }, { follow: true });
  /* Handy: langer Druck öffnet ein kleines Menü (Merken, Teilen, Öffnen) */
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const press = useLongPress(setMenu);
  const link = typeof window === "undefined" ? "" : `${window.location.origin}/beschluss/${a.id}`;
  const items: MenuItem[] = [
    { label: saved ? "Aus Artikeln entfernen" : "Artikel merken", icon: <Bookmark size={18} strokeWidth={1.5} fill={saved ? "currentColor" : "none"} />, onSelect: () => { if (!saved && !allow("bookmarks")) return; void toggleSavedArticle({ id: a.id, title: a.title, date: a.date, gemeinde: a.gemeinde, teaser: a.teaser }).then((err) => toast(err || (saved ? "Aus gespeicherten Artikeln entfernt" : "Artikel gespeichert"))); } },
    { label: "Teilen", icon: <Share size={18} strokeWidth={1.5} />, onSelect: () => void shareLink(a.title, link).then((r) => r === "copied" && toast("Link kopiert.")) },
    { label: "Öffnen", icon: <ArrowRight size={18} strokeWidth={1.5} />, onSelect: () => onOpen(a) },
  ];
  return (
    <>
    <article
      onContextMenu={press.handlers.onContextMenu}
      onMouseEnter={() => { onHover(a.ags); later(); }}
      onMouseLeave={stop}
      onTouchStart={(e) => { later(); swipe.handlers.onTouchStart(e); press.handlers.onTouchStart(e); }}
      onTouchMove={(e) => { stop(); swipe.handlers.onTouchMove(e); press.handlers.onTouchMove(e); }}
      onTouchEnd={(e) => { swipe.handlers.onTouchEnd(e); press.handlers.onTouchEnd(); }}
      onTouchCancel={() => { swipe.handlers.onTouchCancel(); press.handlers.onTouchCancel(); }}
      onClick={(e) => {
        if (press.consume()) { e.preventDefault(); return; }
        if ((e.target as HTMLElement).closest("button, a")) return;
        if (e.metaKey || e.ctrlKey || e.shiftKey) return;
        e.preventDefault();
        onOpen(a);
      }}
      style={{ animationDelay: `${Math.min(index * 30, 240)}ms`, ...(swipe.dx ? { transform: `translateX(${swipe.dx}px)`, transition: "none" } : {}) }}
      className="group relative grid shrink-0 animate-cardIn grid-cols-[44px_minmax(0,1fr)_auto] gap-2.5 sm:grid-cols-[52px_minmax(0,1fr)_auto] sm:gap-3 cursor-pointer rounded-lg border-b border-slate-200 bg-white px-3 max-sm:px-4 py-3 sm:py-4 transition-colors last:border-b-0 hover:bg-slate-50 has-[a:focus-visible]:outline has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-teal-600 sm:px-3.5"
    >
      <div aria-hidden="true" className="flex flex-col items-center border-r border-slate-200 pr-2.5 pt-0.5 text-center sm:pr-3">
        <span className="text-[22px] font-semibold leading-none tracking-[-.02em]">{Number(d) || "—"}</span>
        <span className="mt-1 text-[12px] font-semibold uppercase tracking-[.06em] text-teal-800">{MONTH_SHORT[Number(m) - 1]}</span>
        <span className="text-[12px] text-slate-500">{y?.slice(2)}</span>
      </div>
      <div className="min-w-0">
      <h3 lang="de" className="m-0 hyphens-auto break-words text-[16px] font-semibold max-sm:hyphens-none max-sm:line-clamp-2 leading-[1.35] tracking-[-.01em]">
        <a
          href={`/beschluss/${a.id}`}
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey) return;
            e.preventDefault();
            onOpen(a);
          }}
          className="text-slate-900 no-underline outline-none transition-colors group-hover:text-teal-700"
        >
          <Highlight text={a.title} terms={terms} />
        </a>
      </h3>
      {/* Datum für Bildschirmleser: die Datumsspalte links ist nur Gestaltung (aria-hidden) */}
      {/^\d{4}-\d{2}-\d{2}/.test(a.date) && <p className="sr-only">Sitzung am {fmtDate(a.date)}</p>}
      {/* Handy: Stadt, Gremium, Status und Thema nebeneinander, bei Platzmangel umbrechend */}
      <p className="m-0 mt-1 text-[12px] leading-[1.45] text-slate-500 sm:hidden">
        {[a.gemeinde, a.gremium, STATUS_BY_ID[a.status]?.label, thema].filter(Boolean).map((t, i) => (
          <span key={i}>
            {i > 0 && " · "}
            <Highlight text={t!} terms={terms} />
          </span>
        ))}
      </p>
      <p className="mb-1.5 mt-0.5 hidden text-[14px] font-medium text-slate-500 sm:block">
        <Highlight text={sub} terms={terms} />
        {/* Stand dezent am Ende der Zeile */}
        {STATUS_BY_ID[a.status] && (
          <span className="whitespace-nowrap font-normal">
            {" · "}
            {STATUS_BY_ID[a.status].label}
          </span>
        )}
        {/* Thema (Label nach Regeln), nach dem auch gefiltert wird */}
        {thema && (
          <span className="whitespace-nowrap font-normal">
            {" · "}
            <Highlight text={thema} terms={terms} />
          </span>
        )}
      </p>
      {extra}
      {!compact && <p className="m-0 mt-1.5 line-clamp-4 max-w-[96ch] text-[14px] leading-[1.5] text-slate-600 sm:mt-0 sm:line-clamp-none sm:leading-[1.6]">
        <Highlight text={a.teaser} terms={terms} />
      </p>}
      {/* Verlauf: auch in der kompakten Ansicht */}
      {a.steps && a.steps.length > 1 && a.steps[0].d < todayLocal() && <StepTimeline steps={a.steps} />}
      </div>
      {/* Eigene Spalte fürs Lesezeichen: der Text endet bündig mit dem Suchfeld (rechts davon Filter und Herz) */}
      <div className="flex w-6 justify-end sm:w-[56px]">
        <SaveArticleButton article={{ id: a.id, title: a.title, date: a.date, gemeinde: a.gemeinde, teaser: a.teaser }} size={20} className="-mr-3.5 max-sm:-mr-2.5 -mt-1" />
      </div>
    </article>
    {menu && <ContextMenu pos={menu} items={items} label={a.title} onClose={() => setMenu(null)} />}
    </>
  );
});

/** Kleine Timeline der Beratungen eines Vorgangs: die letzte bis heute in Petrol, künftige grau (hohler Punkt, gestrichelt) */
export function StepTimeline({ steps }: { steps: NonNullable<Article["steps"]> }) {
  const shown = steps.slice(-5);
  const today = todayLocal();
  const current = shown.reduce((c, st, i) => (st.d <= today ? i : c), -1);
  return (
    <ol aria-label="Verlauf des Vorgangs" tabIndex={0} className="mt-2.5 flex items-start overflow-x-auto pb-0.5 [scrollbar-width:none]">
      {steps.length > shown.length && <li className="mr-2 self-center text-[12px] text-slate-500">+{steps.length - shown.length}</li>}
      {shown.map((st, i) => {
        const last = i === shown.length - 1, now = i === current, future = st.d > today, nextFuture = !last && shown[i + 1].d > today;
        return (
          <li key={i} className={`relative flex min-w-[96px] max-w-[170px] flex-1 flex-col gap-0.5 pr-2 ${future ? "opacity-60" : ""}`}>
            <div className="flex items-center">
              <span className={`h-2.5 w-2.5 flex-none rounded-full ${now ? "bg-teal-600" : future ? "border border-slate-300 bg-white" : "bg-slate-300"}`} />
              {!last && <span className={nextFuture ? "h-0 flex-1 border-t border-dashed border-slate-300" : "h-px flex-1 bg-slate-300"} />}
            </div>
            <span className="text-[12px] font-semibold tabular-nums text-slate-600">{fmtDate(st.d)}</span>
            <span className="truncate text-[12px] text-slate-500" title={st.c}>{st.c || "Gremium offen"}</span>
            <span className="truncate text-[12px] text-slate-500">{STATUS_BY_ID[st.s as Article["status"]]?.label || ""}</span>
          </li>
        );
      })}
    </ol>
  );
}
