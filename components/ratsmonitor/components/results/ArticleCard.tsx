import { memo } from "react";
import { STATUS_BY_ID } from "../../lib/constants";
import { MONTH_SHORT, fmtDate, highlightSegments } from "../../lib/text";
import type { Article } from "../../types";
import { IconPin, IconTag } from "../icons";

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
    <span className={`inline-flex h-6 items-center gap-1.5 rounded-full border px-[9px] text-xs font-semibold ${st.badge} ${className}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {st.label}
    </span>
  );
}

interface Props {
  article: Article;
  index: number;
  terms: string[];
  gemeindeActive: boolean;
  themaActive: boolean;
  onOpen: (a: Article) => void;
  onGemeinde: (a: Article) => void;
  onThema: (a: Article) => void;
  onHover: (ags: string) => void;
}

/** Eintrag der Ergebnisliste; die ganze Karte ist klickbar, die Chips filtern */
export const ArticleCard = memo(function ArticleCard({ article: a, index, terms, gemeindeActive, themaActive, onOpen, onGemeinde, onThema, onHover }: Props) {
  const [y, m, d] = a.date.split("-");
  const chip =
    "relative z-[1] inline-flex h-[26px] items-center gap-[5px] rounded-full border px-[9px] text-[12.5px] font-medium transition-colors";
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
      className="group relative grid shrink-0 animate-cardIn cursor-pointer grid-cols-1 gap-2.5 rounded-xl border border-slate-200 bg-white p-4 transition-[border-color,box-shadow] hover:border-slate-300 hover:shadow-card has-[a:focus-visible]:outline has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-teal-600 sm:grid-cols-[64px_minmax(0,1fr)] sm:gap-[18px] sm:py-[18px] sm:pl-4 sm:pr-5"
    >
      <div aria-hidden="true" className="flex items-baseline gap-1.5 sm:flex-col sm:items-center sm:border-r sm:border-slate-200 sm:pr-3.5 sm:pt-0.5 sm:text-center">
        <span className="text-sm font-semibold leading-none tracking-[-.02em] sm:text-2xl">{Number(d)||'—'}</span>
        <span className="text-xs font-semibold uppercase tracking-[.06em] text-teal-600 sm:mt-1">{MONTH_SHORT[Number(m) - 1]}</span>
        <span className="text-xs text-slate-500">{y}</span>
      </div>
      <div>
        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          <button
            type="button"
            aria-pressed={gemeindeActive}
            title="Nach Gemeinde filtern"
            onClick={() => onGemeinde(a)}
            className={`${chip} ${gemeindeActive ? "border-teal-200 bg-teal-50 text-teal-700" : "border-slate-200 bg-white text-slate-900 hover:bg-slate-100"}`}
          >
            <IconPin size={13} />
            <Highlight text={a.gemeinde} terms={terms} />
          </button>
          <button
            type="button"
            aria-pressed={themaActive}
            title="Nach Thema filtern"
            onClick={() => onThema(a)}
            className={`${chip} ${themaActive ? "border-teal-200 bg-teal-50 text-teal-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}
          >
            <IconTag size={13} />
            <Highlight text={a.thema} terms={terms} />
          </button>
          <span className="text-[12.5px] text-slate-500">
            <Highlight text={a.gremium} terms={terms} />
          </span>
          <StatusBadge status={a.status} className="sm:ml-auto" />
        </div>
        <h3 className="mb-1.5 mt-0 text-[17px] font-semibold leading-[1.35] tracking-[-.01em]">
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
        <p className="m-0 max-w-[96ch] text-[14.5px] leading-[1.62] text-slate-600">
          <Highlight text={a.teaser} terms={terms} />
        </p>
        <div className="mt-2.5 flex items-center gap-3.5 text-[12.5px] text-slate-500">
          <time dateTime={a.date}>Sitzung am {fmtDate(a.date)}</time>
          <span aria-hidden="true" className="font-medium text-teal-600">
            Ausführlich lesen ›
          </span>
        </div>
      </div>
    </article>
  );
});
