// Read-only field audit. Never classifies, generates text, or replaces missing facts.
export const DATA_REQUIREMENTS_VERSION='complete-article-v1';
export const REQUIRED_FIELDS=[
 ['processedAt','Bearbeitungsdatum',"length(coalesce(json_extract(payload,'$.metadata.lastProcessedAt'),''))>0"],
 ['region','Stadt / Kreis',"length(region_id)>0"],
 ['committee','Gremium',"length(trim(coalesce(json_extract(payload,'$.committee'),'')))>0"],
 ['participants','Belegte Sitzungsteilnahme',"json_array_length(json_extract(payload,'$.events'))>0 AND NOT EXISTS(SELECT 1 FROM json_each(json_extract(topics.payload,'$.events')) e WHERE coalesce(json_extract(e.value,'$.attendance.status'),'')!='available' OR coalesce(json_extract(e.value,'$.attendance.sourceUrl'),'')='')"],
 ['reference','Vorgangsnummer oder belegtes Nichtvorliegen',"length(trim(coalesce(json_extract(payload,'$.reference'),'')))>0 OR json_extract(payload,'$.referenceStatus')='not_available_in_source'"],
 ['process','Bekannter Prozessstand',"status IN ('announced','consulting','recommended','approved','rejected','postponed','info')"],
 ['title','Amtlicher Titel',"length(trim(coalesce(json_extract(payload,'$.officialTitle'),'')))>0"],
 ['summary','Aktuelle KI-Inhaltszusammenfassung',"json_extract(payload,'$.contentAnalysis.status')='completed' AND length(trim(coalesce(json_extract(payload,'$.shortSummary'),'')))>0 AND json_array_length(json_extract(payload,'$.longSummary'))>0 AND json_array_length(json_extract(payload,'$.contentAnalysis.evidence'))>0"],
 ['originals','Originalverweise',"json_extract(payload,'$.sourceUrl') LIKE 'https://%' OR EXISTS(SELECT 1 FROM json_each(json_extract(topics.payload,'$.documents')) d WHERE json_extract(d.value,'$.url') LIKE 'https://%')"],
 ['ruleLabel','Gespeichertes Regel-Label',"coalesce(json_extract(payload,'$.labelAssessments.rule.primary'),json_extract(payload,'$.classification.primary'),'')!='' AND coalesce(json_extract(payload,'$.labelAssessments.rule.method'),json_extract(payload,'$.classification.method'),'') NOT IN ('','pending')"],
 ['aiLabel','Getrenntes aktuelles KI-Label',"coalesce(json_extract(payload,'$.labelAssessments.ai.primary'),'')!='' AND coalesce(json_extract(payload,'$.labelAssessments.ai.status'),'completed')='completed'"],
 ['keywords','Zehn inhaltsbasierte KI-Stichwörter, Summe 100',"json_extract(payload,'$.weightedKeywords.status')='completed' AND json_extract(payload,'$.weightedKeywords.inputBasis')='content' AND json_extract(payload,'$.weightedKeywords.method') LIKE 'codex-%' AND json_array_length(json_extract(payload,'$.weightedKeywords.items'))=10 AND (SELECT SUM(json_extract(k.value,'$.weight')) FROM json_each(json_extract(topics.payload,'$.weightedKeywords.items')) k)=100 AND (SELECT COUNT(DISTINCT lower(trim(json_extract(k.value,'$.term')))) FROM json_each(json_extract(topics.payload,'$.weightedKeywords.items')) k)=10 AND NOT EXISTS(SELECT 1 FROM json_each(json_extract(topics.payload,'$.weightedKeywords.items')) k WHERE json_type(k.value,'$.weight')!='integer' OR json_extract(k.value,'$.weight')<=0 OR coalesce(trim(json_extract(k.value,'$.term')),'')='')"]
];
export async function dataCompleteness(db,region='all'){
 if(!db)throw Error('Datenbank fehlt');
 if(!/^[a-z0-9-]{1,80}$/.test(region))throw Error('Ungültiges Gebiet');
 const where="json_extract(payload,'$.identity.mergedInto') IS NULL"+(region==='all'?'':' AND region_id=?');
 const fields=REQUIRED_FIELDS.map(([id,,sql])=>`COALESCE(SUM(COALESCE((${sql}),0)),0) AS ${id}`);
 const all=REQUIRED_FIELDS.map(([, ,sql])=>`COALESCE((${sql}),0)`).join(' AND ');
 const row=await db.prepare(`SELECT COUNT(*) AS total,COALESCE(SUM(${all}),0) AS complete,${fields.join(',')} FROM topics WHERE ${where}`).bind(...(region==='all'?[]:[region])).first();
 return {version:DATA_REQUIREMENTS_VERSION,region,total:Number(row.total),complete:Number(row.complete),incomplete:Number(row.total-row.complete),fields:REQUIRED_FIELDS.map(([id,name])=>({id,name,complete:Number(row[id]),missing:Number(row.total-row[id])})),note:'Unbekannte Werte und Quellenlücken zählen nicht als vollständig. Das ist eine technische Feldprüfung, keine unabhängige Inhaltsfreigabe.'};
}
