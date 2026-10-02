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
