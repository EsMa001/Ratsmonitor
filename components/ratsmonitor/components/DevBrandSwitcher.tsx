import { setLogo, useBrand } from "../lib/brand";
import { LOGO_IDS, LOGOS, type LogoId } from "../lib/brands";
import { IS_DEV } from "../lib/tier";

/** Nur in der Entwicklung: zwischen den Logo-Varianten wechseln (unten rechts) */
export function DevBrandSwitcher() {
  const { logo } = useBrand();
  if (!IS_DEV) return null;
  return (
    <label
      title="Nur Entwicklung: Logo und Produktname wechseln"
      className="fixed bottom-3 right-3 z-[1200] flex items-center gap-1.5 rounded-lg border border-dashed border-amber-300 bg-amber-50/90 py-1 pl-2 pr-1 text-[11px] font-semibold text-amber-800 opacity-60 shadow-sm transition-opacity hover:opacity-100 focus-within:opacity-100"
    >
      Logo
      <select
        aria-label="Logo-Variante wählen"
        value={logo}
        onChange={(e) => setLogo(e.target.value as LogoId)}
        className="h-6 cursor-pointer rounded-md border border-amber-200 bg-white px-1 text-[12px] font-medium text-slate-800 outline-none focus:border-amber-500"
      >
        {LOGO_IDS.map((id) => (
          <option key={id} value={id}>
            {LOGOS[id].label}
          </option>
        ))}
      </select>
    </label>
  );
}
