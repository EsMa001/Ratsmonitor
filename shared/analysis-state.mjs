import {LABELS,LABEL_VERSION,CLASSIFIER_VERSION,LEGACY_LABELS} from './labels.mjs';
import {THEMES_VERSION,OPEN} from './themes.mjs';
import {analysisSignature} from './article-record.mjs';
import {AI_LOCAL_METHOD} from './ai-local-content.mjs';
const ids=new Set(LABELS.map(l=>l.id));
// Einordnungen von Hand und per KI aus labels-v2 gelten übersetzt (LEGACY_LABELS), labels-v3 direkt (Schritt 5, 14.10.2026)
const CATALOGS=new Set([LABEL_VERSION,'labels-v2']);
const toLabel=id=>LEGACY_LABELS[id]||null;
export const sourceTitle=t=>t.officialTitle||t.title||'';
export function hasCurrentLabel(t){const c=t.classification;return !!c&&c.version===LABEL_VERSION&&c.method===CLASSIFIER_VERSION&&c.evidence===sourceTitle(t)&&ids.has(c.primary);}
const hasStoredRuleLabel=t=>{const c=t.classification;return !!c&&CATALOGS.has(c.version)&&typeof c.method==='string'&&c.method.startsWith('title-rules-v')&&c.evidence===sourceTitle(t)&&!!toLabel(c.primary);};
/** Thema aus readReport (payload.theme), wenn es zur aktuellen Fassung der Themen und zum heutigen Titel gehört */
const hasReadTheme=t=>{const th=t.theme;return !!th&&th.version===THEMES_VERSION&&th.evidence===sourceTitle(t)&&(th.id===OPEN||ids.has(th.id));};
export function hasCurrentAiLabel(t){const ai=t.labelAssessments?.ai;return !!ai&&ai.status==='completed'&&ai.method===AI_LOCAL_METHOD&&CATALOGS.has(ai.version)&&!!toLabel(ai.primary)&&ai.sourceSignature===analysisSignature(t);}
export function hasReviewedLabel(t){const review=t.labelAssessments?.review;return !!review&&!!toLabel(review.primary)&&typeof review.reviewer==='string'&&review.reviewer.trim().length>0&&typeof review.reviewedAt==='string'&&Number.isFinite(Date.parse(review.reviewedAt))&&review.status!=='stale'&&(!review.sourceSignature||review.sourceSignature===analysisSignature(t));}
// A read selects saved results; title-rule freshness remains independent of the displayed label.
export function storedClassification(t){
 if(hasReviewedLabel(t)){const review=t.labelAssessments.review;return {primary:toLabel(review.primary),secondary:[],version:LABEL_VERSION,method:'manual-review',evidence:sourceTitle(t),reason:review.reason||'Manuell gepruefte Einordnung.',sourceUrl:review.sourceUrl||t.sourceUrl||'',classifiedAt:review.reviewedAt};}
 if(hasCurrentAiLabel(t)){const ai=t.labelAssessments.ai;return {...ai,primary:toLabel(ai.primary),version:LABEL_VERSION,evidence:sourceTitle(t),secondary:(Array.isArray(ai.secondary)?ai.secondary:[]).map(toLabel).filter(x=>x&&x!==toLabel(ai.primary))};}
 if(hasReadTheme(t)){const th=t.theme;return {primary:th.id===OPEN?'unklar':th.id,secondary:[],subs:th.subs||[],version:LABEL_VERSION,method:'read-report',evidence:sourceTitle(t),reason:'Thema aus Titel und Unterlage (Regeln).',sourceUrl:t.sourceUrl||'',classifiedAt:null};}
 if(hasStoredRuleLabel(t)){const c=t.classification;return c.version===LABEL_VERSION?c:{...c,primary:toLabel(c.primary),secondary:[],version:LABEL_VERSION};}
 return {primary:'unklar',secondary:[],version:LABEL_VERSION,method:'pending',evidence:sourceTitle(t),reason:'Analyse ausstehend. Einordnung startet nur auf Anforderung des Betreibers.',sourceUrl:t.sourceUrl||'',classifiedAt:null};
}
export function preserveAnalysis(incoming,prior){return {...incoming,classification:prior?.classification||incoming.classification,analysisFeatures:prior?.analysisFeatures||incoming.analysisFeatures};}
