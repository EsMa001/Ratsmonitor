import {decode} from './sessionnet.mjs';
// Text of a town's own website and of the PDF files it publishes (invitations, announcements, minutes, Amtsblatt),
// split into meetings with the items of their public part. Pure functions without network; the reader in website.mjs
// fetches, these only read.
// - An item is taken only where the text shows that it stands in the public part: a heading of the public part, a
//   sentence of the head such as "findet eine öffentliche Sitzung … statt", a title naming the public session, or the
//   mark "Ö" of the items. Without such evidence nothing is taken and the meeting is unclear. A heading of the
//   non-public part, or an item marked N/NÖ, ends the public part for the rest of the meeting.
// - Towns write by hand: numbers, offices ("1. Bürgermeister"), times ("19.00 Uhr"), dates and vote counts look alike.
//   Where a line is not clearly an item it is not one.
const MORE={bdquo:'„',ldquo:'“',rdquo:'”',lsquo:'‘',rsquo:'’',sbquo:'‚',laquo:'«',raquo:'»',shy:'',hellip:'…',sect:'§',euro:'€',minus:'−',ndash:'–',mdash:'—',thinsp:' ',ensp:' ',emsp:' ',zwnj:'',zwj:'',middot:'·',bull:'•',deg:'°',eacute:'é',egrave:'è',aacute:'á',agrave:'à',ccedil:'ç',
 ZeroWidthSpace:'',NegativeThinSpace:'',NegativeMediumSpace:'',NegativeThickSpace:'',NegativeVeryThinSpace:'',NoBreak:'',NonBreakingSpace:' ',hyphen:'-',dash:'-',ast:'*',midast:'*',quest:'?',lpar:'(',rpar:')',colon:':',comma:',',period:'.',sol:'/',num:'#',excl:'!'};
