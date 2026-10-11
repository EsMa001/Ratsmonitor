/**
 * Kind of an official document, read from its title. Used to measure which share of the text volume belongs to
 * the paper itself and which to attachments, minutes and invitations. Order matters: the first match wins.
 */
export const DOCUMENT_TYPES=Object.freeze({
 paper:'Vorlage, Antrag, Anfrage',
 decision:'Beschlusstext, Auszug',
 attachment:'Anlage',
 minutes:'Niederschrift, Protokoll',
 invitation:'Einladung, Bekanntmachung, Sitzungsmappe',
 other:'Sonstiges (Titel ohne erkennbare Art, meist Anlagen)',
});
const RULES=[
 ['minutes',/niederschrift|protokoll/],
 ['invitation',/einladung|bekanntmachung|tagesordnung|nachtrag|nachlieferung|sitzungskalender|sammeldokument/],
 ['attachment',/anlage|anhang|präsentation|praesentation|stellungnahme|lageplan|übersicht/],
 // "Beschlussvorlage" and "Beschlussvorschlag" are papers; a decision text records what was decided.
 ['decision',/beschluss(?!vorlage|vorschlag|empfehlung)|auszug|infotext/],
 ['paper',/vorlage|antrag|anfrage|mitteilung|drucksache|beschlussvorschlag|beschlussempfehlung|bericht/],
];
export function documentType(title){
 const t=String(title||'').toLowerCase();
 return RULES.find(([,pattern])=>pattern.test(t))?.[0]||'other';
}
/** The one document the current pipeline reads for a report: the paper, otherwise the first PDF (see documents.mjs). */
export const primaryDocument=documents=>documents.find(d=>/vorlage/i.test(d.title))||documents.find(d=>/beschlussvorschlag|bericht/i.test(d.title))||documents[0]||null;
/** The PDF the import reads for a summary (enrichDocument) and the local PDF store keeps (scripts/pdf-store/fetch.mjs). */
export const primaryPdf=documents=>{const pdfs=(documents||[]).filter(d=>d.kind==='application/pdf');return pdfs.find(d=>/vorlage/i.test(d.title))||pdfs.find(d=>/beschlussvorschlag|bericht/i.test(d.title))||pdfs[0]||null;};
/** Ab so vielen Berichten gilt ein Dokument als Unterlage der ganzen Sitzung (Probelauf 11.10.2026). */
export const SESSION_DOCUMENT_USES=5;
/**
 * A document of the whole session rather than of one agenda item: minutes or invitation by title, or linked from
 * SESSION_DOCUMENT_USES or more reports (some systems attach the minutes or the session bundle to every item). Its rule
 * summary would describe the whole session, e.g. video surveillance at schools for "Einführung neuer Mitglieder".
 */
export const sessionDocument=(doc,uses=0)=>['minutes','invitation'].includes(documentType(doc?.title))||uses>=SESSION_DOCUMENT_USES;
