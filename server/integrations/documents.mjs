import {extractText,getDocumentProxy} from 'unpdf';
import {SOURCES} from './regions.mjs';
import {NRW_SOURCES} from './source-catalog.mjs';
import {allowed} from './sessionnet.mjs';
import {checkedUrl,clean} from './oparl.mjs';
import {buildRuleSummary} from './rule-summary.mjs';
import {fetchNoRedirect,SOURCE_USER_AGENT} from './no-redirect.mjs';
// The document proxy of the current PDF library has no destroy(); its loading task releases the document.
const release=pdf=>pdf.destroy?pdf.destroy():pdf.loadingTask?.destroy?.();
// Dokumente dürfen nur von der Quelle gelesen werden, zu der die Adresse gehört (Herkunft und Pfad); neben den fest eingerichteten
// zählen alle Quellen des Katalogs, den auch der Import nutzt. Mehrere Gebiete teilen sich oft einen Host (SessionNet): der Pfad entscheidet.
export function sourceFor(url){
  const u=new URL(url),inside=s=>{if(!s.base)return false;try{const b=new URL(s.base);return b.origin===u.origin&&u.pathname.toLowerCase().startsWith(b.pathname.toLowerCase());}catch{return false;}};
  return SOURCES.find(inside)||NRW_SOURCES.find(inside)||SOURCES.find(s=>new URL(s.base).origin===u.origin)||{base:'https://invalid.local/'};
}
export async function readDocument(url){const r=await fetchNoRedirect(new URL(url).hostname==='oparl.stadt-muenster.de'?checkedUrl(url):allowed(url,sourceFor(url)),{signal:AbortSignal.timeout(30000),headers:{'User-Agent':SOURCE_USER_AGENT}});if(!r.ok)throw Error('Dokument HTTP '+r.status);if(Number(r.headers.get('Content-Length'))>12000000)throw Error('Dokument zu groß');const bytes=new Uint8Array(await r.arrayBuffer());if(bytes.byteLength>12000000)throw Error('Dokument zu groß');const pdf=await getDocumentProxy(bytes,{isEvalSupported:false});try{if(pdf.numPages>150)throw Error('Dokument zu umfangreich');const {text}=await extractText(pdf,{mergePages:true});return text.slice(0,65000)}finally{await release(pdf)}}
export function extractPassages(text){let s=clean(text);const start=s.search(/(?:Beschlussvorschlag\s*:?|Beschlussvorschläge\s*:?|Bericht\s*:|Sachverhalt\s*:)/i);if(start>=0)s=s.slice(start);return (s.match(/[^.!?]+[.!?]+(?:\s|$)/g)||[s]).map(clean).filter(p=>p.length>55&&p.length<700&&!/^Seite\s+\d/i.test(p)).slice(0,7)}
export async function enrichDocument(topic,reader=readDocument){const d=topic.documents.find(d=>/vorlage/i.test(d.title)&&d.kind==='application/pdf')||topic.documents.find(d=>/beschlussvorschlag|bericht/i.test(d.title)&&d.kind==='application/pdf')||topic.documents.find(d=>d.kind==='application/pdf');if(!d)return topic;const text=await reader(d.url);if(text.trim().length<100)return {...topic,documentIssue:'Das Dokument enthält keinen ausreichend lesbaren Text.'};const passages=extractPassages(text);return {...topic,...(()=>{const ruleSummary=buildRuleSummary(text,topic.officialTitle||topic.title,undefined,{url:d.url,title:d.title});return {ruleSummary:ruleSummary||undefined}})(),hasDocumentText:true,sourceText:topic.sourceText+'\n'+text,documentSource:d.url,longSummary:[...topic.longSummary,...(passages.length?['Auszug aus der Originalunterlage (der dortige Beschlussvorschlag ist noch kein Nachweis einer Entscheidung):',...passages]:[])],generatedBy:'Automatischer Quellenüberblick mit Originalauszug'}}