// Entities are decoded until nothing changes: CMS exports escape an escaped text again ("Nicht&amp;ouml;ffentlich").
const decodeOnce=s=>decode(String(s).replace(/&([a-z]+);/gi,(m,k)=>MORE[k]??m));
/** Text with its HTML entities decoded, also entities escaped once or twice more. */
export function decodeEntities(s){let t=String(s??'');for(let k=0;k<5&&/&(?:#x?[0-9a-f]+|[a-z]+);/i.test(t);k++){const n=decodeOnce(t);if(n===t)break;t=n;}return t;}
const entities=decodeEntities;
// UTF-8 read as Windows-1252 or Latin-1 ("NichtÃ¶ffentlich"): the bytes of each run are read again as UTF-8.
const CP1252={0x20ac:0x80,0x201a:0x82,0x0192:0x83,0x201e:0x84,0x2026:0x85,0x2020:0x86,0x2021:0x87,0x02c6:0x88,0x2030:0x89,0x0160:0x8a,0x2039:0x8b,0x0152:0x8c,0x017d:0x8e,0x2018:0x91,0x2019:0x92,0x201c:0x93,0x201d:0x94,0x2022:0x95,0x2013:0x96,0x2014:0x97,0x02dc:0x98,0x2122:0x99,0x0161:0x9a,0x203a:0x9b,0x0153:0x9c,0x017e:0x9e,0x0178:0x9f};
const CONT='[\\u0080-\\u00bf\\u0152\\u0153\\u0160\\u0161\\u0178\\u017d\\u017e\\u0192\\u02c6\\u02dc\\u2013\\u2014\\u2018-\\u201a\\u201c-\\u201e\\u2020-\\u2022\\u2026\\u2030\\u2039\\u203a\\u20ac\\u2122]';
const MOJIBAKE=new RegExp(`[\\u00c2-\\u00df]${CONT}|[\\u00e0-\\u00ef]${CONT}{2}|[\\u00f0-\\u00f4]${CONT}{3}`,'g');
const UTF8=new TextDecoder('utf-8',{fatal:true});
/** Text with UTF-8 sequences that were read as Windows-1252/Latin-1 put right (also when that happened twice). */
export function repairMojibake(s){
 let t=String(s??'');
 for(let k=0;k<3&&/[Â-ô]/.test(t);k++){
  const n=t.replace(MOJIBAKE,m=>{const bytes=[...m].map(c=>{const p=c.codePointAt(0);return p<256?p:CP1252[p];});try{return UTF8.decode(Uint8Array.from(bytes));}catch{return m;}});
  if(n===t)break;t=n;
 }
 return t;
}
/** Words that make a page, link or document worth reading for meetings. */
export const SESSION_WORDS=/Sitzung|Tagesordnung|Einladung|Bekanntmachung[^.]{0,80}Sitzung|Niederschrift|Protokoll|Sitzungsbericht|Beschlüsse|Beschlussübersicht|Gemeinderat|Stadtrat|Marktgemeinderat|Marktrat|Ausschuss|Ratssitzung|Stadtverordnetenversammlung|Gemeindevertretung|Stadtvertretung|Ortschaftsrat|Ortsrat|Ortsbeirat|Kreistag/i;
/** Link texts, titles and addresses of the non-public part; such documents are not read. */
// Also the short forms "nö", "(NÖ)", "N.Ö.", "…_noe_…" and "nichtoeff-…" of labels and file names.
export const NONPUBLIC_WORDS=/nicht(?:[\s_.-]|%20|%2D)*(?:ö|oe|o|%C3%B6)ffentl|nicht(?:[\s_.-]|%20|%2D)*(?:ö|oe|%C3%B6)ff(?!\p{L})|vertraulich|geschlossene[rn]?[\s_-]+(?:Sitzung|Teil)|Ausschlu(?:ss|ß)[\s_-]+der[\s_-]+(?:Ö|Oe)ffentlichkeit|(?<![\p{L}\p{N}])(?:N\.?\s?Ö\.?|NOE)(?!\p{L})/iu;
/** Umlauts as one character: pdf.js and some editors write "ö" as "o" with a combining (U+0308) or spacing (U+00A8) diaeresis. */
export const composeUmlauts=s=>String(s??'').replace(/¨\s?([AOUaou])/g,'$1̈').replace(/([AOUaou])¨/g,'$1̈').normalize('NFC');

// --- mentions of the non-public part ---------------------------------------------------------------------------------
// Lines that report on the non-public part from the public one: "Bekanntgabe von Beschlüssen aus nichtöffentlicher
// Sitzung", "die in nichtöffentlicher Sitzung gefassten Beschlüsse". Only these past reports; "Bericht … in
// nichtöffentlicher Sitzung" or "Information zu TOP 3: Beratung in nichtöffentlicher Sitzung" name the part itself.
const NP_ADJ='nicht\\s*-?\\s*öffentlich';
const PUBLIC_REPORT=new RegExp(`(?:Bekanntgabe|Bekanntgaben|Mitteilung|Mitteilungen|Information|Informationen|Unterrichtung|Bericht|Berichte)\\s[^.:;]{0,100}?(?<!\\p{L})aus\\s+(?:der\\s+|einer\\s+|den\\s+|dem\\s+)?(?:\\p{L}+\\s+){0,2}${NP_ADJ}(?:e[rnms]?)?\\s+(?:Sitzung(?:en)?|Beratung(?:en)?|Teil|Sitzungsteil)(?!\\p{L})|(?:in|aus)\\s+(?:der\\s+|den\\s+)?(?:\\p{L}+\\s+)?${NP_ADJ}e[rnm]?\\s+Sitzung(?:en)?\\s+(?:\\p{L}+\\s+){0,3}gefasste[n]?\\s+Beschl\\p{L}*|${NP_ADJ}\\s+gefasste[rn]?\\s+Beschl\\p{L}*`,'giu');
const isPublicReport=s=>new RegExp(PUBLIC_REPORT.source,'iu').test(s);
// The text compared without case and umlauts; a lost character (U+FFFD) stands for any letter.
const foldText=s=>s.toLowerCase().replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss').replace(/�/g,'#');
// The public excluded, in any word order and distance within the sentence ("Die Öffentlichkeit soll bei TOP 4 ausgeschlossen
// werden", "beabsichtigt, die Öffentlichkeit für TOP 4 auszuschließen", "unter Ausschl. d. Öff."); the end of the public
// part ("Ende der öffentlichen Sitzung", "Ende öffentliche Sitzung: 20:15 Uhr", "schließt den öffentlichen Teil", "Der
// öffentliche Teil der Sitzung wurde um 20:15 Uhr geschlossen"); listeners and press leave ("Die Zuhörer verlassen den
// Saal", "ohne Zuhörer fortgesetzt"). All on folded text (see foldText).
// Also "unter Ausschluss von Presse und Öffentlichkeit", "der Zuhörer", "(unter Ausschluss d. Ö.)", "(Ausschluss Öff.)", "(o. Öff.)",
// "Die Öffentlichkeit ist nicht zugelassen", a column "Öffentlichkeit: ausgeschl.".
const AUDIENCE='(?:oeffentlichkeit|oeff\\b|oe\\b|zuhoerer\\w*|zuhoerenden|presse|publikum|besucher\\w*|gaeste|einwohner\\w*|buerger\\w*)';
// Also listeners, guests or the press not admitted ("Besucher sind zu den folgenden Punkten nicht zugelassen", "Presse und Zuhörer
// sind ausgeschlossen", "zu dem Zuhörer keinen Zutritt hatten", "mussten die Zuhörer draußen bleiben"), "schließt die Öffentlichkeit
// … aus", "(u. A. d. Ö.)", "wurde unter sich weiterberaten".
const LISTENERS='(?:oeffentlichkeit|zuhoerer\\w*|zuhoerenden|presse|publikum|besucher(?:innen|n)?|gaeste[n]?|gaestinnen)';
const EXCLUDED_F=new RegExp(`\\b${LISTENERS}\\b[^.;]{0,80}?\\b(?:ausgeschlossen|ausgeschl\\b|nicht\\s+(?:zugelassen|gestattet|erlaubt|zulaessig|anwesend|teilnahmeberechtigt|zugegen)|keinen?\\s+(?:zutritt|zugang|einlass)|draussen\\s+bleiben|nicht\\s+(?:teilnehmen|beiwohnen))|\\bkeinen?\\s+(?:zutritt|zugang|einlass)\\b[^.;]{0,40}?\\b${LISTENERS}\\b|\\bkeine\\s+${LISTENERS}\\s+(?:zugelassen|erlaubt|gestattet|erwuenscht)|\\b(?:schliesst|schloss|schliessen|schlossen)\\b[^.;]{0,80}?\\b${LISTENERS}\\b[^.;]{0,80}?\\baus\\b|\\bu\\.\\s*a\\.\\s*d\\.\\s*oe\\b|\\bunter\\s+sich\\b[^.;]{0,40}?\\b(?:weiter)?(?:berat|beriet|besproch|verhandel)|ausschlu(?:ss|s)\\s+der\\s+oeffentlichkeit|ausschl(?:uss|\\.)?\\s*(?:der|d\\.?)\\s*oeff|ausschl\\w*\\.?\\s+(?:von\\s+|der\\s+|des\\s+|d\\.\\s*)?(?:${AUDIENCE}\\s+(?:und|u\\.|sowie)\\s+(?:der\\s+|des\\s+)?)?${AUDIENCE}|oeffentlichkeit\\b[^.;]{0,120}?\\b(?:ausgeschlossen|ausgeschl\\b|auszuschliessen|ausschliessen|ausschliesst|ausschloss)|\\b(?:ausgeschlossen|auszuschliessen|ausschliessen)\\b[^.;]{0,40}?\\boeffentlichkeit|ohne\\s+oeffentlichkeit|nicht\\s+fuer\\s+die\\s+oeffentlichkeit|oeffentlichkeit\\b[^.;]{0,60}?\\bnicht\\s+(?:zugelassen|gestattet|erlaubt|zulaessig|vorgesehen|gegeben)|\\bo\\.\\s*oeff|\\bohne\\s+oeff\\.`);
// Also "Ende der Sitzung (öffentlicher Teil): 20:15 Uhr", "Öffentliche Sitzung Ende: 20:15 Uhr", "Ende ÖT 20:15 Uhr", "Öffentlicher Sitzungsteil:
// 19:00 Uhr bis 20:15 Uhr", "Im Anschluss an den öffentlichen Teil wurde weiter beraten".
const END_PUBLIC_F=/\bende\b[^.;]{0,30}?\(\s*oeffentliche[rn]?\s+(?:teil|sitzung|sitzungsteil)|\boeffentliche[rn]?\s+(?:teil|sitzung|sitzungsteil)\w*\s*[:(,–-]?\s*(?:ende|beendet|geschlossen)\b|\bende\s+(?:des\s+|der\s+)?oe-?t\b|\boeffentliche[rn]?\s+(?:teil|sitzungsteil|sitzung)\s*:?\s*(?:von\s+)?\d{1,2}[:.]\d{2}\s*(?:uhr\s*)?(?:bis|–|-)\s*\d|(?:im\s+anschluss\s+an|nach)\s+(?:den|dem|die|der)\s+oeffentlichen?\s+(?:teil|sitzungsteil|sitzung|beratung)|(?:schluss|ende|abschluss|beendigung)\s+(?:der\s+|des\s+)?oeffentlichen?\s+(?:sitzung|teil|sitzungsteil|beratung|tagesordnung)|\b(?:schliesst|schloss|schliessen|beendet|beendete|beenden|endet|endete|geschlossen)\b[^.;]{0,80}?\b(?:den|die|der)\s+oeffentlichen?\s+(?:teil|sitzung|sitzungsteil|sitzungsabschnitt|beratung)|\b(?:der|die)\s+oeffentliche[rn]?\s+(?:teil|sitzung|sitzungsteil|sitzungsabschnitt)\b[^.;]{0,80}?\b(?:endet|endete|beendet|beendete|geschlossen|schliesst|schloss|zu\s+ende)\b/;
// Also "Die Zuhörer mussten den Saal räumen", "wurden hinausgebeten", "ohne Publikum".
const LEAVE_F=/\b(?:zuhoerer\w*|zuhoerenden|besucher\w*|gaeste|presse\w*|oeffentlichkeit|publikum)\b[^.;]{0,80}?\b(?:verlassen|verlaesst|verliessen|verliess|raeumen|raeumten|raeumte|geraeumt|hinausgebeten|hinaus|gehen)\b|\b(?:saal|sitzungssaal|raum|sitzungsraum)\b[^.;]{0,40}?\b(?:raeumen|raeumten|raeumte|geraeumt)\b|\bhinausgebeten\b|\bohne\s+(?:die\s+)?(?:beteiligung|anwesenheit|teilnahme|zulassung|zutritt|zugang)\s+(?:der\s+|des\s+|von\s+)?(?:oeffentlichkeit|zuhoerer\w*|presse|gaeste|besucher\w*|publikum)\b|\bohne\s+(?:die\s+)?(?:zuhoerer\w*|oeffentlichkeit|presse|gaeste|besucher\w*|publikum|buerger(?:innen|n)?|einwohner(?:innen|n)?|zuschauer\w*)\b/;
const NP_SPACED=[
 // nichtöffentlich, nicht-öffentl., nichtöff., nichtöfftl., nichtöfentlich, nicht?ffentlich, nichtoef
 /nicht[\s\-_./–]{0,3}(?:oe|o|e|ae|#|\?)?f{1,2}(?:entl|enl|etl|tl|l(?![a-z])|\.|(?![a-z]))/,
 // nö, NÖ, N.Ö., n.öff., nöff., NÖS, n-oe, noeS
 // nö, NÖ, N.Ö., n.öff., nöff., NÖS, NÖT (nichtöffentlicher Teil), n-oe, noeS, NOeT
 /(?<![a-z0-9])n[\s.\-_/]{0,2}oe(?:[\s.\-_]{0,2}f{1,2}(?:entl[a-z]*|tl)?\.?(?![a-z])|[\s.\-_]?[st](?![a-z])|(?![a-z]))/,
 // nichtö., nicht ö.
 /nicht[\s\-]{0,2}oe(?![a-z])/,
 /vertraul|\(vertr\.?\)/,
 /geschlossene[nrms]?\s+(?:sitzung|teil|sitzungsteil|beratung|runde|gesellschaft|kreis)|geschl\.\s*(?:sitzung|teil)/,
 // "N-Sitzung", "N-Teil" (the closed session of an agenda in parts Ö/N), "Unöffentliche Sitzung", a closed meeting ("Klausur").
 /(?<![a-z0-9])n\s*-\s*(?:sitzung|teil|sitzungsteil)\b|\bunoeffentlich|\bklausur/,
 EXCLUDED_F,
 END_PUBLIC_F,
 LEAVE_F,
 // a meeting expressly not public ("keine öffentliche Sitzung", "nicht in öffentlicher Sitzung"), a field "Öffentlich: nein"
 /\b(?:kein|keine|keiner|keinen|nicht\s+in)\s+oeffentliche[rnms]?\s+(?:\w*sitzung|beratung|teil|tagung)/,
 /\boeffentlich\w*(?:\s+(?:sitzung|beratung|teil|sitzungsteil))?\s*[:?]?\s*(?:nein|no)\b/,
 /(?<![a-z])interne[rnms]?\s+(?:beratung|sitzung|teil|sitzungsteil|angelegenheit)|\(intern\)|\bintern\s+(?:beraten|behandelt|besprochen|fortgesetzt|weitergefuehrt|weiterberaten|diskutiert|eroertert|verhandelt)\b|(?:^|\s)intern\s*$/,
 // "Geheime Sitzung", "(geheim)" (not a secret ballot, not a secrecy that has ended), "hinter verschlossenen Türen",
 // "Nur für Ratsmitglieder", "(geschlossen)".
 /\bgeheim(?!e?[rnms]?\s+(?:wahl|abstimmung|stimmabgabe)|haltung\w*\s+(?:\w+\s+){0,3}(?:weggefallen|entfallen|aufgehoben))/,
 /hinter\s+(?:geschlossenen|verschlossenen)\s+tuer/,
 /\bnur\s+(?:fuer\s+)?(?:die\s+)?(?:\w*mitglieder|gemeinderaete|stadtraete|marktgemeinderaete|\w*raete|mandatstraeger\w*|mandatsinhaber\w*)\b/,
 // A status "privat" as a word of its own.
 /^\s*\(?privat\)?\s*$|\(privat\)/,
 /\(\s*geschlossene?[rnms]?\s*\)|^\s*geschlossen\s*$|\(\s*geschl\.?\s*\)/,
 // The secrecy that binds the members on the matters of the non-public part ("unterliegt der Verschwiegenheitspflicht").
 /verschwiegenheit/,
 // In other words of a report: "Danach blieb der Rat unter sich", "tagte intern weiter", "nicht vor Publikum", "im kleinen Kreis".
 /\bunter\s+sich\b|\bim\s+(?:kleinen|kleineren|engsten|engeren)\s+kreis\b/,
 /\b(?:tagt\w*|beriet\w*|berat\w*|weiter\w*|fortgesetzt|fort)\b[^.;]{0,30}\bintern\b|\bintern\b[^.;]{0,30}\b(?:weiter\w*|fort\w*|getagt|beraten)\b/,
 /\bnicht\s+vor\s+(?:publikum|zuhoerer\w*|zuschauer\w*|oeffentlichkeit|presse|gaeste\w*|besucher\w*|buerger\w*|einwohner\w*)/,
];
// The paragraph of a municipal code that excludes the public (§ 35 GemO, Art. 52 GO, § 52 HGO, § 40 ThürKO, § 29 KV M-V,
// § 48 GO NRW, § 64 NKomVG, § 40 KSVG, § 37 SächsGemO, § 52 KVG LSA, § 35 GO SH, § 36 BbgKVerf): an item that cites it
// is read as one of the non-public part.
// Also a paragraph of the rules of procedure (GeschO), which lists the matters of the non-public part, and a Roman paragraph
// ("Art. 52 II GO", "§ 35 I GemO").
const RULES_NP=/(?:§|Paragraph|Art\.?|Artikel)\s*\d+[^()]{0,30}?(?:GeschO|Geschäftsordnung|GO\s*-?\s*GR|GeschOGR|GOGR)(?!\p{L})/u;
// Also a paragraph written "(1)" or with Roman number and sentence ("§ 35 (1) GemO", "§ 35 I 2 GemO"), and the codes of counties and
// districts (Art. 46 LKrO, § 30 LKrO, § 33 KrO NRW, § 32 HKO, § 33 SächsLKrO, § 28 LKO, Art. 41 BezO).
const LAW_REF='(?:\\s*(?:(?:Abs\\.?|Absatz)\\s*(?:\\d+|[IVX]{1,4})|\\(\\d{1,2}\\)|[IVX]{1,4}(?=[\\s,)])|(?:Satz|S\\.|Nr\\.?|Ziff\\.?)\\s*\\d+|\\d{1,2}(?=\\s)))*\\s*(?:der\\s+|des\\s+)?';
// The code also with the Land written before it, short or in full ("Sächs. GemO", "Bbg. KVerf", "Bayerische Gemeindeordnung", "der
// Sächsischen Gemeindeordnung", "Thüringer Kommunalordnung", "Kommunalverfassungsgesetz").
const LAW_LAND='(?:(?:Sächs|Bay|Bbg|Brandenb|Thür|Hess|Nds|Nieders|Meckl|Saarl|Schl|Rh)\\p{L}{0,14}\\.?\\s*-?\\s*|\\p{Lu}\\p{Ll}+(?:ische[nrs]?|er)\\s+)?';
const LAW_MUNICIPAL='(?:GemO|GO(?:\\s*(?:NRW|SH|BW))?|HGO|KO|KV(?:\\s*M-?V)?|KVMV|KVerf|NKomVG|KSVG|KVG(?:\\s*LSA)?|SächsGemO|BbgKVerf|BayGO|ThürKO|Gemeindeordnung|Kommunalordnung|Kommunalverfassung(?:sgesetz)?|Kommunalselbstverwaltungsgesetz)';
const LAW_COUNTY='(?:LKrO|KrO(?:\\s*NRW)?|HKO|SächsLKrO|BezO|LKO|NKomVG|ThürKO|BbgKVerf|KVerf|Landkreisordnung|Kreisordnung|Bezirksordnung)';
const LAW_NP=new RegExp(`(?:§§?|Paragraph|Art\\.?|Artikel)\\s*(?:(?:35|52|40|29|48|64|37|36)${LAW_REF}${LAW_LAND}${LAW_MUNICIPAL}|(?:28|30|32|33|41|46|64|40|36)${LAW_REF}${LAW_LAND}${LAW_COUNTY})(?![\\p{L}])`,'u');
// Hyphenated, letter-spaced or split words read without anything but letters.
// Also words read by OCR or without the ligature "ff" ("Nichtöffentiiche", "Nichtöentliche").
const NP_COMPACT=/nicht(?:oe|o|e|ae|#)?ff?entl|nicht(?:oe|o|e|ae|#)?f{0,2}ent[il]{1,2}ch|unterausschlu(?:ss|s)deroeffentlichkeit|geschlossene(?:sitzung|rteil|nteil)|vertraulich/;
// Typing errors of "nichtöffentlich" that no pattern foresees ("Nichöffentliche", "Nichtöfffentliche", "Nichtöffetnliche", "Nciht
// öffentliche", "Nichttöffentliche"): a word that begins like it is at most two edits (optimal string alignment) from it.
function editDistance(a,b,max){
 if(Math.abs(a.length-b.length)>max)return max+1;
 let prev2=null,prev=Array.from({length:b.length+1},(x,j)=>j);
 for(let i=1;i<=a.length;i++){
  const row=[i];let low=i;
  for(let j=1;j<=b.length;j++){
   let v=Math.min(prev[j]+1,row[j-1]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));
   if(prev2&&i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])v=Math.min(v,prev2[j-2]+1);
   row.push(v);low=Math.min(low,v);
  }
  if(low>max)return max+1;prev2=prev;prev=row;
 }
 return prev[b.length];
}
const NP_WORD='nichtoeffentlich';
const typoNonPublic=folded=>{
 const words=folded.split(/[^a-z#]+/).filter(Boolean);
 for(let i=0;i<words.length;i++){
  const w=words[i],candidates=[w];
  // "Nciht öffentliche": a first word close to "nicht" with the next one.
  if(w.length>=4&&w.length<=6&&words[i+1]&&editDistance(w,'nicht',1)<=1)candidates.push(w+words[i+1]);
  for(const c of candidates){
   if(c[0]!=='n'||c.length<13)continue;
   for(let l=13;l<=Math.min(18,c.length);l++)if(editDistance(c.slice(0,l),NP_WORD,2)<=2)return true;
  }
 }
 return false;
};
/** Whether a line names the non-public part in any spelling (reports on it from the public part excepted). */
export function mentionsNonPublic(s){
 const n=normalizeLine(s),t=foldText(n.replace(PUBLIC_REPORT,' '));
 return NP_SPACED.some(re=>re.test(t))||NP_COMPACT.test(t.replace(/[^a-z#]/g,''))||LAW_NP.test(n)||RULES_NP.test(n)||typoNonPublic(t);
}
// Labels and addresses only: "Teil N", "(intern)", "interner Teil", a folder or name part "geschlossen".
// Also "(geschl.)", "geheim" and a name part "np" (gr-2026-09-16-np.pdf).
const LABEL_ONLY=/(?<![a-z0-9])(?:teil[\s\-_]*n|geschlossen(?:e[rns]?)?|geschl\.?|geheim|np|interna?)(?![a-z0-9])|\(intern\)|(?<![a-z0-9])interne[rns]?[\s\-_]+(?:teil|sitzung|sitzungsteil|beratung)/;
const latinPercent=s=>s.replace(/%([0-9a-f]{2})/gi,(m,h)=>String.fromCharCode(parseInt(h,16)));
const safeDecode=s=>{try{return decodeURIComponent(s);}catch{return s;}};
/** Whether a label, title, address or line names the non-public part (in any Unicode form, encoding or spelling). */
export const isNonPublicText=s=>{
 const raw=String(s??'');
 return [raw,safeDecode(raw),latinPercent(raw)].some(f=>{const t=composeUmlauts(repairMojibake(decodeEntities(f)));return NONPUBLIC_WORDS.test(t)||mentionsNonPublic(t)||LABEL_ONLY.test(foldText(t));});
};

/** One line as a person reads it: entities and mojibake undone, spaced letters joined, dashes, quotes and spaces made uniform. */
export function normalizeLine(line){
 let s=String(line??'');
 if(/&(?:#x?[0-9a-f]+|[a-z]+);/i.test(s))s=decodeEntities(s);
 // Full-width letters of an IME or a converter ("ＮＩＣＨＴÖＦＦＥＮＴＬＩＣＨ") are the letters themselves.
 s=composeUmlauts(repairMojibake(s)).replace(/[\uff01-\uff5e]/g,c=>String.fromCharCode(c.charCodeAt(0)-0xfee0)).replace(/[  -   　\t]/g,' ').replace(/[­​-‍⁠﻿]/g,'');
 s=s.replace(/[‐‑]/g,'-').replace(/[‒-―−⸺⸻﹘﹣－]/g,'–').replace(/[„“”‟″«»＂]/g,'"').replace(/[‚‘’‛′`´]/g,"'");
 // Letter-spaced headings ("T a g e s o r d n u n g"): single letters with single spaces form one word; the words of
 // such a heading are set apart by two or more spaces, which stay a word break.
 s=s.replace(/(?<![\p{L}\p{N}])\p{L}(?: \p{L}){2,}(?![\p{L}\p{N}])/gu,m=>m.replace(/ /g,''));
 // A part's key glued to its noun ("TeilB" of a calendar folded by wordwrap or a PDF without the space) is "Teil B".
 s=s.replace(/(?<!\p{L})(Teil|Sitzungsteil|Abschnitt)([A-H]|I{1,3}|IV|VI{0,3}|[1-9])(?![\p{L}\d])/gu,'$1 $2');
 // "Nicht – öffentlicher Teil" (a dash set by a word processor) is "Nicht-öffentlicher Teil".
 s=s.replace(/(?<!\p{L})(nicht)\s*[–-]\s*(?=[öÖ])/giu,'$1-');
 return s.replace(/\s+/g,' ').trim();
}
// The element that starts at start, up to its matching end tag (nested elements of the same name are counted).
function element(html,start,tag){
 const re=new RegExp(`<(/?)${tag}\\b[^>]*>`,'gi');re.lastIndex=start;let depth=0,m;
 while((m=re.exec(html))){if(m[1]){if(--depth<=0)return html.slice(start,m.index+m[0].length);}else if(!m[0].endsWith('/>'))depth++;}
 return html.slice(start);
}
// Removes elements of these names with their content, innermost first, so that nesting does not cut one short.
function strip(html,names){
 const re=new RegExp(`<(${names})\\b[^>]*>(?:(?!<\\1\\b)[\\s\\S])*?</\\1\\s*>`,'gi');let before;
 do{before=html;html=html.replace(re,' ');}while(html!==before);
 return html.replace(new RegExp(`<(?:${names})\\b[^>]*/>`,'gi'),' ');
}
const BLOCK='p|div|li|ul|ol|tr|table|thead|tbody|tfoot|h[1-6]|dt|dd|dl|section|article|header|footer|main|aside|nav|blockquote|pre|hr|figure|figcaption|address|details|summary|caption|center|fieldset|legend|option|body|html';
const INLINE='span|a|b|strong|em|i|u|s|small|big|sup|sub|abbr|acronym|mark|font|time|del|ins|q|cite|dfn|var|bdi|bdo|wbr';
// Frame elements are left out unless they name the non-public part: a tab bar in <nav> may hold the heading of a part.
function stripFrame(html,names){
 const re=new RegExp(`<(${names})\\b[^>]*>((?:(?!<\\1\\b)[\\s\\S])*?)</\\1\\s*>`,'gi');let before;
 do{before=html;html=html.replace(re,(m,tag,inner)=>mentionsNonPublic(entities(inner.replace(/<[^>]+>/g,' ')))?`<div>${inner}</div>`:' ');}while(html!==before);
 return html;
}
// Text of markup that is not just links, navigation, forms or scripts (a skip link before the page header is no content).
const plainText=x=>x.replace(/<(script|style|nav|aside|form|noscript|a|button)\b[\s\S]*?<\/\1\s*>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/g,' ').trim();
// The frame of a page: a header before any text of the body, a footer after all of it. Inside an article or section, or
// between texts, a header or footer is content (the head of a part); one that names the non-public part always is.
function stripPageFrame(html){
 let h=html;
 const found=[...h.matchAll(/<(header|footer)\b[^>]*>/gi)].map(m=>({at:m.index,tag:m[1].toLowerCase()})).reverse();
 for(const f of found){
  const whole=element(h,f.at,f.tag),before=h.slice(0,f.at),after=h.slice(f.at+whole.length);
  const open=(before.match(/<(?:article|section)\b/gi)||[]).length-(before.match(/<\/(?:article|section)\s*>/gi)||[]).length;
  const keep=open>0||mentionsNonPublic(entities(whole.replace(/<[^>]+>/g,' ')))||!!plainText(f.tag==='header'?before:after);
  h=before+(keep?`<div>${whole.replace(/^<[^>]*>/,'').replace(/<\/(?:header|footer)\s*>$/i,'')}</div>`:' ')+after;
 }
 return h;
}
const attrOf=(attrs,name)=>{const m=String(attrs).match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`,'i'));return m?(m[1]??m[2]??m[3]).trim():'';};
const altText=attrs=>['alt','title','aria-label','data-title','data-tooltip','data-original-title'].map(n=>attrOf(attrs,n)).find(Boolean)||'';
// Words of an element's class, id and data attributes and of an image's file name, camelCase and umlauts written out
// ("topNichtOeffentlich" → "top-nicht-oeffentlich", "status-nö" → "status-noe", data-status="nichtoeffentlich").
const attrWords=attrs=>{const values=[...String(attrs).matchAll(/(?:^|\s)(class|id|data-[\w-]+|aria-(?:labelledby|controls|describedby))\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/gi)].map(m=>m[2]??m[3]??m[4]??'');values.push(safeDecode(attrOf(attrs,'src').split('?')[0].split('/').pop()||''));return values.join(' ').replace(/([a-zäöü])([A-ZÄÖÜ])/g,'$1-$2').toLowerCase().replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss').replace(/[_+]|%20/g,'-');};
// Words that name the non-public part on any element; words of a symbol only on an element without text (an icon).
const NP_ATTR=/(?:^|[^a-z])(?:nicht-?oe?ff\w*|noeff\w*|non-?public|not-?public|nicht-?oeffentlich\w*|vertraulich\w*|confidential|geheim|secret|n-?oe(?:t|s)?|np)(?:$|[^a-z])/;
const NP_SYMBOL=/(?:^|[^a-z])(?:lock|locked|schloss|key|eye-(?:off|slash)|visibility-off|private?|closed|geschlossen|restricted|n)(?:$|[^a-z])/;
const npClass=attrs=>{const c=attrOf(attrs,'class').toLowerCase();return /eye-slash|non-public|nicht-oeffentlich|nicht-öffentlich|not-public/.test(c)||c.split(/[\s_-]+/).some(p=>NP_CLASS_PARTS.has(p))||NP_ATTR.test(attrWords(attrs));};
// An image without text whose file is such an icon ("/Icons/schloss.svg", "lock_closed.gif").
const npSource=attrs=>/(?:^|[/_.-])(?:lock|locked|schloss|nichtoeffentlich|nicht-oeffentlich|nonpublic|noe|np|vertraulich|eye-slash)(?=[/_.-]|$)/i.test(attrOf(attrs,'src').split('?')[0].split('/').pop()||'');
const NP_CLASS_PARTS=new Set(['np','noe','noet','nichtoeffentlich','nichtöffentlich','nichtoeff','nonpublic','vertraulich','lock','locked','schloss','geschlossen']);
// Symbols whose meaning is plain: a file, a link, an arrow, a decoration; the mark of the public part.
const PLAIN_SYMBOL=/(?:^|[^a-z])(?:pdf|docx?|xlsx?|odt|download|file|datei|dokument|document|attachment|paperclip|print|drucken|mail|email|envelope|calendar|kalender|ical|ics|rss|feed|external|extern|link|arrow|pfeil|chevron|angle|caret|plus|minus|search|lupe|home|phone|telefon|map|karte|marker|location|clock|uhr|time|info|share|facebook|twitter|instagram|youtube|xing|linkedin|whatsapp|spacer|blank|pixel|transparent|logo|wappen|bullet|dot|line|trenner|oeffentlich|public|photo|foto|bild|image|thumb\w*|teaser\w*)(?:$|[^a-z])/;
// Also an empty cell or badge of a status column drawn by a style ("status status-2", "badge", "flag", "ampel").
const ICONISH=/(?:^|[\s_-])(?:fa[srlbdt]?|fa-solid|fa-regular|mdi|icon|icons|ico|glyphicon|bi|dashicons|ion|ionicons|las|lar|lab|feather|ti|uk-icon|svg-icon|material-icons\S*|material-symbols\S*|symbol|status|state|badge|flag|indicator|kennzeichen|kennzeichnung|ampel|zugang|access|visibility|sichtbarkeit)(?:$|[\s_-])/i;
/** The character that stands for a symbol whose meaning the page does not tell (an icon without text in a column). */
export const SYMBOL='￼';
// An icon without text whose class or file is a lock or names the non-public part marks an item as a word would; any other
// symbol of unknown meaning stands as SYMBOL, which the parser treats as a mark of unknown meaning (rule 4).
const iconText=(attrs,symbol=true)=>{const t=altText(attrs);if(t)return t;if(npClass(attrs)||npSource(attrs)||NP_SYMBOL.test(attrWords(attrs)))return '(nichtöffentlich)';return symbol&&!PLAIN_SYMBOL.test(attrWords(attrs))?SYMBOL:'';};
// Ligature icon fonts draw the symbol from its name ("lock", "visibility_off").
const MATERIAL_NP=/^(?:lock|lock_outline|lock_person|https|vpn_key|key|password|visibility_off|no_accounts|block|do_not_disturb\w*|shield|security|enhanced_encryption|private_connectivity|gpp_\w+)$/;
const MATERIAL_PLAIN=/^(?:picture_as_pdf|download|file_download|description|article|event|calendar_\w+|today|schedule|access_time|place|location_on|map|attach_file|attachment|open_in_new|link|launch|arrow_\w+|chevron_\w+|expand_\w+|navigate_\w+|info|mail|email|print|home|search|public|visibility|check)$/;
const SUPERSCRIPT={0:'⁰',1:'¹',2:'²',3:'³',4:'⁴',5:'⁵',6:'⁶',7:'⁷',8:'⁸',9:'⁹'};
const CONTAINER=/^(?:div|section|article|tbody|thead|tfoot|table|ul|ol|dl|details|fieldset|main|aside)$/i;
const VOID=/^(?:img|input|area|br|hr|meta|link|source|wbr|col|embed|param|track)$/i;
// An element with content and such a class: a container begins a non-public part, a row or item carries the mark at its end.
function markClasses(h){
 const found=[];for(const m of h.matchAll(/<([a-z][a-z0-9]*)\b([^>]*?)(?<!\/)>/gi))if(!VOID.test(m[1])&&npClass(m[2]))found.push(m);
 for(const m of found.reverse()){
  const whole=element(h,m.index,m[1]);if(!/<\/[a-z]/i.test(whole.slice(-(m[1].length+4)))||!whole.slice(m[0].length).replace(/<[^>]+>/g,'').trim())continue;
  if(CONTAINER.test(m[1]))h=h.slice(0,m.index+m[0].length)+'<p>Nichtöffentlicher Teil</p>'+h.slice(m.index+m[0].length);
  else{const end=m.index+whole.length-whole.match(/<\/[a-z][a-z0-9]*\s*>$/i)[0].length;h=h.slice(0,end)+' (nichtöffentlich) '+h.slice(end);}
 }
 return h;
}
// Struck text may go unless it names the non-public part or a part of the meeting.
const struck=inner=>{const t=normalizeLine(entities(inner.replace(/<[^>]+>/g,' ')));return !mentionsNonPublic(t)&&!closedLine(t)&&!/(?<!\p{L})(?:Teil|Sitzungsteil|Abschnitt)(?!\p{L})/u.test(t);};
// The lines of a piece of markup, as htmlToLines makes them.
const quickLines=x=>entities(x.replace(/\s+/g,' ').replace(/<br\b[^>]*>/gi,'\n').replace(new RegExp(`</?(?:${BLOCK})\\b[^>]*>`,'gi'),'\n').replace(/<\/?(?:t[dh]|span|a|b|i|button|label)\b[^>]*>/gi,' ').replace(new RegExp(`</?(?:${INLINE})\\b[^>]*>`,'gi'),'').replace(/<[^>]+>/g,' ')).split('\n').map(normalizeLine).filter(Boolean);
// A line in the card of an item that may say it is not public: a mention, a heading or key of a later part, a symbol.
const cardMark=l=>mentionsNonPublic(l)&&!isPublicReport(l)||closedLine(l)||isNonPublicHeading(l)||BARE_N.test(l)||l.includes(SYMBOL)||PART_KEY.test(l)||
 l.length<=40&&PART_WORD.test(l)&&!isPublicHeading(l)&&!/(?<!\p{L})(?:A|I|1|Erster|öffentlich\p{L}*)(?!\p{L})/u.test(l)||(()=>{const p=l.length<=40&&l.match(PART_HEADING);return !!p&&!/^(?:A|I|1|Erster|1\.|Ö)/u.test(partKey(p)||'')&&!isPublicHeading(l);})();
// Cards and accordions hold one item each with its fields and badges ("TOP 3 …" / "Vorlage 2026/043" / "N-Teil"): where an
// element holds exactly one item and, after it, a line that may say it is not public, that line is the item's (its mark
// "(nichtöffentlich)" is put at the end of the element).
const CARD_TAGS='div|li|article|section|details|tr|dl|fieldset|tbody|table|ul|ol';
/** The line htmlToLines puts at the end of an item's card that may say the item is not public; it belongs to that item. */
export const CARD_NP='(nichtöffentlich: Kennzeichnung dieses Punktes)';
function markCards(h){
 if(!/\d/.test(h))return h;
 const ends=[];
 for(const m of h.matchAll(new RegExp(`<(${CARD_TAGS})\\b[^>]*>`,'gi'))){
  // A wrapper of the whole page is no card (and is not read twice).
  const whole=element(h,m.index,m[1]),close=whole.match(/<\/[a-z][a-z0-9]*\s*>$/i);if(!close||whole.length>100000)continue;
  const lines=quickLines(whole),at=lines.map((l,k)=>itemOfLine(l)?k:-1).filter(k=>k>=0);
  if(at.length!==1||isPublicReport(lines[at[0]]))continue;
  if(lines.slice(at[0]+1).some(cardMark))ends.push(m.index+whole.length-close[0].length);
 }
 for(const e of [...new Set(ends)].sort((a,b)=>b-a))h=h.slice(0,e)+`<p>${CARD_NP}</p>`+h.slice(e);
 return h;
}
/** Lines of the main content of a page: main or [role=main], otherwise the body without its frame. */
export function htmlToLines(html){
 let h=String(html||'').replace(/<!--[\s\S]*?-->/g,' ').replace(/<!\[CDATA\[[\s\S]*?\]\]>/g,' ');
 // Struck text is withdrawn (the old day of a moved meeting, an item taken off), unless it names the non-public part.
 h=h.replace(/<(del|s|strike)(?=[\s>])[^>]*>([\s\S]*?)<\/\1\s*>/gi,(m,tag,inner)=>struck(inner)?' ':m);
 h=h.replace(/<([a-z][a-z0-9]*)\b([^>]*\bstyle\s*=\s*["'][^"']*line-through[^"']*["'][^>]*)>([\s\S]*?)<\/\1\s*>/gi,(m,tag,a,inner)=>struck(inner)?' ':m);
 // Symbols inside a link or button belong to it (a file icon, an arrow), not to an item.
 h=h.replace(/<(a|button)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,m=>m.replace(/<svg\b([^>]*)>([\s\S]*?)<\/svg\s*>/gi,(x,a,body)=>` ${altText(a)||body.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]||''} `).replace(/<(?:img|input|area)\b([^>]*)>/gi,(x,a)=>` ${iconText(a,false)} `).replace(/<(i|span)\b([^>]*?)\s*(?:\/>|>\s*<\/\1\s*>)/gi,(x,tag,a)=>` ${iconText(a,false)} `));
 // Text alternatives are text: an icon or image with title/alt "nichtöffentlich" marks an item like a word; a symbol without
 // text stands as SYMBOL.
 h=h.replace(/<svg\b([^>]*)>([\s\S]*?)<\/svg\s*>/gi,(m,a,body)=>{const t=[altText(a),body.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]??''].filter(Boolean).join(' ');return ` ${t||iconText(a)} `;});
 h=h.replace(/<(?:img|input|area)\b([^>]*)>/gi,(m,a)=>` ${iconText(a)} `);
 h=h.replace(/<(span|i)\b([^>]*\bclass\s*=\s*["'][^"']*material-(?:icons|symbols)[^"']*["'][^>]*)>\s*([a-z_0-9]{1,40})\s*<\/\1\s*>/gi,(m,tag,a,name)=>` ${altText(a.replace(/\saria-hidden\s*=\s*["']?\w+["']?/i,''))||(MATERIAL_NP.test(name)?'(nichtöffentlich)':MATERIAL_PLAIN.test(name)?'':SYMBOL)} `);
 // Superscripts: a number or star is a footnote mark ("Grundstück¹"), letters are a mark of their own ("Grundstück NÖ").
 h=h.replace(/<(sup|sub)\b[^>]*>([\s\S]*?)<\/\1\s*>/gi,(m,tag,inner)=>{const t=inner.replace(/<[^>]+>/g,'').trim();return tag.toLowerCase()==='sup'&&/^\d{1,2}\)?$/.test(t)?t.replace(/\d/g,d=>SUPERSCRIPT[d]):/^[*†‡]+\)?$/.test(t)?t:` ${inner} `;});
 h=labelPanels(h);
 h=markClasses(h);
 // An empty element (an icon font's <i>, a <span> badge) is read by its title; another element only where its title
 // names the non-public part (<abbr title="nichtöffentlich">N</abbr>).
 h=h.replace(/<(i|span|em|b|strong|abbr|a|div|td|th|li|button|small|sup|sub|mark|font|u|s|p|dd|dt)\b([^>]*?)\s*(?:\/>|>\s*<\/\1\s*>)/gi,(m,tag,a)=>{const t=iconText(a,/^i$/i.test(tag)&&/\bclass\s*=/i.test(a)||ICONISH.test(attrOf(a,'class')));return t?`${m} ${t} `:m;});
 h=h.replace(/<([a-z][a-z0-9]*)\b([^>]*?)(?<!\/)>(?!\s*<\/\1\s*>)/gi,(m,tag,a)=>{const t=altText(a);return t&&!/^(?:img|input|area|script|style)$/i.test(tag)&&mentionsNonPublic(t)?`${m} ${t} `:m;});
 h=strip(h,'script|style|noscript|template|svg|iframe|object|canvas');
 const main=h.search(/<main\b/i),role=h.match(/<([a-z][a-z0-9]*)\b[^>]*\brole\s*=\s*["']?main\b[^>]*>/i);
 // A legend outside the main content (in the footer or a side box of the template) still tells what the marks of the items mean.
 let legends=[];
 const outside=part=>quickLines(strip(part,'a|nav|form|select|button')).filter(l=>formatLegend(l)||LEGEND.test(l)||mentionsNonPublic(l)&&/(?<!\p{L})(?:Punkte?|TOPs?|Tagesordnungspunkte?|markiert\p{L}*|gekennzeichnet\p{L}*|dargestellt\p{L}*|Kennzeichnung)(?!\p{L})/u.test(l));
 if(main>=0){const m=element(h,main,'main');legends=outside(h.slice(0,main)+' '+h.slice(main+m.length));h=m;}
 else if(role){const m=element(h,role.index,role[1]);legends=outside(h.slice(0,role.index)+' '+h.slice(role.index+m.length));h=m;}
 // Without main the body without its frame: headings of a part between the articles of single items stay, as do the
 // heads of articles and sections (<section><header><h2>Teil B</h2></header>) and headers between texts.
 else h=stripPageFrame(h.match(/<body\b[^>]*>([\s\S]*)<\/body>/i)?.[1]??h);
 // Navigation and side boxes are not content, also inside main, unless they name the non-public part; forms never are.
 // Buttons, summaries and labels are text (the heading of a part may be the button of an accordion or a tab).
 h=stripFrame(h,'nav|aside');
 h=strip(h,'form|select|dialog');
 h=markCards(h);
 // Line breaks of the source are spaces, except inside <pre>.
 h=h.replace(/<pre\b[^>]*>([\s\S]*?)<\/pre>/gi,(m,body)=>'\n'+body.replace(/\r?\n/g,'<br>')+'\n');
 h=h.replace(/\s+/g,' ').replace(/<br\b[^>]*>/gi,'\n').replace(new RegExp(`</?(?:${BLOCK})\\b[^>]*>`,'gi'),'\n').replace(/<\/?(?:t[dh]|span|a|b|i|button|label)\b[^>]*>/gi,' ');
 // Other inline markup sits inside words ("<strong>T</strong>agesordnung"); any other tag is a space.
 h=h.replace(new RegExp(`</?(?:${INLINE})\\b[^>]*>`,'gi'),'').replace(/<[^>]+>/g,' ');
 return [...entities(h).split('\n').map(normalizeLine).filter(Boolean),...legends];
}
// Tabs and accordions whose labels stand apart from their panels (a tab bar below the panels, set on top by a style): each label
// that names a part is put at the start of the panel it opens (href="#…", aria-controls, data-target), and the label a panel names
// by aria-labelledby likewise.
function labelPanels(h){
 const labels=new Map();
 const add=(id,text)=>{const t=normalizeLine(entities(String(text).replace(/<[^>]+>/g,' ')));if(id&&t&&t.length<=60&&(isPublicHeading(t)||isNonPublicHeading(t)||mentionsNonPublic(t)||closedLine(t)||PART_HEADING.test(t)))labels.set(id,t);};
 for(const m of h.matchAll(/<([a-z][a-z0-9]*)\b([^>]*?)(?<!\/)>/gi)){
  const a=m[2],target=(attrOf(a,'href').match(/^#([\w:.-]+)$/)?.[1])||attrOf(a,'aria-controls')||(attrOf(a,'data-target')||attrOf(a,'data-bs-target')).replace(/^#/,''),id=attrOf(a,'id');
  if(!target&&!id||VOID.test(m[1]))continue;
  const inner=element(h,m.index,m[1]).slice(m[0].length).slice(0,2000);
  if(target)add(target,inner);
  if(id&&/^(?:a|button|li|span|label|h[1-6])$/i.test(m[1]))labels.set('@'+id,inner);
 }
 if(!labels.size)return h;
 return h.replace(/<([a-z][a-z0-9]*)\b([^>]*)>/gi,(m,tag,a)=>{
  const id=attrOf(a,'id'),by=attrOf(a,'aria-labelledby');
  let t=id&&labels.get(id);
  if(!t&&by){const raw=labels.get('@'+by);if(raw!==undefined){const x=normalizeLine(entities(String(raw).replace(/<[^>]+>/g,' ')));if(x&&x.length<=60&&(isPublicHeading(x)||isNonPublicHeading(x)||mentionsNonPublic(x)||closedLine(x)))t=x;}}
  return t&&!VOID.test(tag)?`${m}<p>${t}</p>`:m;
 });
}
const PAGE_ONLY=/^(?:[-–]\s*)?\d{1,3}(?:\s*[-–])?$|^\d{1,3}\s*\/\s*\d{1,3}$|^Seite\s+\d{1,3}(?:\s*(?:von|\/)\s*\d{1,3})?$/i;
const PAGE_MARK=/\bSeite\s+\d{1,3}\s*(?:von|\/)\s*\d{1,3}\b/gi;
// What a running head says besides the page number, where it names a part of the meeting ("Nichtöffentlicher Teil Seite 2 von 2",
// "Einladung GR 14.10.2026 – nichtöffentlicher Teil Seite 2 / 2"): kept, so that the part is not lost with the number.
const partOfHead=rest=>mentionsNonPublic(rest)||isNonPublicHeading(rest)||closedLine(rest)||PART_HEADING.test(rest)||/(?<!\p{L})(?:Teil|Sitzungsteil|Abschnitt)\s+(?:[B-H]|II|III|IV|[2-9])(?![\p{L}\d])/u.test(rest);
/** Lines of the text of a PDF (unpdf, pages joined by line breaks) without page numbers and "Seite 2 von 5" lines. */
export function pdfLines(text){
 return String(text||'').split(/\r\n|\r|\n|\f/).map(normalizeLine).map(l=>{
  if(l.length>100||!new RegExp(PAGE_MARK.source,'i').test(l))return l;
  const rest=l.replace(PAGE_MARK,' ').replace(/\s+/g,' ').replace(/^[\s|–·-]+|[\s|–·-]+$/g,'').trim();
  return rest&&partOfHead(rest)?rest:'';
 }).filter(l=>l&&!PAGE_ONLY.test(l));
}

const MONTH='(Januar|Jänner|Jan\\.?|Februar|Feb\\.?|März|Maerz|Mär\\.?|Mrz\\.?|April|Apr\\.?|Mai|Juni|Jun\\.?|Juli|Jul\\.?|August|Aug\\.?|September|Sept\\.?|Sep\\.?|Oktober|Okt\\.?|November|Nov\\.?|Dezember|Dez\\.?)';
const MONTHS={jan:1,jän:1,feb:2,mär:3,mae:3,mrz:3,apr:4,mai:5,jun:6,jul:7,aug:8,sep:9,okt:10,nov:11,dez:12};
const WEEKDAY='(?:(?:Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonnabend|Sonntag|Mo|Di|Mi|Do|Fr|Sa|So)\\.?,?\\s+(?:den\\s+)?)?';
const DATE_RES=[
 [new RegExp(`${WEEKDAY}(?<![\\d.])(\\d{1,2})\\.\\s?(\\d{1,2})\\.\\s?(\\d{4})(?![\\d.]\\d)`,'gu'),m=>[m[3],m[2],m[1]]],
 // A two-digit year only with a two-digit month ("14.10.26"); "3.1.10" is an item number.
 [new RegExp(`${WEEKDAY}(?<![\\d.])(\\d{1,2})\\.(\\d{2})\\.(\\d{2})(?![\\d]|\\.\\d)`,'gu'),m=>['20'+m[3],m[2],m[1]]],
 [new RegExp(`${WEEKDAY}(?<![\\d.])(\\d{1,2})\\.\\s*${MONTH}(?!\\p{L})\\s*(\\d{4})(?!\\d)`,'giu'),m=>[m[3],MONTHS[m[2].toLowerCase().slice(0,3)],m[1]]],
 [/(?<![\d-])(\d{4})-(\d{2})-(\d{2})(?![\d])/g,m=>[m[1],m[2],m[3]]],
];
/** Dates in a text: [{iso, index, text}], in order; impossible dates (31.02.) are left out. */
export function germanDates(s){
 const text=String(s||''),found=[];
 for(const [re,parts] of DATE_RES)for(const m of text.matchAll(re)){
  const [y,mo,d]=parts(m).map(Number);if(!mo||y<1990||y>2100)continue;
  const date=new Date(Date.UTC(y,mo-1,d));if(date.getUTCMonth()!==mo-1||date.getUTCDate()!==d)continue;
  found.push({iso:date.toISOString().slice(0,10),index:m.index,text:m[0]});
 }
 found.sort((a,b)=>a.index-b.index||b.text.length-a.text.length);
 return found.filter((f,i)=>!found.slice(0,i).some(g=>f.index<g.index+g.text.length));
}
/** Time of day "HH:MM" from "19:00 Uhr", "19.00 Uhr" or "19 Uhr", otherwise null. */
export function timeOf(s){
 const m=String(s||'').match(/(?<![\d.,:])([01]?\d|2[0-3])(?:[:.]([0-5]\d))?\s*Uhr\b/);
 return m?`${m[1].padStart(2,'0')}:${m[2]||'00'}`:null;
}

// Committees: the bodies of a town, its districts and its county; every "…ausschuss" and "…beirat". Hyphenated words
// before it belong to the name ("Haupt-, Finanz- und Personalausschuss").
const BODY_PRE='(?:\\p{L}+-(?:\\s*,\\s*|\\s+(?:und|sowie|u\\.)\\s+))*';
const BODY_CORE='(?:\\p{L}*?(?:gemeinderat|beirat|ausschuss|ausschuß)|(?:markt|stadt|orts|ortschafts|ältesten|stadtbezirks|bezirks)rat|stadtverordnetenversammlung|gemeinschaftsversammlung|verbandsversammlung|gemeindevertretung|stadtvertretung|bezirksvertretung|kreistag)';
const BODY=new RegExp(`(?<![\\p{L}-])(${BODY_PRE})(${BODY_CORE})(e?s)?(?:sitzung(?:en)?)?(?![\\p{L}])`,'iu');
const COUNCIL=/(?<!\p{L})Rat(?:es)?\s+der\s+(Stadt|Gemeinde)(?!\p{L})/u;
// Words that follow a committee without being the name of a place.
const NOT_PLACE=new Set(('sitzung sitzungen tagung tagesordnung einladung bekanntmachung niederschrift protokoll beschluss beschlüsse öffentliche öffentlich '+
 'öffentlicher nichtöffentliche nichtöffentlicher am vom im in der die das den dem des und oder ort datum beginn uhr hinweis termin termine mitglieder top '+
 'tagesordnungspunkt herr frau bürgermeister bürgermeisterin gemeinde stadt markt sitzungsort sitzungssaal rathaus für zur zum bericht ergebnisse '+
 'beschlussübersicht teil vorsitz vorsitzender vorsitzende ende mit ohne wird hat findet verwaltung kreis landkreis tagt tagte berät beriet '+
 'montag dienstag mittwoch donnerstag freitag samstag sonnabend sonntag januar februar märz april mai juni juli august september oktober november dezember '+
 'beschließt beschloss stimmt nimmt lehnt sitzungstermin sitzungstermine sitzungsbeginn aus über bei nach vor wegen sowie bzw zu').split(' '));
const placeWord=w=>w&&/^\p{Lu}[\p{L}-]*\p{L}$/u.test(w)&&!NOT_PLACE.has(w.toLowerCase())&&!/(?:ung|heit|keit|schaft|tion|ungen)$/i.test(w);
const TWO_PART=/^(?:Bad|Sankt|St\.|Groß|Klein|Alt|Neu|Ober|Unter|Nieder|Hohen)$/;
const upper=s=>s.charAt(0).toUpperCase()+s.slice(1);
/** Canonical name of the committee named in a text ("des Gemeinderates Oberdorf" → "Gemeinderat Oberdorf"), or null. */
export function committeeOf(s){
 const text=normalizeLine(s),m=text.match(BODY),c=text.match(COUNCIL);
 if(c&&(!m||c.index<m.index))return `Rat der ${c[1]}`;
 if(!m)return null;
 const core=upper(m[2].replace(/ß/g,'ss')),after=text.slice(m.index+m[0].length);
 let name=m[1]+core;
 if(/^ausschuss$/i.test(core)){
  // "Ausschuss für Bau, Umwelt und Verkehr": the words of its field up to the first word that is not one.
  const f=after.match(/^\s+für\s+(.+)$/u);
  if(f){
   const words=[];
   for(const w of f[1].split(/\s+/)){const bare=w.replace(/[,;:.]+$/,'');if(!(/^(?:und|sowie)$/.test(bare)||/^\p{Lu}[\p{L}-]*$/u.test(bare)&&!NOT_PLACE.has(bare.toLowerCase())))break;words.push(w.replace(/[;:.]+$/,''));if(/[;:.]$/.test(w))break;}
   while(words.length&&/^(?:und|sowie)$|,$/.test(words.at(-1)))words.pop();
   if(words.length)return `${name} für ${words.join(' ')}`;
  }
  return name;
 }
 if(/^verbandsversammlung$/i.test(core)){
  // The assembly of a special-purpose association carries the association's name.
  const v=after.match(/^\s+(?:des|der)\s+(\p{L}*verband)(?:e?s)?((?:\s+(?:für\s+)?\p{Lu}[\p{L}-]*)*)/u);
  if(v){const words=[];for(const w of v[2].trim().split(/\s+/).filter(Boolean)){if(w!=='für'&&(NOT_PLACE.has(w.toLowerCase())||!/^\p{Lu}/u.test(w)))break;words.push(w);}return ['Verbandsversammlung',upper(v[1]),...words].join(' ');}
  return name;
 }
 // A place name only after an article ("des Gemeinderates Oberdorf"): "Stadtrat Muster" may name a person. A body that
 // is never a person's title takes it also as the head of a notice ("Gemeindevertretung Nachbarhausen").
 if(/(?:^|\s)(?:des|der|dem|den|die)\s+$/i.test(text.slice(0,m.index))||m[3]||m.index===0&&!m[1]&&/(?:vertretung|versammlung|ortsgemeinderat|ortschaftsrat)$/i.test(core)){
  const w=after.match(/^\s+([\p{L}.-]+)(?:\s+([\p{L}-]+))?/u);
  if(w&&TWO_PART.test(w[1])&&placeWord(w[2]))name+=` ${w[1]} ${w[2]}`;
  else if(w&&placeWord(w[1]))name+=' '+w[1];
 }
 return name;
}
/** Bodies of special-purpose associations (Zweck-, Schul-, Abwasserverband), which are not the town's own bodies. */
export function isSpecialPurposeBody(name){return /(?:wasserversorgungs|abwasser|wasser|klärwerks)gruppe|gruppenwasserversorgung|gruppenklär\p{L}+|fernwasserversorgung|zweckvereinbarung|^(?:Wasserversorgung|Abwasserbeseitigung|Abwasserentsorgung|Wasserbeschaffung)\s+\p{Lu}|(?:zweck|schul|abwasser|wasser|boden|abfall|planungs|unterhaltungs|deich|wege|forst|gewässer|verkehrs|tourismus|sparkassen|kultur|landschaftspflege|krankenhaus|friedhofs|breitband|erschließungs|gewerbe|industrie|regional)\p{L}{0,25}verband|(?<!\p{L})ZV(?=\s+\p{Lu})/iu.test(String(name||''));}

const MINUTES=/Niederschrift|Protokoll|Sitzungsbericht|Bericht\s+(?:aus|über|von)\s|(?<!\p{L})Aus\s+(?:dem|der|den)\s+(?:Sitzung|\p{L}*(?:rat|ausschuss|vertretung|versammlung|tag|beirat)(?:e?s)?(?!\p{L})|\p{L}*sitzung)|Beschlüsse(?!n)|Beschlussübersicht|Beschlussfassungen|Ergebniss?e?\s+(?:der|aus\s+der)\s+\p{L}*sitzung|(?<!\p{L})fand\s.{0,100}(?:Sitzung|Tagung)/iu;
const INVITATION=/Einladung|Bekanntmachung|Tagesordnung|(?<!\p{L})Ladung|(?<!\p{L})findet\s.{0,100}(?:Sitzung|Tagung)|(?:Sitzung|Tagung)\s.{0,100}(?<!\p{L})findet\s.{0,60}statt|(?<!\p{L})lade\s.{0,80}(?<!\p{L})ein(?!\p{L})/iu;
/** 'minutes' (report, minutes, decisions), 'invitation' (invitation, announcement, agenda) or null: title first, then the first 40 lines. */
export function documentKind(title,lines=[]){
 const t=normalizeLine(title);
 if(MINUTES.test(t))return 'minutes';
 // "Öffentliche Bekanntmachung" is the heading of every notice; it decides only where the text does not.
 const generic=INVITATION.test(t)&&!/Einladung|Tagesordnung|Ladung|Sitzung|Tagung/i.test(t);
 if(INVITATION.test(t)&&!generic)return 'invitation';
 for(const line of (lines||[]).slice(0,40).map(normalizeLine)){
  if(itemOf(line))continue;
  const a=line.search(MINUTES),b=line.search(INVITATION);
  if(a>=0&&(b<0||a<=b))return 'minutes';
  if(b>=0)return 'invitation';
 }
 return generic?'invitation':null;
}

// Items: "1.", "1)", "1 ", "TOP 1", "Tagesordnungspunkt 1", "Punkt 1", "Ö 1", "NÖ 2", "1.1". form tells how the number
// was written; a document numbers its items one way, and other numbers in it are text (lists inside a decision).
const NUM='(\\d{1,2}(?:\\.\\d{1,2}){0,2})';
// The marks N/NÖ (non-public) and Ö (public) in any case and with a separator before the number ("N-3", "NÖ/4", "nö 3").
const MARK='(NÖ|Nö|nö|NOE|Noe|noe|N|n|Ö|ö)(?:\\s*[-/.:]\\s*|\\s*)';
const KEYWORD=new RegExp(`^(?:TOP|Top|TO|Tagesordnungspunkt|Punkt)\\s*(?:Nr\\.?\\s*)?(?:${MARK})?${NUM}\\.?(?!\\d)\\s*(?:[:.)–-]\\s*)?(.*)$`,'u');
const PREFIXED=new RegExp(`^${MARK}${NUM}\\.?(?!\\d)\\s*(?:[:.)–-]\\s*)?(.*)$`,'u');
// A mark after the number, as a column of a table ("2 N Grundstücksverkauf", "4 (NÖ) …", "1 Ö Bauantrag").
const AFTER_MARK=/^\(?(NÖ|Nö|nö|NOE|N|Ö|ö)\)?(?:\s*[.:)–-]\s*|\s+|$)/u;
// A mark at the end of the title, as the last column of a table, in brackets or after a dash ("Grundstücke N",
// "Haushalt (Ö)", "Vergabe – n.ö.", "Kita ö"). A mark N is never overridden by a mark Ö.
const TRAIL_MARK=/(?:\s+|\s*[-–,;:/|]\s*)\(?(NÖ|Nö|nö|NOE|noe|N|n|n\.\s?ö\.?|N\.\s?Ö\.?|Ö|ö)\)?\.?$/u;
const markOf=m=>m?(/^ö$/i.test(m)?'Ö':'N'):null;
// A mark N in brackets anywhere in the title ("Grundstück (N) Vorlage 2026/043", "[N]", "(N.)", "(NS)", "(NÖT)"), or standing
// alone in the middle of it (a column between the title and the number of the paper: "Grundstück N GR/2026/043").
const BRACKET_N=/[([]\s*(?:NÖ|Nö|nö|NOE|N|n|NS|NÖS|NÖT|NT|N\.\s?Ö\.?|n\.\s?ö\.?)\s*\.?\s*[)\]]/u;
const MID_N=/(?:^|\s)(?:NÖ|Nö|nö|NOE|N|NS|NÖS|NÖT)(?=\s|$)/u;
function withMark(prefix,title){
 let p=prefix,t=title;
 const a=!p&&t.match(AFTER_MARK);if(a){p=markOf(a[1]);t=t.slice(a[0].length).trim();}
 // A mark glued to the title, the column set close to it ("Fl.Nr. 412N", "PersonalangelegenheitN").
 const g=t.match(/(?<=[\p{Ll}\d)\]])(NÖ|N|Ö)$/u);
 if(g){const m=markOf(g[1]);p=p==='N'||m==='N'?'N':p||m;t=t.slice(0,g.index).trim();}
 const z=t.match(TRAIL_MARK);
 if(z&&z.index>0){const m=markOf(z[1].replace(/[.\s]/g,''));p=p==='N'||m==='N'?'N':p||m;t=t.slice(0,z.index).trim();}
 if(BRACKET_N.test(t)||MID_N.test(t))p='N';
 return {prefix:p,title:t};
}
// Marks whose meaning the text does not tell: a symbol or a short code at the end of the title ("■", "#", "(+)", "(V)",
// "○", "x"), an Ö in its middle (a column not at the end), "ja"/"nein" inside it. Such a meeting is not taken.
const PARTY_CODE=/^(?:CSU|CDU|SPD|FDP|AfD|ÖDP|FW|FWG|UWG|WG|BL|BfB|UBV|SSW|BSW|Linke|Grüne|GRÜNE)$/u;
const oddMark=t=>{
 const s=String(t||'').trim();
 if(/\s[^\p{L}\p{N}\s"'„“”»«)\].,;:!?…%€§&/–-]{1,3}$/u.test(s)||/\s[xX]$/.test(s))return true;
 const b=s.match(/\s[([]\s*([^()[\]\s]{1,4})\s*[)\]]$/u);
 if(b&&/^(?:[^\p{L}\p{N}]{1,3}|\p{Lu}{1,2}\.?|\p{L}\.)$/u.test(b[1])&&!PARTY_CODE.test(b[1])&&!/^[Öö]$/.test(b[1]))return true;
 return /(?:^|\s)[([]?[Öö][)\]]?\s+\S/u.test(s)||/(?:^|\s)(?:ja|nein)(?=\s|$)/u.test(s);
};
const PLAIN=new RegExp(`^${NUM}(\\.|\\))?\\s+(.+)$`,'u');
// A mark glued to the number, as Thuringian towns write it ("1ö Beschluss …", "3nö Grundstück"): the mark decides the part.
const GLUED=new RegExp(`^${NUM}(NÖ|Nö|nö|Ö|ö)\\s+(.+)$`,'u');
const OFFICE=/^(?:Erste[rn]?\s+|Zweite[rn]?\s+|Dritte[rn]?\s+|Stellvertretende[rn]?\s+)?(?:Ober|Vize|Orts|Kreis)?(?:[Bb]ürgermeister|Vorsitzende|Beigeordnete|Stellvertreter|[Oo]rtsvorsteher|Landrat|Landrätin|Kommandant|Schriftführer|Amtsdirektor|Amtsvorsteher|Verbandsvorsteher|Kämmerer|Kämmerin|Vorstand)(?:in|innen|e[rn]?|r|n|\(in\)|\(r\))?(?!\p{L})|^stellv\.|^Bgm\.?(?!\p{L})/u;
// Members and staff named in a list of those present ("2. Gemeinderätin Probe", "3. GR Beispiel", "4. Hauptamtsleiter Muster"):
// a mandate or post followed by a name. "5. Stadtrat – Umbesetzung der Ausschüsse" is an item.
const MEMBER=/^(?:(?:Gemeinde|Stadt|Markt|Marktgemeinde|Kreis|Orts|Ortschafts|Ortsgemeinde|Stadtbezirks|Bezirks)(?:rat|rätin|räte|ratsmitglied)|Ratsmitglied|Ratsherr|Ratsfrau|Gemeindevertreter(?:in)?|Stadtverordnete[rn]?|Kreistagsmitglied|Kreisrätin|GR(?:in)?|StR(?:in)?|MGR|KR|\p{Lu}\p{Ll}*(?:amts)?leiter(?:in)?|Sachbearbeiter(?:in)?|Protokollführer(?:in)?)\.?(?=\s+(?:Dr\.\s+|Prof\.\s+)?\p{Lu}[\p{Ll}.'-]+(?:\s*[,(]|\s+\p{Lu}[\p{Ll}-]+\s*$|\s*$))/u;
// Names with a party, an office or a note ("Huber, Josef (CSU)", "Maier Hans CSU", "Huber, Anna Erste Bürgermeisterin",
// "Max Mustermann (SPD)"), the votes of an election ("Gemeinderat Hans Maier mit 9 Stimmen") and a role with its names
// ("Gemeinderäte: Hans Probe, Erika Beispiel", "Verwaltung: Kämmerer Fritz Zahl").
const PARTY='(?:CSU|CDU|SPD|FDP|AfD|ÖDP|FW|FWG|UWG|UBV|WG|BfB|BL|Grüne|GRÜNE|B90\\/Grüne|Bündnis\\s*90\\/Die\\s+Grünen|Die\\s+Linke|Linke|Freie\\s+Wähler|parteilos|fraktionslos)';
const NAME="\\p{Lu}[\\p{Ll}'-]+(?:-\\p{Lu}[\\p{Ll}'-]+)?";
const OFFICE_TAIL='(?:(?:Erste|Zweite|Dritte)[rn]?\\s+)?(?:Ober)?(?:Bürgermeister(?:in)?|Kämmerer|Kämmerin|Schriftführer(?:in)?|Ortsvorsteher(?:in)?|\\p{Lu}\\p{Ll}*(?:amts)?leiter(?:in)?|Sachbearbeiter(?:in)?)';
const NAMED_PERSON=new RegExp(`^${NAME},\\s+${NAME}(?:\\s+(?:${PARTY}|${OFFICE_TAIL})(?:\\s*\\([^)]{1,30}\\))?|\\s*\\([^)]{1,30}\\))$|^${NAME}\\s+${NAME}\\s+(?:${PARTY}|${OFFICE_TAIL})(?:\\s*\\([^)]{1,30}\\))?$|^(?:(?:Dr\\.|Prof\\.)\\s+)?${NAME}\\s+${NAME}\\s*\\(${PARTY}\\)$`,'u');
const ELECTED=new RegExp(`^(?:Herr|Frau|Gemeinderat|Gemeinderätin|Stadtrat|Stadträtin|Marktgemeinderat|Marktgemeinderätin|Ratsmitglied|GR|StR|MGR)\\s+(?:${NAME}\\s+){0,2}${NAME}\\s+mit\\s+\\d{1,3}\\s+(?:Ja-)?Stimmen\\.?$`,'u');
const ROLE_NAME=`(?:(?:Herr|Frau|Dr\\.|Prof\\.)\\s+)?(?:\\p{Lu}[\\p{Ll}.'-]+\\s+){0,3}${NAME}(?:\\s*\\([^)]{1,30}\\))?`;
const ROLE_LIST=new RegExp(`^(?:Vorsitz|Vorsitzende[rn]?|Gemeinderäte|Gemeinderätinnen|Stadträte|Stadträtinnen|Ratsmitglieder|\\p{L}*[Mm]itglieder|Verwaltung|Schriftführer(?:in)?|Protokollführer(?:in)?|Protokoll|Gäste|Presse|Zuhörer|Entschuldigt|Abwesend|Anwesend|Sachverständige|Berichterstatter(?:in)?)\\s*:\\s*${ROLE_NAME}(?:\\s*,\\s*${ROLE_NAME})*$`,'u');
const UNIT=/^(?:Anlagen?|Seiten?|Stimmen?|Ja|Nein|Enthaltung(?:en)?|Mitglieder|Gemeinderäte|Gemeinderätinnen|Stadträte|Stadträtinnen|Ratsmitglieder|Personen|Teilnehmer|Euro|EUR|Mio|Mrd|Tsd|Prozent|Jahre?n?|Monate?n?|Wochen?|Tage?n?|Stunden?|Minuten|Stück|Wohneinheiten|WE|Plätze|Kinder|Bauplätze|Exemplare|Fälle|Uhr|Gegenstimmen?)(?!\p{L})/u;
const key=n=>n.split('.').map(p=>String(Number(p))).join('.');
const mainNumber=n=>Number(String(n).split('.')[0]);
// An office of a club or brigade, an honorary or former office, followed by a name ("Kassierer Tim Test", "Altbürgermeister
// Fritz Alt", "Gemeinderat a. D. Hans Huber").
const CLUB_OFFICE=new RegExp(`^(?:(?:Feuerwehr|Stadtbrand|Kreisbrand|Ortsbrand)?[Kk]ommandant(?:in)?|Kassierer(?:in)?|Kassenwart(?:in)?|Jugendwart(?:in)?|Gerätewart|Wehrführer(?:in)?|Wehrleiter(?:in)?|Kassenprüfer(?:in)?|Beisitzer(?:in)?|Schriftwart(?:in)?|Altbürgermeister(?:in)?|Ehrenbürger(?:in)?|Ehrenbürgermeister(?:in)?|Stellvertreter(?:in)?)\\s+(?:(?:Dr|Prof)\\.\\s+)?${NAME}(?:\\s+${NAME})?$`,'u');
// Common first names: a line that is nothing but a name (with an office before it, a note after it) names a person, in
// whatever list it stands (those present, further participants, lay judges, a brigade's officers, blood donors).
const FIRST_NAMES=new Set(('hans peter josef joseph johann johannes georg franz karl carl ludwig alois anton sebastian florian tobias daniel matthias '+
 'alexander jan lukas jonas felix simon benjamin david philipp julian moritz leon niklas nikolaus michael thomas andreas stefan '+
 'stephan christian markus marcus martin wolfgang jürgen frank uwe bernd dieter helmut werner gerhard günter günther heinz kurt '+
 'walter otto erwin herbert hermann ernst wilhelm friedrich heinrich rudolf siegfried volker holger jens jörg dirk sven kai lars '+
 'oliver patrick marco mario dominik fabian kevin dennis marcel robert richard reinhard roland norbert hubert konrad albert bruno '+
 'emil erich gustav hugo oskar theo xaver vinzenz willi willy sepp ulrich gerd harald hartmut joachim lothar detlef detlev '+
 'bernhard christoph manfred rainer ralf ralph rolf horst max maximilian fritz paul tim tom timo jonathan elias noah luis louis '+
 'ben finn jakob jacob leopold valentin vincent adrian marc mark marius nils ole rené rene sascha stefano torsten thorsten '+
 'udo axel achim armin arno benno berthold eberhard edgar egon ewald gottfried heiko henning herrmann ingo jochen klemens clemens '+
 'leonhard lorenz ludger mathias norman olaf reiner rüdiger steffen till ullrich waldemar wendelin wigand wilfried winfried '+
 'klaus claus karl-heinz hans-peter hans-jürgen klaus-dieter franz-josef heinz-peter eckhard erhard gregor hannes kilian korbinian leo lutz quirin severin sigmund stanislaus anna maria petra eva karla lena erika ursula monika sabine susanne andrea claudia birgit gabriele karin heike martina angelika '+
 'brigitte renate elisabeth christine barbara stefanie stephanie nicole sandra julia katharina laura sarah sara lisa sophie '+
 'hannah hanna lea marie johanna emma mia clara klara helga ingrid gisela irmgard hildegard margarete margret gertrud elfriede '+
 'rosemarie christa inge ilse edith anja tanja silke kerstin katrin kathrin daniela nadine melanie simone manuela doris heidi '+
 'bettina beate cornelia elke gudrun jutta marion regina rita theresa theresia therese veronika franziska magdalena agnes carina '+
 'carolin caroline christina diana ines iris jana jasmin jessica judith kristin linda lydia maren miriam natalie nina paula '+
 'ramona sabrina silvia sylvia sonja svenja ulrike vanessa verena annette antje dagmar gaby hedwig luise louise lieselotte '+
 'waltraud anneliese gerlinde marianne annemarie elena emily greta ida lara leonie marlene nele pia sophia thea vera yvonne '+
 'alexandra astrid bärbel brunhilde charlotte dorothea elfi elisa elli emilia erna frieda friederike hedi heidrun helene '+
 'henriette hilde irene isabel isabella jacqueline josefine kathleen katja kornelia lieselotte lilli lotte luisa margit '+
 'mareike marina marta martha mechthild michaela mona nadja nora olga patricia rebecca regine rosi ruth sieglinde sigrid '+
 'stella tamara tatjana uta ute viktoria walburga wilma lena-marie lina amelie antonia mila marlies anke annika').split(' '));
const NAME_WORD="\\p{Lu}[\\p{Ll}ß'’]+";
const FIRST_RE=`${NAME_WORD}(?:-${NAME_WORD})?`;
const firstName=w=>w.split('-').every(p=>FIRST_NAMES.has(p.toLowerCase()));
// Offices and roles before a name ("Ortssprecher", "Stellvertretender Kommandant", "Seniorenbeauftragte", "Kassiererin:").
const ROLE_STEM=/^\p{Ll}*(?:meister|sprecher|beauftragt|leiter|wart|rat|rätin|räte|mitglied|vorsitzend|vorsteher|kommandant|kämmerer|kämmerin|führer|referent|sachbearbeiter|direktor|präsident|vertreter|kassier|kassierer|beisitzer|schriftführer|prüfer|ingenieur|planer|architekt|pfarrer|rektor|leiterin|wartin|helfer|richter|schöffe|bürger|vorstand|sekretär|verwalter|pfleger|warte)\p{Ll}*$/u;
const ROLE_WORD={test:w=>/^\p{Lu}/u.test(w)&&ROLE_STEM.test(w.toLowerCase())||/^(?:Stellvertretende[rn]?|Stellv\.|Erste[rn]?|Zweite[rn]?|Dritte[rn]?|Herr|Frau|Dr\.|Prof\.|\d\.)$/u.test(w)};
// "Hans Maier", "Anna-Lena Huber-Schmidt", "Hans von Berg", "Josef Huber jun.", "Peter Schmid (75 Spenden)", an office before it
// ("Kämmerer Fritz Zahl", "Jugendwartin: Karla Klein"); "Huber, Anna", "Huber, Anna, Hausfrau, Musterbach", "Maier, Hans Erster
// Bürgermeister". The first name must be a common one.
const COMMA_NAME=new RegExp(`^${NAME_WORD}(?:-${NAME_WORD})?,\\s*(?:(?:Dr|Prof)\\.\\s+)?(${FIRST_RE})(?:\\s+${FIRST_RE})?(?:\\s*(?:[,(]|$)|\\s+\\p{Lu})`,'u');
const SURNAME=new RegExp(`^${NAME_WORD}(?:-${NAME_WORD})?$`,'u');
const PARTICLE=/^(?:von|van|de|der|den|zu|vom|di|da|del|ten|ter|und)$/;
// A person also as "Huber Josef" (name and common first name in either order), as lists of those present have it.
const nameish=t=>person(t)||/^\p{Lu}[\p{Ll}ß'-]+,?\s+\p{Lu}[\p{Ll}ß'-]+$/u.test(t)&&t.split(/[,\s]+/).some(firstName);
function personLine(raw){
 const t=String(raw||'').trim();
 const c=t.match(COMMA_NAME);if(c&&firstName(c[1]))return true;
 const words=t.replace(/\s*\([^)]{1,40}\)$/u,'').replace(/^([^:]{2,40}):\s+/u,'$1 ').replace(/\s+(?:jun\.|sen\.|jr\.|d\.\s?[JÄ]\.)$/u,'').split(/\s+/);
 const k=words.findIndex(w=>firstName(w));
 if(k<0||words.length-k<2||!words.slice(0,k).every(w=>ROLE_WORD.test(w)))return false;
 let j=k+1;if(j<words.length-1&&firstName(words[j]))j++;
 while(j<words.length-1&&PARTICLE.test(words[j]))j++;
 return j===words.length-1&&SURNAME.test(words[j]);
}
// "Yilmaz, Ayse, Verkäuferin, Musterbach": name, first name (of any origin), occupation and place, as lists of lay judges have them.
const OCCUPATION=/^\p{Lu}\p{Ll}+(?:in|er|ent|ant|eur|frau|mann|kraft|wirt|te|ter)$/u;
const commaPerson=t=>{const p=String(t).split(/\s*,\s*/);return p.length>=3&&p.length<=5&&/^\p{Lu}[\p{Ll}'’-]+(?:-\p{Lu}[\p{Ll}'’-]+)?$/u.test(p[0])&&/^\p{Lu}[\p{Ll}'’-]+(?:[\s-]\p{Lu}[\p{Ll}'’-]+)?$/u.test(p[1])&&!/(?:ung|ungen|heit|keit|schaft|tion|nis|tät|ismus)$/u.test(p[1])&&(OCCUPATION.test(p[2].split(/\s+/)[0])||/^(?:Dr\.|geb\.)/u.test(p[2]));};
const onePerson=t=>commaPerson(t)||OFFICE.test(t)||MEMBER.test(t)||NAMED_PERSON.test(t)||ELECTED.test(t)||ROLE_LIST.test(t)||CLUB_OFFICE.test(t)||/(?<!\p{L})a\.\s?D\.\s+(?:(?:Dr|Prof)\.\s+)?\p{Lu}/u.test(t)||personLine(t);
// A name with its office, occupation or place after commas ("Hans Huber, Erster Bürgermeister", "Anna Maier, Hausfrau, Musterbach").
const TAIL_PART=/^(?:\p{Lu}[\p{L}.'-]*|\d\.)(?:\s+(?:\p{Lu}[\p{L}.'-]*|a\.|d\.|i\.|an|am|im|in|der|den|dem|ob|bei|von|vom|zu|\([^)]{1,30}\))){0,4}$/u;
const namedWithTail=t=>{const m=t.match(/^([^,]{3,50}?),\s*(.+)$/u);return !!m&&onePerson(m[1].trim())&&m[2].split(/\s*,\s*/).every(p=>TAIL_PART.test(p.trim()));};
// Two or more persons in one line, as a table of members and deputies has them ("Anna Maier (CSU) Josef Bauer (CSU)", "GR Anna
// Maier GR Josef Bauer").
const personRow=t=>{const parts=t.split(/(?<=\))\s+|\s+(?=(?:GR|GRin|GRÄ|StR|StRin|MGR|KR|KRin|Herr|Frau|Dr\.)\s)|\s*[|;]\s*/u).map(p=>p.trim()).filter(Boolean);return parts.length>=2&&parts.every(p=>onePerson(p)||namedWithTail(p));};
const person=t=>onePerson(t)||namedWithTail(t)||personRow(t);
function itemOf(raw){
 const line=normalizeLine(raw);let m;
 const titleOk=t=>!t||/^[\p{Lu}„"'(§]/u.test(t)||/^\d{1,2}\.\s+\p{Lu}/u.test(t);
 if((m=line.match(KEYWORD))){const n=key(m[2]),w=withMark(markOf(m[1]),m[3].trim());if(Number(n.split('.')[0])<1||Number(n.split('.')[0])>60||!titleOk(w.title))return null;return {prefix:w.prefix,number:n,title:w.title,form:'keyword'};}
 if((m=line.match(PREFIXED))){const n=key(m[2]),w=withMark(markOf(m[1]),m[3].trim());if(Number(n.split('.')[0])<1||Number(n.split('.')[0])>60||!titleOk(w.title))return null;return {prefix:w.prefix,number:n,title:w.title,form:'prefix'};}
 if((m=line.match(GLUED))){const n=key(m[1]),first=Number(n.split('.')[0]),title=m[3].trim();if(first<1||first>60||!titleOk(title)||!/\p{L}/u.test(title))return null;return {prefix:markOf(m[2]),number:n,title,form:'plain'};}
 if((m=line.match(PLAIN))){
  const n=key(m[1]),first=Number(n.split('.')[0]),{prefix,title}=withMark(null,m[3].trim());
  if(first<1||first>60||!titleOk(title)||!/\p{L}/u.test(title))return null;
  if(germanDates(line)[0]?.index===0||timeOf(line)&&/^Uhr\b/.test(title)||person(title))return null;
  if(!m[2]&&!m[1].includes('.')&&UNIT.test(title)||UNIT.test(title)&&/^(?:Uhr|Stimmen?|Ja|Nein|Gegenstimmen?|Enthaltung)/.test(title))return null;
  return {prefix,number:n,title,form:'plain'};
 }
 return null;
}
/** An agenda item line: {prefix:'Ö'|'N'|null, number, title} or null. */
export function parseItemLine(line){const it=itemOf(line);return it?{prefix:it.prefix,number:it.number,title:it.title}:null;}

// Headings: a short line, or a numbered line whose title is nothing but the heading ("6. Nichtöffentlicher Teil").
// "7. Bekanntgabe von Beschlüssen aus nichtöffentlicher Sitzung" is an item of the public part, not a heading.
const PART='(?:\\s+(?:Teil|Sitzungsteil|Sitzung|Tagesordnung|Beratung|Abschnitt|Sitzungsabschnitt|Tagesordnungspunkte|Punkte|Sitzungsfolge))?(?:\\s+der\\s+Sitzung)?';
const LEAD='^(?:(?:Tagesordnung|TO|Sitzung)\\s*[-–:,]?\\s*)?(?:für\\s+den\\s+|der\\s+|zur\\s+|im\\s+)?';
// Also the short forms of a part: "Ö-Teil", "ÖT", "Tagesordnung ÖT"; "N-Teil", "NÖ-Teil", "NÖT".
const PUBLIC_CORE=new RegExp(`${LEAD}(?:öffentlich(?:e[rnms]?)?${PART}|Ö\\s*-?\\s*Teil|ÖT)$`,'iu');
const NONPUBLIC_CORE=new RegExp(`${LEAD}(?:nicht\\s*-?\\s*)öffentlich(?:e[rnms]?)?${PART}$|${LEAD}(?:N|NÖ)\\s*-?\\s*Teil$|${LEAD}NÖT$|^(?:Teil\\s+|Sitzung\\s+|Beratung\\s+)?unter\\s+Ausschlu(?:ss|ß)\\s+der\\s+Öffentlichkeit$|^vertraulich(?:e[rnms]?)?(?:\\s+(?:Teil|Sitzung|Sitzungsteil|Beratung|Tagesordnung))?$|^geschlossene[rnms]?\\s+(?:Sitzung|Teil|Sitzungsteil)$`,'iu');
// Unnumbered short lines may go on with the body and day ("Öffentliche Sitzung des Gemeinderates am 14.10.2026").
const PUBLIC_LONG=/^öffentliche\s+Sitzung\s+(?:des|der)\s/iu,NONPUBLIC_LONG=/^(?:nicht\s*-?\s*öffentliche\s+Sitzung\s+(?:des|der)\s|unter\s+Ausschlu(?:ss|ß)\s+der\s+Öffentlichkeit(?!\p{L}))/iu;
// Spellings of "nichtöffentlich" a heading may have: "nicht-öffentl.", "Nichtöfentlicher", "nichtöfftl.", "Nicht?ffentlicher".
const canonNP=s=>s.replace(/(?<!\p{L})nicht[\s\-_.–]{0,3}(?:ö|oe|o|e|\?|�)?(?:f{1,2}(?:entlich|entl\.?|tl\.?|\.)?|f{0,2}ent[iIl1|]{1,2}ch)(e[rnms]?)?(?!\p{L})/giu,(m,e)=>(m[0]==='N'?'N':'n')+'ichtöffentlich'+(e||''));
function headingCore(raw){
 const line=canonNP(normalizeLine(raw)),it=itemOf(line);
 if(!it&&line.length>90)return null;
 let core=(it?it.title:line).replace(/^(?:(?:Teil|Abschnitt)\s+(?:[A-H]|[IVX]{1,4}|\d)\s*[:.)–-]?\s*|(?:Erster|Zweiter|Dritter|Vierter)\s+(?:Teil|Sitzungsteil|Abschnitt)\s*[:.)–-]?\s*)/i,'').replace(/^(?:[A-H]|[IVX]{1,4})(?:[.)]\s*|\s+(?=\p{Lu}))/u,'');
 core=core.replace(/[()]/g,' ').replace(/[\s:.,;–-]+$/,'').replace(/\s+/g,' ').trim();
 return {core,numbered:!!it};
}
// The long form only as a heading of its own (capital Ö); "… eine\nöffentliche Sitzung des Gemeinderates statt." is a
// wrapped sentence, which counts as a sentence of the head.
export function isPublicHeading(line){const h=headingCore(line);return !!h&&(PUBLIC_CORE.test(h.core)||!h.numbered&&/^Ö/.test(h.core)&&PUBLIC_LONG.test(h.core));}
export function isNonPublicHeading(line){const h=headingCore(line);return !!h&&(NONPUBLIC_CORE.test(h.core)||!h.numbered&&NONPUBLIC_LONG.test(h.core));}
// A heading of the non-public part followed by a note ("Nichtöffentlicher Teil (ab TOP 3)", "Nichtöffentliche Sitzung ab
// 20:00 Uhr", "NÖ-Teil", "Nichtöffentlicher Teil der Gemeinderatssitzung").
const STARTS_NONPUBLIC=/^[-–*•_.:\s]*(?:(?:Im\s+Anschluss(?:\s+(?:daran|hieran))?|Anschlie(?:ß|ss)end|Danach|(?:Hieran|Daran)\s+anschlie(?:ß|ss)end)\s*[-–:,]?\s*)?(?:(?:Teil|Abschnitt)\s+(?:[A-H]|[IVX]{1,4}|\d)\s*[:.)–-]?\s*|(?:[A-H]|[IVX]{1,4})[.)]\s*)?(?:Tagesordnung\s*[-–:,]?\s*)?(?:nichtöffentlich(?:e[rnms]?)?|vertrauliche[rnms]?|geschlossene[rnms]?|interne[rnms]?|n\.?\s?ö\.?|nö)[\s-]*(?:Teil|Sitzung|Sitzungsteil|Tagesordnung|Beratung|Abschnitt|Sitzungsabschnitt|Tagesordnungspunkte|Punkte|Angelegenheiten)(?!\p{L})|^[-–*•_.:\s]*unter\s+Ausschlu(?:ss|ß)\s+der\s+Öffentlichkeit(?!\p{L})/iu;
// The closing note of an agenda: what follows the published items is a non-public session.
const TRAILING_NP=/^(?:Anschlie(?:ß|ss)end|Im\s+Anschluss(?:\s+(?:daran|hieran))?|Danach|(?:Hieran|Daran)\s+anschlie(?:ß|ss)end)\s*[-–:,]?\s*(?:findet\s+)?(?:eine\s+)?nichtöffentliche[rn]?\s+(?:Sitzung|Beratung|Teil)(?:\s+statt)?\.?$/iu;
const lastItemIndex=(items,start,end)=>{for(let k=end-1;k>=start;k--)if(items[k])return k;return start;};
const startsNonPublic=line=>{const l=canonNP(normalizeLine(line));return l.length<=90&&!itemOf(l)&&STARTS_NONPUBLIC.test(l);};
// A sentence of the head that names the public session ("findet eine öffentliche Sitzung statt", "in öffentlicher Sitzung").
// Never after a negation ("keine öffentliche Sitzung", "nicht in öffentlicher Sitzung") and never from a clause that names the
// non-public part ("Öffentliche Sitzung: nein").
const PUBLIC_SENTENCE=/(?<!nicht\s*-?\s*)(?<!(?:kein\p{L}*|nicht\s+in)\s+)(?<!\p{L})öffentliche[rnm]?\s+(?:\p{L}*sitzung|Tagung)(?!\p{L})|(?:Sitzung|Tagung)\s(?:[^.]{0,40}\s)?(?:ist|findet|tagt)\s+öffentlich(?!\p{L})/iu;
const publicClause=c=>PUBLIC_SENTENCE.test(c)&&!mentionsNonPublic(c)&&!/^(?:Herstellung|Wiederherstellung)\s+der\s+Öffentlichkeit/i.test(c);
const publicSentence=line=>publicClause(line)||mentionsNonPublic(line)&&String(line).split(/[.;,:]\s+|\s+[–-]\s+/).some(publicClause);

// Outcomes in a block of minutes.
const OUTCOMES=[
 ['postponed',/(?<!\p{L})(?:vertagt|zurückgestellt|abgesetzt|verschoben)(?!\p{L})|von\s+der\s+Tagesordnung\s+(?:genommen|abgesetzt)/giu],
 ['info',/zur\s+Kenntnis\s+genommen|(?<!\p{L})(?:nimmt|nahm|nehmen|nahmen)\s[^.;]{0,160}?zur\s+Kenntnis(?!\p{L})|Kenntnisnahme|Kenntnis\s+genommen/giu],
 ['rejected',/(?<!\p{L})abgelehnt(?!\p{L})|(?<!\p{L})lehn(?:t|te|ten|en)\s[^.;]{0,160}?(?<!\p{L})ab(?!\p{L})|nicht\s+zugestimmt|keine\s+Mehrheit|nicht\s+(?:beschlossen|angenommen)(?!\p{L})|(?<!\p{L})(?:abzulehnen|zu\s+versagen|versagt|verweigert|zurückzuweisen|zurückgewiesen|nicht\s+zu\s+erteilen)(?!\p{L})/giu],
 ['approved',/(?<!\p{L})(?:beschlossen|beschließt|beschloss|beschließen|angenommen|zugestimmt|genehmigt|erteilt|befürwortet)(?!\p{L})|(?<!\p{L})stimm(?:t|te|ten|en)\s[^.;]{0,160}?(?<!\p{L})zu(?=\s*(?:[.;,!]|$))/giu],
];
const NEGATED=/(?<!\p{L})(?:nicht|kein(?:e|en)?)\s+(?:\p{L}+\s+)?$/iu;
// "beschließt, den Antrag abzulehnen": the decision is a rejection, its votes count for rejecting.
// Also a decision to refuse what was asked ("beschließt, dem Antrag nicht stattzugeben"): a majority for it rejects the item.
const DECIDED_AGAINST=/(?<!\p{L})(?:(?:sieht|sehen|sah|sahen)\s+keine\s+Möglichkeit|keine\s+Möglichkeit\s+(?:\p{L}+\s+){0,4}?zu|sieht\s+sich\s+(?:nicht\s+in\s+der\s+Lage|außerstande)|abzulehnen|zu\s+versagen|zurückzuweisen|nicht\s+zu\s+erteilen|nicht\s+stattzugeben|nicht\s+zu\s+entsprechen|nicht\s+zu\s+gewähren|nicht\s+herzustellen|nicht\s+zu\s+genehmigen|nicht\s+zuzustimmen)(?!\p{L})/iu;
// The result stated as a refusal ("Das Einvernehmen wird nicht erteilt", "Dem Antrag wird nicht entsprochen", "nicht in
// Aussicht gestellt"): with a vote or a decision it is a rejection, whichever way the vote is counted.
const REFUSED=/(?<!\p{L})nicht\s+(?:\p{L}+\s+){0,2}?(?:erteilt|hergestellt|gewährt|entsprochen|stattgegeben|in\s+Aussicht\s+gestellt|genehmigt|gegeben|befürwortet|zugelassen|angenommen|beschlossen)(?!\p{L})/iu;
const DECIDE_WORD=/^(?:beschlossen|beschließt|beschloss|beschließen)$/i;
// A vote on a motion about the procedure ("Antrag auf Ablehnung/Vertagung … angenommen") says nothing clear about the item.
const PROCEDURE=/Antrag\s+auf\s+(?:Ablehnung|Vertagung|Zurückstellung|Absetzung|Nichtbefassung|Schluss\s+der\s+(?:Debatte|Beratung))/iu;
const VOTES=[
 [/(?<!\p{L})Ja(?:-?Stimmen)?\s*[:=]?\s*(\d{1,3})(?!\d)[\s,;/]*Nein(?:-?Stimmen)?\s*[:=]?\s*(\d{1,3})(?!\d)(?:[\s,;/]*(?:Stimm)?[Ee]nthaltung(?:\(?en\)?)?\s*[:=]?\s*(\d{1,3}))?/iu,m=>[m[1],m[2],m[3]]],
 [/(?<![\d.])(\d{1,3})\s+Ja(?:-?Stimmen)?(?!\p{L})[\s,;/]*(?:und\s+)?(\d{1,3})\s+Nein(?:-?Stimmen)?(?!\p{L})(?:[\s,;/]*(?:und\s+|bei\s+)?(\d{1,3})\s+(?:Stimm)?[Ee]nthaltung(?:en)?)?/u,m=>[m[1],m[2],m[3]]],
 [/(?:Abstimmung(?:sergebnis)?|Ergebnis|Stimmenverhältnis)\s*:?\s*(?:einstimmig\s*)?(\d{1,3})\s*:\s*(\d{1,3})(?!\d)(?:\s*:\s*(\d{1,3}))?/iu,m=>[m[1],m[2],m[3]]],
 [/(?<!\p{L})mit\s+(\d{1,3})\s*:\s*(\d{1,3})(?:\s*:\s*(\d{1,3}))?\s+Stimmen/iu,m=>[m[1],m[2],m[3]]],
 // "3 dafür, 9 dagegen, 1 Enthaltung", "dafür: 3, dagegen: 9".
 [/(?<![\d.])(\d{1,3})\s+(?:Stimmen\s+)?dafür(?!\p{L})[\s,;/]*(?:und\s+)?(\d{1,3})\s+(?:Stimmen\s+)?dagegen(?!\p{L})(?:[\s,;/]*(?:und\s+|bei\s+)?(\d{1,3})\s+(?:Stimm)?[Ee]nthaltung(?:en)?)?/u,m=>[m[1],m[2],m[3]]],
 [/(?<!\p{L})dafür\s*[:=]?\s*(\d{1,3})(?!\d)[\s,;/]*dagegen\s*[:=]?\s*(\d{1,3})(?!\d)(?:[\s,;/]*(?:Stimm)?[Ee]nthaltung(?:en)?\s*[:=]?\s*(\d{1,3}))?/iu,m=>[m[1],m[2],m[3]]],
 // A bare count needs spaces around the colon; "19:30" is a time.
 [/(?<![\d:.,])(\d{1,3})\s+:\s+(\d{1,3})(?![\d:.,])(?:\s+:\s+(\d{1,3}))?/u,m=>[m[1],m[2],m[3]]],
];
const ABBREVIATION=/(?:^|[\s(])(?:Nr|Abs|bzw|ggf|z\.B|vgl|gem|lt|St|Fl|Flst|Dr|Hr|Fr|Art|Ziff|Tsd|Mio|Mrd|ca|evtl|inkl|zzgl|u\.a|d\.h|i\.V|i\.A|bzgl|Str|Fl\.Nr|Gde|Gem|Bgm|Lkr|Az)$/i;
function sentenceAround(text,index){
 const flat=text.replace(/\n/g,' ');
 const ends=[];
 for(const m of flat.matchAll(/[.!?;](?=\s+(?:\p{Lu}|"|\d))/gu)){if(/\d$/.test(flat.slice(0,m.index))&&m[0]==='.')continue;if(ABBREVIATION.test(flat.slice(Math.max(0,m.index-8),m.index)))continue;ends.push(m.index+1);}
 // A line that ends with a full stop or a colon closes its sentence, as does a line of its own ("Abstimmung: 12:2").
 let at=0;for(const line of text.split('\n')){at+=line.length+1;if(/[.!?:]$/.test(line.trim())||line.length<60)ends.push(at);}
 const start=Math.max(0,...ends.filter(e=>e<=index)),end=Math.min(flat.length,...ends.filter(e=>e>index));
 return flat.slice(start,end);
}
const SECTION=/^(?:Sachverhalt|Begründung|Diskussion|Beratung|Anlagen?|Hinweis|Beschlussvorschlag|Erläuterung|Vortrag)\b/i;
function resultText(text,index){
 const lines=text.split('\n');let at=0,line=0;
 for(;line<lines.length;line++){if(at+lines[line].length>=index)break;at+=lines[line].length+1;}
 let out='';
 for(let b=Math.min(line,lines.length-1);b>=0;b--){
  if(b<line&&SECTION.test(lines[b]))break;
  if(/^(?:Beschluss|Beschlussfassung|Ergebnis)(?:\s+(?:Nr\.?\s*)?[\w/.-]+)?\s*:/i.test(lines[b])){
   const part=[];for(let k=b;k<lines.length&&(k<=line||!SECTION.test(lines[k])&&!/^(?:Beschluss|Beschlussfassung)\b/i.test(lines[k]));k++){part.push(lines[k]);if(k>=line&&part.join(' ').length>=300)break;}
   out=part.join(' ');break;
  }
 }
 out=(out||sentenceAround(text,index)).replace(/\s+/g,' ').trim();
 return out.length>300?out.slice(0,299).trimEnd()+'…':out;
}
/** Outcome of an item from the text of its minutes: status, the sentence or "Beschluss: …" paragraph, vote counts. */
export function outcomeOf(blockText){
 const text=String(blockText||'').split('\n').map(normalizeLine).join('\n');
 const hits=[];let postNegated=false;
 for(const [status,re] of OUTCOMES)for(const m of text.matchAll(re)){
  const before=text.slice(Math.max(0,m.index-30),m.index);
  // "erteilt das gemeindliche Einvernehmen nicht", "befürwortet den Antrag nicht", "erteilt keine Zustimmung": the negation after
  // the verb, at the end of its clause or before the object.
  if(status==='approved'&&!/^stimm/i.test(m[0])){const tail=text.slice(m.index+m[0].length).split(/[.;!?\n]|,\s+(?:die|der|das|den|dem|da|weil|wenn|sofern|so\s+dass|und|aber|jedoch)\s/u)[0];if(/(?<!\p{L})nicht\s*$/u.test(tail)||/^\s+(?:\p{L}+\s+)?kein(?:e|en|er|em)?(?!\p{L})/u.test(tail)){postNegated=true;hits.push({status:'rejected',index:m.index});continue;}}
  // "stimmt dem Antrag nicht zu" rejects; "stimmt dem Antrag, die Hebesätze nicht zu erhöhen, zu" approves.
  if(status==='approved'&&/^stimm/i.test(m[0])&&/(?<!\p{L})nicht\s+(?:\p{L}+\s+)?zu$/iu.test(m[0])){hits.push({status:'rejected',index:m.index});continue;}
  // "lehnt den Antrag nicht ab" is no rejection.
  if(status==='rejected'&&/^lehn/i.test(m[0])&&/(?<!\p{L})nicht(?!\p{L})/iu.test(m[0]))continue;
  // "wird nicht verweigert/versagt" refuses nothing.
  // "Der Antrag wird nicht genehmigt": an approval negated is a refusal.
  // With a vote or a decision it is a rejection (below), whichever way the vote is counted.
  if(status==='approved'&&NEGATED.test(before)){postNegated=true;continue;}
  if(status==='rejected'&&/^(?:abgelehnt|lehn|versagt|verweigert|zurückgewiesen)/i.test(m[0])&&NEGATED.test(before))continue;
  hits.push({status,index:m.index});
 }
 let votes=null,voteAt=-1;
 for(const [re,parts] of VOTES){const m=text.match(re);if(m){const [y,n,a]=parts(m);votes={yes:Number(y),no:Number(n),abstentions:a===undefined?null:Number(a)};voteAt=m.index;break;}}
 const against=DECIDED_AGAINST.test(text);
 if(against)for(let i=hits.length-1;i>=0;i--)if(hits[i].status==='approved'&&DECIDE_WORD.test(text.slice(hits[i].index).match(/^\p{L}+/u)?.[0]||''))hits.splice(i,1);
 const found=new Set(hits.map(h=>h.status));
 // A tie rejects the motion; a majority for "abzulehnen" rejects the item, a majority against it leaves it open.
 if(votes&&votes.yes===votes.no&&votes.yes>0){found.delete('approved');found.add('rejected');hits.push({status:'rejected',index:voteAt});}
 else if(votes&&votes.yes!==votes.no&&!(against&&votes.yes<votes.no)){const s=votes.yes>votes.no&&!against?'approved':'rejected';found.add(s);hits.push({status:s,index:voteAt});}
 if((REFUSED.test(text)||postNegated)&&(votes||/(?<!\p{L})einstimmig(?!\p{L})/iu.test(text)||/^(?:Beschluss|Beschlussfassung)\b/imu.test(text))){found.delete('approved');found.add('rejected');hits.push({status:'rejected',index:text.search(REFUSED)});}
 if(PROCEDURE.test(text))found.clear();
 // Taking note or postponing is itself decided ("beschließt, den Punkt zu vertagen"; "12:0"): no contradiction.
 if(found.has('info')||found.has('postponed'))found.delete('approved');
 const unanimous=text.search(/(?<!\p{L})einstimmig(?!\p{L})/iu);
 if(!found.size&&unanimous>=0){const s=against?'rejected':'approved';found.add(s);hits.push({status:s,index:unanimous});}
 const status=found.size===1?[...found][0]:null;
 const first=hits.filter(h=>!status||h.status===status).sort((a,b)=>a.index-b.index)[0];
 return {status,result:first?resultText(text,first.index):'',votes};
}

const SIGNATURE=/^(?:gez\.|gezeichnet(?!\p{L})|Mit\s+freundliche[nm]\s+Grü(?:ß|ss)(?:en)?|(?:(?:Erste|Zweite|Dritte)[rn]?\s+|\d\.\s*)?(?:Ober)?Bürgermeister(?:in)?(?!\p{L})|Vorsitzende[rn]?(?!\p{L})|Ortsvorsteher(?:in)?(?!\p{L})|Ortsbürgermeister(?:in)?(?!\p{L})|Landrat(?!\p{L})|Landrätin|Amtsdirektor(?:in)?|Amtsvorsteher(?:in)?|Verbandsvorsteher(?:in)?|i\.\s?[VA]\.)/iu;
// "Musterbach, 07.10.2026" or "Musterbach, den 7. Oktober 2026" as a line of its own; "Am Dienstag, 14.10.2026, …" is not one.
// The place is a name ("Bad Musterbach", "Neustadt a. d. Aisch"); "Sitzung des Gemeinderates am Mittwoch, 14.10.2026" is none.
const PLACE_DATE=/^(?!(?:Am|Vom|Den|Ab|Bis|Seit)(?!\p{L}))(?!.*(?<!\p{L})(?:Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonnabend|Sonntag|Sitzung|Tagung)(?!\p{L}))\p{Lu}[\p{L}.-]*(?:\s+(?:\p{Lu}[\p{L}.-]*|a\.|d\.|i\.|an|am|im|in|bei|ob|der|dem|den|vor|unter|auf)){0,5},\s*(?:den\s+|am\s+)?\d{1,2}\.\s*(?:\d{1,2}\.\s*\d{2,4}|\p{L}+\.?\s*\d{4})\s*$/u;
const HINT=/^(?:Hinweis(?:e)?(?!\p{L})|Anmerkung|(?:Die\s+)?Sitzungsunterlagen|Die\s+(?:Unterlagen|Bevölkerung|Öffentlichkeit)|Anlagen?\s*:|Bekannt\s?gemacht|Ausgehängt|Abgenommen|Angeschlagen|Veröffentlicht|Zuhörer|Alle\s+Bürger|Interessierte)/iu;
const STOP=/^(?:Vorlage|Drucksache|Berichterstatter|Beschluss|Abstimmung|Sachverhalt|Begründung|Tagesordnung|Sitzungsort|Ort\s*:|Beginn|Datum|Zeit\s*:)/i;
const STOP_SENTENCE=/(?<!\p{L})(?:findet|statt|Anschluss|eingeladen|lade)(?!\p{L})/iu;
// An office ends a letter only as a short line of its own; "1. Bürgermeister … eröffnete die Sitzung" is text.
const signed=line=>SIGNATURE.test(line)&&(line.length<=60||/^(?:gez|Mit\s)/i.test(line));
const signature=(lines,i)=>signed(lines[i])||PLACE_DATE.test(lines[i])||/^den\s+\d{1,2}\./i.test(lines[i])||/(?<!\p{L})gez\./u.test(lines[i])||/^gez\./i.test(lines[i-1]||'')||/^gez\./i.test(lines[i+1]||'');
// Dates that are not the day of the meeting: of the notice, the issue of a paper, its posting, a deadline, a period of
// public display, a paper ("Vorlage vom").
const NOT_MEETING_DAY=/(?:Bekanntmachung|veröffentlicht|Veröffentlichung|aktualisiert|Aktualisierung|geändert|Änderung|zuletzt|publiziert|eingestellt|ausgehängt|Aushang|angeschlagen|abgenommen|Stand|erstellt|Ausgabe|Amtsblatt|Mitteilungsblatt|Nr\.(?:\s*[\d/]+)?|gedruckt|Schreiben|Einladung|Ladungsfrist|Erscheinungstag|Vorlage|Drucksache|Auslegung|ausgelegt|Einwendungen|Stellungnahmen?|Frist|Fristablauf)\s*(?:vom|am|:|den)?\s*(?:\p{L}+,?\s+)?$|(?<!\p{L})(?:bis|spätestens)(?:\s+(?:zum|spätestens|einschließlich))?\s*(?:\p{L}+,?\s+)?$|(?<!\p{L})(?:letzten|vorigen|vorherigen|vergangenen|früheren|vorangegangenen)\s+(?:\p{L}+\s+){0,2}Sitzung\p{L}*\s+(?:vom|am)\s*(?:\p{L}+,?\s+)?$|(?<!\p{L})Anschluss\s+an\s+(?:die|den)\s+(?:\p{L}+\s+){0,2}(?:Sitzung|Teil)\p{L}*\s+(?:vom|am)\s*(?:\p{L}+,?\s+)?$/iu;
const RANGE_NEXT=/^\s*(?:–|-|bis)\s*(?:\p{L}+,?\s+)?/u;
// A notice of a cancelled, postponed, replaced or continued meeting: the old day it names is not the day.
const CANCEL=/(?<!\p{L})(?:entf[äa]llt|entfallen|ausgefallen\p{L}*|abgesagt|f[äa]llt\s+aus|verlegt|verschoben|Ersatz|Ersatztermin|Fortsetzung|ursprünglich|geplante[n]?|angesetzte[n]?|vorgesehene[n]?)(?!\p{L})/iu;
const OLD_DAY=/(?<!\p{L})(?:für|vom|von|statt|anstatt|anstelle|ursprünglich|nicht\s+am|nicht\s+wie\s+(?:geplant|vorgesehen)\s+am)\s+(?:den\s+|dem\s+|am\s+)?(?:\p{L}+,?\s+)?$/iu;
// The old day named after its date ("die am 07.10.2026 geplante Sitzung"), the new one after a word that moves it.
const OLD_AFTER=/^\s*[,)]?\s*(?:geplante|vorgesehene|angesetzte|anberaumte|terminierte|ursprünglich)/iu;
const NEW_DAY=/(?<!\p{L})(?:auf|sondern|nunmehr|jetzt|neu|neuer\s+Termin\s*:?)\s+(?:den\s+|dem\s+|am\s+)?(?:\p{L}+,?\s+)?$/iu;
/**
 * Meetings a text moves or cancels: [{from, to, committee}] for "Die für Mittwoch, 07.10.2026 angesetzte Sitzung des
 * Gemeinderates wird auf Mittwoch, 14.10.2026 verlegt" (to null for "… entfällt", "… ist abgesagt"). The days of the
 * sentence decide: one old day and at most one new one.
 */
export function meetingMoves(lines){
 const out=[];
 for(const raw of (lines||[]).map(normalizeLine)){
  for(const sentence of raw.split(/(?<=[.!?])\s+(?=\p{Lu})/u)){
   if(!CANCEL.test(sentence)||!SESSION_WORD.test(sentence))continue;
   const days=germanDates(sentence);if(!days.length||days.length>2)continue;
   const old=days.filter(d=>OLD_DAY.test(sentence.slice(Math.max(0,d.index-60),d.index))||OLD_AFTER.test(sentence.slice(d.index+d.text.length))),fresh=days.filter(d=>NEW_DAY.test(sentence.slice(Math.max(0,d.index-40),d.index)));
   const committee=committeeOf(sentence);
   if(old.length===1&&fresh.length===1&&old[0].iso!==fresh[0].iso)out.push({from:old[0].iso,to:fresh[0].iso,committee});
   else if(days.length===1&&!fresh.length&&/(?<!\p{L})(?:entf[äa]llt|entfallen|ausgefallen|abgesagt|f[äa]llt\s+aus|findet\s+nicht\s+statt|verlegt|verschoben)(?!\p{L})/iu.test(sentence))out.push({from:days[0].iso,to:null,committee});
  }
 }
 return out;
}
// The head of a gazette (its issue, number, edition): the day it names is the day of the issue.
const ISSUE_LINE=/(?:Amtsblatt|Mitteilungsblatt|Gemeindeblatt|Nachrichtenblatt|Wochenblatt|Amtsbote|Gemeindebote|Heimatblatt|Ausgabe|Jahrgang|(?<!\p{L})Nr\.\s*\d|(?<!\p{L})KW\s*\d)/iu;
// The date field of a letter head ("Datum: 07.10.2026") names the day of the letter where another line names the meeting's.
const LETTER_DATE=/^(?:Datum|Unser\s+Zeichen|Ihr\s+Zeichen|Aktenzeichen|Az\.?|Telefon|Tel\.?|Fax)\s*:/iu;
// How much a line names the day of the meeting: a word of the session, and a weekday or time of day besides.
const MEETING_WORD=/(?<!\p{L})(?:Sitzung|Tagung|findet|statt|Termin|Beginn|tritt|tagt)(?!\p{L})|sitzung(?!\p{L})|sitzungstermin|sitzungstag|sitzungsdatum/iu;
const WEEKDAY_WORD=/(?<!\p{L})(?:Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonnabend|Sonntag)(?!\p{L})/u;
const SESSION_WORD=/(?:sitzung|tagung)(?!\p{L})/iu;
// The date of a letter set on the line of its subject (a Word letter head with a tab: "Einladung zur Sitzung des Gemeinderates
// Datum: 07.10.2026", "… Gemeinderates Musterbach, den 7. Oktober 2026"): at the end of the line, after "Datum:" or a place
// and a comma. A field "Termin:", "Sitzungstag:" names the meeting's day.
const LETTER_TAIL=/(?:.\s*Datum\s*:\s*|(?<!\p{L})(?!(?:Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonnabend|Sonntag|Mo|Di|Mi|Do|Fr|Sa|So)(?!\p{L}))\p{Lu}[\p{L}.-]+,\s*(?:den\s+)?)$/u;
const MEETING_FIELD=/^(?:Termin|Sitzungstermin|Sitzungstag|Sitzungsdatum|Wann)\s*:/iu;
const dateScore=(line,d)=>dayScore(line)+(MEETING_FIELD.test(line)?1:0)-(d&&d.index>10&&!/[^\s.,;:)]/.test(line.slice(d.index+d.text.length))&&LETTER_TAIL.test(line.slice(0,d.index))?3:0);
const dayScore=line=>(MEETING_WORD.test(line)?2:/(?<!\p{L})(?:am|vom)(?!\p{L})/iu.test(line)?1:0)+(timeOf(line)||WEEKDAY_WORD.test(line)?2:0)+1-(LETTER_DATE.test(line)&&!SESSION_WORD.test(line)?2:0);
// A day without year ("Mittwoch, 14. Oktober", "am Mittwoch, 14.10.") counts where its weekday fits exactly one year
// next to the years the document names; without weekday it is not known.
const WEEKDAYS={sonntag:0,montag:1,dienstag:2,mittwoch:3,donnerstag:4,freitag:5,samstag:6,sonnabend:6};
const YEARLESS=new RegExp(`(?:(Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonnabend|Sonntag),?\\s+(?:den\\s+)?)?(?<![\\d.])(\\d{1,2})\\.\\s*(?:(\\d{1,2})\\.(?!\\s*\\d)|${MONTH}(?!\\p{L})(?!\\.?\\s*\\d{4}))`,'gu');
function yearlessDates(line,years){
 const out=[];
 for(const m of String(line).matchAll(YEARLESS)){
  const day=Number(m[2]),month=m[3]?Number(m[3]):MONTHS[m[4].toLowerCase().slice(0,3)];
  if(!month||month>12||day<1||day>31)continue;
  if(!m[1]){out.push({iso:null,index:m.index,text:m[0]});continue;}
  const fits=[...new Set(years.flatMap(y=>[y-1,y,y+1]))].filter(y=>{const d=new Date(Date.UTC(y,month-1,day));return d.getUTCMonth()===month-1&&d.getUTCDay()===WEEKDAYS[m[1].toLowerCase()];});
  out.push({iso:fits.length===1?`${fits[0]}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`:null,index:m.index,text:m[0]});
 }
 return out;
}
function meetingDates(lines,i,ctx){
 if(signature(lines,i))return [];
 const line=lines[i];
 if(ISSUE_LINE.test(line)&&!MEETING_WORD.test(line))return [];
 const found=germanDates(line);
 for(const y of yearlessDates(line,ctx?.years||[]))if(y.iso&&!found.some(f=>y.index<f.index+f.text.length&&f.index<y.index+y.text.length))found.push(y);
 // A moved meeting names its old and its new day in one sentence ("am 07.10.2026 … auf Mittwoch, 14.10.2026 verlegt",
 // "nicht am …, sondern am …").
 const moved=CANCEL.test(line)||found.length>1&&/(?<!\p{L})sondern(?!\p{L})/iu.test(line);
 const days=found.filter(d=>{
  if(NOT_MEETING_DAY.test(line.slice(Math.max(0,d.index-45),d.index)))return false;
  if(moved&&(OLD_DAY.test(line.slice(Math.max(0,d.index-60),d.index))||OLD_AFTER.test(line.slice(d.index+d.text.length))))return false;
  // The first day of a period ("vom 05.10.2026 bis 06.11.2026") is no day of a meeting.
  const after=line.slice(d.index+d.text.length),r=after.match(RANGE_NEXT);
  return !(r&&germanDates(after.slice(r[0].length))[0]?.index===0);
 });
 if(!moved||new Set(days.map(d=>d.iso)).size<=1)return days;
 // Still several days: only the one a word names as the new day; otherwise none of them.
 const fresh=days.filter(d=>NEW_DAY.test(line.slice(Math.max(0,d.index-40),d.index)));
 return new Set(fresh.map(d=>d.iso)).size===1?fresh:[];
}
// A report that names its day without year or by weekday only ("in seiner Sitzung am 14. Oktober", "fand am Mittwoch
// statt"): a bare date elsewhere (of the publication) is not the day.
const PAST_WEEKDAY=/(?<!\p{L})(?:fand|tagte|traf\s+sich|beriet|befasste\s+sich)\s+(?:\p{L}+\s+){0,4}am\s+(?:vergangenen\s+|letzten\s+|gestrigen\s+)?(?:Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonnabend|Sonntag)(?!\s*,?\s*(?:den\s+)?\d)/iu;
// Appointments other than the meeting named in its head ("Am Vortag findet eine Ortsbesichtigung statt", "Zuvor … Bürgerversammlung",
// "Vorbesprechung der Fraktionen"): their days are not the meeting's.
const OTHER_EVENT=/(?<!\p{L})(?:Ortsbesichtigung\p{L}*|Ortstermin\p{L}*|Ortsbegehung\p{L}*|Besichtigung\p{L}*|Begehung\p{L}*|Bereisung\p{L}*|Rundgang|Bürgerversammlung\p{L}*|Einwohnerversammlung\p{L}*|Informationsveranstaltung\p{L}*|Infoveranstaltung\p{L}*|Vorbesprechung\p{L}*|Fraktionssitzung\p{L}*|Fraktionen|Vortag|Zuvor|Vorher|Vorab)(?!\p{L})/iu;
// A note set before or above a head ("Hinweis: Die Sitzung … beginnt bereits um 18.00 Uhr") is no head of a meeting.
const DATED_WEEKDAY=/(?<!\p{L})(?:Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonnabend|Sonntag),?\s+(?:den\s+)?\d{1,2}\.\s?(?:\d{1,2}\.|\p{L})/u;
const NOTE_LINE=/^(?:Hinweis|Achtung|Wichtig|Bitte\s+beachten|Anmerkung|Info)\s*:/iu;
// A weekday not followed by its date ("am Mittwoch um 19 Uhr", "am Mittwoch, 19 Uhr").
const BARE_WEEKDAY=/(?<!\p{L})(Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonnabend|Sonntag)(?!\p{L})(?!\s*,?\s*(?:den\s+)?\d{1,2}\.\s?(?:\d{1,2}\.|\p{L}))/gu;
const RELATIVE_DAY=/(?<!\p{L})(?:kommenden|nächsten|diesen|morgigen|heutigen|folgenden|übernächsten)\s+(?:Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonnabend|Sonntag|Woche)(?!\p{L})|(?<!\p{L})(?:nächster|kommender|dieser|übernächster)\s+Woche(?!\p{L})|(?<!\p{L})(?:morgen|übermorgen|heute)\s+(?:Abend|um|ab)(?!\p{L})/iu;
// A row of a table of dates that holds the first item of an agenda ("21.10.2026 Bauausschuss 1. Bauvoranfrage").
const ROW_ITEM=/(?<![\d.])\d{1,2}\.\s?\d{1,2}\.\s?\d{2,4}(?:\s*[,|–-]?\s*\p{L}[\p{L}\s,-]{0,60}?)?\s+(?:TOP\s*)?\d{1,2}[.)]?\s+\p{Lu}/u;
const RELATIVE_PAST=/(?<!\p{L})(?:vergangenen|letzten|gestrigen|vorigen|vorletzten|zurückliegenden)\s+(?:Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonnabend|Sonntag)(?!\s*,?\s*(?:den\s+)?\d)/iu;
const unresolvedDay=(lines,from,to,ctx)=>{for(let i=from;i<to;i++){const l=lines[i];if(signature(lines,i))continue;if(MEETING_WORD.test(l)&&yearlessDates(l,ctx.years).some(d=>!d.iso)||PAST_WEEKDAY.test(l))return true;}return false;};
// The date of the line that names the day best; on a tie the first.
// Several days named as a meeting's (a list of dates above an agenda): the heading of the agenda names the day, else none.
function pickDate(lines,from,to,ctx){
 let best=null;const strong=[];
 for(let i=from;i<to;i++)for(const d of OTHER_EVENT.test(lines[i])?[]:meetingDates(lines,i,ctx)){const score=dateScore(lines[i],d);if(score>=3)strong.push({...d,score,line:i});if(!best||score>best.score)best={...d,score,line:i};}
 if(best&&best.score<=1&&unresolvedDay(lines,from,to,ctx))return null;
 // The text names the day only as a past weekday ("am vergangenen Mittwoch"): a day in a line that names no session (the
 // publication of an article) is not the day of the meeting.
 if(best&&!MEETING_WORD.test(lines[best.line])&&lines.slice(from,to).some(l=>RELATIVE_PAST.test(l)||PAST_WEEKDAY.test(l)))return null;
 if(new Set(strong.map(d=>d.iso)).size>1){const agenda=strong.filter(d=>/Tagesordnung/i.test(lines[d.line]));return new Set(agenda.map(d=>d.iso)).size===1?agenda.at(-1):null;}
 return best;
}
// A line that starts a meeting in a text of several: it names a session (or is the head of an agenda or invitation)
// and a body, a day follows within two lines. Notes on an earlier or later reading ("Vorberatung in öffentlicher
// Sitzung des Bauausschusses am …") start nothing, nor do notes on a cancelled or moved meeting.
const NOT_HEADER=new RegExp(`(?<!\\p{L})(?:wird|wurde|werden|wurden|hat|haben|hatte|genehmigt|beschlossen|nächste[nrm]?|letzte[nrm]?|vorherige[nrm]?|vergangene[nrm]?|vorangegangene[nrm]?|Bekanntgabe|Genehmigung|Anfragen?|Mitteilung(?:en)?|Vorberatung|vorberaten|vorberatend|empfiehlt|empfohlen|Empfehlung|Beschlussempfehlung)(?!\\p{L})|aus\\s+(?:der\\s+)?(?:nicht\\s*-?\\s*)?öffentliche[rn]?\\s+Sitzung|^\\s*[([]|${CANCEL.source}`,'iu');
const AGENDA_HEAD=/^(?:Tagesordnung|Einladung|(?:Öffentliche\s+)?Bekanntmachung)(?!\p{L})/iu;
const SESSION_ON=/^(?:(?:nicht\s*-?\s*)?öffentliche\s+|ordentliche\s+)?(?:Sitzung|Tagung)\s+(?:am|vom)(?!\p{L})/iu;
// A day of its own with weekday ("Mittwoch, 14.10.2026") as on a page of dates, the time and body in the next line.
const DATE_ONLY=new RegExp(`^${WEEKDAY}\\d{1,2}\\.\\s?(?:\\d{1,2}\\.\\s?\\d{2,4}|${MONTH}\\s*\\d{4})(?:\\s*[,|–-]?\\s*(?:ab\\s+|um\\s+)?(?:\\d{1,2}[:.]\\d{2}(?:\\s*Uhr)?|\\d{1,2}\\s*Uhr))?$`,'iu');
const dayLine=line=>DATE_ONLY.test(line)&&WEEKDAY_WORD.test(line);
// A field that names the day of a meeting ("Termin: 21.10.2026, 18:00 Uhr", "Sitzungstag: Mittwoch, 14.10.2026").
const DAY_FIELD=/^(?:Termin|Datum|Sitzungstermin|Sitzungstag|Sitzungsdatum|Tag|Wann)\s*:/iu;
const SHORT_WEEKDAY=/(?<!\p{L})(?:Mo|Di|Mi|Do|Fr|Sa|So)\.?,?\s+\d/u;
// The line ends inside a sentence or title that goes on in the next line ("…; Empfehlung aus der").
const OPEN_END=/(?:^|\s)(?:der|die|das|des|dem|den|aus|von|vom|im|in|zur|zum|und|oder|sowie|für|mit|auf|über|nach|bei|einer|eines|einem|seiner|ihrer|gemäß|laut)$|[,;:–-]$/iu;
const SESSION_AT=new RegExp(`^(?:Aus\\s+der\\s+|In\\s+der\\s+)?(?:(?:öffentlichen?|ordentlichen?)\\s+)?(?:Sitzung|Tagung)\\s+(?:am|vom)\\s+${WEEKDAY}\\d{1,2}\\.\\s?(?:\\d{1,2}\\.\\s?\\d{2,4}|${MONTH}\\s*\\d{4})(?:\\s*,?\\s*(?:um\\s+)?\\d{1,2}(?:[:.]\\d{2})?\\s*Uhr)?\\s*:?$`,'iu');
// "Hauptausschuss vom 29.09.2026": a body and its day, nothing else.
const BODY_ON=new RegExp(`^[\\p{L} -]{3,60}?\\s+(?:vom|am)\\s+${WEEKDAY}\\d{1,2}\\.\\s?(?:\\d{1,2}\\.\\s?\\d{2,4}|${MONTH}\\s*\\d{4})\\s*:?$`,'iu');
function meetingHeader(lines,i,ctx){
 const line=lines[i],it=itemOf(line),prev=lines[i-1]||'',next=lines[i+1]||'';
 // The continuation of a wrapped item title ("Ö 2 Bebauungsplan …; Empfehlung aus der" / "Sitzung des Bauausschusses vom
 // 22.09.2026") starts nothing.
 if(i>0&&!it&&itemOf(prev)&&!/[.!?]$/.test(prev)&&(OPEN_END.test(prev)||/^\p{Ll}/u.test(line)||NOT_HEADER.test(prev)))return null;
 // A day of its own, also without weekday where the next line names a body's session ("14.10.2026" / "Gemeinderat –
 // öffentliche Sitzung"); that line is part of this head, not a head of its own.
 if(dayLine(line)||DATE_ONLY.test(line)&&SESSION_WORD.test(next)){
  // The next line names the body and its session and nothing else ("Gemeinderat – öffentliche Sitzung"); a headline ("Gemeinderats-
  // sitzung: Kita-Neubau beschlossen") below the day of an article does not make that day the meeting's.
  const rest=next.replace(new RegExp(BODY.source,'giu'),' ').replace(/(?<!\p{L})(?:(?:nicht\s*-?\s*)?öffentliche[rnms]?|ordentliche[rnms]?|außerordentliche[rnms]?|konstituierende[rnms]?|Sitzung|Tagung|des|der|im|am|um|Uhr|Beginn|Ort|Rathaus|Sitzungssaal)(?!\p{L})/giu,' ').replace(/[^\p{L}]+/gu,' ').trim();
  const c=next.length<=100&&!itemOf(next)&&!NOT_HEADER.test(next)&&rest.split(' ').filter(Boolean).length<=1&&committeeOf(next),d=meetingDates(lines,i,ctx)[0];
  if(c&&d)return {date:d.iso,committee:c,day:{...d,score:dateScore(line,d),line:i},own:true};
 }
 if(i>0&&DATE_ONLY.test(prev)&&!itemOf(prev)&&SESSION_WORD.test(line)&&committeeOf(line))return null;
 // "Öffentliche Sitzung vom 16.09.2026", "Aus der öffentlichen Sitzung am 16. September 2026:" on a page of one body's
 // decisions: a head of that body (named by the title) on another day.
 // Not a line of a list of dates: no other day before the next item.
 const lastDay=k=>{for(let j=k+1;j<lines.length&&j<=k+6&&!itemOf(lines[j]);j++)if(germanDates(lines[j]).length)return false;return true;};
 if(!it&&line.length<=90&&SESSION_AT.test(line)&&lastDay(i)){
  const d=meetingDates(lines,i,ctx),committee=committeeOf(line)||ctx.committee;
  if(committee&&new Set(d.map(x=>x.iso)).size===1)return {date:d[0].iso,committee,day:{...d[0],score:dateScore(line,d[0]),line:i},own:true};
 }
 if(line.length>160||NOT_HEADER.test(line)||NOTE_LINE.test(line))return null;
 // "Bauausschuss" on a line of its own, "Sitzung am Dienstag, 21.10.2026", "Dienstag, 20. Oktober 2026, 18 Uhr" or
 // "Termin: 21.10.2026" below it.
 const alone=!SESSION_WORD.test(line)&&!it&&line.length<=80&&/^\p{Lu}/u.test(line);
 const twoLines=alone&&!NOT_HEADER.test(next)&&(SESSION_ON.test(next)||(dayLine(next)||DAY_FIELD.test(next))&&germanDates(next).length>0);
 // "Gemeinderat | Mittwoch 14.10.2026 | 19:00 Uhr": the body first, its day and time in the same line.
 const body=line.match(BODY),inline=!it&&!!body&&body.index<=1&&line.length<=120&&germanDates(line).length>0&&(timeOf(line)||WEEKDAY_WORD.test(line)||SHORT_WEEKDAY.test(line)||BODY_ON.test(line));
 if(!SESSION_WORD.test(line)&&!twoLines&&!inline&&!(AGENDA_HEAD.test(line)&&germanDates(line).length))return null;
 if(it&&!/^(?:(?:nicht\s*-?\s*)?öffentliche\s+|ordentliche\s+|konstituierende\s+|\d+\.\s+)?(?:Sitzung|Tagung)(?!\p{L})/iu.test(it.title))return null;
 const committee=committeeOf(line);if(!committee)return null;
 // The day within two lines, or further through short lines of the head (place, beginning) up to "Sitzungstag: …".
 let best=null;const strong=[];
 for(let k=i;k<Math.min(lines.length,i+7);k++){
  if(k>i&&(itemOf(lines[k])||lines[k].length>100&&k>i+2||k>i+1&&SESSION_WORD.test(lines[k])&&committeeOf(lines[k])||DATE_ONLY.test(lines[k])&&SESSION_WORD.test(lines[k+1]||'')))break;
  if(k>i+2&&best)break;
  // The day of another appointment (a site visit the day before, a citizens' meeting before it) is not the meeting's.
  if(k!==i&&OTHER_EVENT.test(lines[k]))continue;
  for(const d of meetingDates(lines,k,ctx)){const score=dateScore(lines[k],d);strong.push({...d,score,line:k});if(!best||score>best.score)best={...d,score,line:k};}
 }
 // Several days named strongly: only the one of the head line or of a line that names the session; otherwise none.
 const many=strong.filter(d=>d.score>=3);
 if(new Set(many.map(d=>d.iso)).size>1){const here=many.filter(d=>d.line===i),own=here.length?here:many.filter(d=>SESSION_WORD.test(lines[d.line]));best=new Set(own.map(d=>d.iso)).size===1?own.sort((a,b)=>b.score-a.score)[0]:null;}
 return best?{date:best.iso,committee,day:best,own:AGENDA_HEAD.test(line)||/^(?:(?:nicht\s*-?\s*)?öffentliche\s+|ordentliche\s+|konstituierende\s+|\d+\.\s+)?(?:Sitzung|Tagung|Niederschrift|Protokoll|Sitzungsbericht|Bericht)(?!\p{L})/iu.test(line)||twoLines||inline}:null;
}
// The same body with or without the name of the place ("Gemeinderat Musterbach", "Gemeinderat").
const sameBody=(a,b)=>a===b||a.startsWith(b+' ')||b.startsWith(a+' ');
const plainTitle=s=>s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu,'');
const sameTitle=(a,b)=>{const x=plainTitle(a),y=plainTitle(b);return !!x&&!!y&&(x.startsWith(y.slice(0,25))||y.startsWith(x.slice(0,25)));};
// Joins a wrapped line: "Grund-" + "stück" is one word; "Bau-" + "und Umweltausschuss" keeps its hyphen and space.
const join=(a,b)=>/\p{Ll}-$/u.test(a)&&/^\p{Ll}/u.test(b)&&!/^(?:und|oder|sowie|bzw)(?!\p{L})/u.test(b)?a.slice(0,-1)+b:/-$/.test(a)&&/^\p{Lu}/u.test(b)?a+b:a+' '+b;
const ddmmyyyy=iso=>iso?iso.split('-').reverse().join('.'):'';
// Words of a title for comparing two wordings of one item: stems of six letters, without small words.
const SMALL=new Set('der die das des den dem und oder fuer von vom zur zum auf aus mit bei einer eines einem eine ein ueber im in am an zu nach sowie bzw'.split(' '));
const stems=t=>new Set(fold(composeUmlauts(t)).split(/[^a-z0-9]+/).filter(w=>w.length>=3&&!SMALL.has(w)).map(w=>w.slice(0,6)));
// Numbers of a title (plot, house, plan, lot): two titles that both have numbers name the same item only with the same.
const numbersOf=t=>new Set((String(t).match(/\d+(?:[/.-]\d+)*/g)||[]).filter(n=>!/^\d{1,2}\.\d{1,2}\.(?:\d{2}|\d{4})$/.test(n)));
/** Whether two titles name the same item: most words of the shorter one are in the other, and their numbers agree. */
export function similarTitles(a,b){
 const x=stems(a),y=stems(b);if(!x.size||!y.size)return false;
 const p=numbersOf(a),q=numbersOf(b);if(p.size&&q.size&&(p.size!==q.size||[...p].some(n=>!q.has(n))))return false;
 let shared=0;for(const w of x)if(y.has(w))shared++;
 return shared/Math.min(x.size,y.size)>=0.6;
}

// Letters run together ("NichtöffentlicherTeil"), framed ("– Nichtöffentlicher Teil –") or numbered: a short line that
// is nothing but a heading of the non-public part.
const fold=s=>s.toLowerCase().replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss');
const CLOSED_LINE=/^[-–*•_.:\s]*(?:[a-h]|[ivx]{1,4}|\d{1,2})?[.):]?(?:tagesordnung|teil[a-h]?)?[-–:]?(?:nicht-?oeffentliche?[rnms]?|unterausschlussderoeffentlichkeit|vertraulich|geschlossenesitzung|noet|noe|n\.oe\.?t?|n-?teil|n-sitzung)(?:teil|sitzung|sitzungsteil|tagesordnung|beratung|punkte|angelegenheiten)?[-–.:*•_]*$/;
/** A short line that, read without spaces, is a heading of the non-public part (also one that names "NÖT" among others). */
export const closedLine=line=>{const l=canonNP(normalizeLine(line));return l.length<=60&&CLOSED_LINE.test(fold(l).replace(/\s+/g,''))||l.length<=30&&/(?:^|[^a-z])no-?e?t(?:[^a-z]|$)/.test(fold(l))&&/(?:^|[^\p{L}])N(?:Ö|OE|Oe|ö)T(?!\p{L})/iu.test(l);};
// Lists of those present in minutes ("Anwesend:", "Es waren anwesend:", "Gemeinderatsmitglieder:", "Gewählt wurde:"):
// their numbered lines are persons, not items.
// Also a sentence that introduces such a list ("Die Feuerwehrversammlung hat gewählt:", "In den Bauausschuss werden
// entsandt:", "folgende Besetzung des Bauausschusses:").
const LIST_INTRO=/(?<!\p{L})(?:aufgenommen|eingetragen|gemeldet|bestimmt|gewählt|geehrt|entsandt|entsendet|bestellt|berufen|benannt|vorgeschlagen|nominiert|ernannt|verpflichtet|vereidigt|verabschiedet|ausgezeichnet|Besetzung|besetzt|Mitglieder|Vertreter(?:innen)?|Stellvertreter(?:innen)?|Sitzverteilung|Wahlvorschl\p{L}*|Kandidat\p{L}*|Bewerber\p{L}*|Ehrung\p{L}*)(?!\p{L})[^:]{0,80}:\s*$/iu;
// A numbered line of such a list: a person with or without office ("Herr Hans Maier", "Kassierer Tim Test", "Mitglied: GR
// Hans Huber, Vertreter: GR Tim Test", "Bürgermeister a. D. Fritz Alt").
const personish=t=>isPerson(t)||/^(?:Herr|Frau)\s/u.test(t)||/(?:^|\s)(?:Mitglied|Vertreter(?:in)?|Stellvertreter(?:in)?|Vorsitz(?:ende[rn]?)?|Beisitzer(?:in)?|Ersatzmitglied)\s*:/u.test(t)||/^(?:\p{Lu}[\p{L}.-]*\s+){1,3}(?:(?:Dr|Prof)\.\s+)?\p{Lu}\p{Ll}+(?:-\p{Lu}\p{Ll}+)?\s+\p{Lu}\p{Ll}+(?:-\p{Lu}\p{Ll}+)?(?:\s*\([^)]*\))?$/u.test(t);
const ATTENDANCE=/^(?:(?:Zur|Zu\s+der|In\s+der|Bei\s+der)\s+Sitzung\s+(?:waren|sind|ist|war)\s+(?:\p{L}+\s+)?(?:anwesend|erschienen|zugegen)|(?:Anwesend|Erschienen|Zugegen)\s+(?:waren|sind)|Anwesend|Anwesenheit|Anwesende|Abwesend|Entschuldigt|Es\s+(?:waren|sind)\s+(?:anwesend|erschienen)|Es\s+fehlt(?:e|en)?|Erschienen|Teilnehmer(?:innen)?|Teilnehmende|Sitzungsteilnehmer|Stimmberechtigt|\p{L}*[Mm]itglieder|Gemeinderäte|Gemeinderätinnen|Stadträte|Stadträtinnen|Gewählt\s+(?:wurde|wurden|ist|sind)|Geehrt\s+(?:wurde|wurden)|Es\s+wurden\s+(?:gewählt|geehrt)|Vorgeschlagen\s+(?:wurde|wurden)|Bewerber(?:innen)?|Kandidat(?:en|innen)?)\p{L}*(?:\s+(?:waren|sind|wurden))?(?:\s+(?:\p{L}+|des|der)){0,3}\s*(?::|$)/iu;
const END_ATTENDANCE=/^(?:Tagesordnung|Sitzungsverlauf|Verlauf|Beginn|Eröffnung|Beratung|TOP\s*\d|Punkt\s*\d|Der\s|Die\s|Das\s)/iu;
const PERSON=new RegExp(`^(?:Herr|Frau|Dr\\.|Prof\\.)\\s|^\\p{Lu}[\\p{Ll}'-]+(?:-\\p{Lu}[\\p{Ll}'-]+)?,?\\s+\\p{Lu}[\\p{Ll}'.-]+(?:\\s*\\([^)]{1,30}\\))?$|^${NAME},?\\s+${NAME}\\s+(?:${PARTY}|${OFFICE_TAIL})$`,'u');
const isPerson=t=>PERSON.test(t)||person(t);
// The heading of the agenda; numbered lines before it are lists of the head (those present, offices), not items.
const AGENDA_LINE=/^(?:Tagesordnung|TO)(?:\s*[-–:(]\s*(?:öffentliche[rn]?\s+(?:Teil|Sitzung)|öffentlich)\s*\)?)?\s*:?$/iu;
const where=(committee,date,title)=>[committee,ddmmyyyy(date)].filter(Boolean).join(' ')||title||'Sitzung';

