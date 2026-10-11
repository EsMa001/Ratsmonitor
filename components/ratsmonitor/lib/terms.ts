/* Begriffe aus den Auswertungen (Wortstämme aus Titeln) für die Anzeige aufbereiten */

/** Füllwörter, die als Begriff nichts aussagen und Netz und Listen verstopfen */
const FILLER = new Set(["thema", "land", "kapitel", "teil", "nummer", "nr", "anlage", "anlagen", "punkt", "fall", "jahr", "jahre", "stadt", "gemeinde", "antrag", "vorlage", "beschluss", "sitzung", "sache", "bezug", "grundlage", "rahmen", "form", "art", "umsetzung", "änderung", "ergänzung", "entwurf", "holstein", "belange", "belangen", "öffentlicher", "öffentliche", "öffentlichen", "öffentlichem", "abwägungs", "isolierte", "zweiten", "ersten", "dritten", "weiteren", "bezüglich", "gemäß", "sowie"]);

export const isFiller = (term: string) => FILLER.has(term.trim().toLowerCase());

/** „städtebaulichen“ → „Städtebaulichen“; Begriffe mit Bindestrich oder Leerzeichen je Teil, vorhandene Großbuchstaben bleiben */
/* Die Auswertung speichert Wörter ohne Umlaute; häufige Fachwörter hier zurückführen */
const UMLAUT: Record<string, string> = { veranderungssperre: "veränderungssperre", veranderungssperren: "veränderungssperren", flachennutzungsplan: "flächennutzungsplan", flachennutzungsplanes: "flächennutzungsplanes", freiflachen: "freiflächen", freiflachenphotovoltaik: "freiflächenphotovoltaik", freiflachenphotovoltaikanlage: "freiflächenphotovoltaikanlage", gewerbeflachen: "gewerbeflächen", flache: "fläche", flachen: "flächen", barrierefreiheit: "barrierefreiheit", ausgleichsmasnahme: "ausgleichsmaßnahme", strasse: "straße", strassen: "straßen", offentlicher: "öffentlicher", offentliche: "öffentliche", offentlichen: "öffentlichen", behorden: "behörden", stadtebaulichen: "städtebaulichen", stadtebaulicher: "städtebaulicher", wasserstoff: "wasserstoff", kindertagesstatte: "kindertagesstätte", kindertagesstatten: "kindertagesstätten", abwagung: "abwägung", abwagungs: "abwägungs", anderung: "änderung", anderungen: "änderungen" };
export const prettyTerm = (term: string) =>
  term.replace(/[\p{L}]+/gu, (w) => UMLAUT[w.toLowerCase()] ?? w).replace(/(^|[\s-])(\p{Ll})/gu, (_, sep: string, c: string) => sep + c.toUpperCase());

/** Grober Wortstamm, damit Beugungsformen („Bebauungsplan“, „Bebauungsplanes“, „Photovoltaikanlagen“) als ein Begriff gezählt werden */
export const termStem = (term: string) => {
  let w = term.trim().toLowerCase();
  for (let i = 0; i < 2; i++) {
    const m = w.match(/^(.{6,}?)(ens|es|en|er|e|s|n)$/);
    if (!m) break;
    w = m[1];
  }
  return w;
};
