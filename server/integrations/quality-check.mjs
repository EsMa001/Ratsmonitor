// Checks of the stored stock for duplicates, defects and orphans (shared/quality-checks.mjs names them). Each check is
// one request of the quality page: it reads the stock (one or two scans), stores its count with up to SAMPLES examples
// in system_state and answers at once, so the page can run the checks one after another and show every result as it
// arrives. Nothing is changed: identity (merging) rests on official record relations alone, and the operator decides.
import {CATALOG} from '../../shared/catalog.mjs';
import {QUALITY_BY_ID,QUALITY_CHECKS} from '../../shared/quality-checks.mjs';
import {AdminError} from './admin-access.mjs';
import {stockRevisions} from './admin-stored.mjs';
import {nextChunk} from './build-chunks.mjs';
const KEY='admin-quality-check',SAMPLES=20;
const canonical="json_extract(payload,'$.identity.mergedInto') IS NULL";
const title="coalesce(nullif(trim(json_extract(payload,'$.officialTitle')),''),nullif(trim(json_extract(payload,'$.title')),''),'')";
const committee="coalesce(json_extract(payload,'$.events[0].committee'),json_extract(payload,'$.committee'),'')",url="coalesce(json_extract(payload,'$.sourceUrl'),'')";
// Titles that stand several times in one meeting by nature (placeholders, standing items) and short titles: left out
// of the hint "same title in the same meeting", where they made nearly all of the 55,683 groups of the first measurement.
const GENERIC=['*tagesordnungspunkt*','*nicht vorab*','bereits behandelt*','*fragestunde*','*anfragen*','*mitteilungen*','*bekanntgabe*','*verschiedenes*','*sonstiges*','*sachstand*','*niederschrift*','*protokoll*','*eröffnung*','*feststellung der*','*informationen*','*bericht*'];
const generic=`(${GENERIC.map(g=>`lower(${title}) GLOB '${g}'`).join(' OR ')} OR length(${title})<25)`;
const readJson=text=>{try{return JSON.parse(text||'null');}catch{return null;}};
// A check over rows of topics: its condition, counted and sampled (id, region, title, date).
const rows=condition=>async db=>({
 count:Number((await db.prepare(`SELECT count(*) n FROM topics WHERE ${condition}`).first()).n),
 samples:(await db.prepare(`SELECT id,region_id regionId,${title} title,event_date date FROM topics WHERE ${condition} ORDER BY region_id,event_date DESC LIMIT ?`).bind(SAMPLES).all()).results,
});
// Conditions of the checks over rows of topics, shared by the check over the whole stock and the one in steps.
const CONDITIONS={
 truncatedTitle:`${canonical} AND (${title} GLOB '*;' OR ${title} GLOB '*:' OR ${title} GLOB '*,')`,
 emptyTitle:`${canonical} AND ${title}=''`,
 noEvents:`${canonical} AND (json_type(payload,'$.events')<>'array' OR json_array_length(payload,'$.events')=0)`,
 badEventDate:`date(event_date) IS NULL OR event_date NOT GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' OR event_date<'1990-01-01' OR event_date>date('now','+2 years')`,
 eventDateMismatch:`${canonical} AND event_date<>coalesce(json_extract(payload,'$.eventDate'),'')`,
 documentsWithoutUrl:`${canonical} AND EXISTS (SELECT 1 FROM json_each(payload,'$.documents') WHERE coalesce(json_extract(value,'$.url'),'')='')`,
 conflicts:"json_extract(payload,'$.identity.conflict')=1",
 mergeTargetMissing:"json_extract(payload,'$.identity.mergedInto') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM topics b WHERE b.id=json_extract(topics.payload,'$.identity.mergedInto'))",
 mergeChain:"json_extract(payload,'$.identity.mergedInto') IS NOT NULL AND EXISTS (SELECT 1 FROM topics b WHERE b.id=json_extract(topics.payload,'$.identity.mergedInto') AND json_extract(b.payload,'$.identity.mergedInto') IS NOT NULL)",
};
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
 truncatedTitle:rows(CONDITIONS.truncatedTitle),
 emptyTitle:rows(CONDITIONS.emptyTitle),
 noEvents:rows(CONDITIONS.noEvents),
 badEventDate:rows(CONDITIONS.badEventDate),
 // The column is written from the record's own eventDate (sync.ts); a difference means a stale column.
 eventDateMismatch:rows(CONDITIONS.eventDateMismatch),
 documentsWithoutUrl:rows(CONDITIONS.documentsWithoutUrl),
 async regionUnknown(db){
  const known=new Set([...CATALOG.map(r=>r.id),'muenster']);
  const unknown=(await db.prepare('SELECT region_id regionId,count(*) count FROM topics GROUP BY region_id').all()).results.filter(r=>!known.has(r.regionId));
  return {count:unknown.reduce((n,r)=>n+Number(r.count),0),groups:unknown.length,samples:unknown.slice(0,SAMPLES).map(r=>({regionId:r.regionId,count:Number(r.count),title:`${r.count} Berichte`}))};
 },
 conflicts:rows(CONDITIONS.conflicts),
 mergeTargetMissing:rows(CONDITIONS.mergeTargetMissing),
 mergeChain:rows(CONDITIONS.mergeChain),
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
// Orphan checks look at article_analyses and article_versions, whose changes only the content revision counts.
const CONTENT_CHECKS=new Set(['orphanAnalyses','orphanVersions']);
/**
 * Every stored result with the current content revision. stale: the stock changed since that check (changes of reports,
 * stockSum; for the orphan checks also of versions and analyses). A result without stockSum (former version) is stale.
 */
