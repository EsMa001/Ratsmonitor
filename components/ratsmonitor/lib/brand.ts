import { useSyncExternalStore } from "react";
import { BRAND_NAME, DEFAULT_LOGO, LOGO_IDS, LOGOS, type BrandId, type LogoId } from "./brands";
import { IS_DEV } from "./tier";

/**
 * Gewählte Logo-Variante. In der Entwicklung über den Logo-Switch unten rechts wechselbar und im
 * Browser gemerkt; im Produktivbetrieb gilt immer DEFAULT_LOGO.
 */
const KEY = "ratsmonitor:brand:v1";
const listeners = new Set<() => void>();
let current: LogoId | null = null;

function read(): LogoId {
  if (current) return current;
  current = DEFAULT_LOGO;
  if (IS_DEV) {
    try {
      const v = localStorage.getItem(KEY) as LogoId | null;
      if (v && LOGO_IDS.includes(v)) current = v;
    } catch {}
  }
  return current;
}

export function setLogo(id: LogoId) {
  current = id;
  try {
    localStorage.setItem(KEY, id);
  } catch {}
  listeners.forEach((l) => l());
}

export function useBrand(): { logo: LogoId; brand: BrandId; name: string } {
  const logo = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    read,
    () => DEFAULT_LOGO,
  );
  const brand = LOGOS[logo].brand;
  return { logo, brand, name: BRAND_NAME[brand] };
}

/** Produktname in festen Texten (Doku-Inhalte nennen noch „Ratsmonitor“) */
export function useBrandText(): (text: string) => string {
  const { name } = useBrand();
  return (text) => text.replaceAll("Ratsmonitor", name);
}
