import { LOGOS, type LogoId } from "./brands";

const TEAL = "#0d9488";

/* Marken-Zeichen für den Browser-Tab, aus den Logos in components/Brand.tsx abgeleitet (Quadrat, transparenter Grund) */
const PLENARA_P: [number, number, number, number][] = [
  [78.0, 50.0, 3.6, 1], [75.9, 60.7, 3.6, 1], [69.8, 69.8, 3.6, 1], [60.7, 75.9, 3.6, 1], [50.0, 78.0, 3.6, 1], [39.3, 75.9, 3.6, 1], [30.2, 69.8, 3.6, 1],
  [24.1, 60.7, 3.6, 1], [50.0, 22.0, 3.6, 1], [60.7, 24.1, 3.6, 1], [69.8, 30.2, 3.6, 1], [75.9, 39.3, 3.6, 1],
  [67.0, 50.0, 3, 0.55], [63.8, 60.0, 3, 0.55], [55.3, 66.2, 3, 0.55], [44.7, 66.2, 3, 0.55], [36.2, 60.0, 3, 0.55], [33.0, 50.0, 3, 0.55],
  [36.2, 40.0, 3, 0.55], [44.7, 33.8, 3, 0.55], [55.3, 33.8, 3, 0.55], [63.8, 40.0, 3, 0.55],
];
const dots = PLENARA_P.map(([x, y, r, o]) => `<circle cx="${x}" cy="${y}" r="${+(r * 1.35).toFixed(1)}" fill="${TEAL}" fill-opacity="${o}"/>`).join("");

const MARKS = {
  plenara: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 8 100 100">${dots}<path d="M22 108V50A28 28 0 0 1 38.2 24.6" stroke="${TEAL}" stroke-width="9" fill="none" stroke-linecap="round"/></svg>`,
  quorumo: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="14 14 76 76"><circle cx="50" cy="50" r="30" stroke="${TEAL}" stroke-width="10" fill="none"/><path d="M62 62L84 84" stroke="${TEAL}" stroke-width="11" stroke-linecap="round"/></svg>`,
  parlamo: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="18 28 76 76"><path d="M22 66c0-16 12-28 28-28 9 0 16 5 19 12l11 2-10 4c-2 14-14 24-30 24H22z" stroke="${TEAL}" stroke-width="5" fill="none" stroke-linejoin="round" stroke-linecap="round"/><circle cx="60" cy="48" r="3.4" fill="${TEAL}"/></svg>`,
} as const;

/** Adresse des Tab-Symbols für die gewählte Logo-Variante */
export const faviconHref = (logo: LogoId) => `data:image/svg+xml,${encodeURIComponent(MARKS[LOGOS[logo].brand])}`;

/** Setzt das Tab-Symbol (ersetzt vorhandene rel=icon-Einträge) */
export function setFavicon(logo: LogoId) {
  const href = faviconHref(logo);
  document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]').forEach((l) => l.id !== "rm-favicon" && l.remove());
  let link = document.getElementById("rm-favicon") as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement("link");
    link.id = "rm-favicon";
    link.rel = "icon";
    link.type = "image/svg+xml";
    document.head.appendChild(link);
  }
  if (link.href !== href) link.href = href;
}
