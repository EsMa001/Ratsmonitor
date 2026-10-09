// Keep the offline audit on exactly the same candidate set as the quality check.
// A selector, NOT a diagnosis: punctuation alone never authorizes a change.
export const TITLE_SQL="coalesce(nullif(trim(json_extract(payload,'$.officialTitle')),''),nullif(trim(json_extract(payload,'$.title')),''),'')";
export const TITLE_CANDIDATE_SQL=`json_extract(payload,'$.identity.mergedInto') IS NULL AND (${TITLE_SQL} GLOB '*;' OR ${TITLE_SQL} GLOB '*:' OR ${TITLE_SQL} GLOB '*,')`;
// SQLite trim() without its second argument trims ASCII spaces only.
const trim=value=>String(value??'').replace(/^ +| +$/g,'');
export const candidateTitle=topic=>trim(topic.officialTitle)||trim(topic.title);
export const isTitleCandidate=topic=>topic.identity?.mergedInto==null&&[';',':',','].includes(candidateTitle(topic).slice(-1));
