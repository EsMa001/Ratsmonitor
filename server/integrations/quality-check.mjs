// Checks of the stored stock for duplicates, defects and orphans (shared/quality-checks.mjs names them). Each check is
// one request of the quality page: it reads the stock (one or two scans), stores its count with up to SAMPLES examples
// in system_state and answers at once, so the page can run the checks one after another and show every result as it
// arrives. Nothing is changed: identity (merging) rests on official record relations alone, and the operator decides.
import {CATALOG} from '../../shared/catalog.mjs';
import {QUALITY_BY_ID,QUALITY_CHECKS} from '../../shared/quality-checks.mjs';
import {AdminError} from './admin-access.mjs';
const KEY='admin-quality-check',SAMPLES=20;
const canonical="json_extract(payload,'$.identity.mergedInto') IS NULL";
const title="coalesce(nullif(trim(json_extract(payload,'$.officialTitle')),''),nullif(trim(json_extract(payload,'$.title')),''),'')";
const committee="coalesce(json_extract(payload,'$.events[0].committee'),json_extract(payload,'$.committee'),'')",url="coalesce(json_extract(payload,'$.sourceUrl'),'')";
// Titles that stand several times in one meeting by nature (placeholders, standing items) and short titles: left out
// of the hint "same title in the same meeting", where they made nearly all of the 55,683 groups of the first measurement.
const GENERIC=['*tagesordnungspunkt*','*nicht vorab*','bereits behandelt*','*fragestunde*','*anfragen*','*mitteilungen*','*bekanntgabe*','*verschiedenes*','*sonstiges*','*sachstand*','*niederschrift*','*protokoll*','*eröffnung*','*feststellung der*','*informationen*','*bericht*'];
const generic=`(${GENERIC.map(g=>`lower(${title}) GLOB '${g}'`).join(' OR ')} OR length(${title})<25)`;
const readJson=text=>{try{return JSON.parse(text||'null');}catch{return null;}};
const contentRevision=async db=>Number((await db.prepare("SELECT coalesce((SELECT revision FROM data_revisions WHERE id='content'),0) AS revision").first())?.revision||0);
// A check over rows of topics: its condition, counted and sampled (id, region, title, date).
const rows=condition=>async db=>({
 count:Number((await db.prepare(`SELECT count(*) n FROM topics WHERE ${condition}`).first()).n),
 samples:(await db.prepare(`SELECT id,region_id regionId,${title} title,event_date date FROM topics WHERE ${condition} ORDER BY region_id,event_date DESC LIMIT ?`).bind(SAMPLES).all()).results,
});
const RUNNERS={
 // The same source address with the same title under two or more areas: a shared system whose reader does not
 // separate the members' bodies (GVV Schönau, Amt and Stadt Pasewalk). count: the surplus reports.
 async dupSharedSystem(db){
  const group=`FROM topics WHERE ${canonical} AND ${url}<>'' AND ${title}<>'' GROUP BY ${url},lower(${title}) HAVING count(DISTINCT region_id)>1`;
  const total=await db.prepare(`SELECT count(*) groups,coalesce(sum(c-1),0) extra FROM (SELECT count(*) c ${group})`).first();
  const samples=(await db.prepare(`SELECT ${url} url,min(${title}) title,min(event_date) date,min(region_id) regionId,group_concat(DISTINCT region_id) regions,count(*) count,group_concat(id,' ') ids ${group} ORDER BY count(*) DESC,url LIMIT ?`).bind(SAMPLES).all()).results;
  return {count:Number(total.extra),groups:Number(total.groups),samples:samples.map(s=>({...s,regions:String(s.regions).split(','),ids:String(s.ids).split(' ')}))};
 },
 // Reports of one body on one day with the same, non-generic title: mostly distinct items with the same wording
 // (several donation decisions, elections, successors), seldom the same item twice. A hint, not a duplicate.
 async dupSameMeeting(db){
  const group=`FROM topics WHERE ${canonical} AND ${title}<>'' AND NOT ${generic} GROUP BY region_id,event_date,lower(${committee}),lower(${title}) HAVING count(*)>1`;
  const total=await db.prepare(`SELECT count(*) groups,coalesce(sum(c-1),0) extra FROM (SELECT count(*) c ${group})`).first();
  const samples=(await db.prepare(`SELECT region_id regionId,min(${title}) title,event_date date,min(${committee}) committee,count(*) count,group_concat(id,' ') ids ${group} ORDER BY count(*) DESC,region_id,event_date DESC LIMIT ?`).bind(SAMPLES).all()).results;
  return {count:Number(total.extra),groups:Number(total.groups),samples:samples.map(s=>({...s,ids:String(s.ids).split(' ')}))};
 },
 // A title that ends with a dash is a style of some sources ("Protokoll … - öffentlicher Teil -"), not a cut.
 truncatedTitle:rows(`${canonical} AND (${title} GLOB '*;' OR ${title} GLOB '*:' OR ${title} GLOB '*,')`),
 emptyTitle:rows(`${canonical} AND ${title}=''`),
 noEvents:rows(`${canonical} AND (json_type(payload,'$.events')<>'array' OR json_array_length(payload,'$.events')=0)`),
 badEventDate:rows(`date(event_date) IS NULL OR event_date NOT GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' OR event_date<'1990-01-01' OR event_date>date('now','+2 years')`),
 // The column is written from the record's own eventDate (sync.ts); a difference means a stale column.
 eventDateMismatch:rows(`${canonical} AND event_date<>coalesce(json_extract(payload,'$.eventDate'),'')`),
 documentsWithoutUrl:rows(`${canonical} AND EXISTS (SELECT 1 FROM json_each(payload,'$.documents') WHERE coalesce(json_extract(value,'$.url'),'')='')`),
 async regionUnknown(db){
  const known=new Set([...CATALOG.map(r=>r.id),'muenster']);
  const unknown=(await db.prepare('SELECT region_id regionId,count(*) count FROM topics GROUP BY region_id').all()).results.filter(r=>!known.has(r.regionId));
  return {count:unknown.reduce((n,r)=>n+Number(r.count),0),groups:unknown.length,samples:unknown.slice(0,SAMPLES).map(r=>({regionId:r.regionId,count:Number(r.count),title:`${r.count} Berichte`}))};
 },
 conflicts:rows("json_extract(payload,'$.identity.conflict')=1"),
 mergeTargetMissing:rows("json_extract(payload,'$.identity.mergedInto') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM topics b WHERE b.id=json_extract(topics.payload,'$.identity.mergedInto'))"),
 mergeChain:rows("json_extract(payload,'$.identity.mergedInto') IS NOT NULL AND EXISTS (SELECT 1 FROM topics b WHERE b.id=json_extract(topics.payload,'$.identity.mergedInto') AND json_extract(b.payload,'$.identity.mergedInto') IS NOT NULL)"),
 orphanAnalyses:orphans('article_analyses','kind'),
 orphanVersions:orphans('article_versions','captured_at'),
};
function orphans(table,detail){
 return async db=>({
  count:Number((await db.prepare(`SELECT count(*) n FROM ${table} a LEFT JOIN topics t ON t.id=a.topic_id WHERE t.id IS NULL`).first()).n),
  samples:(await db.prepare(`SELECT a.id id,a.topic_id regionId,a.${detail} title FROM ${table} a LEFT JOIN topics t ON t.id=a.topic_id WHERE t.id IS NULL LIMIT ?`).bind(SAMPLES).all()).results.map(r=>({id:r.id,topicId:r.regionId,title:`${r.title} · Bericht ${r.regionId}`})),
 });
}
const readState=async db=>{const r=await db.prepare('SELECT value FROM system_state WHERE key=?').bind(KEY).first();const kept=r?readJson(r.value):null;return kept&&typeof kept==='object'&&kept.checks?kept:{checks:{}};};
/** Every stored result with the current content revision; stale: the stock changed since that check. */
export async function storedQualityChecks(db){
 const [kept,currentRevision]=await Promise.all([readState(db),contentRevision(db)]);
 const checks={};for(const c of QUALITY_CHECKS){const r=kept.checks[c.id];if(r)checks[c.id]={...r,stale:r.revision!==currentRevision};}
 return {checks,currentRevision};
}
/** Runs one check, stores its result (count, groups, samples, when, how long, at which revision) and returns it. */
export async function runQualityCheck(db,id){
 if(!QUALITY_BY_ID[id]||!RUNNERS[id])throw new AdminError(400,'Unbekannte Prüfung.');
 const began=Date.now(),revision=await contentRevision(db);
 const found=await RUNNERS[id](db);
 const entry={id,...found,checkedAt:new Date().toISOString(),ms:Date.now()-began,revision};
 const kept=await readState(db);kept.checks[id]=entry;
 await db.prepare('INSERT INTO system_state(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(KEY,JSON.stringify(kept)).run();
 return {...entry,stale:false};
}
