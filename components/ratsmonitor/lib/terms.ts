/* Begriffe aus den Auswertungen (Wortstämme aus Titeln) für die Anzeige aufbereiten */

/** Füllwörter, die als Begriff nichts aussagen und Netz und Listen verstopfen */
const FILLER = new Set(["thema", "land", "kapitel", "teil", "nummer", "nr", "anlage", "anlagen", "punkt", "fall", "jahr", "jahre", "stadt", "gemeinde", "antrag", "vorlage", "beschluss", "sitzung", "sache", "bezug", "grundlage", "rahmen", "form", "art", "umsetzung", "änderung", "ergänzung", "entwurf", "holstein"]);

export const isFiller = (term: string) => FILLER.has(term.trim().toLowerCase());

/** „städtebaulichen“ → „Städtebaulichen“; Begriffe mit Bindestrich oder Leerzeichen je Teil, vorhandene Großbuchstaben bleiben */
export const prettyTerm = (term: string) =>
  term.replace(/(^|[\s-])(\p{Ll})/gu, (_, sep: string, c: string) => sep + c.toUpperCase());
