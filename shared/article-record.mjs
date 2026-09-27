// A source refresh must never masquerade as an analysis or erase its result.
export const RECORD_VERSION='article-record-v1';
export function analysisSignature(t){return JSON.stringify({title:t.officialTitle||t.title||'',status:t.status,events:(t.events||[]).map(e=>({date:e.date,committee:e.committee,status:e.status,result:e.result||''})),documents:(t.documents||[]).map(d=>d.url).sort()});}
export function preserveArticleContent(old,incoming,source=incoming){
 const next={...incoming};
 for(const key of ['contentAnalysis','weightedKeywords','labelAssessments','metadata'])if(old[key]&&!next[key])next[key]=old[key];
 const priorAI=old.contentAnalysis||/^KI-Zusammenfassung/.test(old.generatedBy||'');
 const incomingAI=incoming.contentAnalysis&&incoming.contentAnalysis.id!==old.contentAnalysis?.id||/^KI-Zusammenfassung/.test(incoming.generatedBy||'')&&incoming.summaryGeneratedAt&&incoming.summaryGeneratedAt!==old.summaryGeneratedAt;
 if(priorAI&&!incomingAI){
  for(const key of ['title','shortSummary','longSummary','generatedBy','summaryGeneratedAt','summaryMethod','summaryModel','summaryEvidence','quality'])if(old[key]!==undefined)next[key]=old[key];
  if(old.contentAnalysis){const stale=old.contentAnalysis.sourceSignature!==analysisSignature(next);next.contentAnalysis={...old.contentAnalysis,...(stale?{status:'stale',reason:'Die Quelldaten haben sich seit dieser Auswertung geändert. Eine erneute Analyse muss manuell gestartet werden.'}:{})};}
 }
 if(old.officialTitle!==next.officialTitle&&old.weightedKeywords&&next.weightedKeywords===old.weightedKeywords)next.weightedKeywords={...old.weightedKeywords,status:'stale'};
 if(next.contentAnalysis?.status==='stale'&&next.labelAssessments?.ai)next.labelAssessments={...next.labelAssessments,ai:{...next.labelAssessments.ai,status:'stale'}};
 // Retain already stored extracts. New processing does not persist full documents.
 if(old.hasDocumentText&&old.sourceText&&!source.hasDocumentText&&!source.documentText){next.sourceText=old.sourceText;next.documentText=old.documentText||'';next.hasDocumentText=true;next.documentSource=old.documentSource;}
 else if(!next.documentText&&!next.hasDocumentText)next.hasDocumentText=false;
 return next;
}
export function importedMetadata(t,prior,at){return {version:RECORD_VERSION,firstImportedAt:prior?.metadata?.firstImportedAt||(prior?null:at),sourceModifiedAt:null,lastProcessedAt:null,...prior?.metadata,...t.metadata,lastFetchedAt:at||t.metadata?.lastFetchedAt||null};}
export function validKeywords(value){return !!value&&Array.isArray(value.items)&&value.items.length>0&&value.items.length<=10&&new Set(value.items.map(k=>k.term)).size===value.items.length&&value.items.every(k=>typeof k.term==='string'&&k.term.trim()&&Number.isInteger(k.weight)&&k.weight>0)&&value.items.reduce((s,k)=>s+k.weight,0)===100;}
