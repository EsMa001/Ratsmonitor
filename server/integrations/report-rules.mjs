// Alle regelbasierten Ergebnisse eines Berichts in einem Schritt (Plan: requirements/regel-schritt-plan.md). Reine Funktion:
// liest nur Quellen (Titel, Dokumentliste, Text des Hauptdokuments), nie das Ergebnis einer anderen Regel, in fester Reihenfolge:
//   1. Hauptdokument und Sitzungsunterlage (shared/document-type.mjs)
//   2. Art des Punkts (shared/item-kind.mjs); nur Sachpunkte bekommen Thema und Sachfakten
//   3. Thema und Unterthemen aus Titel, Betreff und Beschlussvorschlag (shared/themes.mjs), nicht aus der Zusammenfassung;
//      „Was geschieht“ aus dem Titel (shared/stage.mjs)
//   4. Regel-Zusammenfassung kurz und lang (rule-summary.mjs), wie im Import
//   5. Fakten für plenara.X (shared/topic-facts.mjs), aus dem Hauptdokument; einzelne Fakten auch aus passenden Anlagen
//      (ATTACH_FACTS: Hebesatz aus Haushaltssatzung und -plan, Hundesteuer und Gebühren aus der Satzung, Fläche und Wohnungen aus der Begründung), wenn das Hauptdokument sie nicht nennt
// Der Schlüssel (key) fasst alle Eingaben zusammen; gleicher Schlüssel heißt: nichts neu zu rechnen.
import {primaryPdf,sessionDocument,DOC_TYPE_VERSION} from '../../shared/document-type.mjs';
import {itemKind,ITEM_KIND_VERSION} from '../../shared/item-kind.mjs';
import {themeOf,subjectOf,THEMES_VERSION} from '../../shared/themes.mjs';
import {stageOf,STAGE_VERSION} from '../../shared/stage.mjs';
import {factsOf,FACTS_VERSION} from '../../shared/topic-facts.mjs';
import {buildRuleSummary,RULE_SUMMARY_VERSION} from './rule-summary.mjs';
import {mergePages} from './documents.mjs';

export const READ_VERSION=`read-v4:doc${DOC_TYPE_VERSION}:${ITEM_KIND_VERSION}:${THEMES_VERSION}:${STAGE_VERSION}:sum${RULE_SUMMARY_VERSION}:${FACTS_VERSION}`;
// Wie readDocument im Import: sehr lange Dokumente werden nicht zusammengefasst, der Text ist für die Zusammenfassung gekürzt
const MAX_PAGES=150,MAX_SUMMARY_CHARS=65000,MIN_CHARS=100;
// Fakten, die auch Punkte ohne Sachthema tragen (Fraktion im Titel eines Antrags)
const ALWAYS_FACTS=new Set(['faction','faction_advice']);
// Fakten aus Anlagen: Titel der Anlage → Arten, die sie liefern darf. Gemessen 14.10.2026 (Server, 5.000 Berichte): Hebesatz aus
// Haushaltssatzung und -plan etwa 90 % richtig; Jahresergebnis (etwa 70 %) und Gebühren aus Kalkulationen (etwa 60 %) nicht.
const ATTACH_FACTS=[
 [/haushaltssatzung|haushaltsplan|haushalt\s*20\d\d|hebesatz|steuersätze|realsteuer/i,new Set(['hebesatz','dog_tax'])],
 [/hundesteuer/i,new Set(['dog_tax'])],
 // Begründung zum Bebauungsplan: Fläche des Plangebiets und Wohneinheiten (Flächenbilanz)
 [/Begründung/i,new Set(['plan_area','housing','wind_count','house_type'])],
 // Gebührensatzungen für Abwasser und Wasser, nicht Kalkulationen (dort Kostentabellen und Werte anderer Einrichtungen)
 [/^(?!.*(?:Kalkulation|Berechnung|Nachkalk|Synopse|Gegenüberstellung)).*(?:(?:Abwasser|Entwässerung|Wasser\w*)\S*\s*(?:gebühren)?satzung|Gebührensatzung)/i,new Set(['fee_rate'])],
];
const MAX_ATTACH=3;
/** Anlagen, aus denen readReport Fakten liest (nicht das Hauptdokument, keine Sitzungsunterlagen), höchstens MAX_ATTACH. */
export function factAttachments(documents,mainUrl,{uses=()=>0,hasText=null}={}){
 const out=[];
 for(const d of Array.isArray(documents)?documents:[]){
  if(!d?.url||d.url===mainUrl||uses(d.url)>=5||(hasText&&!hasText(d.url)))continue;
  const kinds=new Set();for(const [re,k] of ATTACH_FACTS)if(re.test(String(d.title||'')))for(const x of k)kinds.add(x);
  if(kinds.size&&!out.some(o=>o.url===d.url))out.push({url:d.url,title:d.title||'',kinds});
  if(out.length>=MAX_ATTACH)break;
 }
 return out;
}

