// Fixtures explicitly represent results of a completed operator-triggered analysis.
import {classifyTopic} from '../../shared/labels.mjs';
import {features,MATCH_VERSION} from '../../shared/similarity.mjs';
export const analysed=t=>({...t,classification:classifyTopic(t),analysisFeatures:{...features(t),version:MATCH_VERSION,evidence:t.officialTitle||t.title||'',analysedAt:'2026-09-27T12:00:00Z'}});
