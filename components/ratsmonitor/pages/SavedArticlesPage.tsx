import Link from "next/link";
import { IconBookmark } from "../components/icons";
import { removeSavedArticle, useSavedArticles } from "../lib/savedArticles";
import { FollowButton } from "../components/FollowButton";
import { fmtDate } from "../lib/text";
import { useEntitlements } from "../lib/entitlements";
import { LoginRequired, UsagePill } from "../components/TierNotice";

/** Liste der gespeicherten Artikel (Lesezeichen) */
export function SavedArticlesPage() {
  const list = useSavedArticles();
  const { tier, used, max } = useEntitlements();
  if (tier === "guest")
    return (
      <>
        <h1 className="m-0 text-3xl font-bold tracking-tight">Gespeicherte Artikel</h1>
        <LoginRequired title="Artikel speichern" text="Melde dich kostenlos an, um Artikel zu speichern und bei Neuigkeiten zu einem Vorgang benachrichtigt zu werden." />
      </>
    );
  return (
    <>
      <h1 className="m-0 text-3xl font-bold tracking-tight">
        Gespeicherte Artikel{list.length > 0 && <span className="ml-2 align-middle text-lg font-semibold text-slate-400">{list.length}</span>}
      </h1>
      <p className="m-0 mt-1.5 text-slate-600">Artikel, die du dir gemerkt hast. Mit der Glocke wirst du informiert, sobald es zu einem Vorgang Neuigkeiten gibt.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <UsagePill label="Artikel" used={used.bookmarks} max={max.bookmarks} />
        <UsagePill label="Benachrichtigungen" used={used.notifications} max={max.notifications} />
      </div>

      {!list.length && (
        <div className="mt-6 flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-teal-50 text-teal-600">
            <IconBookmark size={26} />
          </span>
          <h2 className="mb-1 mt-4 text-lg font-semibold">Noch keine gespeicherten Artikel</h2>
          <p className="m-0 max-w-[44ch] text-slate-500">Tippe bei einem Artikel auf das Lesezeichen, um ihn hier zu sammeln.</p>
          <Link className="btn-primary mt-5" href="/">
            Artikel entdecken
          </Link>
        </div>
      )}

      <ul className="m-0 mt-5 flex list-none flex-col gap-[max(0.3vw,6px)] p-0">
        {list.map((a) => (
          <li key={a.id} className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-card transition-shadow hover:shadow-pop">
            <div className="min-w-0 flex-1">
              <Link href={`/beschluss/${a.id}`} className="line-clamp-2 text-[16px] font-semibold leading-snug text-slate-900 no-underline hover:text-teal-700">
                {a.title}
              </Link>
              <p className="m-0 mt-1 text-[12.5px] text-slate-500">{[a.gemeinde, a.date ? fmtDate(a.date) : ""].filter(Boolean).join(" · ")}</p>
              {a.follow && <p className="m-0 mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-2 py-0.5 text-[12px] font-medium text-teal-700">Du wirst über Neuigkeiten informiert</p>}
              {a.teaser && <p className="m-0 mt-1.5 line-clamp-2 text-[13.5px] leading-relaxed text-slate-600">{a.teaser}</p>}
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
    </>
  );
}
