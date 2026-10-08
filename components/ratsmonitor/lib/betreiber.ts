/**
 * Angaben zum Betreiber für Impressum, Datenschutzerklärung, AGB und Widerrufsbelehrung.
 * Alles in eckigen Klammern vor der Veröffentlichung ausfüllen. Name und Sitz stehen im GbR-Vertrag (§ 1).
 * Sobald die UG besteht, hier Name, Rechtsform, Vertretung und Handelsregister anpassen.
 */
export const BETREIBER = {
  name: "plenara GbR",
  /** Alle Gesellschafter mit Vor- und Nachnamen (bei einer GbR im Impressum nötig) */
  gesellschafter: ["[Vor- und Nachname Gesellschafter 1]", "[Vor- und Nachname Gesellschafter 2]"],
  /** Ladungsfähige Anschrift (ein Postfach genügt nicht) */
  strasse: "[Straße Hausnummer]",
  ort: "[PLZ Ort]",
  email: "[kontakt@beispiel.de]",
  /** Sitz der Gesellschaft, maßgeblich für den Gerichtsstand gegenüber Kaufleuten (AGB § 12) */
  sitz: "Billerbeck",
};

/** Zeile für Fließtext: „plenara GbR, Straße, PLZ Ort“ */
export const betreiberAdresse = () => `${BETREIBER.name}, ${BETREIBER.strasse}, ${BETREIBER.ort}`;
