// A source refresh must never masquerade as an analysis or erase its result.
import {AUSZUG_LABEL} from './ris-auszug.mjs';
export const RECORD_VERSION='article-record-v1';
export function analysisSignature(t){return JSON.stringify({title:t.officialTitle||t.title||'',status:t.status,events:(t.events||[]).map(e=>({date:e.date,committee:e.committee,status:e.status,result:e.result||''})),documents:(t.documents||[]).map(d=>d.url).sort()});}
// Grundlage des regelbasierten Auszugs: Titel und Dokumente. Ändern sich beide nicht, bleibt der Auszug gültig.
export const excerptBasis=t=>JSON.stringify([t.officialTitle||t.title||'',(t.documents||[]).filter(d=>d.kind==='application/pdf').map(d=>d.url).sort()]);
export function preserveArticleContent(old,incoming,source=incoming){
 const next={...incoming};
 for(const key of ['contentAnalysis','weightedKeywords','labelAssessments','metadata'])if(old[key]&&!next[key])next[key]=old[key];
 const priorAI=old.contentAnalysis||/^KI-Zusammenfassung/.test(old.generatedBy||'');
 const incomingAI=incoming.contentAnalysis&&incoming.contentAnalysis.id!==old.contentAnalysis?.id||/^KI-Zusammenfassung/.test(incoming.generatedBy||'')&&incoming.summaryGeneratedAt&&incoming.summaryGeneratedAt!==old.summaryGeneratedAt;
 if(priorAI&&!incomingAI){
  for(const key of ['title','shortSummary','longSummary','generatedBy','summaryGeneratedAt','summaryMethod','summaryModel','summaryEvidence','quality'])if(old[key]!==undefined)next[key]=old[key];
  if(old.contentAnalysis){const stale=old.contentAnalysis.sourceSignature!==analysisSignature(next);next.contentAnalysis={...old.contentAnalysis,...(stale?{status:'stale',reason:'Die Quelldaten haben sich seit dieser Auswertung geändert. Eine erneute Analyse muss manuell gestartet werden.'}:{})};}
 }
 // Regelbasierter Auszug: bleibt über Importe erhalten, solange Titel und Dokumente gleich sind; sonst wird er neu gebildet.
 if(old.ruleExcerpt&&!next.ruleExcerpt&&!priorAI&&!incomingAI&&old.ruleExcerpt.basis===excerptBasis(next)){
  next.ruleExcerpt=old.ruleExcerpt;
  if(old.ruleExcerpt.status==='completed'&&old.generatedBy===AUSZUG_LABEL)for(const key of ['shortSummary','longSummary','generatedBy','summaryMethod'])if(old[key]!==undefined)next[key]=old[key];
 }
 // Erfolglose KI-Versuche gelten nur für unveränderte Quelldaten; nach einer Änderung wird wieder angefragt.
 if(old.aiAttempts&&!next.aiAttempts){const signature=analysisSignature(next),kept=Object.fromEntries(Object.entries(old.aiAttempts).filter(([,a])=>a?.sourceSignature===signature));if(Object.keys(kept).length)next.aiAttempts=kept;}
 if(old.officialTitle!==next.officialTitle&&old.weightedKeywords&&next.weightedKeywords===old.weightedKeywords)next.weightedKeywords={...old.weightedKeywords,status:'stale'};
 if((next.contentAnalysis?.status==='stale'||next.labelAssessments?.ai?.sourceSignature&&next.labelAssessments.ai.sourceSignature!==analysisSignature(next))&&next.labelAssessments?.ai)next.labelAssessments={...next.labelAssessments,ai:{...next.labelAssessments.ai,status:'stale'}};
 if(next.weightedKeywords?.inputBasis==='content'&&next.weightedKeywords.sourceSignature&&next.weightedKeywords.sourceSignature!==analysisSignature(next))next.weightedKeywords={...next.weightedKeywords,status:'stale'};
 // Retain already stored extracts. New processing does not persist full documents.
 if(old.hasDocumentText&&old.sourceText&&!source.hasDocumentText&&!source.documentText){next.sourceText=old.sourceText;next.documentText=old.documentText||'';next.hasDocumentText=true;next.documentSource=old.documentSource;}
 else if(!next.documentText&&!next.hasDocumentText)next.hasDocumentText=false;
 return next;
}
// Zeitpunkte eines Abrufs oder einer Prüfung (attendance.fetchedAt jedes Termins, sourceData.fetchedAt,
// quality.checkedAt) ändern sich bei jedem Import. Sie sind keine Änderung am Vorgang: Verglichen damit entstand bei
// jedem erneut gelesenen Termin eine Version und ein vollständiger Neuschrieb (die Hälfte aller Versionen bis 05.10.2026).
const FETCH_TIMES=new Set(['fetchedAt','lastFetchedAt','checkedAt']);
/** JSON eines Feldes ohne Abruf- und Prüfzeitpunkte, für den Vergleich „hat sich etwas geändert?“. */
export const stableJson=value=>JSON.stringify(value,(key,v)=>FETCH_TIMES.has(key)?undefined:v);
/** Hat sich an den Metadaten mehr geändert als der reine Abrufzeitpunkt? Nur dann lohnt ein Schreibvorgang. */
export function metadataChanged(prior,next){
 const strip=m=>{if(!m)return null;const {lastFetchedAt,...rest}=m;return rest;};
 return JSON.stringify(strip(prior))!==JSON.stringify(strip(next));
}
export function importedMetadata(t,prior,at){return {version:RECORD_VERSION,firstImportedAt:prior?.metadata?.firstImportedAt||(prior?null:at),sourceModifiedAt:null,lastProcessedAt:null,...prior?.metadata,...t.metadata,lastFetchedAt:at||t.metadata?.lastFetchedAt||null};}
export function validKeywords(value){return !!value&&Array.isArray(value.items)&&value.items.length>0&&value.items.length<=10&&new Set(value.items.map(k=>k.term)).size===value.items.length&&value.items.every(k=>typeof k.term==='string'&&k.term.trim()&&Number.isInteger(k.weight)&&k.weight>0)&&value.items.reduce((s,k)=>s+k.weight,0)===100;}
