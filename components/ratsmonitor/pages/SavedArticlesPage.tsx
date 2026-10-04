import Link from "next/link";
import { IconBookmark } from "../components/icons";
import { removeSavedArticle, useSavedArticles } from "../lib/savedArticles";
import { FollowButton } from "../components/FollowButton";
import { MONTH_SHORT } from "../lib/text";
import { useEntitlements } from "../lib/entitlements";
import { LoginRequired, UsagePill } from "../components/TierNotice";
import { PageHead } from "../info/blocks";

/** Liste der gespeicherten Artikel (Lesezeichen) */
export function SavedArticlesPage() {
  const list = useSavedArticles();
  const { tier, used, max } = useEntitlements();
  if (tier === "guest")
    return (
      <>
        <PageHead icon="fileText" label="Artikel" name="Gespeicherte Artikel" />
        <section className="ri-sec ri-sec--tight">
          <LoginRequired title="Artikel speichern" text="Melden Sie sich kostenlos an, um Artikel zu speichern und bei Neuigkeiten zu einem Vorgang benachrichtigt zu werden." />
        </section>
      </>
    );
  return (
    <>
      <PageHead icon="fileText" label="Artikel" name={`Gespeicherte Artikel${list.length ? ` (${list.length})` : ""}`} title={<>Gemerkt.<br />Und nichts verpasst.</>} lead="Mit der Glocke werden Sie informiert, sobald es zu einem Vorgang Neuigkeiten gibt.">
        <div className="mt-4 flex flex-wrap gap-2">
          <UsagePill label="Artikel" used={used.bookmarks} max={max.bookmarks} />
          <UsagePill label="Benachrichtigungen" used={used.notifications} max={max.notifications} />
        </div>
      </PageHead>
      <section className="ri-sec ri-sec--tight">

      {!list.length && (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-teal-50 text-teal-600">
            <IconBookmark size={26} />
          </span>
          <h2 className="mb-1 mt-4 text-[18px] font-semibold">Noch keine gespeicherten Artikel</h2>
          <p className="m-0 max-w-[44ch] text-slate-500">Tippen Sie bei einem Artikel auf das Lesezeichen, um ihn hier zu sammeln.</p>
          <p className="m-0 mt-2 max-w-[48ch] text-[14px] text-slate-500">Mit der Glocke folgen Sie einem Vorgang: Sie werden benachrichtigt, sobald er weiter beraten oder beschlossen wird.</p>
          <Link className="btn-primary mt-5" href="/">
            Artikel entdecken
          </Link>
        </div>
      )}

      <ul className="m-0 flex list-none flex-col p-0">
        {list.map((a) => (
          <li key={a.id} className="grid grid-cols-[52px_minmax(0,1fr)_auto_auto] gap-3 rounded-lg border-b border-slate-200 px-3 py-4 transition-colors last:border-b-0 hover:bg-slate-50">
            {/* Datumsblock wie in der Trefferliste */}
            <div aria-hidden="true" className="flex flex-col items-center border-r border-slate-200 pr-3 pt-0.5 text-center">
              <span className="text-[22px] font-semibold leading-none tracking-[-.02em]">{Number(a.date?.slice(8, 10)) || "—"}</span>
              <span className="mt-1 text-[11px] font-semibold uppercase tracking-[.06em] text-teal-600">{a.date ? MONTH_SHORT[Number(a.date.slice(5, 7)) - 1] : ""}</span>
              <span className="text-[11px] text-slate-500">{a.date?.slice(0, 4)}</span>
            </div>
            <div className="min-w-0">
              <Link href={`/beschluss/${a.id}`} className="line-clamp-2 text-[16px] font-semibold leading-[1.35] tracking-[-.01em] text-slate-900 no-underline hover:text-teal-700">
                {a.title}
              </Link>
              <p className="m-0 mt-0.5 text-[13px] font-medium text-slate-500">{a.gemeinde}</p>
              {a.follow && <p className="m-0 mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-2 py-0.5 text-[12px] font-medium text-teal-700">Sie werden über Neuigkeiten informiert</p>}
              {a.teaser && <p className="m-0 mt-1.5 line-clamp-2 text-[14px] leading-[1.6] text-slate-600">{a.teaser}</p>}
            </div>
            <FollowButton article={a} />
            <button
              type="button"
              onClick={() => removeSavedArticle(a.id)}
              title="Entfernen"
              aria-label="Aus gespeicherten Artikeln entfernen"
              className="grid h-9 w-9 flex-none place-items-center rounded-lg text-teal-600 hover:bg-teal-50"
            >
              <IconBookmark size={20} filled />
            </button>
          </li>
        ))}
      </ul>
      </section>
    </>
  );
}
