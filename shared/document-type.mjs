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
 // „Nachtrag“ nur als eigenes Wort („1. Nachtrag zur Tagesordnung“), nicht „Nachtragshaushalt“ (Messung 13.10.2026)
 ['invitation',/einladung|bekanntmachung|tagesordnung|\bnachtrag\b|nachlieferung|sitzungskalender|sitzungsmappe/],
 // "anlage" only as a word of its own: "Kläranlage", "Sportanlage" in a subject are no attachments
 ['attachment',/\banlage|\banhang|präsentation|praesentation|stellungnahme|lageplan|übersicht/],
 // "Beschlussvorlage" and "Beschlussvorschlag" are papers; a decision text records what was decided.
 ['decision',/beschluss(?!vorlage|vorschlag|empfehlung)|auszug|infotext/],
 // „Sammeldokument“ ist meist die Vorlage eines Punkts samt Anlagen (gleicher Text wie die Vorlage); hängt es an vielen
 // Berichten, erkennt sessionDocument es als Unterlage der ganzen Sitzung.
 ['paper',/vorlage|antrag|anfrage|mitteilung|drucksache|beschlussvorschlag|beschlussempfehlung|bericht|sammeldokument/],
];
/** Version of the rules below; the PDF store re-reads all kinds when it changes (scripts/pdf-store/budget.mjs --backfill) */
export const DOC_TYPE_VERSION=3;
const typeOf=t=>RULES.find(([,pattern])=>pattern.test(t))?.[0]||null;
/* The first word names the document ("Beschlussvorlage …", "Anlage 3 …"); words further on usually belong to the subject
   ("… Stellungnahme der Gemeinde zum Bauvorhaben", "… Genehmigung des Protokolls"). "Vorlage (Anlage 2)" is an attachment. */
