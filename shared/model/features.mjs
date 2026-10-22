// Eingaben und Merkmale des Modells (requirements/modell-konzept.md, Begriffsbuch requirements/begriffsbuch-kern.md). Eine Quelle für
// Training (scripts/model/train.mjs) und Betrieb (scripts/model/apply.mjs): was hier anders gerechnet würde, wäre ein anderes Modell.
// Reine Funktionen, ohne Datenbank und ohne Encoder.

/** Fassung der Eingaben: ändert sich Auszug, Text oder Merkmal, muss neu trainiert und neu eingebettet werden. */
export const INPUT_VERSION='input-v1';
/** Fassung des Themas aus dem Modell in payload.theme (View topic_effective_labels, storedClassification); nur bei geändertem Katalog erhöhen */
export const MODEL_THEME_VERSION='model-v1';

// Kataloge der neun Fragen (Begriffsbuch Abschnitt 0); Reihenfolge ist Teil des Modells
export const KIND=['subject','procedure','personal'];
export const THEMES=['bauen','finanzen','mobilitaet','bildung','umwelt','soziales','kultur','sicherheit','verwaltung','wirtschaft'];
export const STATUS=['announced','consulting','recommended','approved','rejected','postponed','info','unknown'];
export const PROCESS=['information','political','permit','planning','build','money','contract','other'];
export const STEPS=['start','frueh','entwurf','abwaegung','beschluss','umsetzung','aufhebung','sonst'];
export const SERVICE=['construction','planning','supply','it','service','none'];
export const APPLICANTS=['cdu','csu','spd','gruene','fdp','afd','linke','bsw','fw','local','other','member','body','residents'];
export const DOCTYPES=['paper','bundle','attachment','result','minutes','session','other'];

/** Platzhalter der Importe, die kein Ergebnis sind */
export const PLACEHOLDER=/^Öffentlich(?:er Tagesordnungspunkt| auf der Tagesordnung);|^In der Tagesordnung geführt|^Sitzung steht noch aus/;
const FIRST_PAGE=1500,DECISION=700;
export const flat=s=>String(s||'').replace(/\s+/g,' ').trim();
/** Beschlussvorschlag: ab dem ersten „Beschlussvorschlag“, „beschließt“ oder „Beschluss:“ im ganzen Text, höchstens 600 Zeichen danach */
export const decisionOf=text=>(flat(text).match(/(Beschlussvorschlag|beschließt|Beschluss:)[^]{0,600}/i)||[''])[0];

/**
 * Eingabe eines Berichts, wie sie die Stichprobe zum Lernen hatte (scripts/model-study/sample-big.mjs).
 * @param {{title?:string,committee?:string,eventDate?:string,events?:any[],documents?:any[]}} payload
 * @param {(url:string)=>({bytes?:number}|null)} fileOf   Eintrag der PDF-Ablage (Größe), oder null
 * @param {(url:string)=>(string[]|null)} pagesOf         Seiten der Textfassung, oder null
 */
export function inputOf(payload,fileOf=()=>null,pagesOf=()=>null){
 const docs=Array.isArray(payload?.documents)?payload.documents:[],ev=Array.isArray(payload?.events)?payload.events:[];
 const pdfs=docs.filter(d=>d?.kind==='application/pdf').map((d,i)=>{const pages=pagesOf(d.url),f=fileOf(d.url);
  return {i,name:flat(d.title),url:d.url,bytes:f?.bytes??null,first:pages?flat(pages[0]).slice(0,FIRST_PAGE):null,decision:pages?decisionOf(pages.join('\n')).slice(0,DECISION)||null:null};});
 return {title:flat(payload?.title),committee:flat(payload?.committee),eventDate:payload?.eventDate||null,
  events:ev.map(e=>({date:e?.date||null,committee:flat(e?.committee),result:flat(e?.result||e?.decision?.text||e?.description)||null})),pdfs};
}

const realResults=input=>input.events.filter(e=>e.result&&!PLACEHOLDER.test(e.result));
/** Texte für den Encoder: Schlüssel t (Titel, Gremium), r (echte Ergebnisse), p.<i> (je PDF Name, erste Seite, Beschlussvorschlag) */
export function encoderTexts(input){
 const out=[['t',`${input.title} | Gremium: ${input.committee||''}`.slice(0,500)]];
 const res=realResults(input).map(e=>e.result);
 if(res.length)out.push(['r',res.join(' | ').slice(0,500)]);
 for(const p of input.pdfs)out.push([`p.${p.i}`,`${p.name} | ${(p.first||'').slice(0,900)} | ${(p.decision||'').slice(0,300)}`]);
 return out;
}

/** Wortteile: ganze Wörter und Buchstabenfolgen von 3 bis 5 Zeichen, mit Vorsilbe der Quelle */
export function parts(s,p){
 const out=[];
 for(const w of String(s||'').toLowerCase().match(/[\p{L}\d]+/gu)||[]){
  if(w.length<2)continue;out.push(p+'w:'+w);const b='<'+w+'>';
  for(let n=3;n<=5;n++)for(let i=0;i+n<=b.length;i++)out.push(p+b.slice(i,i+n));
 }
 return out;
}
/** Merkmale eines PDFs für Dokumentart, Haupt- und Ergebnisdokument */
export const pdfSparse=(input,p)=>[...parts(p.name,'n'),'pos:'+Math.min(p.i,5),'cnt:'+Math.min(input.pdfs.length,6),'txt:'+(p.first?1:0),
 'size:'+(p.bytes?Math.min(9,Math.round(Math.log2(p.bytes/1e4+1))):'x')];
/** Wortteile des Berichts nach der Wahl von Haupt- (main) und Ergebnisdokument (Index oder null) */
export function reportSparse(input,main){
 const dec=input.pdfs.find(p=>p.i===main)?.decision;
 return [...parts(input.title,''),...parts(input.committee,'g'),...realResults(input).flatMap(e=>parts(e.result,'e')),...parts(dec,'d')];
}
/** Sieben Kennzeichen: Sitzung in der Zukunft, echtes Ergebnis, letzte Sitzung in der Zukunft, Haupt-, Ergebnisdokument, PDFs,
 *  Beschlussvorschlag im Hauptdokument. today: Stichtag JJJJ-MM-TT */
export function flags(input,main,res,today){
 const future=input.events.some(e=>e.date&&e.date>today)||(input.eventDate&&input.eventDate>today),last=input.events.at(-1);
 return Float32Array.from([future?1:0,realResults(input).length?1:0,last&&last.date&&last.date>today?1:0,main!=null?1:0,res!=null?1:0,
  input.pdfs.length?1:0,(input.pdfs.find(p=>p.i===main)?.decision)?1:0]);
}
export const cat=(...a)=>{const n=a.reduce((s,x)=>s+x.length,0),o=new Float32Array(n);let p=0;for(const x of a){o.set(x,p);p+=x.length;}return o;};
