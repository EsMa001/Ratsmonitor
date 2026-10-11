import {extractText,getDocumentProxy} from 'unpdf';
import {SOURCES} from './regions.mjs';
import {NRW_SOURCES} from './source-catalog.mjs';
import {allowed} from './sessionnet.mjs';
import {checkedUrl,clean} from './oparl.mjs';
import {buildRuleSummary} from './rule-summary.mjs';
import {fetchNoRedirect,SOURCE_USER_AGENT} from './no-redirect.mjs';
import {bodyBytes} from './body-bytes.mjs';
import {primaryPdf,sessionDocument} from '../../shared/document-type.mjs';
// The document proxy of the current PDF library has no destroy(); its loading task releases the document.
const release=pdf=>pdf.destroy?pdf.destroy():pdf.loadingTask?.destroy?.();
// Dokumente dürfen nur von der Quelle gelesen werden, zu der die Adresse gehört (Herkunft und Pfad); neben den fest eingerichteten
// zählen alle Quellen des Katalogs, den auch der Import nutzt. Mehrere Gebiete teilen sich oft einen Host (SessionNet): der Pfad entscheidet.
export function sourceFor(url){
  const u=new URL(url),inside=s=>{if(!s.base)return false;try{const b=new URL(s.base);return b.origin===u.origin&&u.pathname.toLowerCase().startsWith(b.pathname.toLowerCase());}catch{return false;}};
  return SOURCES.find(inside)||NRW_SOURCES.find(inside)||SOURCES.find(s=>new URL(s.base).origin===u.origin)||{base:'https://invalid.local/'};
}
// Lokale PDF-Ablage (server/node/pdf-store.mjs): nur im Node-Betrieb gesetzt (RM_PDF_STORE); im Worker bleibt sie leer.
let store=null;
export function useDocumentStore(s){store=s;}
/** Lädt ein Dokument von seiner Quelle (gleiche Prüfungen wie der Import, höchstens 12 MB). */
export async function fetchDocumentBytes(url){const r=await fetchNoRedirect(new URL(url).hostname==='oparl.stadt-muenster.de'?checkedUrl(url):allowed(url,sourceFor(url)),{signal:AbortSignal.timeout(30000),headers:{'User-Agent':SOURCE_USER_AGENT}});if(!r.ok){await r.body?.cancel();throw Object.assign(Error('Dokument HTTP '+r.status),{http:r.status});}return bodyBytes(r,12000000,{message:'Dokument zu groß'});}
// Seiten zu einem Text wie unpdf extractText(…,{mergePages:true}), damit eine abgelegte Textfassung dasselbe ergibt wie das PDF.
export const mergePages=pages=>pages.join('\n').replace(/[^\S\n]+/g,' ').replace(/ ?\n ?/g,'\n').replace(/\n{3,}/g,'\n\n');
export async function readDocument(url){const stored=store?.getText?.(url);if(stored){if(stored.pages.length>150)throw Error('Dokument zu umfangreich');return mergePages(stored.pages).slice(0,65000);}let bytes=store?.get(url);if(!bytes){bytes=await fetchDocumentBytes(url);try{store?.put(url,bytes);}catch{/* Ablage ist Hilfe, kein Muss */}}const pdf=await getDocumentProxy(bytes,{isEvalSupported:false,verbosity:0});try{if(pdf.numPages>150)throw Error('Dokument zu umfangreich');const {text}=await extractText(pdf,{mergePages:true});return text.slice(0,65000)}finally{await release(pdf)}}
export function extractPassages(text){let s=clean(text);const start=s.search(/(?:Beschlussvorschlag\s*:?|Beschlussvorschläge\s*:?|Bericht\s*:|Sachverhalt\s*:)/i);if(start>=0)s=s.slice(start);const found=s.split(/(?<=[.!?])\s+/).filter(p=>/[.!?]$/.test(p));return (found.length?found:[s]).map(clean).filter(p=>p.length>55&&p.length<700&&!/^Seite\s+\d/i.test(p)).slice(0,7)}
// uses(url): an wie vielen Berichten das Dokument hängt (für Unterlagen der ganzen Sitzung, sessionDocument); ohne Angabe nur der Titel.
/** @param {any} topic @param {(url:string)=>Promise<string>} [reader] @param {{uses?:(url:string)=>number}} [options] */
export async function enrichDocument(topic,reader=readDocument,{uses=()=>0}={}){const d=primaryPdf(topic.documents);if(!d)return topic;if(sessionDocument(d,uses(d.url)))return {...topic,documentIssue:'Das Dokument gehört zur ganzen Sitzung (Niederschrift, Einladung oder Sammelunterlage), nicht zu diesem Punkt.'};const text=await reader(d.url);if(text.trim().length<100)return {...topic,documentIssue:'Das Dokument enthält keinen ausreichend lesbaren Text.'};const passages=extractPassages(text);return {...topic,readText:text,...(()=>{const ruleSummary=buildRuleSummary(text,topic.officialTitle||topic.title,undefined,{url:d.url,title:d.title});return {ruleSummary:ruleSummary||undefined}})(),hasDocumentText:true,sourceText:topic.sourceText+'\n'+text,documentSource:d.url,longSummary:[...topic.longSummary,...(passages.length?['Auszug aus der Originalunterlage (der dortige Beschlussvorschlag ist noch kein Nachweis einer Entscheidung):',...passages]:[])],generatedBy:'Automatischer Quellenüberblick mit Originalauszug'}}