export async function storedQualityChecks(db){
 const [kept,{stockSum,content}]=await Promise.all([readState(db),stockRevisions(db)]);
 const checks={};for(const c of QUALITY_CHECKS){const r=kept.checks[c.id];if(r)checks[c.id]={...r,stale:typeof r.stockSum!=='number'||r.stockSum!==stockSum||CONTENT_CHECKS.has(c.id)&&r.content!==content};}
 return {checks,currentRevision:content};
}
async function storeResults(db,entries){
 const kept=await readState(db);for(const entry of entries)kept.checks[entry.id]=entry;
 await db.prepare('INSERT INTO system_state(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(KEY,JSON.stringify(kept)).run();
}
/** Runs one check over the whole stock at once (tests and local comparisons; the page runs them in steps), stores and returns it. */
export async function runQualityCheck(db,id){
 if(!QUALITY_BY_ID[id]||!RUNNERS[id])throw new AdminError(400,'Unbekannte Prüfung.');
 const began=Date.now(),{stockSum,content}=await stockRevisions(db);
 const found=await RUNNERS[id](db);
 const entry={id,...found,checkedAt:new Date().toISOString(),ms:Date.now()-began,revision:content,stockSum,content};
 await storeResults(db,[entry]);
 return {...entry,stale:false};
}

// --- In steps (admin-builds.mjs): the same checks, chunk by chunk ---
// Checks over rows of topics and "same title in the same meeting" run over chunks of areas in binary order: counts add
// up, and examples taken in that order are the first examples of the whole stock (ORDER BY region_id …). The counts of
// all row checks of a chunk come from one scan of the chunk. "Same address under several areas" runs per host of the
// source address: the chunks of areas note which areas hold addresses of which host (admin_agg, list 'host'), then each
// host with two or more areas is one unit. A group has one address and so one host: the units divide the groups exactly
// (an earlier division by configured server missed 239 of 2,618 groups; scripts/check-dup-shared.mjs compares). The
// checks of the catalog and of orphans run in one step each, as before.
const ROW_CHECKS=Object.keys(CONDITIONS),SINGLE_CHECKS=['regionUnknown','orphanAnalyses','orphanVersions'];
const IN_UNIT=' AND region_id IN (SELECT value FROM json_each(?))';
const binary=(a,b)=>a===b?0:a<b?-1:1;
const sameMeetingOrder=(a,b)=>b.count-a.count||binary(a.regionId,b.regionId)||binary(String(b.date),String(a.date));
const sharedOrder=(a,b)=>b.count-a.count||binary(a.url,b.url);
// The ids of an example: at most this many are kept in the state of a build and shown on the page.
const SAMPLE_IDS=20;
const trimIds=s=>s.ids&&s.ids.length>SAMPLE_IDS?{...s,ids:s.ids.slice(0,SAMPLE_IDS)}:s;
// Host of the source address (the part between "://" and the next "/", lower case). Only its being the same for the
// same address matters, so both phases use this one expression.
const HOST=`lower(substr(substr(${url},instr(${url},'://')+3),1,instr(substr(${url},instr(${url},'://')+3)||'/','/')-1))`;
const SHARED_ROWS=`FROM topics WHERE ${canonical} AND ${url}<>'' AND ${title}<>''`;
/** The next host after the cursor with two or more areas, from the notes of the area chunks: {host,ids,left} or null. */
async function nextHost(db,build,cursor){
 const [unit,left]=await db.batch([
  db.prepare("SELECT g host,json_group_array(k) ids FROM admin_agg WHERE build=? AND list='host' AND g>? GROUP BY g HAVING count(*)>1 ORDER BY g LIMIT 1").bind(build,cursor),
  db.prepare("SELECT count(*) n FROM (SELECT g FROM admin_agg WHERE build=? AND list='host' AND g>? GROUP BY g HAVING count(*)>1)").bind(build,cursor),
 ]);
 const row=unit.results[0];
 return row?{host:String(row.host),ids:String(row.ids),left:Number(left.results[0]?.n||0)}:null;
}
async function sameMeetingUnit(db,ids){
 const group=`FROM topics WHERE ${canonical} AND ${title}<>'' AND NOT ${generic}${IN_UNIT} GROUP BY region_id,event_date,lower(${committee}),lower(${title}) HAVING count(*)>1`;
 // Examples only where the unit has groups: most units have none, and the second query reads the unit again.
 const total=await db.prepare(`SELECT count(*) groups,coalesce(sum(c-1),0) extra FROM (SELECT count(*) c ${group})`).bind(ids).first();
 const samples=Number(total.groups)?await db.prepare(`SELECT region_id regionId,min(${title}) title,event_date date,min(${committee}) committee,count(*) count,group_concat(id,' ') ids ${group} ORDER BY count(*) DESC,region_id,event_date DESC LIMIT ?`).bind(ids,SAMPLES).all():{results:[]};
 return {count:Number(total.extra),groups:Number(total.groups),samples:samples.results.map(s=>trimIds({...s,ids:String(s.ids).split(' ')}))};
}
async function sharedUnit(db,ids,host){
 const group=`${SHARED_ROWS}${IN_UNIT} AND ${HOST}=? GROUP BY ${url},lower(${title}) HAVING count(DISTINCT region_id)>1`;
 const total=await db.prepare(`SELECT count(*) groups,coalesce(sum(c-1),0) extra FROM (SELECT count(*) c ${group})`).bind(ids,host).first();
 const samples=Number(total.groups)?await db.prepare(`SELECT ${url} url,min(${title}) title,min(event_date) date,min(region_id) regionId,group_concat(DISTINCT region_id) regions,count(*) count,group_concat(id,' ') ids ${group} ORDER BY count(*) DESC,url LIMIT ?`).bind(ids,host,SAMPLES).all():{results:[]};
 return {count:Number(total.extra),groups:Number(total.groups),samples:samples.results.map(s=>trimIds({...s,regions:String(s.regions).split(','),ids:String(s.ids).split(' ')}))};
}
/** "Same address under several areas" per host, with the hosts read in one query over the whole stock (read-only
 * comparison in scripts/check-dup-shared.mjs). */
export async function sharedByHosts(db){
 const units=(await db.prepare(`SELECT ${HOST} host,json_group_array(DISTINCT region_id) ids ${SHARED_ROWS} GROUP BY 1 HAVING count(DISTINCT region_id)>1 ORDER BY 1`).all()).results;
 let partial;for(const u of units)partial=addUnit(partial,await sharedUnit(db,String(u.ids),String(u.host)),{order:sharedOrder,ms:0});
 return {units:units.length,...(partial||{count:0,groups:0,samples:[]})};
}
/** Adds the result of a unit to the partial result of a check: counts add up, examples keep their order and the first SAMPLES. */
function addUnit(partial,result,{order,ms}){
 const p=partial||{count:0,samples:[],ms:0};
 const out={...p,count:p.count+result.count,ms:p.ms+ms};
 if(result.groups!==undefined)out.groups=(p.groups||0)+result.groups;
 const samples=[...p.samples,...result.samples];if(order)samples.sort(order);
 out.samples=samples.slice(0,SAMPLES);
 return out;
}
/** A build over the given checks (target 'quality:<id>' or 'quality:all', admin-builds.mjs). */
function qualityBuild(checks){
 const rowChecks=checks.filter(id=>ROW_CHECKS.includes(id)),sameMeeting=checks.includes('dupSameMeeting'),shared=checks.includes('dupSharedSystem'),singles=checks.filter(id=>SINGLE_CHECKS.includes(id));
 const byRegion=rowChecks.length>0||sameMeeting||shared;
 const parse=next=>{const i=next.indexOf('|');return i<0?['r','']:[next.slice(0,i),next.slice(i+1)];};
 return {
  // Every row check reads the chunk once more; smaller chunks keep each query short.
  chunkRows:10000,
  usesAgg:shared,
  // The hosts are known only after the areas; their number is added to the total when the build gets there.
  async total(db){
   const areas=byRegion?Number((await db.prepare('SELECT count(*) n FROM region_revisions').first())?.n||0):0;
   return areas+singles.length;
  },
  async next(db,st,chunkRows){
   let [phase,cursor]=parse(st.next);
   if(phase==='r'){
    if(byRegion){const {ids,rows}=await nextChunk(db,cursor,chunkRows);if(ids.length)return {unit:{kind:'r',ids},cursor:'r|'+ids.at(-1),areas:ids.length,rows};}
    phase='p';cursor='';
   }
   if(phase==='p'){
    if(shared){const unit=await nextHost(db,st.id,cursor);if(unit)return {unit:{kind:'p',ids:unit.ids,host:unit.host},cursor:'p|'+unit.host,areas:1,heavy:true,total:st.done+unit.left+singles.length};}
    phase='s';cursor='';
   }
   const i=cursor===''?0:Number(cursor)+1;
   if(i<singles.length)return {unit:{kind:'s',id:singles[i]},cursor:'s|'+i,areas:1,heavy:true};
   return null;
  },
  async chunk(db,unit,{build,guard,guardArgs,state}){
   const partial={...state.partial},statements=[];
   if(unit.kind==='r'){
    const ids=JSON.stringify(unit.ids);
    // Which areas of the chunk hold addresses of which host (for "same address under several areas").
    if(shared)statements.push(db.prepare(`INSERT INTO admin_agg(build,list,g,k,n) SELECT ?,'host',${HOST},region_id,count(*) ${SHARED_ROWS}${IN_UNIT} AND ${guard} GROUP BY ${HOST},region_id ON CONFLICT(build,list,g,k) DO UPDATE SET n=n+excluded.n`).bind(build,ids,...guardArgs));
    if(rowChecks.length){
     // One scan of the chunk counts every row check; examples are read only where the chunk has hits and fewer than SAMPLES are kept.
     const began=Date.now();
     const counts=await db.prepare(`SELECT ${rowChecks.map(id=>`coalesce(sum(CASE WHEN (${CONDITIONS[id]}) THEN 1 ELSE 0 END),0) ${id}`).join(',')} FROM topics WHERE 1${IN_UNIT}`).bind(ids).first();
     const share=(Date.now()-began)/rowChecks.length;
     for(const id of rowChecks){
      const count=Number(counts?.[id]||0),kept=partial[id]?.samples?.length||0,t0=Date.now();
      const samples=count&&kept<SAMPLES?(await db.prepare(`SELECT id,region_id regionId,${title} title,event_date date FROM topics WHERE (${CONDITIONS[id]})${IN_UNIT} ORDER BY region_id,event_date DESC LIMIT ?`).bind(ids,SAMPLES-kept).all()).results:[];
      partial[id]=addUnit(partial[id],{count,samples},{ms:share+(Date.now()-t0)});
     }
    }
    if(sameMeeting){const t0=Date.now();partial.dupSameMeeting=addUnit(partial.dupSameMeeting,await sameMeetingUnit(db,ids),{order:sameMeetingOrder,ms:Date.now()-t0});}
   }else if(unit.kind==='p'){const t0=Date.now();partial.dupSharedSystem=addUnit(partial.dupSharedSystem,await sharedUnit(db,unit.ids,unit.host),{order:sharedOrder,ms:Date.now()-t0});}
   else{const t0=Date.now();const r=await RUNNERS[unit.id](db);partial[unit.id]={...r,ms:Date.now()-t0};}
   return {partial,statements};
  },
  async finish(db,st,now){
   const checkedAt=now.toISOString();
   await storeResults(db,checks.map(id=>{const p=st.partial[id]||{count:0,samples:[],ms:0};const {ms,...rest}=p;
    return {id,count:0,samples:[],...(id==='dupSameMeeting'||id==='dupSharedSystem'||id==='regionUnknown'?{groups:0}:{}),...rest,checkedAt,ms:Math.round(ms||0),revision:st.content,stockSum:st.stockSum,content:st.content};}));
  },
 };
}
/** Build targets of the quality checks: 'quality:all' and 'quality:<id>' for every check. */
export const QUALITY_BUILDS=Object.fromEntries([['quality:all',qualityBuild(QUALITY_CHECKS.map(c=>c.id).filter(id=>RUNNERS[id]))],...QUALITY_CHECKS.filter(c=>RUNNERS[c.id]).map(c=>['quality:'+c.id,qualityBuild([c.id])])]);
