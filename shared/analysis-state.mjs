import {LABELS,LABEL_VERSION,CLASSIFIER_VERSION} from './labels.mjs';
import {analysisSignature} from './article-record.mjs';
import {AI_LOCAL_METHOD} from './ai-local-content.mjs';
const ids=new Set(LABELS.map(l=>l.id));
export const sourceTitle=t=>t.officialTitle||t.title||'';
export function hasCurrentLabel(t){const c=t.classification;return !!c&&c.version===LABEL_VERSION&&c.method===CLASSIFIER_VERSION&&c.evidence===sourceTitle(t)&&ids.has(c.primary);}
const hasStoredRuleLabel=t=>{const c=t.classification;return !!c&&c.version===LABEL_VERSION&&typeof c.method==='string'&&c.method.startsWith('title-rules-v')&&c.evidence===sourceTitle(t)&&ids.has(c.primary);};
export function hasCurrentAiLabel(t){const ai=t.labelAssessments?.ai;return !!ai&&ai.status==='completed'&&ai.method===AI_LOCAL_METHOD&&ai.version===LABEL_VERSION&&ids.has(ai.primary)&&ai.sourceSignature===analysisSignature(t);}
export function hasReviewedLabel(t){const review=t.labelAssessments?.review;return !!review&&ids.has(review.primary)&&typeof review.reviewer==='string'&&review.reviewer.trim().length>0&&typeof review.reviewedAt==='string'&&Number.isFinite(Date.parse(review.reviewedAt))&&review.status!=='stale'&&(!review.sourceSignature||review.sourceSignature===analysisSignature(t));}
// A read selects saved results; title-rule freshness remains independent of the displayed label.
export function storedClassification(t){
 if(hasReviewedLabel(t)){const review=t.labelAssessments.review;return {primary:review.primary,secondary:[],version:LABEL_VERSION,method:'manual-review',evidence:sourceTitle(t),reason:review.reason||'Manuell gepruefte Einordnung.',sourceUrl:review.sourceUrl||t.sourceUrl||'',classifiedAt:review.reviewedAt};}
 if(hasCurrentAiLabel(t)){const ai=t.labelAssessments.ai;return {...ai,evidence:sourceTitle(t),secondary:Array.isArray(ai.secondary)?ai.secondary:[]};}
 return hasStoredRuleLabel(t)?t.classification:{primary:'unklar',secondary:[],version:LABEL_VERSION,method:'pending',evidence:sourceTitle(t),reason:'Analyse ausstehend. Einordnung startet nur auf Anforderung des Betreibers.',sourceUrl:t.sourceUrl||'',classifiedAt:null};
}
export function preserveAnalysis(incoming,prior){return {...incoming,classification:prior?.classification||incoming.classification,analysisFeatures:prior?.analysisFeatures||incoming.analysisFeatures};}
