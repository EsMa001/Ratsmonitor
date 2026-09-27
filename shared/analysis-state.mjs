import {LABELS,LABEL_VERSION,CLASSIFIER_VERSION} from './labels.mjs';
const ids=new Set(LABELS.map(l=>l.id));
export const sourceTitle=t=>t.officialTitle||t.title||'';
export function hasCurrentLabel(t){const c=t.classification;return !!c&&c.version===LABEL_VERSION&&c.method===CLASSIFIER_VERSION&&c.evidence===sourceTitle(t)&&ids.has(c.primary);}
// A read never invokes a classifier. Pending is distinct from an analysed ambiguous title.
export function storedClassification(t){return hasCurrentLabel(t)?t.classification:{primary:'unklar',secondary:[],version:LABEL_VERSION,method:'pending',evidence:sourceTitle(t),reason:'Analyse ausstehend. Einordnung startet nur auf Anforderung des Betreibers.',sourceUrl:t.sourceUrl||'',classifiedAt:null};}
export function preserveAnalysis(incoming,prior){return {...incoming,classification:prior?.classification||incoming.classification,analysisFeatures:prior?.analysisFeatures||incoming.analysisFeatures};}
