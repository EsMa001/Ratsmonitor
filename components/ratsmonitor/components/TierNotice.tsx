import Link from "next/link";
import { IS_DEV, setTier, TIER_LABEL, useTier, usage } from "../lib/tier";

/** Platzhalter für Bereiche, die eine Anmeldung voraussetzen (Gast) */
export function LoginRequired({ title, text }: { title: string; text: string }) {
  return (
    <div className="mt-6 flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-teal-50 text-teal-600">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="5" y="11" width="14" height="10" rx="2" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </svg>
      </span>
      <h2 className="mb-1 mt-4 text-[18px] font-semibold">{title}</h2>
      <p className="m-0 max-w-[48ch] text-slate-500">{text}</p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        <Link className="btn-primary" href="/konto/profil#tarif">
          Kostenlos registrieren
        </Link>
        {IS_DEV && (
          <button type="button" onClick={() => setTier("basic")} className="text-[12px] text-slate-400 underline underline-offset-2 hover:text-slate-700">
            Dev: als Basic anmelden
          </button>
        )}
      </div>
    </div>
  );
}

/** Verbrauch eines Limits, z. B. „1 von 1 · Basic“, mit Upgrade-Link am Limit */
export function UsagePill({ label, used, max }: { label: string; used: number; max: number }) {
  const { tier } = useTier();
  const full = Number.isFinite(max) && used >= max;
  return (
    <span className={`inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[12px] font-medium ${full ? "border-amber-200 bg-amber-50 text-amber-800" : "border-slate-200 bg-white text-slate-600"}`}>
      {label}: {usage(used, max)}
      <span className="text-slate-400">· {TIER_LABEL[tier]}</span>
      {full && (
        <Link href="/konto/profil#tarif" className="font-semibold text-amber-900 underline underline-offset-2">
          Upgrade
        </Link>
      )}
    </span>
  );
}
