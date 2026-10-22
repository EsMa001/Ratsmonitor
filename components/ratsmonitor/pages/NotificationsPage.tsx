import Link from "next/link";
import { IconBell } from "../components/icons";
import { FollowButton } from "../components/FollowButton";
import { AccountLoading, LoginRequired, UsagePill } from "../components/TierNotice";
import { PageHead } from "../info/blocks";
import { Icon, type IconName } from "../info/icons";
import { useEntitlements } from "../lib/entitlements";
import { useSavedArticles, useSavedArticlesReady } from "../lib/savedArticles";
import { useAccount } from "../state/account";
import { WeeklyReport } from "./SavedSearchesPage";

/** Benachrichtigungen im Konto: alles an einem Ort, was per E-Mail meldet (Wochenbericht, Suchen und Artikel mit Glocke, Kalender).
 *  Versand: Job notify auf dem Server (server/accounts/notify.mjs); geschaltet wird hier und an den Suchen, Artikeln und im Kalender. */
export function NotificationsPage() {
  const { saved, ready } = useAccount();
  const articles = useSavedArticles();
  const articlesReady = useSavedArticlesReady();
  const { tier, ready: tierReady, signedIn, limits, used, max } = useEntitlements();
  if (!tierReady || !signedIn || tier === "guest")
    return (
      <>
        <PageHead icon="bell" label="Konto" name="Benachrichtigungen" />
        <section className="ri-sec ri-sec--tight">
          {tierReady ? <LoginRequired title="Benachrichtigungen" text="Melden Sie sich an, um neue Treffer zu Ihren Suchen und Artikeln per E-Mail zu erhalten." /> : <AccountLoading />}
        </section>
      </>
    );
  const searches = saved.filter((s) => s.notify?.mail && s.active !== false);
  const freq = { instant: "sofort", daily: "täglich", weekly: "wöchentlich" } as const;
  const followed = articles.filter((a) => a.follow && a.active !== false);
  const row = "flex items-center gap-3 border-b border-slate-200 py-3 text-[16px] text-slate-900 no-underline last:border-b-0 hover:text-teal-700";
  /* Handy: jeder Abschnitt als Karte mit Symbol */
  const card = "max-sm:mt-3 max-sm:rounded-2xl max-sm:bg-slate-50 max-sm:p-4";
  const head = "m-0 mb-1 mt-8 max-sm:mt-0 flex items-center gap-2 text-[18px] max-sm:text-[16px] font-semibold first:mt-0";
  const ico = (name: IconName) => <Icon name={name} size={18} className="text-teal-700 sm:hidden" />;
  const empty = "m-0 py-3 text-[14px] text-slate-500";
  return (
    <>
      <PageHead icon="bell" label="Konto" name="Benachrichtigungen" title={<>Früher wissen, was sich tut.</>} lead="Neue Treffer Ihrer Suchen, Neuigkeiten zu Ihren Vorgängen und neue Sitzungen per E-Mail. Hier sehen Sie alles an einem Ort.">
        <div className="mt-4 flex flex-wrap gap-2">
          <UsagePill label="Benachrichtigungen" used={used.notifications} max={max.notifications} />
        </div>
      </PageHead>
      <section className="ri-sec ri-sec--tight">
        <p className="m-0 mb-4 text-[14px] text-slate-500">Täglich und wöchentlich kommen die E-Mails um 7 Uhr, wöchentlich am Tag des Wochenberichts. Jede E-Mail enthält einen Link zum Abbestellen.</p>

        <div className={card}>
        <h2 className={head}>{ico("newspaper")}Wochenbericht</h2>
        <WeeklyReport bare />
        </div>

        <div className={card}>
        <h2 className={head}>{ico("heart")}Suchen mit E-Mail</h2>
        {!ready ? <AccountLoading /> : searches.length ? (
          <ul className="m-0 list-none p-0">
            {searches.map((s) => (
              <li key={s.id}><Link href="/konto/suchen" className={row}><IconBell size={18} filled /><span className="min-w-0 flex-1 truncate">{s.name}</span><span className="flex-none text-[12px] text-slate-500">{freq[s.notify.freq] ?? "täglich"}</span></Link></li>
            ))}
          </ul>
        ) : (
          <p className={empty}>Noch keine Suche mit Glocke. Speichern Sie eine Suche mit dem Stern neben dem Suchfeld und schalten Sie unter „Meine Suchen“ die Glocke ein.</p>
        )}
        </div>

        <div className={card}>
        <h2 className={head}>{ico("mail")}Artikel mit Glocke</h2>
        {!articlesReady ? <AccountLoading /> : followed.length ? (
          <ul className="m-0 list-none p-0">
            {followed.map((a) => (
              <li key={a.id} className="flex items-center gap-1 border-b border-slate-200 last:border-b-0"><Link href={`/beschluss/${a.id}`} className={`${row} min-w-0 flex-1 border-b-0`}><span className="min-w-0 flex-1 truncate">{a.title}</span><span className="flex-none text-[12px] text-slate-500">{a.gemeinde}</span></Link><FollowButton article={a} size={18} /></li>
            ))}
          </ul>
        ) : (
          <p className={empty}>Noch kein Vorgang mit Glocke. Tippen Sie auf einer Artikelseite oder bei einem gespeicherten Artikel auf die Glocke.</p>
        )}
        </div>

        <div className={card}>
        <h2 className={head}>{ico("clock")}Kalender</h2>
        <p className={empty}>
          {limits.calendar ? "Neue Sitzungen in Ihren Kalendergebieten per E-Mail: der Schalter steht im Kalender." : "Der Kalender gehört zu Enterprise."}{" "}
          <Link href="/konto/kalender" className="font-medium text-teal-700 hover:underline">Zum Kalender</Link>
        </p>
        </div>

        <p className="m-0 mt-8 text-[14px] text-slate-500">
          Wie die Benachrichtigungen arbeiten: <Link href="/funktionen/benachrichtigungen" className="font-medium text-teal-700 hover:underline">Erklärung ansehen</Link>
        </p>
      </section>
    </>
  );
}
