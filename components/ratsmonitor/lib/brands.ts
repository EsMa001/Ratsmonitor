/**
 * Produktnamen und Logo-Varianten zur Auswahl (Vorgabe „Kopfzeile-Logos v3“, Oktober 2026). Ohne React,
 * damit auch Server-Dateien wie das Root-Layout den Namen für den Seitentitel lesen können.
 */
export type BrandId = "quorumo" | "plenara" | "parlamo";

export const BRAND_NAME: Record<BrandId, string> = { quorumo: "Quorumo", plenara: "Plenara", parlamo: "Parlamo" };

/** Alle Varianten einer Marke tragen denselben Produktnamen; v1 behält die IDs der ersten Vorgabe.
 *  Quorumo v3 aus der „Ergänzung Quorumo v3“; die Reihenfolge hier ist die Reihenfolge im Dev-Switch. */
export type LogoId =
  | "quorumo"
  | "quorumo-v2o"
  | "quorumo-v2sq"
  | "quorumo-v3o"
  | "quorumo-v3sq"
  | "plenara"
  | "plenara-v2a"
  | "plenara-v2sq"
  | "parlamo"
  | "parlamo-v2dot"
  | "parlamo-v2sq";

export const LOGOS: Record<LogoId, { brand: BrandId; label: string }> = {
  quorumo: { brand: "quorumo", label: "Quorumo" },
  "quorumo-v2o": { brand: "quorumo", label: "Quorumo v2 o" },
  "quorumo-v2sq": { brand: "quorumo", label: "Quorumo v2 ■" },
  "quorumo-v3o": { brand: "quorumo", label: "Quorumo v3 o" },
  "quorumo-v3sq": { brand: "quorumo", label: "Quorumo v3 ■" },
  plenara: { brand: "plenara", label: "Plenara" },
  "plenara-v2a": { brand: "plenara", label: "Plenara v2 a" },
  "plenara-v2sq": { brand: "plenara", label: "Plenara v2 ■" },
  parlamo: { brand: "parlamo", label: "Parlamo" },
  "parlamo-v2dot": { brand: "parlamo", label: "Parlamo v2 ●" },
  "parlamo-v2sq": { brand: "parlamo", label: "Parlamo v2 ■" },
};
export const LOGO_IDS = Object.keys(LOGOS) as LogoId[];

/** Variante im Produktivbetrieb und ohne gespeicherte Auswahl: Name „Plenara“, Logo „Plenara v2 ■“ (quadratischer Punkt). Alle anderen Varianten und der Umschalter (setLogo, DevBrandSwitcher) bleiben erhalten. */
export const DEFAULT_LOGO: LogoId = "plenara-v2sq";
export const DEFAULT_BRAND: BrandId = LOGOS[DEFAULT_LOGO].brand;

export const PAGE_TAGLINE = "Politik für Ihre Region";
export const pageTitle = (id: BrandId) => `${BRAND_NAME[id]} · ${PAGE_TAGLINE}`;
