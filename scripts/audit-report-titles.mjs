// Offline, read-only audit. No fetch, imports, analysis calls, UPDATEs or apply mode.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {candidateTitle,isTitleCandidate,TITLE_CANDIDATE_SQL} from '../server/integrations/title-candidates.mjs';
import {NRW_SOURCES} from '../server/integrations/source-catalog.mjs';
import {SOURCES} from '../server/integrations/regions.mjs';
import {clean} from '../server/integrations/oparl.mjs';
import {readNrwSnapshot} from './nrw-snapshot-file.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const sha256=value=>createHash('sha256').update(value).digest('hex');
const catalog=new Map([...SOURCES,...NRW_SOURCES].map(s=>[s.id,s]));
const compare=(a,b)=>a<b?-1:a>b?1:0;
function provenance(topic){
 const source=catalog.get(topic.regionId),stored=topic.sourceData?.method;
 let host='unknown';try{host=new URL(topic.sourceUrl).host;}catch{/* missing or malformed source */}
 return {
  adapter:typeof stored==='string'&&stored?stored:'unknown',sourceHost:host,
  // A current catalog entry is a lead, not proof of the adapter used for an old import.
  catalogHint:source?{adapter:source.method==='oparl'?'oparl':source.adapter||(source.extension?'sessionnet':'unknown'),url:source.system||source.base||null}:null,
 };
}

/** Only the raw OParl name of this exact official record can support a proposal here.
 * Scraper agenda.fields.title is already parser output, and a paper's Betreff need not be the agenda title.
 * Neither those fields, an unrelated/linked record, a longer title nor a punctuation match is a repair rule.
 * HTML captures are not stored by these importers. Do not pretend to reconstruct their lost lines.
 */
export function titleEvidence(topic){
 const data=topic.sourceData;
 if(!data||!Array.isArray(data.records))return {cause:'missing_provenance',proposal:null};
 if(topic.identity?.conflict||topic.identity?.mergedInto!=null)return {cause:'identity_conflict',proposal:null};
 if(data.version!=='public-source-fields-v1'||data.method!=='oparl')return {cause:'parsed_fields_only',proposal:null};
 const own=data.records.flatMap((record,index)=>{
  const f=record?.fields;
  return ['paper','agenda'].includes(record?.kind)&&f&&typeof f==='object'&&!Array.isArray(f)&&
   typeof topic.sourceUrl==='string'&&topic.sourceUrl&&f.id===topic.sourceUrl&&typeof f.name==='string'
   ?[{index,record,name:clean(f.name)}]:[];
 });
 if(!own.length)return {cause:'missing_own_source_name',proposal:null};
 if(new Set(own.map(r=>r.name)).size!==1||own.some(({record:r,name})=>!name||r.fields.deleted||r.kind==='agenda'&&r.fields.public!==true))
  return {cause:'conflicting_or_nonpublic_source',proposal:null};
 const original=own[0],before=candidateTitle(topic),after=original.name;
 const evidence={path:`sourceData.records[${original.index}].fields.name`,url:topic.sourceUrl,
  fetchedAt:data.fetchedAt||null,rawName:original.record.fields.name,normalizedName:after,
  recordSha256:sha256(JSON.stringify(original.record))};
 if(after===before)return {cause:'punctuation_in_original_name',evidence,proposal:null};
 // A distinct wording, missing officialTitle or missing capture date remains a review case. Never overwrite an AI title.
 if(typeof topic.officialTitle!=='string'||!topic.officialTitle.trim()||typeof data.fetchedAt!=='string'||!Number.isFinite(Date.parse(data.fetchedAt))||
  !after.startsWith(before)||after.length<=before.length||!/^[\s\p{P}]/u.test(after.slice(before.length)))
  return {cause:'source_name_differs_review',evidence,proposal:null};
 return {cause:'own_original_name_proves_continuation',evidence,
  proposal:{field:'officialTitle',before:topic.officialTitle,after}};
}

