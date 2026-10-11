/**
 * Rang eines Original-PDFs für die PDF-Ablage mit festem Budget (scripts/pdf-store/budget.mjs): Texte werden immer
 * gespeichert, PDFs nach Wert je Byte, bis das Budget voll ist (gieriges Rucksackverfahren: so viel Wert wie möglich
 * je Gigabyte). Was nicht hineinpasst, behält nur seinen Text; das Original bleibt über den Link bei der Quelle.
 *
 * Wert = Dokumentart × Formalie × Scan × Alter. Begründung:
 * - Vorlagen und Beschlusstexte tragen den Inhalt, Niederschriften die Ergebnisse, Anlagen sind oft Pläne und
 *   Gutachten Dritter (groß, rechtlich heikler), Einladungen wiederholen nur die Tagesordnung.
 * - Formalpunkte zählen weniger, außer ihr Dokument ist eine Niederschrift (die Ergebnisse der letzten Sitzung).
 * - Bei Scans ist der Text per OCR gelesen und kann Fehler haben: das Original wiegt mehr.
 * - Ältere Dokumente wiegen etwas mehr: Ratsinfosysteme löschen nach einigen Jahren, dann ist die Kopie die einzige.
 */
export const RANK_VERSION=1;
export const TYPE_VALUE=Object.freeze({paper:1,decision:1,minutes:0.7,attachment:0.4,other:0.4,invitation:0.1});
/** Größte Datei, die als PDF gespeichert wird; Vorlagen und Beschlüsse dürfen größer sein. */
export const MAX_BYTES=10*1048576,MAX_BYTES_PAPER=30*1048576;
// Sehr kleine Dateien zählen wie 50 KB, sonst entschiede bei ihnen allein die Größe.
const MIN_BYTES=50*1024;

/**
 * @param {{type?:string,formal?:boolean|number,scan?:boolean,eventDate?:string|null,bytes:number}} d
 * @param {Date} [now]
 * @returns {{value:number,score:number,keep:boolean}} keep:false heißt: zu groß, nur Text
 */
export function rankPdf(d,now=new Date()){
 const type=TYPE_VALUE[d.type]!=null?d.type:'other';
 let value=TYPE_VALUE[type];
 if(d.formal&&type!=='minutes')value*=0.5;
 if(d.scan)value*=1.5;
 const years=d.eventDate?(now-Date.parse(d.eventDate))/(365.25*864e5):0;
 if(years>0)value*=1+Math.min(years,5)*0.1;
 const keep=d.bytes<=((type==='paper'||type==='decision')?MAX_BYTES_PAPER:MAX_BYTES);
 return {value,score:keep?value/Math.max(d.bytes,MIN_BYTES):0,keep};
}
