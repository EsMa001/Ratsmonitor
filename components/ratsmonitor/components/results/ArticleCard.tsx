import { memo, useLayoutEffect, useRef, useState } from "react";
import { STATUS_BY_ID } from "../../lib/constants";
import { MONTH_SHORT, fmtDate, highlightSegments } from "../../lib/text";
import type { Article } from "../../types";
import { SaveArticleButton } from "../SaveArticleButton";

export function Highlight({ text, terms }: { text: string; terms: string[] }) {
  return (
    <>
      {highlightSegments(text, terms).map((s, i) => (s.hl ? <mark key={i}>{s.text}</mark> : <span key={i}>{s.text}</span>))}
    </>
  );
}

export function StatusBadge({ status, className = "" }: { status: Article["status"]; className?: string }) {
  const st = STATUS_BY_ID[status];
  return (
    <span className={`inline-flex h-6 items-center gap-1.5 rounded-full border px-[9px] text-[12px] font-semibold ${st.badge} ${className}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {st.label}
    </span>
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
}

/** Eintrag der Ergebnisliste: Überschrift, Unterzeile, Zusammenfassung; die ganze Karte ist klickbar */
/** Handy: genau die ersten zwei Zeilen der Überschrift fett. Gemessen wird am ganz fetten Titel, wo Zeile 3 beginnt; ab dort normal. */
function MobileTitle({ title, terms }: { title: string; terms: string[] }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [cut, setCut] = useState(title.length);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      if (!el.offsetParent) return;
      /* Textknoten des fett gesetzten Titels einsammeln */
      const nodes: Text[] = [];
      const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      while (tw.nextNode()) nodes.push(tw.currentNode as Text);
      const total = nodes.reduce((t, n) => t + n.length, 0);
      const r = document.createRange();
      const top = (i: number) => {
        for (const n of nodes) {
          if (i < n.length) {
            r.setStart(n, i);
            r.setEnd(n, i + 1);
            return r.getBoundingClientRect().top;
          }
          i -= n.length;
        }
        return Infinity;
      };
      const t0 = top(0), lh = parseFloat(getComputedStyle(el).lineHeight) || 21;
      let lo = 0, hi = total;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (top(mid) >= t0 + 1.5 * lh) hi = mid;
        else lo = mid + 1;
      }
      setCut(lo);
    };
    setCut(title.length);
    requestAnimationFrame(measure);
    let w = window.innerWidth;
    const onResize = () => {
      if (window.innerWidth === w) return;
      w = window.innerWidth;
      setCut(title.length);
      requestAnimationFrame(measure);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [title]);
  return (
    <span ref={ref} className="sm:hidden">
      <strong className="font-semibold"><Highlight text={title.slice(0, cut)} terms={terms} /></strong>
      <Highlight text={title.slice(cut)} terms={terms} />
    </span>
  );
}

export const ArticleCard = memo(function ArticleCard({ article: a, index, terms, onOpen, onHover, compact = false }: Props) {
  const [y, m, d] = a.date.split("-");
  const sub = [a.gemeinde, a.gremium].filter(Boolean).join(" · ");
  return (
    <article
      onMouseEnter={() => onHover(a.ags)}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("button, a")) return;
        if (e.metaKey || e.ctrlKey || e.shiftKey) return;
        e.preventDefault();
        onOpen(a);
      }}
      style={{ animationDelay: `${Math.min(index * 30, 240)}ms` }}
      className="group relative grid shrink-0 animate-cardIn grid-cols-[44px_minmax(0,1fr)_auto] gap-2.5 sm:grid-cols-[52px_minmax(0,1fr)_auto] sm:gap-3 cursor-pointer rounded-lg border-b border-slate-200 bg-white px-3 py-3 sm:py-4 transition-colors last:border-b-0 hover:bg-slate-50 has-[a:focus-visible]:outline has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-teal-600 sm:px-3.5"
    >
      <div aria-hidden="true" className="flex flex-col items-center border-r border-slate-200 pr-2.5 pt-0.5 text-center sm:pr-3">
        <span className="text-[22px] font-semibold leading-none tracking-[-.02em]">{Number(d) || "—"}</span>
        <span className="mt-1 text-[12px] font-semibold uppercase tracking-[.06em] text-teal-600">{MONTH_SHORT[Number(m) - 1]}</span>
        <span className="text-[12px] text-slate-500">{y?.slice(2)}</span>
      </div>
      <div className="min-w-0">
      <h3 lang="de" className="m-0 hyphens-auto break-words text-[16px] font-semibold max-sm:hyphens-none max-sm:line-clamp-4 max-sm:!font-normal leading-[1.35] tracking-[-.01em]">
        <a
          href={`/beschluss/${a.id}`}
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey) return;
            e.preventDefault();
            onOpen(a);
          }}
          className="text-slate-900 no-underline outline-none transition-colors group-hover:text-teal-700"
        >
          <span className="hidden sm:inline"><Highlight text={a.title} terms={terms} /></span>
          <MobileTitle title={a.title} terms={terms} />
        </a>
      </h3>
      {/* Handy: Stadt, Gremium und Status untereinander */}
      <div className="mt-1 text-[12px] leading-[1.45] text-slate-500 sm:hidden">
        {[a.gemeinde, a.gremium, STATUS_BY_ID[a.status]?.label].filter(Boolean).map((t, i) => (
          <p key={i} className="m-0 truncate"><Highlight text={t!} terms={terms} /></p>
        ))}
      </div>
      <p className="mb-1.5 mt-0.5 hidden text-[14px] font-medium text-slate-500 sm:block">
        <Highlight text={sub} terms={terms} />
        {/* Stand dezent am Ende der Zeile */}
        {STATUS_BY_ID[a.status] && (
          <span className="whitespace-nowrap font-normal">
            {" · "}
            {STATUS_BY_ID[a.status].label}
          </span>
        )}
      </p>
      {!compact && <p className="m-0 hidden max-w-[96ch] text-[14px] leading-[1.6] text-slate-600 sm:block">
        <Highlight text={a.teaser} terms={terms} />
      </p>}
      {!compact && a.steps && a.steps.length > 1 && a.steps[0].d < new Date().toISOString().slice(0, 10) && <StepTimeline steps={a.steps} />}
      </div>
      {/* Eigene Spalte fürs Lesezeichen: der Text endet bündig mit dem Suchfeld (rechts davon Filter und Herz) */}
      <div className="flex w-7 justify-end sm:w-[56px]">
        <SaveArticleButton article={{ id: a.id, title: a.title, date: a.date, gemeinde: a.gemeinde, teaser: a.teaser }} size={20} className="-mr-3.5 -mt-1" />
      </div>
    </article>
  );
});

/** Kleine Timeline der bisherigen Beratungen eines Vorgangs */
export function StepTimeline({ steps }: { steps: NonNullable<Article["steps"]> }) {
  const shown = steps.slice(-5);
  return (
    <ol aria-label="Verlauf des Vorgangs" className="mt-2.5 flex items-start overflow-x-auto pb-0.5 [scrollbar-width:none]">
      {steps.length > shown.length && <li className="mr-2 self-center text-[12px] text-slate-500">+{steps.length - shown.length}</li>}
      {shown.map((st, i) => {
        const last = i === shown.length - 1;
        return (
          <li key={i} className="relative flex min-w-[96px] max-w-[170px] flex-1 flex-col gap-0.5 pr-2">
            <div className="flex items-center">
              <span className={`h-2.5 w-2.5 flex-none rounded-full ${last ? "bg-teal-600" : "bg-slate-300"}`} />
              {!last && <span className="h-px flex-1 bg-slate-300" />}
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
