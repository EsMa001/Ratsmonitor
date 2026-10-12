/**
 * Score eines Original-PDFs für die PDF-Ablage mit fester Grenze (keeper in scripts/pdf-store/store-lib.mjs, budget.mjs):
 * Texte werden immer gespeichert; als PDF bleiben die Dateien mit dem höchsten Score, bis die Grenze voll ist. Was nicht
 * hineinpasst, behält nur seinen Text; das Original bleibt über den Link bei der Quelle. Entscheidung 12.10.2026.
 *
 * Score (0 bis 1, im Reiter als Prozent) = Dokumentart × Formalie × Inhalt × Größe:
 * - Dokumentart: Vorlagen und Beschlusstexte tragen den Inhalt (1), Niederschriften die Ergebnisse (0,7), Anlagen und
 *   Sonstiges sind oft Pläne und Gutachten Dritter (0,4), Einladungen wiederholen nur die Tagesordnung (0,1).
 * - Formalie: halber Wert, außer bei Niederschriften (die Ergebnisse der letzten Sitzung).
 * - Inhalt: voll ab FULL_CHARS Zeichen Text, darunter mit der Wurzel fallend (Deckblätter, Auszüge, Hinweise wiegen wenig).
 *   Seiten, die noch auf OCR warten, zählen vorläufig mit OCR_PAGE_CHARS Zeichen (Mittel der per OCR gelesenen Vorlagen);
 *   nach der OCR gilt die echte Zahl, der Score wird bei jedem Lauf aus dem aktuellen Text gerechnet. Ohne lesbaren Text
 *   (Textebene fehlgeschlagen) zählt der Inhalt halb.
 * - Größe: voll bis FULL_BYTES, darüber mit der Kubikwurzel fallend; über MAX_BYTES (für alle Dokumentarten, Entscheidung
 *   12.10.2026) Score 0: die Datei bleibt nur als Text, das PDF wird gelöscht, sobald der Text vollständig ist.
 * Scan oder Textebene und Alter zählen nicht.
 */
export const RANK_VERSION=3;
export const TYPE_VALUE=Object.freeze({paper:1,decision:1,minutes:0.7,attachment:0.4,other:0.4,invitation:0.1});
/** Feste Grenze der Ablage in GB, PDFs und Texte zusammen (Entscheidung 12.10.2026: 80 statt 100, Luft für Datenbank und
    Sicherung auf der Platte); Standard aller Skripte und der Zeitplaner-Befehle */
export const BUDGET_GB=80;
/** Größte Datei, die als PDF gespeichert wird (alle Dokumentarten) */
export const MAX_BYTES=10*1048576;
export const FULL_CHARS=4000,FULL_BYTES=100*1024,OCR_PAGE_CHARS=800;

/**
 * @param {{type?:string,formal?:boolean|number,chars?:number|null,ocrNeeded?:number|null,bytes:number}} d
 * @returns {{score:number,keep:boolean,content:number,size:number}} keep:false heißt: zu groß, nur Text
 */
export function rankPdf(d){
 const type=TYPE_VALUE[d.type]!=null?d.type:'other';
 let value=TYPE_VALUE[type];
 if(d.formal&&type!=='minutes')value*=0.5;
 const chars=d.chars==null?null:d.chars+(d.ocrNeeded||0)*OCR_PAGE_CHARS;
 const content=chars==null?0.5:Math.min(1,Math.sqrt(chars/FULL_CHARS));
 const size=d.bytes<=FULL_BYTES?1:Math.cbrt(FULL_BYTES/d.bytes);
 const keep=d.bytes<=MAX_BYTES;
 return {score:keep?value*content*size:0,keep,content,size};
}
