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
const MORE={bdquo:'„',ldquo:'“',rdquo:'”',lsquo:'‘',rsquo:'’',sbquo:'‚',laquo:'«',raquo:'»',shy:'',hellip:'…',sect:'§',euro:'€',minus:'−',ndash:'–',mdash:'—',thinsp:' ',ensp:' ',emsp:' ',zwnj:'',zwj:'',middot:'·',bull:'•',deg:'°',eacute:'é',egrave:'è',aacute:'á',agrave:'à',ccedil:'ç'};
const entities=s=>decode(String(s).replace(/&([a-z]+);/gi,(m,k)=>MORE[k]??m));
/** Words that make a page, link or document worth reading for meetings. */
export const SESSION_WORDS=/Sitzung|Tagesordnung|Einladung|Bekanntmachung[^.]{0,80}Sitzung|Niederschrift|Protokoll|Sitzungsbericht|Beschlüsse|Beschlussübersicht|Gemeinderat|Stadtrat|Marktgemeinderat|Marktrat|Ausschuss|Ratssitzung|Stadtverordnetenversammlung|Gemeindevertretung|Stadtvertretung|Ortschaftsrat|Ortsrat|Ortsbeirat|Kreistag/i;
/** Link texts, titles and addresses of the non-public part; such documents are not read. */
// Also the short forms "nö", "(NÖ)", "N.Ö.", "…_noe_…" and "nichtoeff-…" of labels and file names.
export const NONPUBLIC_WORDS=/nicht(?:[\s_.-]|%20|%2D)*(?:ö|oe|o|%C3%B6)ffentl|nicht(?:[\s_.-]|%20|%2D)*(?:ö|oe|%C3%B6)ff(?!\p{L})|vertraulich|geschlossene[rn]?[\s_-]+(?:Sitzung|Teil)|Ausschlu(?:ss|ß)[\s_-]+der[\s_-]+(?:Ö|Oe)ffentlichkeit|(?<![\p{L}\p{N}])(?:N\.?\s?Ö\.?|NOE)(?!\p{L})/iu;
/** Umlauts as one character: pdf.js and some editors write "ö" as "o" with a combining (U+0308) or spacing (U+00A8) diaeresis. */
export const composeUmlauts=s=>String(s??'').replace(/\u00a8\s?([AOUaou])/g,'$1\u0308').replace(/([AOUaou])\u00a8/g,'$1\u0308').normalize('NFC');
/** Whether a label, title, address or line names the non-public part (in any Unicode form of its umlauts). */
export const isNonPublicText=s=>NONPUBLIC_WORDS.test(composeUmlauts(s));