// --- lines of a meeting -----------------------------------------------------------------------------------------------
// A word of the non-public part broken at the end of a line ("Nichtöf-", "nicht-", "N i c h t ö f -"): joined with the
// line that goes on with it, also across a page break with a running head between (up to four lines, never an item).
const NP_FRAGMENT=/(?<![a-z])n\s?i\s?c\s?h\s?t(?:[\s\-–]*(?:o\s?e|o)(?:\s?f){0,2}(?:\s?e)?(?:\s?n)?(?:\s?t)?(?:\s?l)?(?:\s?i)?(?:\s?c)?(?:\s?h)?)?\s*([-–])?\s*$/;
const NP_BROKEN=/(?<![a-z])nicht\s?[-–]?\s?(?:o\s?e|o)?(?:\s?f){0,2}(?:\s?e)?(?:\s?n)?(?:\s?t)?(?:\s?l)?\s*[-–]\s*$/;
const DAY_REST=new RegExp(`^(?:${MONTH}\\s*\\d{4}|\\d{1,2}\\.\\s?\\d{2,4})(?!\\d)`,'iu');
function prepareLines(lines){
 const src=(lines||[]).map(normalizeLine).filter(Boolean),out=[];
 for(let i=0;i<src.length;i++){
  // A day broken between day and month ("am Mittwoch, 14." / "Oktober 2026, um 19.00 Uhr") is one line.
  if(/(?<![\d.])\d{1,2}\.$/.test(src[i])&&DAY_REST.test(src[i+1]||'')){src.splice(i,2,src[i]+' '+src[i+1]);}
  // A body's name wrapped at its hyphen in a narrow column ("Öffentliche Sitzung des Bau-" / "und Umweltausschusses") is one line.
  if(/\p{L}-$/u.test(src[i])&&src[i+1]&&!itemOf(src[i])&&!itemOf(src[i+1])){const j=join(src[i],src[i+1]),c=committeeOf(j);if(c&&c!==committeeOf(src[i])&&c!==committeeOf(src[i+1]))src.splice(i,2,j);}
  const l=src[i],f=fold(l).match(NP_FRAGMENT);
  // A field and its value on two lines (<dt>Öffentliche Sitzung</dt><dd>nein</dd>) are one line.
  if(l.length<=40&&/öffentlich/iu.test(l)&&!/:\s*\S/.test(l)&&/^(?:ja|nein|no|yes|x|-|–)$/iu.test(src[i+1]||'')){out.push(`${l.replace(/:\s*$/,'')}: ${src[i+1]}`);i++;continue;}
  if(f){
   const hyphen=!!f[1],frag=f[0].replace(/[^a-z]/g,'');let k=-1;
   for(let j=i+1;j<src.length&&j<=i+(hyphen?12:1);j++){
    if(itemOf(src[j]))break;
    if((hyphen||/^[öÖ]/.test(src[j]))&&/^nicht(?:oe|o|e)?ff?entl/.test(frag+fold(src[j]).replace(/[^a-z]/g,'').slice(0,24))){k=j;break;}
   }
   if(k>=0){const head=hyphen?l.replace(/\s*[-–]\s*$/,''):l,glue=hyphen?(/^\p{Ll}/u.test(src[k])?'':'-'):' ';out.push(head+glue+src[k],...src.slice(i+1,k));i=k;continue;}
  }
  // Any other sentence that names the non-public part only with its next line ("Die Öffentlichkeit soll bei TOP 4 aus-" /
  // "geschlossen werden", "Ende der öffentlichen" / "Sitzung"), also across a running head or page number between.
  if(!itemOf(l)&&!/[.!?]$/.test(l)&&!mentionsNonPublic(l)){
   let k=-1;
   for(let j=i+1;j<src.length&&j<=i+4;j++){
    if(itemOf(src[j])||mentionsNonPublic(src[j]))break;
    if(mentionsNonPublic(join(l,src[j]))){k=j;break;}
    if(src[j].length>80)break;
   }
   if(k>=0){out.push(join(l,src[k]),...src.slice(i+1,k));i=k;continue;}
  }
  out.push(l);
 }
 return out;
}
// The rest of a word of the non-public part broken off at the end of an earlier line ("liche Sitzung", "licher Teil"):
// where nothing joined it, it is a mention whose part is not known.
const NP_TAIL=/^(?:l|li|lich|liche[rnms]?|ich|iche[rnms]?|ntlich\p{Ll}*|tlich\p{Ll}*|entlich\p{Ll}*|fentlich\p{Ll}*|ffentlich\p{Ll}*)(?:\s+(?:Sitzung|Teil|Sitzungsteil|Beratung|Tagesordnung|Punkte|Angelegenheiten|Behandlung))?\s*[:.]?$/u;
// Words of a line between the items of an invitation that speak of the public, listeners, the press or secrecy; such a line
// that is not read as anything else is a mention of the non-public part (folded text). Invitations to the public are not.
const SUSPECT=/oeffentlichkeit|publikum|zuhoerer|zuhoerenden|besucher|\bgaeste|\bpresse\b|geheim|\bintern\b|vertraul|\bgeschlossen|verschlossen|ausgeschlossen|ausschluss|ausschl\.|mandatstraeger|\bzutritt|\bklausur|\bprivat\b|draussen/;
const SUSPECT_OK=/(?<!ohne\s+(?:die\s+)?)beteiligung\s+der\s+oeffentlichkeit|oeffentlichkeitsbeteiligung|oeffentlichkeits\W+(?:und|sowie)(?:\s+behoerden|\s*$)|fragen?\s+(?:aus\s+)?der\s+oeffentlichkeit|herstellung\s+der\s+oeffentlichkeit|(?:unterrichtung|information)\s+der\s+oeffentlichkeit|(?:herzlich\s+)?(?:eingeladen|willkommen)/;
// A short line without a sentence ("Geheime Sitzung", "Fortsetzung ohne Publikum"): a heading.
const suspect=l=>{const f=foldText(normalizeLine(l));return SUSPECT.test(f)&&!SUSPECT_OK.test(f);};
// A note that refers to items or to the rest of the agenda ("Die weiteren Punkte …", "ab hier", "Öffentlich sind die Tagesordnungspunkte 1 und 2").
const REFERS=/(?<!\p{L})(?:Tagesordnungspunkt\p{L}*|Punkte|Punkten|TOP|TOPs)(?!\p{L})/u;
const FORWARD=/(?<!\p{L})(?:(?:weitere[n]?|folgende[n]?|nachfolgende[n]?|restliche[n]?|übrige[n]?|anschließende[n]?|sich\s+anschließende[n]?)\s+(?:Tagesordnungs)?(?:punkte[n]?|Themen|Beratungen|Beratungsgegenstände[n]?|Gegenstände[n]?)|ab\s+hier|von\s+(?:hier|nun)\s+an|ab\s+(?:jetzt|sofort))(?!\p{L})/iu;
// A field of an item's card ("Öffentlichkeit: nein", "Sitzungsart: nichtöffentlich", "Zugang: nicht öffentlich").
const FIELD=/^[\p{L}][\p{L}\s./-]{0,40}?\s*:\s*\S.{0,60}$/u;
// The lines of an item's card ("Vorlage: 2026/043", "Drucksache Nr. 12/2026", "Berichterstatter: Kämmerer").
const CARD_FIELD=/^(?:Vorlage|Vorlagen?-?Nr\.?|Beschlussvorlage|Drucksache|Az\.?|Aktenzeichen|Berichterstatt\p{L}*|Referent\p{L}*|Sachbearbeit\p{L}*|Federführung|Zuständig\p{L}*|Anlagen?|Dokumente?|Beratungsfolge|Antragsteller\p{L}*)(?!\p{L})/iu;
// A part named by its key alone ("II", "B"), as a badge has it; the first part ("I", "A") is none.
const PART_KEY=/^(?:[B-H]|I{2,3}|IV|V|VI{1,3}|[2-9])$/u;
// A sentence that introduces a decision ("Der Gemeinderat beschließt:", "fasst folgenden Beschluss:").
const DECISION_INTRO=/(?<!\p{L})(?:beschließt|beschloss|beschließen|beschlossen|fasst\s+(?:folgenden|nachstehenden)\s+Beschluss|ergeht\s+folgender\s+Beschluss|Beschlussvorschlag|Beschlusstext|Beschluss|empfiehlt|stimmt\s+(?:folgendem|folgenden|wie\s+folgt)|wie\s+folgt)(?!\p{L})/iu;
const headingLike=l=>l.length<=70&&/^\p{Lu}\p{L}{3}/u.test(l)&&!/[.!?;,]$/.test(l)&&!/(?<!\p{L})(?:wird|werden|wurde|wurden|ist|sind|war|waren|erfolgt|erfolgen|findet|bleibt|bleiben|soll|sollen|kann|können|muss|müssen|mussten|musste|hat|haben)(?!\p{L})/iu.test(l);
// A note right after an item that points to it ("Die Beratung erfolgt nichtöffentlich", "Dieser Punkt wird …", "Wird …").
const DEICTIC=/^[\s(]*(?:(?:Dieser|Diese|Der|Die|Das)\s+(?:Punkt|Tagesordnungspunkt|TOP|Beratung|Behandlung|Vorlage|Angelegenheit|Gegenstand)|Beratung|Behandlung|Wird|Werden|Erfolgt|Hierzu|Dazu)(?!\p{L})/iu;
// A line that is nothing but a mark of the non-public part ("(nichtöffentlich)", "– nicht öffentlich –", "Status: NÖ",
// "N", "wird nichtöffentlich beraten"): it belongs to the item it stands next to.
const MARK_WORDS=/nichtöffentlich\p{L}*|n\.?\s?ö\.?(?:ff\.?|s)?|nö|noe|vertraulich\p{L}*|geschlossen\p{L}*|unter\s+Ausschlu(?:ss|ß)\s+der\s+Öffentlichkeit|(?:in|im)\s+nichtöffentlicher\s+(?:Sitzung|Beratung)|Status|Art|Kennzeichnung|Sitzungsteil|Behandlung|Beratung|wird|werden|erfolgt|behandelt|beraten|nein|(?<!\p{L})N(?!\p{L})/giu;
const BARE_N=/^[\s([–-]*(?:N|n|NÖ|Nö|nö|N\.\s?Ö\.?)[\s)\]–.-]*$/u;
const markOnly=line=>{const l=canonNP(line);return !/:\s*$/.test(l)&&(BARE_N.test(l)||mentionsNonPublic(l))&&!/[\p{L}\d]/u.test(l.replace(MARK_WORDS,' '));};
// Sentences that end the public part ("Ende des öffentlichen Teils", "Im Anschluss findet eine nichtöffentliche Sitzung
// statt", "Für die folgenden Punkte wird die Öffentlichkeit ausgeschlossen").
const separator=line=>SEPARATOR.some(re=>re.test(line))||[EXCLUDED_F,END_PUBLIC_F,LEAVE_F].some(re=>re.test(foldText(line)));
const SEPARATOR=[
 /^(?:Schluss|Ende|Abschluss|Beendigung)\s+(?:der|des)\s+öffentlichen\s+(?:Sitzung|Teil(?:e?s)?|Sitzungsteil(?:e?s)?|Beratung|Tagesordnung)/iu,
 /(?<!\p{L})(?:Der|Die)\s+öffentliche[rn]?\s+(?:Teil|Sitzung|Sitzungsteil)\s+(?:\S+\s+){0,4}(?:endet|beendet|geschlossen|schließt)/iu,
 /^(?:Im\s+Anschluss|Anschließend|Anschl\.|Danach|Es\s+folgt|Nachfolgend|Hierauf|Sodann)(?!\p{L})/iu,
 /(?:für|bei|zu)\s+(?:den\s+|die\s+)?(?:nach)?folgenden\s+(?:Tagesordnungs)?punkte|mit\s+(?:den\s+)?folgenden\s+(?:Tagesordnungs)?punkten|folgende\s+(?:Tagesordnungs)?punkte/iu,
 /Öffentlichkeit\s+(?:wird|wurde|ist)\s+(?:\S+\s+){0,3}ausgeschlossen/iu,
 // "Die Sitzung wird intern fortgesetzt."
 /(?<!\p{L})(?:Sitzung|Beratung)\s+(?:wird|wurde)\s+(?:\S+\s+){0,4}(?:fortgesetzt|weitergeführt)/iu,
];
// Notes on items: "Die Punkte 3 und 4 …", "TOP 3 bis 4 nichtöffentlich", "Ab Ziffer 3 …"; numbers are only resolved
// where the note names them and nothing vague ("die beiden letzten", "die mit * gekennzeichneten", "alle anderen").
const REF_LIST=/(?<!\p{L})(?:TOP|Top|TO-Punkte?n?|Tagesordnungspunkte?n?|Punkte?n?|Pkt\.|Nrn?\.|Nummern?|Ziffern?|Ziff\.)\s*((?:\d{1,2}(?:\.\d{1,2})?)(?:\s*(?:,|und|u\.|sowie|bis|-|–|\/|&)\s*\d{1,2}(?:\.\d{1,2})?)*)/giu;
const VAGUE=/(?<!\p{L})(?:letzte[nrms]?|vorletzte[nrms]?|beide[nrms]?|zwei|drei|vier|übrige[nrms]?|restliche[nrms]?|sonstige[nrms]?|andere[nrms]?|weitere[nrms]?|gekennzeichnet\p{L}*|markiert\p{L}*|Stern\p{L}*|kursiv\p{L}*|fett\p{L}*|unterstrichen\p{L}*|außer|ausgenommen|Ausnahme|bis\s+auf|obige[nrms]?|vorstehende[nrms]?|oben|genannte[nrms]?|aufgeführte[nrms]?|einige[nrms]?|manche[nrms]?|mehrere[nrms]?|alle|sämtliche[nrms]?)(?!\p{L})|[*¹²³⁴⁵⁶⁷⁸⁹†‡]/iu;
const ROMAN_REF=/(?<!\p{L})(?:TOP|Top|TO-Punkte?n?|Tagesordnungspunkte?n?|Punkte?n?|Pkt\.|Nrn?\.|Ziffern?|Ziff\.)\s*[IVX]{1,5}(?![\p{L}\d])/u;
// A legend that tells the part of items by their type or colour ("Kursiv: nichtöffentliche Punkte", "Grau dargestellte Punkte werden
// nichtöffentlich beraten", "Fett gedruckte Punkte werden öffentlich beraten"): the lines lost that formatting (rule 4).
const FORMAT=/(?<!\p{L})(?:kursiv\p{L}*|fett\p{L}*|grau\p{L}*|rot(?:e[nrs]?)?|blau\p{L}*|grün\p{L}*|gelb\p{L}*|orange\p{L}*|farbig\p{L}*|farblich\p{L}*|eingefärbt\p{L}*|ausgegraut\p{L}*|hervorgehoben\p{L}*|unterstrichen\p{L}*|markiert\p{L}*|Schrift(?:art|farbe)?|Farbe|hinterlegt\p{L}*)(?!\p{L})/iu;
const FORMAT_TARGET=/(?<!\p{L})(?:öffentlich\p{L}*|nichtöffentlich\p{L}*|nicht\s*-?\s*öffentlich\p{L}*|Punkte?|TOPs?|Tagesordnungspunkte?)(?!\p{L})/iu;
const formatLegend=line=>{const l=canonNP(normalizeLine(line));return l.length<=200&&FORMAT.test(l)&&FORMAT_TARGET.test(l)&&!/^(?:hinterlegt|Farbe)/iu.test(l)&&(!/(?<!\p{L})hinterlegt/iu.test(l)||/(?<!\p{L})(?:grau|rot|blau|grün|gelb|orange|farbig|farblich)/iu.test(l));};
// Notes that move or cancel the meeting ("Die Sitzung wird auf Mittwoch, 21.10.2026 verschoben", "Terminänderung: neuer Termin 21.10.2026").
const MOVE=/(?<!\p{L})(?:verschoben|verlegt|abgesagt|entf[äa]llt|entfallen|f[äa]llt\s+aus|findet\s+nicht\s+statt|Terminänderung|Terminverschiebung|Verlegung|Absage|neuer\s+Termin|Ersatztermin|neu\s+terminiert)(?!\p{L})/iu;
function refsOf(line){
 const nums=[];for(const m of line.matchAll(REF_LIST))for(const n of m[1].match(/\d{1,2}(?:\.\d{1,2})?/g))nums.push(mainNumber(n));
 const rest=canonNP(line.replace(REF_LIST,' ')).replace(/nichtöffentlich\p{L}*/giu,' ');
 // Items named by Roman numbers where the agenda counts otherwise ("TOP III und IV"): which ones is not certain.
 const vague=VAGUE.test(line)||ROMAN_REF.test(line)||nums.length>0&&/(?<!\p{L})öffentlich(?!keit)/iu.test(rest);
 return {nums,vague,any:nums.length>0||vague};
}
// Footnote marks at an item ("Grundstücke*", "Personal¹", "Haushalt (1)", "Kita2"): what they mean is told elsewhere.
// Also a letter as mark ("Grundstück a)", "Personal (a)"), as Word numbers its footnotes.
const FOOTNOTE={test:t=>/[*†‡¹⁴⁵⁶⁷⁸⁹⁰￼]|(?<!m)[²³]|\(\d\)\s*$|\p{Ll}\d{1,2}$|(?:^|\s)\(?\p{Ll}\)\s*$/u.test(t)||/(?<=\s)\d\)\s*$/.test(t)&&!t.includes('(')};
// A past report in the block of an item that reports from the non-public part ("In der nichtöffentlichen Sitzung vom
// 16.09.2026 wurde … beschlossen").
const PAST_REPORT=/(?<!\p{L})(?:wurde|wurden|hat|hatte|haben|hatten|gefasst\p{L}*|beschloss\p{L}*|beschlossen|vergeben|gibt|gab|teilt|teilte)(?!\p{L})/iu;
// A table whose last column says whether an item is public ("Nr. Gegenstand Ö/N", "TOP Betreff öffentlich", "… Art").
const COLUMN_HEAD=/^(?:Nr\.?|Lfd\.?\s*Nr\.?|TOP|Punkt|Pkt\.?|Tagesordnungspunkt)\s+(?:\p{L}+[\s/]+){0,4}(Ö\s*\/\s*N|Ö\s*\/\s*NÖ|nicht\s*-?\s*öffentlich|Öffentlichkeit|öffentlich|Status|Art|Sitzungsteil|Öff\.?|Ö)\s*$/iu;
// Any other column that says whether an item is public, not as the last one ("TOP Vorlage Ö/N Betreff", "TOP Betreff Ö N",
// "Nr. Betreff öffentlich Vorlage"): its marks cannot be told from the text of a line.
const COLUMN_ANY=/^(?:Nr\.?|Lfd\.?\s*Nr\.?|TOP|Punkt|Pkt\.?|Tagesordnungspunkt)\s+.*(?<![\p{L}])(?:Ö\s*\/\s*NÖ?|Ö|ö|N|NÖ|nö|öffentlich|Öffentlichkeit|nicht\s*-?\s*öffentlich|Status|Sitzungsteil|Öff\.?)(?![\p{L}])/u;
const TWO_COLUMNS=/(?<![\p{L}])(?:Ö|ö|öffentlich)\s+(?:N|NÖ|nö|n|nichtöffentlich|nicht\s*-?\s*öffentlich)(?![\p{L}])/u;
// Headings of a part: "Teil B", "II.", "B.", "B Sitzung", "Zweiter Teil", "Ö-Teil", "N-Teil".
const PART_HEADING=/^(?:(?:Teil|Abschnitt|Sitzungsteil)\s+([A-H]|[IVX]{1,4}|\d{1,2})(?![\p{L}\d])|([A-H]|[IVX]{1,4})[.):](?:\s|$)|([A-H])\s+(?=(?:Öffentlich\p{L}*|Nichtöffentlich\p{L}*|Sitzung|Teil|Sitzungsteil)(?!\p{L}))|((?:Erster|Zweiter|Dritter|Vierter|[1-4]\.)\s+(?:Teil|Sitzungsteil|Abschnitt))(?!\p{L})|(Ö|N|NÖ)\s*-\s*Teil(?!\p{L}))/u;
const partKey=p=>p.slice(1).find(Boolean);
// A short line that names a part of the meeting in any other way ("Teil 2", "Sitzungsteil", "Zweiter Abschnitt").
const PART_WORD=/(?<!\p{L})(?:Teil|Sitzungsteil|Abschnitt|Sitzungsabschnitt)(?!\p{L})/u;
const ITEM_LIKE=/^(?:(?:TOP|Top|TO|Tagesordnungspunkt|Punkt)\s*(?:Nr\.?\s*)?[\p{L}./()-]{0,5}\s*\d{1,2}|(?:NÖ|Nö|nö|N|Ö)\s*[-/.:]?\s*\d{1,2}|\d{1,2}(?:\.\d{1,2})*[.)]?\s+\S)/u;
// A legend of a mark ("■ = nichtöffentlich", "# nichtöffentlich", "(+) = nichtöffentliche Beratung", "V = vertraulich",
// "*) nichtöffentlich", "¹ nichtöffentliche Beratung").
const LEGEND=/^\s*(?:(?:[^\p{L}\p{N}\s]{1,3}|[¹²³⁴⁵⁶⁷⁸⁹]|\([^)\s]{1,3}\)|\d{1,2}\)?|\p{Ll}\))\s*(?:[=:–…-]\s*)?|[A-ZÄÖÜ]{1,2}\s*[=:]\s*)(?:[Nn]icht\s*-?\s*[öÖ]|[Nn]ichtö|[Vv]ertraul|[Uu]nter\s+[Aa]usschl|[Gg]eschlossen|[Nn]\.?\s?[öÖ]\.?(?!\p{L}))/u;
// A head that names a non-public part generally ("Im Anschluss findet eine nichtöffentliche Sitzung statt", "öffentliche
// und nichtöffentliche Sitzung"); any other mention in the head names something in particular.
const GENERIC_HEAD=line=>{const l=canonNP(normalizeLine(line));return /(?<!\p{L})(?:im\s+Anschluss|anschließend|anschl\.|danach|daran|es\s+folgt|nachfolgend|schließt\s+sich|sich\s+anschließend|nach\s+(?:dem|der)\s+öffentlichen|vor\s+(?:dem|der)\s+öffentlichen|zuvor|vorher|ab\s+\d{1,2}(?:[:.]\d{2})?\s*Uhr)(?!\p{L})/iu.test(l)&&/nichtöffentlich\p{L}*\s+(?:Sitzung|Teil|Sitzungsteil|Beratung)|Ausschlu(?:ss|ß)\s+der\s+Öffentlichkeit/iu.test(l)||/(?<!\p{L})öffentliche[rn]?\s+(?:Sitzung\s+|Teil\s+)?und\s+(?:anschließend\s+)?(?:eine[rn]?\s+)?nichtöffentliche[rn]?\s+(?:Sitzung|Teil|Sitzungsteil)/iu.test(l);};
// A mark before an item ("(nichtöffentlich) TOP 3 …" of an icon): the item is marked N.
const LEAD_MARK=/^(?:\((?:nichtöffentlich|vertraulich)\)\s*)+(?=\S)/iu;
const itemOfLine=line=>{const m=line.match(LEAD_MARK);if(m){const it=itemOf(line.slice(m[0].length));return it?{...it,prefix:'N'}:null;}return itemOf(line);};
// Significant words of a title, for notes that name an item by its title ("Der Tagesordnungspunkt „Grundstücksangelegenheiten“ …").
const STRUCTURE_WORDS=new Set('sitzung sitzungen oeffentlich oeffentliche oeffentlichen oeffentlicher nichtoeffentlich nichtoeffentliche nichtoeffentlichen nichtoeffentlicher tagesordnung tagesordnungspunkt tagesordnungspunkte beratung behandelt behandlung beraten anschluss gemeinderat gemeinderates gemeinderats teilnahme punkte'.split(' '));
const titleWords=t=>fold(t).split(/[^a-z0-9]+/).filter(w=>w.length>=6&&!STRUCTURE_WORDS.has(w));
// Text that lost its characters: a replacement character, mojibake not undone, a "?" for an umlaut.
const BROKEN=/\ufffd|[ÃÂ][\u0080-\u00bf]|(?:^|[\s("„])\p{L}+\?\p{Ll}{2,}/u;
// A line cut short by a teaser or excerpt ("Grundstücksverkauf Fl.Nr. 412 (nich…", "[...]", "Weiterlesen »").
const TRUNCATED_LINE=/(?:…|\.{3}|\[\s*(?:…|\.{2,3})\s*\])\s*[»›>→"']?\s*$|^\s*(?:…\s*)?(?:weiterlesen|weiter\s+lesen|mehr\s+lesen|mehr\s+erfahren|mehr\s+dazu|read\s+more|zum\s+(?:vollständigen\s+)?(?:artikel|beitrag|text)|vollständige[rn]?\s+(?:text|artikel|beitrag|meldung)|mehr|weiter)\s*(?:[»›>→"']|\.\.\.|…)?\s*$/iu;
/** Whether the lines of an excerpt are cut short (a teaser of a feed or calendar entry). */
export const truncatedText=lines=>(lines||[]).some(l=>TRUNCATED_LINE.test(normalizeLine(l)));
const PUBLIC_MARK=/^(?:ja|j|x|✓|✔|öffentlich|Ö)$/iu,NONPUBLIC_MARK=/^(?:nein|-|–)$/iu;
// The status of one item on the line below it ("öffentlich", "Status: öffentlich", "(Ö)").
const PUBLIC_STATUS=/^[\s([–-]*(?:(?:Status|Art|Sitzungsteil)\s*:\s*)?(?:öffentlich|Ö|ö)[\s)\]–.-]*$/u;

/**
 * Meetings in the lines of a page or document, with the items of their public part. title: the link text or document
 * title (date, committee and public session as a fallback). wrapped: the lines are wrapped (PDF), so a title may go on
 * in the next lines. Returns {meetings:[{date, time, committee, kind, items, restricted, unclear, publicEvidence,
 * heading, context, issuer}], issues}. context: the head of the meeting (its first lines), issuer: the line above that
 * names who gives notice ("Zweckverband …", "Gemeinde Bdorf"), both for the body the meeting belongs to.
 * Fail-closed, in this order of rules:
 * 1. Items only from one block after explicit evidence of the public part (a heading, a sentence of the head, the title,
 *    the mark Ö); after the block nothing more is taken.
 * 2. Every mention of the non-public part in a meeting (in any spelling, hyphenated, letter-spaced, broken by a page) is
 *    a heading that ends the block, or belongs to one item, which is dropped with all items after it. A mention that is
 *    neither drops the whole meeting. A further heading of a part ("Teil B", "II.") after the block also ends it.
 * 3. A note on items ("Die Punkte 3 und 4 …") drops the items it names and all after them where it names their numbers
 *    exactly, otherwise the whole meeting.
 * 4. A mark N at an item drops it and all after it; a footnote mark at any item drops the whole meeting.
 * 5. A head that names a non-public part counts only where the agenda marks its start (a heading or a mark N).
 */
export function parseSessionText(lines,{title='',wrapped=false}={}){
 const issues=[];title=normalizeLine(title);
 const all=prepareLines(lines);
 const kind=documentKind(title,all),items=all.map(itemOfLine);
 // A numbered list of persons whose numbering starts again after it (those present before the agenda, whatever the line
 // that introduces them says) is no list of items.
 for(let i=0;i<all.length;i++){
  if(!items[i]||mainNumber(items[i].number)!==1)continue;
  let j=i;while(j<all.length&&items[j]&&mainNumber(items[j].number)===j-i+1)j++;
  const names=items.slice(i,j).filter(it=>nameish(it.title)).length;
  if(j-i<2||names<2)continue;
  // All of them names and the numbering starts again after them; or most of them names (a first name not known).
  const next=items.slice(j,j+4).find(Boolean);
  if(names===j-i&&next&&mainNumber(next.number)===1||names>=Math.ceil((j-i)*0.6))for(let k=i;k<j;k++)items[k]=null;
  i=j-1;
 }
 const ctx={years:[...new Set([...all,title].flatMap(l=>germanDates(l).map(d=>Number(d.iso.slice(0,4)))))],committee:committeeOf(title)};
 // A gazette (Amtsblatt, Mitteilungsblatt): its head lines (before the link text, which may only say "Amtsblatt Nr. 41"),
 // which may name the one municipality or the association it belongs to.
 const issueAt=all.slice(0,4).findIndex(l=>ISSUE_HEAD.test(l)&&germanDates(l).length>0);
 const gazette=[...all.slice(0,3),title].filter(l=>GAZETTE_TITLE.test(l)).join(' | ')||(issueAt>=0?all.slice(0,issueAt+1).join(' | '):'');
 // Who gives notice just above a line (a municipality, an association; also in capitals).
 const issuerAt=i=>{for(let k=i-1;k>=0&&k>=i-4&&!items[k];k--){const l=capsFix(all[k]);if(l.length<=100&&ISSUER.test(l)&&!GAZETTE.test(l))return fold(l);}return '';};
 // 1. Meetings: a text of several (Amtsblatt, list of dates) is cut at each header of another meeting. Headers before
 // the first item, and repeated headers of the same meeting (also with or without the place), belong to it.
 const segments=[{start:0,header:null}],headerLines=new Set();
 for(let i=0;i<all.length;i++){
  const h=meetingHeader(all,i,ctx);if(!h)continue;
  headerLines.add(i);
  const seg=segments.at(-1),hasItems=items.slice(seg.start,i).some(Boolean);
  const issuer=issuerAt(i);
  if(!seg.header&&!hasItems){seg.header={...h,line:i,issuer};continue;}
  // The same day and body again is the same meeting (a running head), unless another municipality gives notice of it (a
  // Verwaltungsgemeinschaft's notice of the councils of two members meeting the same evening).
  if(seg.header&&seg.header.date===h.date&&sameBody(seg.header.committee,h.committee)&&!(hasItems&&issuer&&seg.header.issuer&&issuer!==seg.header.issuer))continue;
  segments.push({start:i,header:{...h,line:i,issuer}});
 }
 const titlePublic=publicSentence(title)&&!mentionsNonPublic(title.replace(PUBLIC_SENTENCE,'')),titleClosed=mentionsNonPublic(title)&&!titlePublic;
 const meetings=[];let carried=null;
 segments.forEach((seg,s)=>{
  const end=segments[s+1]?.start??all.length;
  // After a meeting that ended in its non-public part, what follows belongs to that part unless a head of its own
  // names another day and another body (a running head, a note on an earlier reading are no new meeting).
  if(carried&&!(seg.header?.own&&seg.header.date!==carried.date&&!sameBody(seg.header.committee,carried.committee||''))){
   if(items.slice(seg.start,end).some(Boolean))issues.push(`Sitzungskopf im nichtöffentlichen Teil (${where(seg.header?.committee,seg.header?.date,title)}): keine neue Sitzung erkennbar, nichts übernommen.`);
   return;
  }
  carried=null;
  let first=seg.start;while(first<end&&!items[first])first++;
  // Numbered lines before the heading of the agenda are lists of the head (those present, offices), not items. A day or
  // body named between them and that heading is the head of another meeting: then nothing is clear.
  const agendaAt=all.findIndex((l,i)=>i>first&&i<end&&!items[i]&&AGENDA_LINE.test(l));
  let listsBefore=agendaAt>first&&items.slice(agendaAt+1,end).some(Boolean)?agendaAt:-1;
  // A list there whose items carry the marks Ö/N is an agenda itself (a short agenda before the reports on its items, an overview
  // before the minutes): it is read, so that its marks count.
  if(listsBefore>=0&&items.slice(first,listsBefore).some(it=>it&&it.prefix))listsBefore=-1;
  // Any other list left out there that names the non-public part cannot be matched to the agenda (rule 2).
  const skippedNP=listsBefore>=0&&all.slice(first,listsBefore).some(l=>mentionsNonPublic(l)&&!isPublicReport(l)||isNonPublicHeading(l)||closedLine(l)||BARE_N.test(l)||NP_BROKEN.test(fold(l))||formatLegend(l));
  const skipped=listsBefore>=0?[first,listsBefore]:null;
  if(listsBefore>=0){first=listsBefore+1;while(first<end&&!items[first])first++;}
  const itemAt=i=>i>=first&&items[i]?items[i]:null;
  // Day, time and body from the head of the meeting (the lines before its first item), else from the title.
  const head=seg.header?.line;
  const day=seg.header?.day??pickDate(all,seg.start,first,ctx);
  // The title's day only for a single meeting, never the day of its notice or posting ("Aushang vom 02.10.2026: Einladung …"),
  // and not where the text names the day only relatively ("am kommenden Mittwoch").
  const relative=all.slice(seg.start,Math.max(first,Math.min(end,seg.start+12))).some(l=>RELATIVE_DAY.test(l)||RELATIVE_PAST.test(l));
  const titleDay=germanDates(title).find(d=>!NOT_MEETING_DAY.test(title.slice(Math.max(0,d.index-45),d.index)))?.iso;
  let date=day?.iso??(segments.length===1&&!relative?titleDay:null)??null;
  // A weekday the head names without its date ("am Mittwoch um 19 Uhr", "am kommenden Mittwoch") must be the weekday of the day found
  // (the day above a post is often that of its publication); a relative day counts only where the line of the day names its weekday.
  const headWin=all.slice(seg.start,Math.max(first,Math.min(end,seg.start+12))).filter((l,k)=>!items[seg.start+k]&&!OTHER_EVENT.test(l));
  const bare=[...headWin,...(segments.length===1?[title]:[])].filter(l=>MEETING_WORD.test(l)||timeOf(l)).flatMap(l=>[...l.matchAll(BARE_WEEKDAY)].map(m=>WEEKDAYS[m[1].toLowerCase()]));
  if(date&&bare.length&&!bare.includes(new Date(date+'T00:00:00Z').getUTCDay())){issues.push(`Wochentag im Kopf passt nicht zum Datum ${ddmmyyyy(date)}; Sitzungstag nicht sicher, nichts übernommen.`);date=null;}
  if(date&&headWin.some(l=>RELATIVE_DAY.test(l))&&!(day&&day.iso===date&&DATED_WEEKDAY.test(all[day.line])))date=null;
  let time=day?timeOf(all[day.line]):null;
  for(let i=seg.start;!time&&i<first;i++)if(!signature(all,i)&&!CANCEL.test(all[i]))time=timeOf(all[i]);
  if(!time&&segments.length===1)time=timeOf(title);
  let committee=seg.header?.committee??null;
  for(const pass of [l=>/Sitzung|Tagung|Einladung|Niederschrift|Protokoll|Bericht/i.test(l),()=>true])for(let i=seg.start;!committee&&i<first;i++)if(pass(all[i])&&!CANCEL.test(all[i]))committee=committeeOf(all[i]);
  committee??=committeeOf(title);
  const headAt=head!==undefined?head:all.slice(seg.start,first).findIndex(l=>/(?:sitzung|tagung)(?!\p{L})/iu.test(l)&&committeeOf(l)&&!CANCEL.test(l));
  const at=head!==undefined?head:headAt>=0?seg.start+headAt:-1;
  const heading=at>=0?all[at]:title;
  // Who gives notice: the nearest line above the head that names a municipality, county, association or Amt (the title
  // of a gazette above it is not one), also across the address lines of a letter head.
  let issuer='';
  const top=at>=0?at:first;
  for(let k=top-1;k>=0&&k>=top-15&&!items[k];k--){const l=capsFix(all[k]);if(GAZETTE.test(l))continue;if(ISSUER.test(l)&&l.length<=100){issuer=l;break;}}
  // The lines above the head up to the item before it (the section of a gazette: "Aus der Gemeinde Bdorf", "BDORF").
  const lead=[];for(let k=top-1;k>=0&&k>=top-8&&!items[k];k--)lead.unshift(all[k]);
  const headText=at>=0?all.slice(at,Math.min(first,at+3)).join(' '):'';
  const context=[issuer,headText,title].filter(Boolean).join(' ');
  // 2. Public part: none → public → nonpublic. Each meeting starts anew; the title counts only for a single meeting.
  let latePublic=false;
  let state='none',evidence='',restricted=false,unclear=0,mixed=false,delimited=false,headMention=false,headSpecific=false,footnote=false,whole=null;
  if(segments.length===1&&titleClosed){state='nonpublic';restricted=true;delimited=true;}
  else if(segments.length===1&&titlePublic){state='public';evidence=`Titel „${title}“`;}
  // An invitation whose agenda ends with the note that a non-public session follows ("Anschließend findet eine nichtöffentliche
  // Sitzung statt."): the agenda before it is the public part (the non-public items are not published).
  else if(segments.length===1&&kind==='invitation'&&seg.start<first&&all.slice(Math.max(first,lastItemIndex(items,seg.start,end)),end).some(l=>TRAILING_NP.test(canonNP(normalizeLine(l))))){state='public';evidence='Hinweis „Anschließend nichtöffentliche Sitzung“ nach der Tagesordnung';}
  // The items of a meeting are numbered one way: with keyword ("TOP 1") if any, else with mark ("Ö 1"), else plain.
  // A mark N/NÖ alone does not make the style: such an item ends the public part in any form.
  const marked=items.slice(first,end).filter(Boolean),style=marked.some(i=>i.form==='keyword')?'keyword':marked.some(i=>i.form==='prefix'&&i.prefix==='Ö')?'prefix':'plain';
  const numbers=new Set(marked.map(i=>mainNumber(i.number)));
  const headLines=all.slice(seg.start,first);
  const column=headLines.map(l=>l.match(COLUMN_HEAD)).find(Boolean),columnKind=column?(/lichkeit$/i.test(column[1])?'access':/nicht/i.test(column[1])?'closed':/öffentlich/i.test(column[1])?'public':'mark'):null;
  if(skipped&&all.slice(skipped[0],skipped[1]).some(l=>germanDates(l).some(d=>d.iso!==date)||!itemOf(l)&&l.length<=60&&!/:\s*$/.test(l)&&!ATTENDANCE.test(l)&&!LIST_INTRO.test(l)&&committeeOf(l)&&/^\p{Lu}/u.test(l)))mixed=true;
  const taken=[],seen=new Map(),cuts=[],parts=new Map(),read=new Set();let cur=null,seenItem=false,absent=false,listed=false,present=0,lastItem=-1,lastItemEnd=-1,lastPrefix=null,partSeen=false,statusStyle=false,itemOpen=false,oeSeen=false,unmarked=-1,npFirst=null;
  const endBlock=()=>{state='nonpublic';restricted=true;cur=null;};
  const discard=(reason,detail='')=>{whole??=[reason,detail];};
  if(skippedNP)discard('Erwähnung des nichtöffentlichen Teils in einer Aufzählung vor der Tagesordnung','sie ist keinem Punkt zuzuordnen');
  // Rows of a table of dates with the agenda in the row ("14.10.2026 Gemeinderat 1. Bauantrag Kita"): with another day than the
  // meeting's, or several days, which row an item belongs to is not known.
  const rowDays=all.slice(seg.start,end).filter(l=>ROW_ITEM.test(l)).map(l=>germanDates(l)[0]?.iso).filter(Boolean);
  if(rowDays.length&&(new Set(rowDays).size>1||rowDays.some(d=>d!==date)))discard('Tabelle mit mehreren Sitzungen','welche Punkte zu welchem Tag und Gremium gehören, ist nicht eindeutig');
  // A column of the marks that is not the last one, or two of them: the marks of a line cannot be told apart.
  if(headLines.some(l=>l.length<=100&&COLUMN_ANY.test(l)&&(!COLUMN_HEAD.test(l)||TWO_COLUMNS.test(l))))discard('Spalte „öffentlich/nichtöffentlich“ der Tagesordnung nicht lesbar','sie steht nicht am Ende der Zeile');
  // The item a mark belongs to (the item read last, or the one whose report this is) and all after it are dropped.
  // The lines between the item just read and line i are fields of its card only.
  const cardBlock=i=>{if(lastItemEnd<0||i-lastItemEnd>4)return false;const block=all.slice(lastItemEnd,i);return block.length>0&&block.every(l=>l.length<=60&&CARD_FIELD.test(l));};
  const dropLast=()=>{const k=cur?taken.indexOf(cur):-1;if(k>=0)cuts.push(k);else if(taken.length&&taken.at(-1).line===lastItem)cuts.push(taken.length-1);endBlock();};
  // An item read again in the non-public part (an agenda repeated as a list of the parts) goes, with all after it.
  // Items this text puts in the non-public part: another document of the same meeting must not give them out.
  const closedItems=[];const shut=it=>{if(it?.title)closedItems.push({number:it.number,title:withMark(it.prefix,it.title).title});};
  const again=it=>{const k=taken.findIndex(x=>x.number===it.number&&(sameTitle(x.title,it.title||'')||!!it.title&&similarTitles(x.title,it.title)));if(k>=0)cuts.push(k);};
  const applyRefs=r=>{if(r.vague||!r.nums.length||r.nums.some(n=>!numbers.has(n)))discard('Nichtöffentliche Punkte erst nach der Tagesordnung benannt','welche Punkte öffentlich sind, ist nicht eindeutig');else{const min=Math.min(...r.nums),k=taken.findIndex(x=>mainNumber(x.number)>=min);if(k>=0)cuts.push(k);}};
  // Which items read so far a line names by their title (quoted text that is no title counts as naming another).
  const namesItems=line=>{const words=new Set(titleWords(line)),named=taken.filter(x=>titleWords(x.title).some(w=>words.has(w)));const quoted=/[„"“”»«]/.test(line);return {named,other:named.some(x=>x!==(cur||taken.at(-1)))||quoted&&!named.length};};
  const continues=(j)=>{const line=all[j];return !itemOfLine(line)&&!headerLines.has(j)&&!headerLines.has(j+1)&&!isPublicHeading(line)&&!isNonPublicHeading(line)&&!closedLine(line)&&!mentionsNonPublic(line)&&!isPublicReport(line)&&!BARE_N.test(line)&&!NP_BROKEN.test(fold(line))&&!PART_HEADING.test(line)&&!(line.length<=40&&PART_WORD.test(line))&&!LEGEND.test(line)&&!/^[*¹²³(■#]/u.test(line)&&!signed(line)&&!PLACE_DATE.test(line)&&!HINT.test(line)&&!STOP.test(line)&&!STOP_SENTENCE.test(line)&&!ATTENDANCE.test(line)&&!LIST_INTRO.test(line)&&!(germanDates(line).length&&(timeOf(line)||WEEKDAY_WORD.test(line)||SHORT_WEEKDAY.test(line)))&&/[\p{L}\d]/u.test(line)&&!(committeeOf(line)&&SESSION_ON.test(all[j+1]||''))&&
   // Never a line that speaks of the public, listeners or secrecy, refers to items or the rest of the agenda, or is the name above an office.
   !suspect(line)&&!separator(line)&&!REFERS.test(line)&&!FORWARD.test(line)&&!personLine(line)&&!(line.length<=40&&signed(all[j+1]||''));};
  for(let i=seg.start;i<end;){
   const line=all[i],raw=itemAt(i),after=i===lastItemEnd;
   if(BROKEN.test(line))discard('Zeichenkodierung des Textes fehlerhaft');
   // A legend by type or colour (rule 4), wherever it stands.
   if(!raw&&formatLegend(line))discard('Kennzeichnung der Punkte durch Schriftart oder Farbe','welche Punkte öffentlich sind, ist nicht eindeutig');
   // A note that moves or cancels the meeting to or from another day ("Achtung: Die Sitzung wird auf Mittwoch, 21.10.2026 verschoben",
   // "Terminänderung: neuer Termin 21.10.2026"): the day of the items is not certain.
   if(!raw&&date&&(kind!=='minutes'||i<first)&&MOVE.test(line)&&(SESSION_WORD.test(line)||/Termin/iu.test(line))&&!(committeeOf(line)&&committee&&!sameBody(committeeOf(line),committee))){
    const found=germanDates(line),other=found.filter(d=>d.iso!==date&&!OLD_DAY.test(line.slice(Math.max(0,d.index-60),d.index))&&!OLD_AFTER.test(line.slice(d.index+d.text.length)));
    if(other.length||!found.length&&/(?<!\p{L})(?:abgesagt|entf[äa]llt|entfallen|f[äa]llt\s+aus|findet\s+nicht\s+statt|Absage)(?!\p{L})/iu.test(line))discard('Hinweis auf Verlegung oder Absage der Sitzung','der Tag der Sitzung ist nicht sicher');
   }
   if(raw&&FOOTNOTE.test(raw.title))footnote=true;
   // A symbol of unknown meaning in a line of the agenda (a status column drawn as icon) is a mark too (rule 4).
   if(!raw&&i>=first&&line.includes(SYMBOL)&&/[\p{L}\d]/u.test(line.replace(SYMBOL,'')))footnote=true;
   // A text cut short ("…", "[...]", "Weiterlesen"): what the rest says is not known.
   if(i>=first&&TRUNCATED_LINE.test(line))discard('Text gekürzt','der Rest der Tagesordnung ist nicht gelesen');
   if(!raw&&i>=first&&seenItem&&dayLine(line)&&germanDates(line)[0]?.iso!==date)mixed=true;
   // A numbered line not read as an item (a title without letters, a person) still fills its place in the numbering.
   if(!raw&&i>=first&&state==='public'){const n=line.match(/^(?:TOP\s*)?(\d{1,2})(?:[.)]|\s)/u);if(n)read.add(Number(n[1]));}
   // The mark htmlToLines put at the end of an item's card: that item (the last one read) and all after it go.
   if(!raw&&line===CARD_NP){const k=taken.findIndex(x=>x.line===lastItem);if(k>=0)cuts.push(k);endBlock();delimited=true;itemOpen=false;i++;continue;}
   if(!raw){
    // A report on decisions of the non-public part as a heading ("In nichtöffentlicher Sitzung gefasste Beschlüsse") is
    // a mention as well, except as the text of the item that announces it.
    const report=isPublicReport(line)&&!(cur&&isPublicReport(cur.title));
    // A word of the non-public part broken at the end of a line that no later line completes is a mention too.
    // A column of marks drawn before the rows (also in the head) cannot be matched to the items; the rest of a broken word
    // ("liche Sitzung"); in an invitation any other line between the items that speaks of the public, listeners or secrecy.
    const np=mentionsNonPublic(line)||report||isNonPublicHeading(line)||closedLine(line)||BARE_N.test(line)||NP_BROKEN.test(fold(line))||NP_TAIL.test(line)||
     seenItem&&i>=first&&(kind!=='minutes'||headingLike(line))&&SUSPECT.test(foldText(line))&&!SUSPECT_OK.test(foldText(line));
    if(np){
     const mark=markOnly(line),names=namesItems(line);
     const heading=isNonPublicHeading(line)||closedLine(line)||startsNonPublic(line)||report&&line.length<=110&&!/[.!?]$/.test(line)||line.length<=120&&/:\s*$/.test(line)&&!names.named.length&&!/[„"“”»«]/.test(line);
     const part=canonNP(line).match(PART_HEADING);
     // A legend of a mark: what the marked items are is told only here (rule 4).
     const forward=FORWARD.test(line)&&!refsOf(line).nums.length&&!VAGUE.test(line.replace(new RegExp(FORWARD.source,'giu'),' '));
     if(LEGEND.test(line)&&!isNonPublicHeading(line)&&!closedLine(line)&&!startsNonPublic(line))discard('Markierung von Punkten mit Legende „nichtöffentlich“','welche Punkte gemeint sind, ist nicht eindeutig');
     // A note after the items that names items ("Hinweis: TOP 3 und 4 nichtöffentlich") is read as such, never as a field of the last item.
     else if(i>=first&&!heading&&!mark&&!forward&&!ITEM_LIKE.test(line)&&refsOf(line).any){applyRefs(refsOf(line));endBlock();delimited=true;itemOpen=false;}
     // A status in the lines of an item (accordion, card: "Sitzungsteil: nichtöffentlich" below "Vorlage: …") is that item's,
     // also as a field of any name ("Öffentlichkeit: nein", "Zugang: nicht öffentlich", "Beratungsart: vertraulich").
     else if((mark&&(after||itemOpen)||state==='public'&&FIELD.test(line)&&(after||itemOpen&&cardBlock(i))&&!names.named.length&&!names.other)){if(lastPrefix==='Ö'&&after&&mark)endBlock();else dropLast();delimited=true;itemOpen=false;}
     // A badge or heading of a part below the fields of an item's card ("Vorlage 2026/043" / "N-Teil"): it may be that item's.
     else if(heading&&itemOpen&&!after&&cardBlock(i)){dropLast();if(part)parts.set(partKey(part),'closed');delimited=true;itemOpen=false;}
     else if(heading){
      const r=refsOf(line.replace(/^[\s*•_–-]+|[\s*•_–-]+$/g,''));if(r.any)applyRefs(r);if(part)parts.set(partKey(part),'closed');
      // Labels of the parts after all the items (a tab bar set below its panels): which items they belong to is not known.
      if(latePublic&&!items.slice(i+1,end).some(Boolean))discard('Bezeichnungen der Sitzungsteile erst nach den Punkten','welche Punkte öffentlich sind, ist nicht eindeutig');
      endBlock();delimited=true;itemOpen=false;
     }
     else if(i<first){
      headMention=true;const r=refsOf(line);
      if(r.any)applyRefs(r);
      // A head that names something in particular (an item by its matter) cannot be matched to the agenda (rule 5).
      else if(!GENERIC_HEAD(line))headSpecific=true;
      if(state==='none'&&!seenItem&&publicSentence(line)){state='public';evidence=`Satz „${line.length>120?line.slice(0,119)+'…':line}“`;}
     }
     else if(/(?:Teil|Abschnitt)\s+(?:[A-H]|[IVX]{1,4}|\d)\s*[:=–-]?\s*(?:nichtöffentlich|öffentlich)/iu.test(canonNP(line))){
      // A legend of the parts ("Teil A: öffentlich, Teil B: nicht öffentlich") must agree with where the block ended.
      for(const m of canonNP(line).matchAll(/(?:Teil|Abschnitt)\s+([A-H]|[IVX]{1,4}|\d)\s*[:=–-]?\s*(nichtöffentlich|öffentlich)/giu)){const was=parts.get(m[1]);if(/^nicht/i.test(m[2])?was!=='closed':was==='closed')discard('Legende der Sitzungsteile passt nicht zur Gliederung der Tagesordnung');}
      endBlock();
     }
     // A note on all items after it ("Die weiteren Punkte werden ohne Beteiligung der Öffentlichkeit beraten.", "Presse und Zuhörer
     // sind ab hier ausgeschlossen") between items is a heading in other words; after the agenda it is a note (rule 3).
     else if(forward&&items.slice(i+1,end).some(Boolean)){if(itemOpen&&!after&&cardBlock(i))dropLast();endBlock();delimited=true;itemOpen=false;}
     // A line that starts like an item not read yet ("TOP 3 nichtöffentlich: …") is that item.
     else if(ITEM_LIKE.test(line)&&!taken.some(x=>mainNumber(x.number)===Number(line.match(/\d{1,2}/)[0]))){endBlock();delimited=true;}
     else if(refsOf(line).any){applyRefs(refsOf(line));endBlock();}
     // A note that names an item by its title, not by its number (rule 3): the whole meeting; one that names the item just
     // read belongs to it.
     else if(names.other)discard('Hinweis auf nichtöffentliche Beratung nennt einen Punkt nur mit seinem Titel','welche Punkte öffentlich sind, ist nicht eindeutig');
     else if(names.named.length)dropLast();
     else if(separator(line)){endBlock();delimited=true;}
     else if(kind==='minutes'&&cur&&isPublicReport(cur.title)&&PAST_REPORT.test(line)){/* the report the item announces */}
     // A short heading in other words ("Geheime Sitzung", "Fortsetzung ohne Publikum") ends the block.
     else if(headingLike(line)&&!refsOf(line).any){if(itemOpen&&!after&&cardBlock(i))dropLast();endBlock();delimited=true;itemOpen=false;}
     // Right after an item a note that points to it ("Die Beratung erfolgt nichtöffentlich.") is that item's; one that names a
     // matter in other words ("Die Grundstücksangelegenheit wird nichtöffentlich beraten.") cannot be matched (rule 2).
     else if(after&&DEICTIC.test(line))dropLast();
     else if(after&&kind!=='minutes')discard('Hinweis auf nichtöffentliche Beratung nennt keinen Punkt eindeutig','welche Punkte öffentlich sind, ist nicht eindeutig');
     else if(after)dropLast();
     else if(state==='nonpublic'){/* inside the non-public part already */}
     else if(kind==='minutes'&&cur)dropLast();
     else discard('Erwähnung des nichtöffentlichen Teils nicht zuzuordnen');
     i++;continue;
    }
    // The head or a note that names items by number together with the public ("Die Sitzung ist öffentlich mit Ausnahme der
    // Tagesordnungspunkte 4 und 5", "Öffentliche Sitzung: TOP 1–3"): which items are public is not read from words (rule 3).
    if((i<first||kind!=='minutes')&&!isPublicReport(line)&&refsOf(line).nums.length&&/(?<!\p{L})(?:öffentlich\p{L}*|Ausnahme|ausgenommen|außer)(?!\p{L})/iu.test(line))discard('Hinweis nennt Punkte mit Nummer zum öffentlichen Teil','welche Punkte öffentlich sind, ist nicht eindeutig');
    // A status below an item, also below its other lines, is that item's, not a heading of the items after it.
    if((after||itemOpen)&&PUBLIC_STATUS.test(line)){statusStyle=true;if(taken.at(-1)?.line===lastItem)taken.at(-1).status='Ö';i++;continue;}
    // A line with another day and a time or weekday after the items ("Do, 15.10.2026, 14:00 Uhr | Seniorennachmittag",
    // "Termin: 21.10.2026, 18:00 Uhr"): another meeting or event begins; nothing after it belongs to this one.
    // In an invitation also the same day at another time ("Mi, 14.10.2026, 15:00 Uhr | Seniorennachmittag").
    if(state==='public'&&seenItem&&i>=first&&line.length<=140&&!NOT_HEADER.test(line)&&(timeOf(line)||WEEKDAY_WORD.test(line)||SHORT_WEEKDAY.test(line))&&meetingDates(all,i,ctx).some(d=>d.iso!==date||kind!=='minutes'&&time&&timeOf(line)&&timeOf(line)!==time)){issues.push(`Anderer Termin nach den Punkten (${where(committee,date,title)}): „${line.length>80?line.slice(0,79)+'…':line}“; folgende Punkte nicht übernommen.`);endBlock();itemOpen=false;i++;continue;}
    // After the items a line that names another day of a session and introduces a list or stands as a heading ("Öffentliche
    // Sitzung vom 16.09.2026", "Die nächste Sitzung … am 11.11.2026 … Auf der Tagesordnung stehen:", "Bereits in der Sitzung am
    // 16.09.2026 hatte der Gemeinderat beschlossen:"): what follows is not known to belong to this meeting.
    if(state==='public'&&seenItem&&i>=first&&line.length<=240&&(SESSION_WORD.test(line)||MEETING_WORD.test(line)||DATE_ONLY.test(line))&&(/:\s*$/.test(line)||!/[.!?]$/.test(line)&&line.length<=100)&&meetingDates(all,i,ctx).some(d=>d.iso!==date)){issues.push(`Anderer Sitzungstag nach den Punkten (${where(committee,date,title)}): „${line.length>80?line.slice(0,79)+'…':line}“; folgende Punkte nicht übernommen.`);endBlock();itemOpen=false;i++;continue;}
    if(isPublicHeading(line)){if(state==='public'&&taken.length)latePublic=true;if(state==='none'){state='public';evidence=`Überschrift „${line}“`;}const p=line.match(PART_HEADING);if(p)parts.set(partKey(p),state==='public'?'public':'none');partSeen=true;cur=null;absent=false;itemOpen=false;i++;continue;}
    // Another heading of a part after the public block ends it ("Teil B", "II.", "B.", "Zweiter Teil", "N-Teil", "B Sitzung").
    const p=line.length<=80&&line.match(PART_HEADING);
    if(p){if(state==='public'&&(partSeen||taken.length)){if(itemOpen&&!after&&cardBlock(i))dropLast();endBlock();delimited=true;parts.set(partKey(p),'closed');}else parts.set(partKey(p),state==='public'?'public':'none');partSeen=true;cur=null;itemOpen=false;i++;continue;}
    if(state==='public'&&taken.length&&(line.length<=40&&PART_WORD.test(line)||PART_KEY.test(line))&&!PUBLIC_STATUS.test(line)){if(itemOpen&&!after&&cardBlock(i))dropLast();endBlock();delimited=true;itemOpen=false;i++;continue;}
    // After the items another line that introduces a list ("Außerdem standen auf der Tagesordnung:", "Anschließend ging es
    // um:"): a block whose part the text does not name; nothing after it is taken (rule 1).
    if(state==='public'&&taken.length&&i>=first&&/:\s*$/.test(line)&&line.length<=200&&itemAt(i+1)&&!itemAt(i+1).number.includes('.')&&!(kind==='minutes'&&[...seen.keys()].some(n=>mainNumber(n)>=mainNumber(itemAt(i+1).number)))&&!publicClause(line)&&!DECISION_INTRO.test(line)&&!ATTENDANCE.test(line)&&!LIST_INTRO.test(line)&&!AGENDA_LINE.test(line)&&!/^(?:Beschluss|Beschlussfassung|Ergebnis|Abstimmung|Zu\s+(?:den\s+|dem\s+)?(?:TOP|Punkt|Tagesordnungspunkt)|Tagesordnung|Sachverhalt|Begründung)/iu.test(line)){issues.push(`Weitere Aufzählung nach den Punkten (${where(committee,date,title)}): „${line.length>80?line.slice(0,79)+'…':line}“; folgende Punkte nicht übernommen.`);endBlock();itemOpen=false;i++;continue;}
    if(ATTENDANCE.test(line)||LIST_INTRO.test(line)){absent=true;listed=LIST_INTRO.test(line);present=0;i++;continue;}
   }
   if(absent){
    // The list ends at the agenda, at prose, where its numbering starts again, or at an item that names no person.
    const n=Number(line.match(/^(\d{1,2})[.)]?\s/)?.[1]||0);
    if(END_ATTENDANCE.test(line)||n&&present&&n<=present||raw&&!(listed?personish(raw.title):isPerson(raw.title))||!n&&line.length>60)absent=false;
    else{if(n)present=n;i++;continue;}
   }
   if(!raw&&kind==='minutes'&&/^Tagesordnung(?!\p{L})/iu.test(line))cur=null;
   // An item marked N/NÖ in whatever form or numbering, or one whose own line names the non-public part, ends the
   // public part.
   // (A title wrapped in the middle of a report from the non-public part is read with its next line.)
   const report=raw&&wrapped&&i+1<end&&!itemOf(all[i+1])&&isPublicReport(join(raw.title,all[i+1]))&&!mentionsNonPublic(join(raw.title,all[i+1]));
   // A line that names the non-public part under the number of an item read already ("1 Beratung voraussichtlich
   // nichtöffentlich" at the foot of a page) is a footnote or legend, not that item: which items it means is not known.
   if(raw&&state==='public'&&raw.prefix!=='N'&&mentionsNonPublic(raw.title)&&!report&&[...seen.keys()].some(n=>mainNumber(n)>=mainNumber(raw.number))&&!taken.some(x=>x.number===raw.number&&(sameTitle(x.title,raw.title)||similarTitles(x.title,raw.title))))discard('Fußnote oder Legende „nichtöffentlich“ unter der Nummer eines Punktes','welche Punkte gemeint sind, ist nicht eindeutig');
   if(raw&&(raw.prefix==='N'||mentionsNonPublic(raw.title)&&!report)){again(raw);shut(raw);seenItem=true;lastItem=i;lastItemEnd=i+1;lastPrefix='N';itemOpen=true;endBlock();delimited=true;i++;continue;}
   // In the non-public part an item read before comes again: from the first item of that part on it is one of them (a list
   // and then its parts); a lower number is the report on a public item of minutes.
   if(raw&&state==='nonpublic'){npFirst??=mainNumber(raw.number);if(mainNumber(raw.number)>=npFirst){again(raw);shut(raw);}}
   // Only some items carry the mark Ö: an item without it after one with it is not shown to be public.
   if(raw&&state==='public'&&!raw.number.includes('.')){if(raw.prefix==='Ö')oeSeen=true;else if(oeSeen&&unmarked<0&&!(kind==='minutes'&&seen.has(raw.number)))unmarked=i;}
   let it=raw&&raw.form===style?raw:null;
   if(it&&cur&&state==='public'&&seen.has(it.number)){
    // An item read again (agenda first, then the report on each item; a list and its details): the lines after it are
    // that item's. In minutes a numbered list inside a decision is text of that item.
    const known=seen.get(it.number);
    if(sameTitle(known.title,it.title||all[i+1]||'')){cur=known;lastItem=-1;itemOpen=false;i++;if(!it.title)i++;lastItemEnd=i;continue;}
    if(kind==='minutes')it=it.prefix?it:null;
   }
   else if(it&&kind==='minutes'&&cur&&state==='public'&&it.form==='plain'&&cur.deciding)it=null;
   if(!it){
    if(state==='none'&&!seenItem&&publicSentence(line)){state='public';evidence=`Satz „${line.length>120?line.slice(0,119)+'…':line}“`;}
    if(cur&&kind==='minutes'){cur.block.push(line);if(/^Beschluss/i.test(line)||DECISION_INTRO.test(line)&&/:\s*$/.test(line))cur.deciding=true;if(/Abstimmung|(?<!\p{L})Ja(?!\p{L}).*Nein|einstimmig|\d\s*:\s*\d|Stimmen/i.test(line))cur.deciding=false;}
    i++;continue;
   }
   seenItem=true;lastItem=i;lastPrefix=it.prefix;itemOpen=true;
   if(it.prefix==='Ö'&&state==='none'){state='public';evidence='Kennzeichnung „Ö“ der Tagesordnungspunkte';}
   if(state!=='public'){if(state==='none')unclear++;else restricted=true;cur=null;i++;lastItemEnd=i;continue;}
   const itemLine=i;let t=it.title,j=i+1;const pieces=[t];read.add(mainNumber(it.number));
   if(!t&&j<end&&continues(j))t=all[j++];
   if(kind==='minutes'){if(/(?:[,:-]|(?<!\p{L})und)$/u.test(t)&&j<end&&continues(j))t=join(t,all[j++]);}
   // A wrapped title that reports from the non-public part ("Bekanntgabe von Beschlüssen" / "aus nichtöffentlicher Sitzung").
   else if(wrapped)for(let k=0;k<3&&j<end&&(continues(j)||!itemOf(all[j])&&isPublicReport(join(t,all[j]))&&!mentionsNonPublic(join(t,all[j])));k++){pieces.push(all[j]);t=join(t,all[j++]);}
   t=t.replace(/\s+/g,' ').replace(/\s*[,;:–]$/,'').trim();
   i=j;lastItemEnd=j;
   if(!/\p{L}/u.test(t)||t.length<3||t.length>400){cur=null;continue;}
   // A title that ends in an open bracket ("Grundstücksangelegenheit Fl.Nr. 412 (nicht") was cut short: what it said is not known.
   if(/\([^()]*$/u.test(t))discard('Text gekürzt','ein Titel endet in einer offenen Klammer');
   if(FOOTNOTE.test(t))footnote=true;
   // The next items run on in the title ("Genehmigung der Niederschrift 2. Bauantrag Kita 3. …", a description without line
   // breaks): where one item ends is not known.
   if(!it.number.includes('.')&&new RegExp(`(?:^|\\s)${mainNumber(it.number)+1}[.)]\\s+\\p{Lu}`,'u').test(t))discard('Mehrere Punkte in einer Zeile','wo ein Punkt endet, ist nicht erkennbar');
   // A mark at the end of a wrapped title, or in the last column of a table.
   const tail=withMark(it.prefix,t);
   // A narrow column "nicht-/öffent-/lich" wrapped together with the title: the ends of its lines read as one word.
   const split=/(?:^|\s)(?:nicht|nicht\s*-?\s*ö\p{L}*|öf+\p{L}*)\s*[-–]$/iu.test(pieces[0])||NP_COMPACT.test(foldText(pieces.map(l=>l.match(/(\S+)\s*$/)?.[1]||'').join('')).replace(/[^a-z#]/g,''));
   if(tail.prefix==='N'||mentionsNonPublic(t)||split){again({number:it.number,title:tail.title});shut({number:it.number,title:tail.title});lastPrefix='N';endBlock();delimited=true;continue;}
   t=tail.title;
   const tok=t.match(/\s(\S+)$/)?.[1]??'';
   if(columnKind==='access'&&!it.prefix&&tail.prefix!=='Ö'){
    // A column "Öffentlichkeit" with "zugelassen"/"ausgeschlossen".
    const v=t.match(/\s((?:nicht\s+)?\S+)$/u)?.[1]||'';
    if(/^(?:zugelassen|gegeben|ja|öffentlich)$/iu.test(v))t=t.slice(0,-v.length).trim();
    else if(/^(?:nicht\s+\S+|ausgeschlossen|ausgeschl\.?|nein)$/iu.test(v)){shut({number:it.number,title:t.slice(0,-v.length).trim()});endBlock();delimited=true;continue;}
    else discard('Spalte „Öffentlichkeit“ der Tagesordnung nicht lesbar');
   }
   else if(columnKind&&!it.prefix&&tail.prefix!=='Ö'){
    if(columnKind==='public'&&PUBLIC_MARK.test(tok))t=t.slice(0,-tok.length).trim();
    else if(columnKind==='public'&&NONPUBLIC_MARK.test(tok)){endBlock();delimited=true;continue;}
    else discard('Spalte „öffentlich/nichtöffentlich“ der Tagesordnung nicht lesbar');
   }
   else if(!columnKind&&/^(?:ja|nein)$/i.test(tok))discard('Kennzeichnung „ja/nein“ ohne erkennbare Spalte');
   // A mark whose meaning the text does not tell (rule 4).
   else if(!columnKind&&oddMark(t))footnote=true;
   if(it.prefix!=='Ö'&&tail.prefix==='Ö'&&state==='public'&&!it.number.includes('.'))oeSeen=true;
   if(seen.has(it.number)){
    // A number again just after the name of a body or a day: another meeting whose head was not recognised. Otherwise
    // a list numbered anew: what follows is not known to belong to this meeting.
    if(all.slice(Math.max(first+1,itemLine-3),itemLine).some(l=>!itemOf(l)&&(committeeOf(l)&&/^\p{Lu}/u.test(l)||SESSION_WORD.test(l)&&germanDates(l).length)))mixed=true;
    issues.push(`Punkt ${it.number} doppelt (${where(committee,date,title)}); nur der erste übernommen.`);cur=null;
    if(kind!=='minutes')endBlock();
    continue;
   }
   cur={prefix:tail.prefix,number:it.number,title:t,block:[],deciding:false,line:itemLine};seen.set(it.number,cur);taken.push(cur);
  }
  // A gap in the numbers of an invitation's items (2 → 4): what follows may be another text frame of a gazette (the non-public
  // items of another meeting); it is not known to belong here.
  if(kind!=='minutes')for(let k=1;k<taken.length;k++){const a=mainNumber(taken[k-1].number),b=mainNumber(taken[k].number);if(b>a+1&&!Array.from({length:b-a-1},(x,n)=>a+n+1).every(n=>read.has(n))){issues.push(`Nummernsprung von Punkt ${a} auf ${b} (${where(committee,date,title)}); folgende Punkte nicht übernommen.`);cuts.push(k);break;}}
  // Items with the mark Ö next to items without it: from the first without it nothing is shown to be public.
  if(taken.some(x=>x.prefix==='Ö')){const k=taken.findIndex(x=>x.prefix!=='Ö'&&x.status!=='Ö');if(k>=0)cuts.push(k);}
  if(unmarked>=0){const k=taken.findIndex(x=>x.line>unmarked);if(k>=0)cuts.push(k);}
  // Items named by a note or marked after they were read go, with all items after them.
  if(cuts.length){for(const x of taken.slice(Math.min(...cuts)))shut(x);taken.length=Math.min(...cuts);}
  const say=n=>`${n} ${n===1?'Punkt':'Punkte'} nicht übernommen.`;
  const drop=(text,detail='')=>{const at=`${text} (${where(committee,date,title)})${detail?': '+detail:''}`;if(taken.length)issues.push(`${at}; ${say(taken.length)}`);else issues.push(`${at}; nichts übernommen.`);taken.length=0;unclear=unclear||1;};
  if(whole)drop(...whole);
  else if(footnote)drop('Punkte mit Fußnoten-, Stern- oder anderer Markierung','deren Bedeutung ist nicht eindeutig öffentlich');
  else if(statusStyle&&taken.some(x=>x.status!=='Ö'&&x.prefix!=='Ö'))drop('Kennzeichnung der Punkte uneinheitlich','nicht jeder Punkt trägt die Angabe „öffentlich“');
  else if(taken.length&&mixed)drop('Punktnummern doppelt nach Angabe eines Gremiums oder Tages','Zuordnung zur Sitzung unklar');
  // The head names something of the non-public part in particular: which item it means is not known (rule 5).
  else if(taken.length&&headSpecific)drop('Hinweis im Kopf auf nichtöffentliche Beratung','er nennt keinen Punkt mit seiner Nummer');
  // The head names a non-public part ("anschließend nichtöffentliche Sitzung") but the agenda never marks where it
  // starts by a heading or a mark N: its end is not known, nothing is taken.
  else if(taken.length&&headMention&&!delimited)drop('Ende des öffentlichen Teils nicht erkennbar','die Einladung nennt einen nichtöffentlichen Teil, die Tagesordnung grenzt ihn nicht ab');
  // A line that reads as a heading of the non-public part while this meeting was never found restricted.
  else if(taken.length&&!restricted&&all.slice(seg.start,end).some(closedLine))drop('Ende des öffentlichen Teils nicht erkennbar','eine Überschrift des nichtöffentlichen Teils ist nicht eindeutig lesbar');
  else if(unclear)issues.push(`Öffentlicher Teil nicht eindeutig erkennbar (${where(committee,date,title)}); ${say(unclear)}`);
  if(state==='nonpublic')carried={date,committee};
  // The signature below the items ("Ortsgemeinde Nachbarhausen", "Erster Bürgermeister der Gemeinde Nachbarhausen"): who
  // gives notice where the head does not say it. Only lines of the signature, not the head of the next notice.
  let lastAt=-1;for(let k=end-1;k>=first;k--)if(items[k]){lastAt=k;break;}
  const trailer=[];
  if(lastAt>=0)for(let k=lastAt+1,sig=false,prevSig=false;k<end&&k<=lastAt+12&&!items[k];k++){
   const l=all[k],starts=PLACE_DATE.test(l)||/^gez\.|^Mit\s+freundliche/iu.test(l)||signed(l),office=/(?:bürgermeister|vorsteher|vorsitzende|landrat|landrätin|amtsdirektor)/iu.test(l)&&l.length<=100;
   // A line below the office goes with it ("Verbandsvorsitzender" / "Zweckverband Wasserversorgung Oberland").
   if(starts||office||sig&&prevSig&&l.length<=80){trailer.push(l);sig=true;prevSig=starts||office;}else prevSig=false;
  }
  // Who gives notice anywhere above the head in the whole text (an Amt or a Verwaltungsgemeinschaft whose collective notice names
  // itself only above its first meeting).
  const docTop=Math.min(top,segments.find(x=>x.header)?.header.line??top);
  const docIssuers=[];for(let k=0;k<docTop;k++){const l=capsFix(all[k]);if(!items[k]&&l.length<=100&&ISSUER.test(l)&&!GAZETTE.test(l))docIssuers.push(l);}
  meetings.push({date,time,committee,kind,trailer,docIssuers,lastPublic:Math.max(0,...[...seen.keys()].map(mainNumber)),items:taken.map(x=>{const o=kind==='minutes'?outcomeOf(x.block.join('\n')):{status:null,result:'',votes:null};return {prefix:x.prefix,number:x.number,title:x.title,status:o.status,result:o.result,votes:o.votes};}),restricted,unclear:unclear>0,publicEvidence:evidence,heading,context,issuer,lead,headText,headLines:all.slice(at>=0?at:seg.start,first).filter(l=>!GAZETTE_TITLE.test(l)&&!GAZETTE.test(l)&&!ISSUE_HEAD.test(l)).slice(0,20),gazette,closedItems});
 });
 return {meetings,issues};
}
/** A line set in capitals ("ZWECKVERBAND WASSERVERSORGUNG OBERLAND") as it is written otherwise ("Zweckverband Wasserversorgung Oberland"). */
export const capsFix=l=>{const s=String(l??'');return /\p{Lu}{3}/u.test(s)&&!/\p{Ll}/u.test(s)?s.replace(/\p{L}+/gu,w=>w[0]+w.slice(1).toLowerCase()):s;};
// Who gives notice of a meeting, as a line of its own above its head.
// Also "Der Landrat des Landkreises …", "ZV Wasserversorgung …", "Verbandsgemeindewerke …".
const ISSUER=/^(?:(?:Öffentliche\s+)?Bekanntmachung\s+(?:des|der)\s+)?(?:\p{L}+-\s+(?:und|u\.)\s+\p{L}*verband(?:e?s)?|(?:Der\s+|Die\s+)?(?:Landrat|Landrätin)(?=\s+(?:des|der)\s)|ZV(?=\s+\p{Lu})|Verbandsgemeinde\p{L}+|Samtgemeinde\p{L}+|Verbandsgemeindeverwaltung|Samtgemeindeverwaltung|Amtsverwaltung|Gemeinde|Stadt|Markt|Marktgemeinde|Ortsgemeinde|Hansestadt|Große\s+Kreisstadt|Kreisstadt|Universitätsstadt|Landeshauptstadt|Landkreis(?:es)?|Landratsamt(?:es)?|Kreis(?:es)?|Kreisverwaltung|Amt(?:es)?|Verbandsgemeinde|Samtgemeinde|Verwaltungsgemeinschaft|Verwaltungsverband|Gemeindeverwaltungsverband|\p{L}*verband(?:e?s)?|Wasserversorgungsgruppe|Gruppenwasserversorgung|Fernwasserversorgung)(?!\p{L})|^(?:Wasserversorgung|Abwasserbeseitigung|Abwasserentsorgung|Wasserbeschaffung)(?=\s+\p{Lu})/u;
// A gazette as the title of a document or its first lines (not "Amtliche Bekanntmachungen", a heading of any notice page).
// Also the names of local papers ("Gemeindezeitung", "Oberland-Rundschau", "Heimatzeitung", "Gemeindenachrichten").
const PAPER='Mitteilungsblatt|Amtsblatt|Gemeindeblatt|Wochenblatt|Nachrichtenblatt|Amtsbote|Gemeindebote|Heimatblatt|Amtsanzeiger|Gemeindeanzeiger|Gemeindezeitung|Stadtzeitung|Heimatzeitung|Bürgerzeitung|Dorfzeitung|Rundschau|Gemeindenachrichten|Stadtnachrichten|Bürgerblatt|Ortsblatt|Gemeindebrief|Stadtanzeiger|Infoblatt|Kurier|Heimatbote|Bote';
const GAZETTE_TITLE=new RegExp(`(?:${PAPER})(?!\\p{L})`,'iu');
const GAZETTE=new RegExp(`^(?:${PAPER}|Amtliche\\s+(?:Bekanntmachungen|Nachrichten|Mitteilungen)|Amtliches\\s+Mitteilungsblatt)(?!\\p{L})`,'iu');
// The line of an issue ("Jahrgang 32 · Freitag, 9. Oktober 2026 · Nr. 41"): its head is a gazette's, whatever it is called.
const ISSUE_HEAD=/(?<!\p{L})(?:Jahrgang|Ausgabe)(?!\p{L})|(?<!\p{L})Nr\.\s*\d{1,3}(?![\d.])/u;
