// Text als Mensch ihn liest: HTML-Entitäten (auch mehrfach maskiert), Mojibake (UTF-8 als Windows-1252/Latin-1 gelesen) und
// Umlaute aus zwei Zeichen. Reine Funktionen; genutzt von website-text.mjs (dort weiter exportiert) und den Lesern.
import {decode} from './sessionnet.mjs';

const MORE={bdquo:'„',ldquo:'“',rdquo:'”',lsquo:'‘',rsquo:'’',sbquo:'‚',laquo:'«',raquo:'»',shy:'',hellip:'…',sect:'§',euro:'€',minus:'−',ndash:'–',mdash:'—',thinsp:' ',ensp:' ',emsp:' ',zwnj:'',zwj:'',middot:'·',bull:'•',deg:'°',eacute:'é',egrave:'è',aacute:'á',agrave:'à',ccedil:'ç',
 ZeroWidthSpace:'',NegativeThinSpace:'',NegativeMediumSpace:'',NegativeThickSpace:'',NegativeVeryThinSpace:'',NoBreak:'',NonBreakingSpace:' ',hyphen:'-',dash:'-',ast:'*',midast:'*',quest:'?',lpar:'(',rpar:')',colon:':',comma:',',period:'.',sol:'/',num:'#',excl:'!'};
// Entities are decoded until nothing changes: CMS exports escape an escaped text again ("Nicht&amp;ouml;ffentlich").
const decodeOnce=s=>decode(String(s).replace(/&([a-z]+);/gi,(m,k)=>MORE[k]??m));
/** Text with its HTML entities decoded, also entities escaped once or twice more. */
export function decodeEntities(s){let t=String(s??'');for(let k=0;k<5&&/&(?:#x?[0-9a-f]+|[a-z]+);/i.test(t);k++){const n=decodeOnce(t);if(n===t)break;t=n;}return t;}
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
/** Umlauts as one character: pdf.js and some editors write "ö" as "o" with a combining (U+0308) or spacing (U+00A8) diaeresis. */
export const composeUmlauts=s=>String(s??'').replace(/¨\s?([AOUaou])/g,'$1̈').replace(/([AOUaou])¨/g,'$1̈').normalize('NFC');
/**
 * Umlauts of a PDF whose font maps them to other characters ("÷ffentliche Sitzungsvorlage", "‰ndern", "zuk¸nftig", "Fˆrderung",
 * "‹bersicht"; Kirchberg an der Murr, 2026). Repaired for the whole text, and only where such characters stand inside words at
 * least three times: a real per mille sign or diacritic stays. "ß" comes out as "fl" in those files and is left as it is,
 * since "fl" is also an ordinary pair of letters ("Pflicht").
 */
const FONT_UMLAUTS={'÷':'Ö','‰':'ä','ˆ':'ö','¸':'ü','‹':'Ü'};
export function repairFontUmlauts(text){
 const t=String(text??'');
 if((t.match(/\p{L}[‰ˆ¸]|[‰ˆ¸]\p{L}/gu)||[]).length<3)return t;
 return t.replace(/(?<=\p{L})[‰ˆ¸]|[‰ˆ¸](?=\p{L})|(?<![\p{L}\d])[÷‹](?=\p{Ll})/gu,c=>FONT_UMLAUTS[c]);
}
