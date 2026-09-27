import {LABEL_VERSION,CLASSIFIER_VERSION} from '../../shared/labels.mjs';
// Analysis needs dates and labels, not meeting descriptions, documents or raw text.
export const ANALYTICS_SQL=`SELECT id,region_id AS regionId,
 json_extract(payload,'$.title') AS title,
 json_extract(payload,'$.officialTitle') AS officialTitle,
 json_extract(payload,'$.sourceUrl') AS sourceUrl,
 event_date AS eventDate,updated_at AS updatedAt,
 (SELECT json_group_array(json_extract(e.value,'$.date')) FROM json_each(json_extract(topics.payload,'$.events')) e) AS eventDays,
 json_extract(payload,'$.identity.mergedInto') AS mergedInto,
 json_extract(payload,'$.analysisFeatures') AS savedFeatures,
 CASE WHEN json_extract(payload,'$.classification.version')=?
 AND json_extract(payload,'$.classification.method')=?
 AND json_extract(payload,'$.classification.evidence')=coalesce(nullif(json_extract(payload,'$.officialTitle'),''),json_extract(payload,'$.title'),'')
 THEN json_extract(payload,'$.classification.primary') ELSE NULL END AS savedLabel
 FROM topics`;
export function analysisRow(row){
 const {eventDays,mergedInto,savedLabel,savedFeatures,...t}=row;
 return {...t,analysisFeatures:savedFeatures?JSON.parse(savedFeatures):undefined,events:JSON.parse(eventDays||'[]').map(date=>({date})),identity:{mergedInto},classification:savedLabel?{primary:savedLabel,version:LABEL_VERSION,method:CLASSIFIER_VERSION,evidence:t.officialTitle||t.title||''}:undefined};
}
export async function loadAnalyticsTopics(db){
 const rows=await db.prepare(ANALYTICS_SQL).bind(LABEL_VERSION,CLASSIFIER_VERSION).all();
 return rows.results.map(analysisRow);
}