/** One line as a person reads it: spaced letters joined, dashes, quotes and spaces made uniform. */
export function normalizeLine(line){
 let s=composeUmlauts(line).replace(/[\u00a0\u2000-\u200a\u202f\u205f\u3000\t]/g,' ').replace(/[\u00ad\u200b-\u200d\u2060\ufeff]/g,'');
 s=s.replace(/[\u2010\u2011]/g,'-').replace(/[\u2012-\u2015\u2212\u2e3a\u2e3b\ufe58\ufe63\uff0d]/g,'–').replace(/[„“”‟″«»＂]/g,'"').replace(/[‚‘’‛′`´]/g,"'");
 // Letter-spaced headings ("T a g e s o r d n u n g"): single letters with single spaces form one word; the words of
 // such a heading are set apart by two or more spaces, which stay a word break.
 s=s.replace(/(?<![\p{L}\p{N}])\p{L}(?: \p{L}){2,}(?![\p{L}\p{N}])/gu,m=>m.replace(/ /g,''));
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
/** Lines of the main content of a page: main, article or [role=main], otherwise the body without its frame. */
export function htmlToLines(html){
 let h=String(html||'').replace(/<!--[\s\S]*?-->/g,' ').replace(/<!\[CDATA\[[\s\S]*?\]\]>/g,' ');
 h=strip(h,'script|style|noscript|template|svg|iframe|object|canvas');
 const main=h.search(/<main\b/i),role=h.match(/<([a-z][a-z0-9]*)\b[^>]*\brole\s*=\s*["']?main\b[^>]*>/i);
 if(main>=0)h=element(h,main,'main');
 else if(role)h=element(h,role.index,role[1]);
 else if(/<article\b/i.test(h)){const parts=[];let at=0;for(;;){const i=h.slice(at).search(/<article\b/i);if(i<0)break;const part=element(h,at+i,'article');parts.push(part);at+=i+part.length;}h=parts.join('\n');}
 else h=strip((h.match(/<body\b[^>]*>([\s\S]*)<\/body>/i)?.[1]??h),'header|footer');
 // Navigation, side boxes and forms are not content, also inside main.
 h=strip(h,'nav|aside|form|select|button|dialog');
 // Line breaks of the source are spaces, except inside <pre>.
 h=h.replace(/<pre\b[^>]*>([\s\S]*?)<\/pre>/gi,(m,body)=>'\n'+body.replace(/\r?\n/g,'<br>')+'\n');
 h=h.replace(/\s+/g,' ').replace(/<br\b[^>]*>/gi,'\n').replace(new RegExp(`</?(?:${BLOCK})\\b[^>]*>`,'gi'),'\n').replace(/<\/?t[dh]\b[^>]*>/gi,' ');
 // Inline markup sits inside words ("<b>T</b>agesordnung"); any other tag is a space.
 h=h.replace(new RegExp(`</?(?:${INLINE})\\b[^>]*>`,'gi'),'').replace(/<[^>]+>/g,' ');
 return entities(h).split('\n').map(normalizeLine).filter(Boolean);
}
const PAGE_ONLY=/^(?:[-–]\s*)?\d{1,3}(?:\s*[-–])?$|^\d{1,3}\s*\/\s*\d{1,3}$|^Seite\s+\d{1,3}(?:\s*(?:von|\/)\s*\d{1,3})?$/i;
/** Lines of the text of a PDF (unpdf, pages joined by line breaks) without page numbers and "Seite 2 von 5" lines. */
export function pdfLines(text){
 return String(text||'').split(/\r\n|\r|\n|\f/).map(normalizeLine).filter(l=>l&&!PAGE_ONLY.test(l)&&!(l.length<=100&&/\bSeite\s+\d{1,3}\s+(?:von|\/)\s+\d{1,3}\b/i.test(l)));
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
 // A place name only after an article ("des Gemeinderates Oberdorf"): "Stadtrat Muster" may name a person.
 if(/(?:^|\s)(?:des|der|dem|den|die)\s+$/i.test(text.slice(0,m.index))||m[3]){
  const w=after.match(/^\s+([\p{L}.-]+)(?:\s+([\p{L}-]+))?/u);
  if(w&&TWO_PART.test(w[1])&&placeWord(w[2]))name+=` ${w[1]} ${w[2]}`;
  else if(w&&placeWord(w[1]))name+=' '+w[1];
 }
 return name;
}
/** Bodies of special-purpose associations (Zweck-, Schul-, Abwasserverband), which are not the town's own bodies. */
export function isSpecialPurposeBody(name){return /(?:zweck|schul|abwasser|wasser|abfall)\p{L}{0,25}verband/iu.test(String(name||''));}

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
const MARK='(NÖ|Nö|nö|NOE|Noe|noe|N|n|Ö|ö)(?:\\s*[-/.]\\s*|\\s*)';
const KEYWORD=new RegExp(`^(?:TOP|Top|TO|Tagesordnungspunkt|Punkt)\\s*(?:Nr\\.?\\s*)?(?:${MARK})?${NUM}\\.?(?!\\d)\\s*(?:[:.)–-]\\s*)?(.*)$`,'u');
const PREFIXED=new RegExp(`^${MARK}${NUM}\\.?(?!\\d)\\s*(?:[:.)–-]\\s*)?(.*)$`,'u');
// A mark after the number, as a column of a table ("2 N Grundstücksverkauf", "4 (NÖ) …", "1 Ö Bauantrag").
const AFTER_MARK=/^\(?(NÖ|Nö|nö|NOE|N|Ö|ö)\)?(?:\s*[.:)–-]\s*|\s+|$)/u;
const markOf=m=>m?(/^ö$/i.test(m)?'Ö':'N'):null;
function withMark(prefix,title){const a=!prefix&&title.match(AFTER_MARK);return a?{prefix:markOf(a[1]),title:title.slice(a[0].length).trim()}:{prefix,title};}
const PLAIN=new RegExp(`^${NUM}(\\.|\\))?\\s+(.+)$`,'u');
const OFFICE=/^(?:Erste[rn]?\s+|Zweite[rn]?\s+|Dritte[rn]?\s+|Stellvertretende[rn]?\s+)?(?:Ober|Vize|Orts|Kreis)?(?:[Bb]ürgermeister|Vorsitzende|Beigeordnete|Stellvertreter|[Oo]rtsvorsteher|Landrat|Landrätin|Kommandant|Schriftführer|Amtsdirektor|Amtsvorsteher|Verbandsvorsteher|Kämmerer|Kämmerin|Vorstand)(?:in|innen|e[rn]?|r|n|\(in\)|\(r\))?(?!\p{L})|^stellv\.|^Bgm\.?(?!\p{L})/u;
// Members and staff named in a list of those present ("2. Gemeinderätin Probe", "3. GR Beispiel", "4. Hauptamtsleiter Muster"):
// a mandate or post followed by a name. "5. Stadtrat – Umbesetzung der Ausschüsse" is an item.
const MEMBER=/^(?:(?:Gemeinde|Stadt|Markt|Marktgemeinde|Kreis|Orts|Ortschafts|Ortsgemeinde|Stadtbezirks|Bezirks)(?:rat|rätin|räte|ratsmitglied)|Ratsmitglied|Ratsherr|Ratsfrau|Gemeindevertreter(?:in)?|Stadtverordnete[rn]?|Kreistagsmitglied|Kreisrätin|GR(?:in)?|StR(?:in)?|MGR|KR|\p{Lu}\p{Ll}*(?:amts)?leiter(?:in)?|Sachbearbeiter(?:in)?|Protokollführer(?:in)?)\.?(?=\s+(?:Dr\.\s+|Prof\.\s+)?\p{Lu}[\p{Ll}.'-]+(?:\s*[,(]|\s+\p{Lu}[\p{Ll}-]+\s*$|\s*$))/u;
const UNIT=/^(?:Anlagen?|Seiten?|Stimmen?|Ja|Nein|Enthaltung(?:en)?|Mitglieder|Gemeinderäte|Gemeinderätinnen|Stadträte|Stadträtinnen|Ratsmitglieder|Personen|Teilnehmer|Euro|EUR|Mio|Mrd|Tsd|Prozent|Jahre?n?|Monate?n?|Wochen?|Tage?n?|Stunden?|Minuten|Stück|Wohneinheiten|WE|Plätze|Kinder|Bauplätze|Exemplare|Fälle|Uhr|Gegenstimmen?)(?!\p{L})/u;
const key=n=>n.split('.').map(p=>String(Number(p))).join('.');
const person=t=>OFFICE.test(t)||MEMBER.test(t);
function itemOf(raw){
 const line=normalizeLine(raw);let m;
 const titleOk=t=>!t||/^[\p{Lu}„"'(§]/u.test(t)||/^\d{1,2}\.\s+\p{Lu}/u.test(t);
 if((m=line.match(KEYWORD))){const n=key(m[2]),w=withMark(markOf(m[1]),m[3].trim());if(Number(n.split('.')[0])<1||Number(n.split('.')[0])>60||!titleOk(w.title))return null;return {prefix:w.prefix,number:n,title:w.title,form:'keyword'};}
 if((m=line.match(PREFIXED))){const n=key(m[2]);if(Number(n.split('.')[0])<1||Number(n.split('.')[0])>60||!titleOk(m[3]))return null;return {prefix:markOf(m[1]),number:n,title:m[3].trim(),form:'prefix'};}
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
const PUBLIC_CORE=new RegExp(`${LEAD}öffentlich(?:e[rnms]?)?${PART}$`,'iu');
const NONPUBLIC_CORE=new RegExp(`${LEAD}(?:nicht\\s*-?\\s*)öffentlich(?:e[rnms]?)?${PART}$|^(?:Teil\\s+|Sitzung\\s+|Beratung\\s+)?unter\\s+Ausschlu(?:ss|ß)\\s+der\\s+Öffentlichkeit$|^vertraulich(?:e[rnms]?)?(?:\\s+(?:Teil|Sitzung|Sitzungsteil|Beratung|Tagesordnung))?$|^geschlossene[rnms]?\\s+(?:Sitzung|Teil|Sitzungsteil)$`,'iu');
// Unnumbered short lines may go on with the body and day ("Öffentliche Sitzung des Gemeinderates am 14.10.2026").
const PUBLIC_LONG=/^öffentliche\s+Sitzung\s+(?:des|der)\s/iu,NONPUBLIC_LONG=/^(?:nicht\s*-?\s*öffentliche\s+Sitzung\s+(?:des|der)\s|unter\s+Ausschlu(?:ss|ß)\s+der\s+Öffentlichkeit(?!\p{L}))/iu;
function headingCore(raw){
 const line=normalizeLine(raw),it=itemOf(line);
 if(!it&&line.length>90)return null;
 let core=(it?it.title:line).replace(/^(?:(?:Teil|Abschnitt)\s+(?:[A-H]|[IVX]{1,4}|\d)\s*[:.)–-]?\s*)/i,'').replace(/^(?:[A-H]|[IVX]{1,4})[.)]\s*/,'');
 core=core.replace(/[()]/g,' ').replace(/[\s:.,;–-]+$/,'').replace(/\s+/g,' ').trim();
 return {core,numbered:!!it};
}
// The long form only as a heading of its own (capital Ö); "… eine\nöffentliche Sitzung des Gemeinderates statt." is a
// wrapped sentence, which counts as a sentence of the head.
export function isPublicHeading(line){const h=headingCore(line);return !!h&&(PUBLIC_CORE.test(h.core)||!h.numbered&&/^Ö/.test(h.core)&&PUBLIC_LONG.test(h.core));}
export function isNonPublicHeading(line){const h=headingCore(line);return !!h&&(NONPUBLIC_CORE.test(h.core)||!h.numbered&&NONPUBLIC_LONG.test(h.core));}
// A sentence of the head that names the public session ("findet eine öffentliche Sitzung statt", "in öffentlicher Sitzung").
const PUBLIC_SENTENCE=/(?<!nicht\s*-?\s*)(?<!\p{L})öffentliche[rnm]?\s+(?:\p{L}*sitzung|Tagung)(?!\p{L})|(?:Sitzung|Tagung)\s(?:[^.]{0,40}\s)?(?:ist|findet|tagt)\s+öffentlich(?!\p{L})/iu;
const publicSentence=line=>PUBLIC_SENTENCE.test(line)&&!/^(?:Herstellung|Wiederherstellung)\s+der\s+Öffentlichkeit/i.test(line);

// Outcomes in a block of minutes.
const OUTCOMES=[
 ['postponed',/(?<!\p{L})(?:vertagt|zurückgestellt|abgesetzt|verschoben)(?!\p{L})|von\s+der\s+Tagesordnung\s+(?:genommen|abgesetzt)/giu],
 ['info',/zur\s+Kenntnis\s+genommen|(?<!\p{L})(?:nimmt|nahm|nehmen|nahmen)\s[^.;]{0,160}?zur\s+Kenntnis(?!\p{L})|Kenntnisnahme|Kenntnis\s+genommen/giu],
 ['rejected',/(?<!\p{L})abgelehnt(?!\p{L})|(?<!\p{L})lehn(?:t|te|ten|en)\s[^.;]{0,160}?(?<!\p{L})ab(?!\p{L})|nicht\s+zugestimmt|keine\s+Mehrheit|nicht\s+(?:beschlossen|angenommen)(?!\p{L})|(?<!\p{L})(?:abzulehnen|zu\s+versagen|versagt|verweigert|zurückzuweisen|zurückgewiesen|nicht\s+zu\s+erteilen)(?!\p{L})/giu],
 ['approved',/(?<!\p{L})(?:beschlossen|beschließt|beschloss|beschließen|angenommen|zugestimmt|genehmigt|erteilt|befürwortet)(?!\p{L})|(?<!\p{L})stimm(?:t|te|ten|en)\s[^.;]{0,160}?(?<!\p{L})zu(?!\p{L})/giu],
];
const NEGATED=/(?<!\p{L})(?:nicht|kein(?:e|en)?)\s+(?:\p{L}+\s+)?$/iu;
// "beschließt, den Antrag abzulehnen": the decision is a rejection, its votes count for rejecting.
const DECIDED_AGAINST=/(?<!\p{L})(?:abzulehnen|zu\s+versagen|zurückzuweisen|nicht\s+zu\s+erteilen)(?!\p{L})/iu;
const DECIDE_WORD=/^(?:beschlossen|beschließt|beschloss|beschließen)$/i;
// A vote on a motion about the procedure ("Antrag auf Ablehnung/Vertagung … angenommen") says nothing clear about the item.
const PROCEDURE=/Antrag\s+auf\s+(?:Ablehnung|Vertagung|Zurückstellung|Absetzung|Nichtbefassung|Schluss\s+der\s+(?:Debatte|Beratung))/iu;
const VOTES=[
 [/(?<!\p{L})Ja(?:-?Stimmen)?\s*[:=]?\s*(\d{1,3})(?!\d)[\s,;/]*Nein(?:-?Stimmen)?\s*[:=]?\s*(\d{1,3})(?!\d)(?:[\s,;/]*(?:Stimm)?[Ee]nthaltung(?:\(?en\)?)?\s*[:=]?\s*(\d{1,3}))?/iu,m=>[m[1],m[2],m[3]]],
 [/(?<![\d.])(\d{1,3})\s+Ja(?:-?Stimmen)?(?!\p{L})[\s,;/]*(?:und\s+)?(\d{1,3})\s+Nein(?:-?Stimmen)?(?!\p{L})(?:[\s,;/]*(?:und\s+|bei\s+)?(\d{1,3})\s+(?:Stimm)?[Ee]nthaltung(?:en)?)?/u,m=>[m[1],m[2],m[3]]],
 [/(?:Abstimmung(?:sergebnis)?|Ergebnis|Stimmenverhältnis)\s*:?\s*(?:einstimmig\s*)?(\d{1,3})\s*:\s*(\d{1,3})(?!\d)(?:\s*:\s*(\d{1,3}))?/iu,m=>[m[1],m[2],m[3]]],
 [/(?<!\p{L})mit\s+(\d{1,3})\s*:\s*(\d{1,3})(?:\s*:\s*(\d{1,3}))?\s+Stimmen/iu,m=>[m[1],m[2],m[3]]],
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
 const hits=[];
 for(const [status,re] of OUTCOMES)for(const m of text.matchAll(re)){
  const before=text.slice(Math.max(0,m.index-30),m.index);
  if(status==='approved'&&/^stimm/i.test(m[0])&&/(?<!\p{L})nicht(?!\p{L})/iu.test(m[0])){hits.push({status:'rejected',index:m.index});continue;}
  // "lehnt den Antrag nicht ab" is no rejection.
  if(status==='rejected'&&/^lehn/i.test(m[0])&&/(?<!\p{L})nicht(?!\p{L})/iu.test(m[0]))continue;
  if((status==='approved'||status==='rejected'&&/^(?:abgelehnt|lehn)/i.test(m[0]))&&NEGATED.test(before))continue;
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
 if(PROCEDURE.test(text))found.clear();
 // Taking note or postponing is itself decided ("beschließt, den Punkt zu vertagen"; "12:0"): no contradiction.
 if(found.has('info')||found.has('postponed'))found.delete('approved');
 const unanimous=text.search(/(?<!\p{L})einstimmig(?!\p{L})/iu);
 if(!found.size&&unanimous>=0){found.add('approved');hits.push({status:'approved',index:unanimous});}
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
const NOT_MEETING_DAY=/(?:Bekanntmachung|veröffentlicht|ausgehängt|Aushang|angeschlagen|abgenommen|Stand|erstellt|Ausgabe|Amtsblatt|Mitteilungsblatt|Nr\.(?:\s*[\d/]+)?|gedruckt|Schreiben|Einladung|Ladungsfrist|Erscheinungstag|Vorlage|Drucksache|Auslegung|ausgelegt|Einwendungen|Stellungnahmen?|Frist|Fristablauf)\s*(?:vom|am|:|den)?\s*(?:\p{L}+,?\s+)?$|(?<!\p{L})(?:bis|spätestens)(?:\s+(?:zum|spätestens|einschließlich))?\s*(?:\p{L}+,?\s+)?$/iu;
const RANGE_NEXT=/^\s*(?:–|-|bis)\s*(?:\p{L}+,?\s+)?/u;
// How much a line names the day of the meeting: a word of the session, and a weekday or time of day besides.
const MEETING_WORD=/(?<!\p{L})(?:Sitzung|Tagung|findet|statt|Termin|Datum|Beginn|tritt|tagt)(?!\p{L})|sitzung(?!\p{L})|sitzungstermin|sitzungstag/iu;
const WEEKDAY_WORD=/(?<!\p{L})(?:Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonnabend|Sonntag)(?!\p{L})/u;
const dayScore=line=>(MEETING_WORD.test(line)?2:/(?<!\p{L})(?:am|vom)(?!\p{L})/iu.test(line)?1:0)+(timeOf(line)||WEEKDAY_WORD.test(line)?2:0)+1;
function meetingDates(lines,i){
 if(signature(lines,i))return [];
 const line=lines[i];
 return germanDates(line).filter(d=>{
  if(NOT_MEETING_DAY.test(line.slice(Math.max(0,d.index-45),d.index)))return false;
  // The first day of a period ("vom 05.10.2026 bis 06.11.2026") is no day of a meeting.
  const after=line.slice(d.index+d.text.length),r=after.match(RANGE_NEXT);
  return !(r&&germanDates(after.slice(r[0].length))[0]?.index===0);
 });
}
// The date of the line that names the day best; on a tie the first.
function pickDate(lines,from,to){
 let best=null;
 for(let i=from;i<to;i++)for(const d of meetingDates(lines,i)){const score=dayScore(lines[i]);if(!best||score>best.score)best={...d,score,line:i};}
 return best;
}
// A line that starts a meeting in a text of several: it names a session (or is the head of an agenda or invitation)
// and a body, a day follows within two lines. Notes on an earlier or later reading ("Vorberatung in öffentlicher
// Sitzung des Bauausschusses am …") start nothing.
const NOT_HEADER=/(?<!\p{L})(?:wird|wurde|werden|wurden|hat|haben|hatte|genehmigt|beschlossen|nächste[nrm]?|letzte[nrm]?|vorherige[nrm]?|vergangene[nrm]?|vorangegangene[nrm]?|Bekanntgabe|Genehmigung|Anfragen?|Mitteilung(?:en)?|Vorberatung|vorberaten|vorberatend|empfiehlt|empfohlen|Empfehlung|Beschlussempfehlung)(?!\p{L})|aus\s+(?:der\s+)?(?:nicht\s*-?\s*)?öffentliche[rn]?\s+Sitzung|^\s*[([]/iu;
const SESSION_WORD=/(?:sitzung|tagung)(?!\p{L})/iu;
const AGENDA_HEAD=/^(?:Tagesordnung|Einladung|(?:Öffentliche\s+)?Bekanntmachung)(?!\p{L})/iu;
const SESSION_ON=/^(?:(?:nicht\s*-?\s*)?öffentliche\s+|ordentliche\s+)?(?:Sitzung|Tagung)\s+(?:am|vom)(?!\p{L})/iu;
function meetingHeader(lines,i){
 const line=lines[i],it=itemOf(line);
 if(line.length>160||NOT_HEADER.test(line))return null;
 // "Bauausschuss" on a line of its own, "Sitzung am Dienstag, 21.10.2026" below it.
 const twoLines=!SESSION_WORD.test(line)&&!it&&line.length<=80&&SESSION_ON.test(lines[i+1]||'')&&!NOT_HEADER.test(lines[i+1]);
 if(!SESSION_WORD.test(line)&&!twoLines&&!(AGENDA_HEAD.test(line)&&germanDates(line).length))return null;
 if(it&&!/^(?:(?:nicht\s*-?\s*)?öffentliche\s+|ordentliche\s+|konstituierende\s+|\d+\.\s+)?(?:Sitzung|Tagung)(?!\p{L})/iu.test(it.title))return null;
 const committee=committeeOf(line);if(!committee)return null;
 let best=null;
 for(let k=i;k<Math.min(lines.length,i+3);k++){if(k>i&&itemOf(lines[k]))break;for(const d of meetingDates(lines,k)){const score=dayScore(lines[k]);if(!best||score>best.score)best={...d,score,line:k};}}
 return best?{date:best.iso,committee,day:best,own:AGENDA_HEAD.test(line)||/^(?:(?:nicht\s*-?\s*)?öffentliche\s+|ordentliche\s+|konstituierende\s+|\d+\.\s+)?(?:Sitzung|Tagung|Niederschrift|Protokoll|Sitzungsbericht|Bericht)(?!\p{L})/iu.test(line)||twoLines}:null;
}
// The same body with or without the name of the place ("Gemeinderat Musterbach", "Gemeinderat").
const sameBody=(a,b)=>a===b||a.startsWith(b+' ')||b.startsWith(a+' ');
const plainTitle=s=>s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu,'');
const sameTitle=(a,b)=>{const x=plainTitle(a),y=plainTitle(b);return !!x&&!!y&&(x.startsWith(y.slice(0,25))||y.startsWith(x.slice(0,25)));};
// Joins a wrapped line: "Grund-" + "stück" is one word; "Bau-" + "und Umweltausschuss" keeps its hyphen and space.
const join=(a,b)=>/\p{Ll}-$/u.test(a)&&/^\p{Ll}/u.test(b)&&!/^(?:und|oder|sowie|bzw)(?!\p{L})/u.test(b)?a.slice(0,-1)+b:/-$/.test(a)&&/^\p{Lu}/u.test(b)?a+b:a+' '+b;
const ddmmyyyy=iso=>iso?iso.split('-').reverse().join('.'):'';

// Lines that report on the non-public part from the public one ("Bekanntgabe von Beschlüssen aus nichtöffentlicher
// Sitzung", "die in nichtöffentlicher Sitzung gefassten Beschlüsse"); any other naming of it closes the public part.
const PUBLIC_REPORT=/(?:Bekanntgabe|Bekanntgaben|Mitteilung|Mitteilungen|Information|Unterrichtung|Bericht)\s[^.]{0,100}?(?:aus|in|über)\s+(?:der\s+|einer\s+|den\s+)?(?:\p{L}+\s+)?nicht\s*-?\s*öffentliche[rnm]?\s+(?:Sitzung(?:en)?|Beratung(?:en)?|Teil)(?!\p{L})|(?:in|aus)\s+(?:der\s+)?(?:\p{L}+\s+)?nicht\s*-?\s*öffentliche[rnm]?\s+Sitzung(?:en)?\s+gefasste[n]?\s+Beschl\p{L}*/giu;
const closes=line=>NONPUBLIC_WORDS.test(line.replace(PUBLIC_REPORT,' '))||/^[Nn]$/.test(line);
// Letters run together ("NichtöffentlicherTeil"), framed ("– Nichtöffentlicher Teil –") or numbered: a short line that
// is nothing but a heading of the non-public part.
const fold=s=>s.toLowerCase().replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss');
const CLOSED_LINE=/^[-–*•_.:\s]*(?:[a-h]|[ivx]{1,4}|\d{1,2})?[.):]?(?:tagesordnung|teil[a-h]?)?[-–:]?(?:nicht-?oeffentliche?[rnms]?|unterausschlussderoeffentlichkeit|vertraulich|geschlossenesitzung|noe|n\.oe\.?)(?:teil|sitzung|sitzungsteil|tagesordnung|beratung|punkte|angelegenheiten)?[-–.:*•_]*$/;
/** A short line that, read without spaces, is a heading of the non-public part. */
export const closedLine=line=>{const l=normalizeLine(line);return l.length<=60&&CLOSED_LINE.test(fold(l).replace(/\s+/g,''));};
// Lists of those present in minutes ("Anwesend:", "Entschuldigt:"): their numbered lines are persons, not items.
const ATTENDANCE=/^(?:Anwesend|Anwesenheit|Anwesende|Abwesend|Entschuldigt|Es\s+fehlt(?:e|en)?|Teilnehmer(?:innen)?|Teilnehmende|Sitzungsteilnehmer|Stimmberechtigt)\p{L}*(?:\s+(?:waren|sind|Mitglieder))?\s*(?::|$)/iu;
const END_ATTENDANCE=/^(?:Tagesordnung|Sitzungsverlauf|Verlauf|Beginn|Eröffnung|Beratung|TOP\s*\d|Punkt\s*\d|Der\s|Die\s|Das\s)/iu;
const PERSON=/^(?:Herr|Frau|Dr\.|Prof\.)\s|^\p{Lu}[\p{Ll}'-]+(?:-\p{Lu}[\p{Ll}'-]+)?,?\s+\p{Lu}[\p{Ll}'.-]+(?:\s*\([^)]{1,30}\))?$/u;
const where=(committee,date,title)=>[committee,ddmmyyyy(date)].filter(Boolean).join(' ')||title||'Sitzung';

/**
 * Meetings in the lines of a page or document, with the items of their public part. title: the link text or document
 * title (date, committee and public session as a fallback). wrapped: the lines are wrapped (PDF), so a title may go on
 * in the next lines. Returns {meetings:[{date, time, committee, kind, items, restricted, unclear, publicEvidence,
 * heading, context}], issues}. context: the head of the meeting (its first lines), for the body it belongs to.
 * Fail-closed: whatever names the non-public part after the first item (a heading the rules do not know, a sentence,
 * a mark N/NÖ in any form, a note on an item) ends the public part; a meeting after a non-public part starts afresh
 * only with a head of its own for another day and another body.
 */
export function parseSessionText(lines,{title='',wrapped=false}={}){
 const all=[],issues=[];title=normalizeLine(title);
 // A heading broken after "Nicht-" ("Nicht-" / "öffentlicher Teil", "<b>Nicht</b><br>öffentlicher Teil") is one line.
 for(const l of (lines||[]).map(normalizeLine).filter(Boolean)){const prev=all.at(-1);if(prev&&/(?<!\p{L})nicht\s*-?$/iu.test(prev)&&/^öffentl/iu.test(l))all[all.length-1]=prev+(prev.endsWith('-')?'':' ')+l;else all.push(l);}
 const kind=documentKind(title,all),items=all.map(itemOf);
 // 1. Meetings: a text of several (Amtsblatt, list of dates) is cut at each header of another meeting. Headers before
 // the first item, and repeated headers of the same meeting (also with or without the place), belong to it.
 const segments=[{start:0,header:null}];
 for(let i=0;i<all.length;i++){
  const h=meetingHeader(all,i);if(!h)continue;
  const seg=segments.at(-1),hasItems=items.slice(seg.start,i).some(Boolean);
  if(!seg.header&&!hasItems){seg.header={...h,line:i};continue;}
  if(seg.header&&seg.header.date===h.date&&sameBody(seg.header.committee,h.committee))continue;
  segments.push({start:i,header:{...h,line:i}});
 }
 const titlePublic=publicSentence(title)&&!NONPUBLIC_WORDS.test(title.replace(PUBLIC_SENTENCE,'')),titleClosed=NONPUBLIC_WORDS.test(title)&&!titlePublic;
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
  // Day, time and body from the head of the meeting (the lines before its first item), else from the title.
  const head=seg.header?.line;
  const day=seg.header?.day??pickDate(all,seg.start,first);
  const date=day?.iso??(segments.length===1?germanDates(title)[0]?.iso:null)??null;
  let time=day?timeOf(all[day.line]):null;
  for(let i=seg.start;!time&&i<first;i++)if(!signature(all,i))time=timeOf(all[i]);
  if(!time&&segments.length===1)time=timeOf(title);
  let committee=seg.header?.committee??null;
  for(const pass of [l=>/Sitzung|Tagung|Einladung|Niederschrift|Protokoll|Bericht/i.test(l),()=>true])for(let i=seg.start;!committee&&i<first;i++)if(pass(all[i]))committee=committeeOf(all[i]);
  committee??=committeeOf(title);
  const headAt=head!==undefined?head:all.slice(seg.start,first).findIndex(l=>/(?:sitzung|tagung)(?!\p{L})/iu.test(l)&&committeeOf(l));
  const at=head!==undefined?head:headAt>=0?seg.start+headAt:-1;
  const heading=at>=0?all[at]:title;
  const context=(at>=0?all.slice(at,Math.min(first,at+3)):[]).concat(title).join(' ');
  // 2. Public part: none → public → nonpublic. Each meeting starts anew; the title counts only for a single meeting.
  let state='none',evidence='',restricted=false,unclear=0,mixed=false,named=false;
  if(segments.length===1&&titleClosed){state='nonpublic';restricted=true;}
  else if(segments.length===1&&titlePublic){state='public';evidence=`Titel „${title}“`;}
  // The items of a meeting are numbered one way: with keyword ("TOP 1") if any, else with mark ("Ö 1"), else plain.
  // A mark N/NÖ alone does not make the style: such an item ends the public part in any form.
  const marked=items.slice(seg.start,end).filter(Boolean),style=marked.some(i=>i.form==='keyword')?'keyword':marked.some(i=>i.form==='prefix'&&i.prefix==='Ö')?'prefix':'plain';
  const taken=[],seen=new Map();let cur=null,seenItem=false,absent=false,present=0;
  const continues=(j)=>{const line=all[j];return !itemOf(line)&&!isPublicHeading(line)&&!isNonPublicHeading(line)&&!closes(line)&&!signed(line)&&!PLACE_DATE.test(line)&&!HINT.test(line)&&!STOP.test(line)&&!STOP_SENTENCE.test(line)&&/[\p{L}\d]/u.test(line)&&!(committeeOf(line)&&SESSION_ON.test(all[j+1]||''));};
  for(let i=seg.start;i<end;){
   const line=all[i],raw=items[i];
   if(isNonPublicHeading(line)){state='nonpublic';restricted=true;cur=null;absent=false;i++;continue;}
   if(isPublicHeading(line)){if(state==='none'){state='public';evidence=`Überschrift „${line}“`;}cur=null;absent=false;i++;continue;}
   if(!raw&&ATTENDANCE.test(line)){absent=true;present=0;i++;continue;}
   if(absent){
    // The list ends at the agenda, at prose, where its numbering starts again, or at an item that names no person.
    const n=Number(line.match(/^(\d{1,2})[.)]?\s/)?.[1]||0);
    if(END_ATTENDANCE.test(line)||n&&present&&n<=present||raw&&!PERSON.test(raw.title)||!n&&line.length>60)absent=false;
    else{if(n)present=n;i++;continue;}
   }
   if(!raw&&kind==='minutes'&&/^Tagesordnung(?!\p{L})/iu.test(line))cur=null;
   // An item marked N/NÖ in whatever form or numbering, or one whose own line names the non-public part, ends the
   // public part; so does any other line naming it once the agenda has begun.
   if(raw&&(raw.prefix==='N'||closes(raw.title))){seenItem=true;state='nonpublic';restricted=true;cur=null;i++;continue;}
   if(!raw&&(seenItem||state==='public')&&state!=='nonpublic'&&closes(line)){
    // A note after the agenda ("Die Punkte 3 und 4 werden in nichtöffentlicher Sitzung beraten") may name items
    // already read: which of them are public is then not known.
    const refs=[...line.matchAll(/(?<![\d.,:])(\d{1,2})(?![\d.,:]\d)/g)].map(m=>Number(m[1]));
    if(!isNonPublicHeading(line)&&/(?<!\p{L})(?:Punkte?|TOP|Tagesordnungspunkte?|Nr\.?)(?!\p{L})/iu.test(line)&&refs.some(n=>taken.some(x=>Number(x.number.split('.')[0])>=n)))named=true;
    state='nonpublic';restricted=true;cur=null;i++;continue;
   }
   let it=raw&&raw.form===style?raw:null;
   if(it&&kind==='minutes'&&cur&&state==='public'){
    // In minutes a numbered list inside a decision is text of that item, unless it repeats an item already read
    // (agenda first, then the report on each item). A lower number not read yet is an item taken out of order.
    const known=seen.get(it.number);
    if(known){if(sameTitle(known.title,it.title||all[i+1]||'')){cur=known;i++;if(!it.title)i++;continue;}it=it.prefix?it:null;}
    else if(it.form==='plain'&&cur.deciding)it=null;
   }
   if(!it){
    if(state==='none'&&!seenItem&&publicSentence(line)){state='public';evidence=`Satz „${line.length>120?line.slice(0,119)+'…':line}“`;}
    if(cur&&kind==='minutes'){cur.block.push(line);if(/^Beschluss/i.test(line))cur.deciding=true;if(/Abstimmung|(?<!\p{L})Ja(?!\p{L}).*Nein|einstimmig|\d\s*:\s*\d|Stimmen/i.test(line))cur.deciding=false;}
    i++;continue;
   }
   seenItem=true;
   if(it.prefix==='Ö'&&state==='none'){state='public';evidence='Kennzeichnung „Ö“ der Tagesordnungspunkte';}
   if(state!=='public'){if(state==='none')unclear++;else restricted=true;cur=null;i++;continue;}
   const itemLine=i;let t=it.title,j=i+1;
   if(!t&&j<end&&continues(j))t=all[j++];
   if(kind==='minutes'){if(/(?:[,:-]|(?<!\p{L})und)$/u.test(t)&&j<end&&continues(j))t=join(t,all[j++]);}
   else if(wrapped)for(let k=0;k<3&&j<end&&continues(j);k++)t=join(t,all[j++]);
   t=t.replace(/\s+/g,' ').replace(/\s*[,;:–]$/,'').trim();
   i=j;
   if(!/\p{L}/u.test(t)||t.length<3||t.length>400){cur=null;continue;}
   if(closes(t)){state='nonpublic';restricted=true;cur=null;continue;}
   if(seen.has(it.number)){
    // A number again just after the name of a body or a day: another meeting whose head was not recognised.
    if(all.slice(Math.max(first+1,itemLine-3),itemLine).some(l=>!itemOf(l)&&(committeeOf(l)&&/^\p{Lu}/u.test(l)||SESSION_WORD.test(l)&&germanDates(l).length)))mixed=true;
    issues.push(`Punkt ${it.number} doppelt (${where(committee,date,title)}); nur der erste übernommen.`);cur=null;continue;
   }
   cur={prefix:it.prefix,number:it.number,title:t,block:[],deciding:false};seen.set(it.number,cur);taken.push(cur);
  }
  const say=n=>`${n} ${n===1?'Punkt':'Punkte'} nicht übernommen.`;
  if(taken.length&&named){
   issues.push(`Nichtöffentliche Punkte erst nach der Tagesordnung benannt (${where(committee,date,title)}): welche Punkte öffentlich sind, ist nicht eindeutig; ${say(taken.length)}`);
   taken.length=0;unclear=unclear||1;
  }
  else if(taken.length&&mixed){
   issues.push(`Punktnummern doppelt nach Angabe eines Gremiums oder Tages (${where(committee,date,title)}): Zuordnung zur Sitzung unklar; ${say(taken.length)}`);
   taken.length=0;unclear=unclear||1;
  }
  // The head names a non-public part ("anschließend nichtöffentliche Sitzung") but the agenda never marks where it
  // starts: its end is not known, nothing is taken (items marked Ö each say it of themselves).
  else if(taken.length&&!restricted&&!evidence.startsWith('Kennzeichnung')&&all.slice(seg.start,first).some(l=>NONPUBLIC_WORDS.test(l.replace(PUBLIC_REPORT,' ')))){
   issues.push(`Ende des öffentlichen Teils nicht erkennbar (${where(committee,date,title)}): die Einladung nennt einen nichtöffentlichen Teil, die Tagesordnung grenzt ihn nicht ab; ${say(taken.length)}`);
   taken.length=0;unclear=unclear||1;
  }
  // A line that reads as a heading of the non-public part while this meeting was never found restricted.
  else if(taken.length&&!restricted&&all.slice(seg.start,end).some(closedLine)){
   issues.push(`Ende des öffentlichen Teils nicht erkennbar (${where(committee,date,title)}): eine Überschrift des nichtöffentlichen Teils ist nicht eindeutig lesbar; ${say(taken.length)}`);
   taken.length=0;unclear=unclear||1;
  }
  else if(unclear)issues.push(`Öffentlicher Teil nicht eindeutig erkennbar (${where(committee,date,title)}); ${say(unclear)}`);
  if(state==='nonpublic')carried={date,committee};
  meetings.push({date,time,committee,kind,items:taken.map(x=>{const o=kind==='minutes'?outcomeOf(x.block.join('\n')):{status:null,result:'',votes:null};return {prefix:x.prefix,number:x.number,title:x.title,status:o.status,result:o.result,votes:o.votes};}),restricted,unclear:unclear>0,publicEvidence:evidence,heading,context});
 });
 return {meetings,issues};
}
