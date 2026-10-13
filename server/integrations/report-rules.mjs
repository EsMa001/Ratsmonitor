// Alle regelbasierten Ergebnisse eines Berichts in einem Schritt (Plan: requirements/regel-schritt-plan.md). Reine Funktion:
// liest nur Quellen (Titel, Dokumentliste, Text des Hauptdokuments), nie das Ergebnis einer anderen Regel, in fester Reihenfolge:
//   1. Hauptdokument und Sitzungsunterlage (shared/document-type.mjs)
//   2. Art des Punkts (shared/item-kind.mjs); nur Sachpunkte bekommen Thema und Sachfakten
//   3. Thema und Unterthemen aus Titel, Betreff und Beschlussvorschlag (shared/themes.mjs), nicht aus der Zusammenfassung
//   4. Regel-Zusammenfassung kurz und lang (rule-summary.mjs), wie im Import
//   5. Fakten für plenara.X (shared/topic-facts.mjs)
// Der Schlüssel (key) fasst alle Eingaben zusammen; gleicher Schlüssel heißt: nichts neu zu rechnen.
import {createHash} from 'node:crypto';
import {primaryPdf,sessionDocument,DOC_TYPE_VERSION} from '../../shared/document-type.mjs';
import {itemKind,ITEM_KIND_VERSION} from '../../shared/item-kind.mjs';
import {themeOf,subjectOf,THEMES_VERSION} from '../../shared/themes.mjs';
import {factsOf,FACTS_VERSION} from '../../shared/topic-facts.mjs';
import {buildRuleSummary,RULE_SUMMARY_VERSION} from './rule-summary.mjs';
import {mergePages} from './documents.mjs';

export const READ_VERSION=`read-v1:doc${DOC_TYPE_VERSION}:${ITEM_KIND_VERSION}:${THEMES_VERSION}:sum${RULE_SUMMARY_VERSION}:${FACTS_VERSION}`;
// Wie readDocument im Import: sehr lange Dokumente werden nicht zusammengefasst, der Text ist für die Zusammenfassung gekürzt
const MAX_PAGES=150,MAX_SUMMARY_CHARS=65000,MIN_CHARS=100;
// Fakten, die auch Punkte ohne Sachthema tragen (Fraktion im Titel eines Antrags)
const ALWAYS_FACTS=new Set(['faction','faction_advice']);

/** Hauptdokument eines Berichts, wie es readReport wählt. Für Aufrufer, die vorher den Text laden müssen.
 *  @param {any[]} documents @param {{uses?:(url:string)=>number,hasText?:((url:string)=>boolean)|null}} [o] */
export function mainDocument(documents,{uses=()=>0,hasText=null}={}){
 const doc=primaryPdf(documents,{uses,hasText});
 return doc?{doc,session:sessionDocument(doc,uses(doc.url))}:{doc:null,session:false};
}

/** Schlüssel aller Eingaben: Regelfassung, Titel, Hauptdokument, Sitzungsunterlage, Textstand. */
export function readKey({title,mainUrl,session,textSha}){
 return createHash('sha256').update([READ_VERSION,title||'',mainUrl||'',session?1:0,textSha||''].join('\u0001')).digest('hex').slice(0,24);
}

/**
 * @param {{title?:string,officialTitle?:string,documents?:any[]}} report
 * @param {{uses?:(url:string)=>number,hasText?:((url:string)=>boolean)|null,pages?:string[]|null,textSha?:string,at?:string}} [o]
 *   pages: Seiten des Hauptdokuments (wie in der PDF-Ablage), nur wenn mainDocument(...) sie geliefert hat
 */
export function readReport(report,{uses=()=>0,hasText=null,pages=null,textSha='',at=new Date().toISOString()}={}){
 const title=report.officialTitle||report.title||'';
 // 1. Dokumente
 const {doc,session}=mainDocument(report.documents,{uses,hasText});
 const text=doc&&!session&&pages?mergePages(pages):'';
 // 2. Art des Punkts
 const kind=itemKind(title);
 // 3. Thema
 const theme=kind==='subject'?themeOf({title,subject:text?subjectOf(text):''}):{theme:'offen',subs:[],source:'formal'};
 // 4. Zusammenfassung
 let ruleSummary=null,summaryIssue=null;
 if(!doc)summaryIssue='no-document';
 else if(session)summaryIssue='session-document';
 else if(!pages)summaryIssue='no-text';
 else if(pages.length>MAX_PAGES)summaryIssue='too-long';
 else if(text.trim().length<MIN_CHARS)summaryIssue='unreadable';
 else ruleSummary=buildRuleSummary(text.slice(0,MAX_SUMMARY_CHARS),title,at,{url:doc.url,title:doc.title})||null;
 if(!ruleSummary&&!summaryIssue)summaryIssue='no-summary';
 // 5. Fakten
 const facts=factsOf(title,text).filter(f=>kind==='subject'||ALWAYS_FACTS.has(f.kind));
 return {
  version:READ_VERSION,key:readKey({title,mainUrl:doc?.url,session,textSha}),
  mainUrl:doc?.url||null,session,itemKind:kind,
  theme:{id:theme.theme,subs:theme.subs,source:theme.source,version:THEMES_VERSION},
  ruleSummary,summaryIssue,facts,
 };
}
