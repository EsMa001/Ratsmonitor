import Link from "next/link";
import { IS_DEV, priceLabel, rankOf, setTier, TIER_LABEL, UPGRADE_TEXT, useTier, usage } from "../lib/tier";
import { useMe } from "../lib/account";
import { usePlusLink } from "../lib/booking";

/** Neutraler Platzhalter, solange /api/me noch nicht geantwortet hat (statt eines Sperrhinweises) */
export function AccountLoading() {
  return (
    <p role="status" className="m-0 px-6 py-10 text-center text-slate-500">
      Konto wird geladen …
    </p>
  );
}

/** Platzhalter für Bereiche, die eine Anmeldung bzw. eine freigeschaltete Stufe voraussetzen */
export function LoginRequired({ title, text }: { title: string; text: string }) {
  const me = useMe();
  const plus = usePlusLink("plus");
  if (!me.ready) return <AccountLoading />;
  const signedIn = !!me.user;
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-teal-50 text-teal-700">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="5" y="11" width="14" height="10" rx="2" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </svg>
      </span>
      <h2 className="mb-1 mt-4 text-[18px] font-semibold">{signedIn ? "Teil von Plus" : title}</h2>
      <p className="m-0 max-w-[48ch] text-slate-500">{signedIn ? (plus.book ? `Diese Funktion gehört zu Plus, ${priceLabel("plus")}, monatlich kündbar.` : "Diese Funktion gehört zu Plus. In der Testphase schalten wir Plus auf Anfrage frei.") : text}</p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        {signedIn ? (
          <Link className="btn-primary" href={plus.href}>
            {plus.label}
          </Link>
        ) : (
          me.accounts && (
            <Link className="btn-primary" href="/anmelden">
              Anmelden
            </Link>
          )
        )}
        {IS_DEV && (
          <button type="button" onClick={() => setTier("plus")} className="text-[12px] text-slate-500 underline underline-offset-2 hover:text-slate-700">
            Dev: als Plus anmelden
          </button>
        )}
      </div>
    </div>
  );
}

/** Verbrauch eines Limits, z. B. „1 von 1 · Konto“, mit Verweis auf die nächste Stufe am Limit */
export function UsagePill({ label, used, max }: { label: string; used: number; max: number }) {
  const { tier } = useTier();
  const links = { plus: usePlusLink("plus"), pro: usePlusLink("pro") };
  const full = Number.isFinite(max) && used >= max;
  /* Am Limit: Konto zu Plus, Plus zu Pro (zur Buchung, sonst zur Anfrage); Pro und Enterprise haben keine Grenze */
  const next = rankOf(tier) < rankOf("plus") ? "plus" : "pro";
  const plus = links[next];
  const more = rankOf(tier) < rankOf("pro");
  return (
    <span className={`inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[12px] font-medium ${full ? "border-amber-200 bg-amber-50 text-amber-800" : "border-slate-200 bg-white text-slate-600"}`}>
      {label}: {usage(used, max)}
      <span className="text-slate-500">· {TIER_LABEL[tier]}</span>
      {full && (
        <Link href={more && plus.book ? plus.href : "/kontakt"} title={more && plus.book ? plus.label : UPGRADE_TEXT} className="font-semibold text-amber-900 underline underline-offset-2">
          {more ? `Mehr mit ${TIER_LABEL[next]}` : "Mehr auf Anfrage"}
        </Link>
      )}
    </span>
  );
}