/** rows carry the stored column identity and the untouched payload string, not inferred title-based IDs. */
export function auditTitleRows(rows,{basis='unspecified',totalTopics=null,revision=null,expectedCount=null}={}){
 const findings=[],groups=new Map(),causes=new Map();let read=0;
 for(const row of rows){
  read++;const topic=JSON.parse(row.payload);
  if(!isTitleCandidate(topic))continue;
  const origin=provenance({...topic,regionId:row.region_id});
  const result=topic.id!==row.id||topic.regionId&&topic.regionId!==row.region_id
   ?{cause:'column_identity_mismatch',proposal:null}:titleEvidence(topic);
  const finding={id:row.id,regionId:row.region_id,title:candidateTitle(topic),sourceUrl:topic.sourceUrl||null,
   ...origin,...result,payloadSha256:sha256(row.payload)};
  findings.push(finding);causes.set(result.cause,(causes.get(result.cause)||0)+1);
  const key=JSON.stringify([row.region_id,origin.sourceHost,origin.adapter]);
  if(!groups.has(key))groups.set(key,{regionId:row.region_id,...origin,count:0,causes:{}});
  const group=groups.get(key);group.count++;group.causes[result.cause]=(group.causes[result.cause]||0)+1;
 }
 findings.sort((a,b)=>compare(a.regionId,b.regionId)||compare(a.id,b.id));
 return {format:'ratsmonitor-title-audit-v1',mode:'dry-run',basis,revision,totalTopics:totalTopics??read,
  candidateCount:findings.length,expectedCount,countMatches:expectedCount===null?null:findings.length===expectedCount,
  proposalCount:findings.filter(f=>f.proposal).length,
  causes:Object.fromEntries([...causes].sort(([a],[b])=>compare(a,b))),
  groups:[...groups.values()].map(g=>({...g,causes:Object.fromEntries(Object.entries(g.causes).sort(([a],[b])=>compare(a,b)))}))
   .sort((a,b)=>compare(a.regionId,b.regionId)||compare(a.sourceHost,b.sourceHost)||compare(a.adapter,b.adapter)),
  findings};
}

export function auditDatabase(filename,{expectedCount=null}={}){
 const db=new DatabaseSync(filename,{readOnly:true});
 try{
  db.exec('PRAGMA query_only=ON; BEGIN'); // One consistent read snapshot, including the revision and counts.
  const hasRevision=db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='data_revisions'").get();
  const revision=hasRevision?db.prepare("SELECT revision FROM data_revisions WHERE id='content'").get()?.revision??null:null;
  const totalTopics=db.prepare('SELECT count(*) n FROM topics').get().n;
  const rows=db.prepare(`SELECT id,region_id,payload FROM topics WHERE ${TITLE_CANDIDATE_SQL}`).iterate();
  return auditTitleRows(rows,{basis:'sqlite-read-only',totalTopics,revision,expectedCount});
 }finally{try{db.exec('ROLLBACK');}finally{db.close();}}
}

export function auditBundled({expectedCount=null}={}){
 const topics=['topics','regions'].flatMap(name=>JSON.parse(fs.readFileSync(path.join(root,'data',name+'.json'),'utf8')).topics);
 const snapshot=readNrwSnapshot();topics.push(...snapshot.topics);
 const rows=topics.map(t=>({id:t.id,region_id:t.regionId||'muenster',payload:JSON.stringify(t)}));
 return auditTitleRows(rows,{basis:'bundled topics.json + regions.json + nrw-seed.json; NOT the 2026-10-07 dev database',revision:snapshot.revision,expectedCount});
}

export function main(args=process.argv.slice(2)){
 let database=null,bundled=false,expectedCount=null;
 for(let i=0;i<args.length;i++){
  const arg=args[i];
  if(arg==='--database'&&!database&&args[i+1]&&!args[i+1].startsWith('--'))database=args[++i];
  else if(arg==='--bundled'&&!bundled)bundled=true;
  else if(arg==='--expected-count'&&expectedCount===null&&/^\d+$/.test(args[i+1]||'')){
   expectedCount=Number(args[++i]);if(!Number.isSafeInteger(expectedCount))throw Error('Ungültige erwartete Trefferzahl.');
  }else throw Error('Unbekannte oder unvollständige Option: '+arg);
 }
 if(Boolean(database)===bundled)throw Error('Aufruf: node scripts/audit-report-titles.mjs --database <lokale-Kopie.sqlite> | --bundled [--expected-count 4963]');
 const report=database?auditDatabase(path.resolve(database),{expectedCount}):auditBundled({expectedCount});
 process.stdout.write(JSON.stringify(report,null,2)+'\n');
 // Still emit the complete audit, but never silently treat another snapshot as the reported 4,963 cases.
 if(report.countMatches===false)process.exitCode=2;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{main();}catch(e){console.error(e.message);process.exitCode=1;}
}
