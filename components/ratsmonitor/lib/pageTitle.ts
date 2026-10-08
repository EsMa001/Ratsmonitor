/** Name der Seite für den Tab-Titel („Preise · Plenara“). Ohne React, damit der Aufbau testbar bleibt.
 *  Startseite und Analyse-Seiten setzen ihren Titel selbst (App.tsx bzw. AnalyticsPages.tsx). */
const NAMES: Record<string, string> = {
  "/funktionen/suche": "Suche",
  "/funktionen/benachrichtigungen": "Benachrichtigungen",
  "/faq": "FAQ",
  "/videos": "Videos",
  "/datenabdeckung": "Datenabdeckung",
  "/preise": "Preise",
  "/anmelden": "Anmelden",
  "/registrieren": "Registrieren",
  "/kontakt": "Kontakt",
  "/agb": "AGB",
  "/widerruf": "Widerruf",
  "/impressum": "Impressum",
  "/datenschutz": "Datenschutz",
  "/konto/suchen": "Gespeicherte Suchen",
  "/konto/artikel": "Gespeicherte Artikel",
  "/konto/kalender": "Kalender",
  "/konto/profil": "Profil",
  "/konto/postfach": "Postfach",
};

/** @param brancheName Name der Branche bei /anwender/<slug> (aus info/content.ts) */
export function pageName(path: string, brancheName?: string): string {
  if (path.startsWith("/anwender/")) return brancheName ?? "Anwender";
  if (path.startsWith("/beschluss/")) return "Beschluss";
  if (path.startsWith("/thema/")) return "Thema";
  if (path.startsWith("/konto")) return NAMES[path.replace(/\/$/, "")] ?? "Konto";
  return NAMES[path] ?? "";
}

/** „Preise · Plenara“; ohne bekannten Seitennamen nur der Produktname */
export const tabTitle = (path: string, productName: string, brancheName?: string) => {
  const name = pageName(path, brancheName);
  return name ? `${name} · ${productName}` : productName;
};
