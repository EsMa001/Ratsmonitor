import { IS_DEV, setTier, TIER_LABEL, useTier, type Tier } from "../lib/tier";

/** Nur in der Entwicklung: Account-Zustand ohne echten Login wechseln */
export function DevTierSwitcher() {
  const { tier } = useTier();
  if (!IS_DEV) return null;
  return (
    <label title="Nur Entwicklung: Account-Zustand simulieren" className="flex items-center gap-1.5 rounded-lg border border-dashed border-amber-300 bg-amber-50/70 py-1 pl-2 pr-1 text-[12px] font-semibold text-amber-800">
      DEV
      <select
        aria-label="Account-Zustand simulieren"
        value={tier}
        onChange={(e) => setTier(e.target.value as Tier)}
        className="h-7 cursor-pointer rounded-md border border-amber-200 bg-white px-1.5 text-[12px] font-medium text-slate-800 outline-none focus:border-amber-500"
      >
        {(Object.keys(TIER_LABEL) as Tier[]).map((t) => (
          <option key={t} value={t}>
            {t === "guest" ? "Gast (nicht eingeloggt)" : t === "basic" ? "Basic (kostenlos)" : t === "pro" ? "Pro (bezahlt)" : "Enterprise"}
          </option>
        ))}
      </select>
    </label>
  );
}
