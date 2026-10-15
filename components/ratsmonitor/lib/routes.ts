import { brancheBySlug } from "../info/content";

/** Adressen der Info- und der Analyse-Seiten. Hier statt in den Seitenmodulen, damit App.tsx sie kennt, ohne die
 *  Seiten selbst ins Startpaket zu ziehen (die Seiten werden bei Bedarf nachgeladen). */
export const INFO_PATHS = ["/", "/faq", "/videos", "/datenabdeckung", "/funktionen/benachrichtigungen", "/preise", "/anmelden", "/kontakt", "/agb", "/widerruf"] as const;
export const ANALYTICS_PATHS = ["/analytics", "/analytics/ueber", "/analytics/diffusion", "/analytics/graph", "/analytics/trends", "/analytics/vergleich", "/analytics/beschluesse", "/analytics/gremien", "/analytics/fraktionen", "/analytics/tools", "/analytics/politik", "/analytics/finanzen", "/analytics/news", "/analytics/atlas", "/analytics/signale", "/analytics/fakten"] as const;
export const brancheOf = (p: string) => (p.startsWith("/anwender/") ? brancheBySlug(p.slice(10)) : undefined);
export const isInfoPath = (p: string) => (INFO_PATHS as readonly string[]).includes(p) || p === "/registrieren" || !!brancheOf(p);
export const isAnalyticsPath = (p: string) => (ANALYTICS_PATHS as readonly string[]).includes(p);