export function documentType(title){
 const t=String(title||'').toLowerCase().trim();
 if(/^\S+\s*\((anlage|anhang)\b/.test(t))return 'attachment';
 const first=t.match(/^[a-zäöüß-]+/)?.[0];
 return (first&&typeOf(first))||typeOf(t)||'other';
}
/* Kind of document read from the start of its text (letterhead and header of the first page): the earliest marker within
   HEAD_CHARS wins. Many portals give titles without the kind ("2026-188", "Ergänzung", "Dokument Fraktion"), or the title
   names the subject only. An attachment shows itself only right at the start ("Anlage 1 …"). null: no marker. */
export const HEAD_CHARS=600;
const HEAD_RULES=[
 ['attachment',/^.{0,60}?\b(anlage|anhang)\s*(nr\.?\s*)?\d/],
 ['decision',/\b(auszug aus (der|dem) (niederschrift|protokoll|sitzungsprotokoll)|beschlussauszug|auszug aus dem beschlussbuch|beschlussausfertigung|beschlussabschrift)/],
 ['minutes',/\b(niederschrift|sitzungsniederschrift|protokoll|ergebnisprotokoll|kurzprotokoll) (über|der|des|zur|vom|von)\b/],
 // Session documents only by their heading: "Tagesordnung" also stands in letters ("Antrag zur Tagesordnung")
 ['invitation',/^.{0,150}?\b(einladung (zur|zu der|zu einer)|öffentliche bekanntmachung|bekanntmachung (zur|der) sitzung)\b|^.{0,80}?\btagesordnung (für|der|zur)\b/],
 ['paper',/\b(beschlussvorlage|sitzungsvorlage|verwaltungsvorlage|informationsvorlage|mitteilungsvorlage|berichtsvorlage|vorlage der verwaltung|vorlagen?[- ]?(nr|nummer)|vorlage:? [a-z]{0,6}[-/ ]?\d+|drucksache|antrag der|antrag des|anfrage der|anfrage des|antwort (zur|auf die) anfrage|beantwortung der anfrage|stellungnahme der verwaltung)\b/],
];
export function documentTypeFromText(text){
 const head=String(text||'').slice(0,HEAD_CHARS*3).replace(/\s+/g,' ').trim().slice(0,HEAD_CHARS).toLowerCase();
 let best=null,at=Infinity;
 // Position of the marker itself (rules anchored at the start match from 0): the earliest wins
 for(const [type,pattern] of HEAD_RULES){const m=pattern.exec(head);if(!m)continue;const g=m.slice(1).find(Boolean)||m[0],i=head.indexOf(g,m.index);if(i<at){at=i;best=type;}}
 return best;
}
/* Kind used for the rank (shared/pdf-rank.mjs): the title, corrected by the start of the text. A paper by its text counts as
   a paper, whatever the title says (title without kind, attachment or session document by a subject word); a title without
   kind takes the kind of the text. Otherwise the title stands. */
export function effectiveType(titleType,textType){
 if(!textType||textType===titleType)return titleType;
 if(textType==='paper'&&titleType!=='decision')return 'paper';
 if(textType==='minutes'&&titleType==='decision')return 'minutes';
 if(titleType==='other')return textType;
 return titleType;
}
/** The one document the current pipeline reads for a report: the paper, otherwise the first PDF (see documents.mjs). */
export const primaryDocument=documents=>documents.find(d=>/vorlage/i.test(d.title))||documents.find(d=>/beschlussvorschlag|bericht/i.test(d.title))||documents[0]||null;
/* Rang der Art für das Hauptdokument: Vorlage, Antrag oder Anfrage zuerst; Beschlusstext und Titel ohne erkennbare Art gleich
   (Titel wie „FB 1-047-26“ sind oft die Vorlage selbst, dann zählt wie früher die Reihenfolge); Anlagen danach; Niederschrift
   und Einladung zuletzt und gleich (zwischen zwei Sitzungsunterlagen zu wechseln brächte nichts). Früher genügte „vorlage“
   irgendwo im Titel, so wurden „Anlage 1 zur Vorlage …“ und „Bürgerexemplar (Tagesordnung mit öffentlichen Vorlagen)“
   Hauptdokument, und ohne „vorlage“ das erste PDF, oft die Niederschrift neben einem Antrag (Messung 12.10.2026: 11.119 von
   273.688 Berichten mit mehreren PDFs bekommen ein passenderes Hauptdokument). */
const PRIMARY_RANK={paper:0,decision:1,other:1,attachment:2,minutes:3,invitation:3};
const primaryRank=d=>{const t=String(d.title||'');return PRIMARY_RANK[documentType(t)]*3+(/vorlage/i.test(t)?0:/beschlussvorschlag|bericht/i.test(t)?1:2);};
/** Das Hauptdokument eines Berichts: die beste Art nach PRIMARY_RANK, bei Gleichstand das erste. Nie eine Unterlage der ganzen
    Sitzung nach Zahl der Berichte (uses ab SESSION_DOCUMENT_USES), solange es ein anderes PDF gibt. Mit hasText: unter den
    übrigen das beste mit Text, sonst wie ohne (Vorlage ohne Text, Sammeldokument mit Text). Ohne Optionen nur nach Titel, wie
    der Abruf der Ablage (fetch.mjs) es braucht, bevor ein Text da ist.
    @param {any[]} documents @param {{uses?:(url:string)=>number,hasText?:((url:string)=>boolean)|null}} [o] */
export const primaryPdf=(documents,{uses=()=>0,hasText=null}={})=>{
 let pdfs=(documents||[]).filter(d=>d?.kind==='application/pdf');
 const own=pdfs.filter(d=>uses(d.url)<SESSION_DOCUMENT_USES);if(own.length)pdfs=own;
 if(hasText){const read=pdfs.filter(d=>hasText(d.url));if(read.length)pdfs=read;}
 let best=null,rank=Infinity;for(const d of pdfs){const r=primaryRank(d);if(r<rank){rank=r;best=d;}}return best;
};
/** Art jedes PDFs eines Berichts: wie documentType, aber hat der Bericht eine Vorlage, sind PDFs ohne erkennbare Art Anlagen
    („Lageplan“, „Begründung“, „Ergebnisplan 2026“). @param {any[]} documents @returns {Map<string,string>} url → Art */
export function reportTypes(documents){
 const pdfs=(documents||[]).filter(d=>d?.kind==='application/pdf'),types=new Map(pdfs.map(d=>[d.url,documentType(d.title)]));
 if([...types.values()].includes('paper'))for(const [u,t] of types)if(t==='other')types.set(u,'attachment');
 return types;
}
/** Ab so vielen Berichten gilt ein Dokument als Unterlage der ganzen Sitzung (Probelauf 11.10.2026). */
export const SESSION_DOCUMENT_USES=5;
/**
 * A document of the whole session rather than of one agenda item: minutes or invitation by title, or linked from
 * SESSION_DOCUMENT_USES or more reports (some systems attach the minutes or the session bundle to every item). Its rule
 * summary would describe the whole session, e.g. video surveillance at schools for "Einführung neuer Mitglieder".
 */
export const sessionDocument=(doc,uses=0)=>['minutes','invitation'].includes(documentType(doc?.title))||uses>=SESSION_DOCUMENT_USES;
