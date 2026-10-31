import Link from "next/link";
import { memo, useState } from "react";
import { fmtDate } from "../../lib/text";
import { usePhone } from "../../lib/usePhone";
import { ART_LABEL, type DocHit, type DocSnippet } from "./useDocSearch";

/** Original an der Fundstelle: über den Durchreicher /api/dokument (wie im Artikel), sonst die Adresse der Quelle; #page springt
 *  in PDF-Betrachtern der Browser zur Seite */
const pageHref = (d: DocHit, page: number) =>
  `${d.docIndex >= 0 ? `/api/dokument?t=${encodeURIComponent(d.topicId)}&i=${d.docIndex}` : d.url}#page=${page}`;

function Snippet({ d, s }: { d: DocHit; s: DocSnippet }) {
  return (
    <li>
      <a href={pageHref(d, s.page)} target="_blank" rel="noopener noreferrer" className="rm-docsnip grid grid-cols-[48px_minmax(0,1fr)] gap-2 text-[14px] leading-relaxed text-slate-700 no-underline">
        <span className="font-semibold text-teal-700">S. {s.page}</span>
        <span className="min-w-0 break-words">
          {s.before}
          {s.hit && <b className="font-semibold text-slate-900">{s.hit}</b>}
          {s.after}
          <span className="sr-only"> (Original öffnen, Seite {s.page})</span>
        </span>
      </a>
    </li>
  );
}

/** Ein Treffer der Dokumentsuche: Dokumentname (zum Vorgang), Art, Ort, Gremium, Sitzungstag; darunter die Fundstellen mit Seite
 *  (zum Original). Am Handy eine Fundstelle offen, die übrigen auf Tippen. */
export const DocumentRow = memo(function DocumentRow({ doc: d }: { doc: DocHit }) {
  const phone = usePhone();
  const [open, setOpen] = useState(false);
  const shown = phone && !open ? d.snippets.slice(0, 1) : d.snippets;
  const more = d.snippets.length - shown.length;
  const sub = [d.gemeinde, d.gremium, d.date && fmtDate(d.date)].filter(Boolean).join(" · ");
  return (
    <li className="border-b border-slate-200 py-4">
      <h3 lang="de" className="m-0 hyphens-auto break-words text-[16px] font-semibold leading-snug">
        <Link href={`/beschluss/${d.topicId}`} className="text-slate-900 no-underline hover:text-teal-700">{d.title}</Link>
        <span className="font-normal text-slate-500"> · {ART_LABEL[d.art] ?? "Dokument"}</span>
      </h3>
      {sub && <p className="m-0 mt-0.5 text-[14px] text-slate-500">{sub}</p>}
      {d.topicTitle && d.topicTitle !== d.title && <p className="m-0 mt-0.5 line-clamp-2 text-[14px] text-slate-600">Vorgang: {d.topicTitle}</p>}
      {shown.length > 0 && (
        <ul className="m-0 mt-2 list-none space-y-1.5 p-0" aria-label="Fundstellen">
          {shown.map((s) => <Snippet key={s.page} d={d} s={s} />)}
        </ul>
      )}
      {(more > 0 || d.hits > d.snippets.length) && (
        <p className="m-0 mt-1 flex flex-wrap items-baseline gap-x-3 text-[14px] text-slate-500">
          {more > 0 && (
            <button type="button" onClick={() => setOpen(true)} className="font-medium text-teal-700 hover:text-teal-600">
              {more === 1 ? "1 weitere Stelle" : `${more} weitere Stellen`}
            </button>
          )}
          {d.hits > d.snippets.length && <span>Treffer auf {d.hits} Seiten</span>}
        </p>
      )}
    </li>
  );
});