/** Hauptdokument eines Berichts, wie es readReport wählt. Für Aufrufer, die vorher den Text laden müssen.
 *  @param {any[]} documents @param {{uses?:(url:string)=>number,hasText?:((url:string)=>boolean)|null}} [o] */
export function mainDocument(documents,{uses=()=>0,hasText=null}={}){
 const doc=primaryPdf(documents,{uses,hasText});
 return doc?{doc,session:sessionDocument(doc,uses(doc.url))}:{doc:null,session:false};
}

// Prüfsumme ohne node:crypto (das Modul läuft auch im Import-Bundle): zwei 53-Bit-Hashes (cyrb53) mit verschiedenen Startwerten.
// Dient nur dem Erkennen geänderter Eingaben, nicht der Sicherheit.
function cyrb53(str,seed){
 let h1=0xdeadbeef^seed,h2=0x41c6ce57^seed;
 for(let i=0;i<str.length;i++){const ch=str.charCodeAt(i);h1=Math.imul(h1^ch,2654435761);h2=Math.imul(h2^ch,1597334677);}
 h1=Math.imul(h1^(h1>>>16),2246822507)^Math.imul(h2^(h2>>>13),3266489909);
 h2=Math.imul(h2^(h2>>>16),2246822507)^Math.imul(h1^(h1>>>13),3266489909);
 return (4294967296*(2097151&h2)+(h1>>>0)).toString(16).padStart(14,'0');
}
/** Schlüssel aller Eingaben: Regelfassung, Titel, Hauptdokument, Sitzungsunterlage, Textstand. */
export function readKey({title,mainUrl,session,textSha,attSha=''}){
 const s=[READ_VERSION,title||'',mainUrl||'',session?1:0,textSha||'',attSha||''].join('\u0001');
 return cyrb53(s,1)+cyrb53(s,2);
}

/**
 * @param {{title?:string,officialTitle?:string,documents?:any[]}} report
 * @param {{uses?:(url:string)=>number,hasText?:((url:string)=>boolean)|null,pages?:string[]|null,textSha?:string,at?:string}} [o]
 *   pages: Seiten des Hauptdokuments (wie in der PDF-Ablage), nur wenn mainDocument(...) sie geliefert hat
 */
export function readReport(report,{uses=()=>0,hasText=null,pages=null,textSha='',attachments=[],at=new Date().toISOString()}={}){
 const title=report.officialTitle||report.title||'';
 // 1. Dokumente
 const {doc,session}=mainDocument(report.documents,{uses,hasText});
 const text=doc&&!session&&pages?mergePages(pages):'';
 // 2. Art des Punkts
 const kind=itemKind(title);
 // 3. Thema
 const theme=kind==='subject'?themeOf({title,subject:text?subjectOf(text):''}):{theme:'offen',subs:[],source:'formal'};
 // Was geschieht: nur bei Sachpunkten
 const stage=kind==='subject'?stageOf({title}):null;
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
 if(kind==='subject'){
  const have=new Set(facts.map(f=>f.kind));
  for(const a of attachments||[]){
   if(!a?.pages||![...a.kinds].some(k=>!have.has(k)))continue;
   const got=factsOf(title,mergePages(a.pages)).filter(f=>a.kinds.has(f.kind)&&!have.has(f.kind));
   for(const f of got)facts.push(f);for(const f of got)have.add(f.kind);
  }
 }
 const attSha=(attachments||[]).map(a=>a.textSha||'').join(',');
 return {
  version:READ_VERSION,key:readKey({title,mainUrl:doc?.url,session,textSha,attSha}),
  mainUrl:doc?.url||null,session,itemKind:kind,stage,
  theme:{id:theme.theme,subs:theme.subs,source:theme.source,version:THEMES_VERSION,evidence:title},
  ruleSummary,summaryIssue,facts,
 };
}
