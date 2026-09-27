import {preserveArticleContent} from './article-record.mjs';
// Only official record relations establish identity. Titles, references, PDFs and
// meeting URLs deliberately cannot merge records.
export const IDENTITY_VERSION='official-records-v1';
const region=t=>t.regionId||'muenster';
export function recordUrl(value){
 try{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password)return null;
 if(!/(?:\/papers?(?:\/|$)|\/agendaitems?(?:\/|$)|\/(?:vo0050|to0050)\.(?:asp|php)$)/i.test(u.pathname))return null;
 u.hash='';u.searchParams.sort();return u.href;}catch{return null;}
}
export function paperUrl(t){const u=recordUrl(t.sourceUrl);return u&&(/\/papers?(?:\/|\?|$)|\/vo0050\./i.test(u))?u:null;}
const officialRecords=t=>{
 const records=[...t.identityRecords||[]];
 // Existing SessionNet / More-Rubin IDs were constructed from official IDs by
 // their adapters. Meeting+ordinal fallbacks contain dashes and do not qualify.
 for(const [prefix,kind] of [['vo','paper'],['top','agenda']]){const start=region(t)+'-'+prefix+'-';if(t.id?.startsWith(start)&&/^\d+$/.test(t.id.slice(start.length))){try{records.push({authority:new URL(t.sourceUrl).origin,kind,id:t.id.slice(start.length)});}catch{}}}
 return records.filter(r=>['paper','agenda'].includes(r.kind)&&/^\d+$/.test(r.id)&&/^https:\/\//.test(r.authority));
};
const recordKey=r=>JSON.stringify([r.authority,r.kind,r.id]);
const paperKey=t=>paperUrl(t)||officialRecords(t).filter(r=>r.kind==='paper').map(recordKey)[0]||null;
const linkCache=new WeakMap();
const links=t=>{if(!linkCache.has(t))linkCache.set(t,[...new Set([...([t.sourceUrl,...t.identityLinks||[]].map(recordUrl).filter(Boolean)),...officialRecords(t).map(recordKey)])].sort());return linkCache.get(t);};
/** @template {{identity?:{mergedInto?:string}}} T @param {T[]} topics @returns {T[]} */
export const activeTopics=topics=>topics.filter(t=>!t.identity?.mergedInto);
export function identityState(t){return t.identity?.conflict?'conflict':paperKey(t)?'paper':'unlinked';}
export function mergeHistory(old,fresh){
 const events=new Map((old.events||[]).map(e=>[JSON.stringify([e.url,e.date,e.committee]),e]));
 for(const e of fresh.events||[]){const key=JSON.stringify([e.url,e.date,e.committee]),prior=events.get(key);const next={...prior,...e};
  if(prior?.attendance?.status==='available'&&e.attendance?.status!=='available')next.attendance=prior.attendance;
  if(prior?.decision&&prior.decision.kind!=='unknown'&&e.decision?.kind==='unknown')next.decision=prior.decision;
  // A metadata-only adapter reporting "unknown" is not contrary evidence to a
  // result read from the public minutes. Keep its source-backed enrichment.
  if(prior?.decision&&e.status==='unknown'&&!e.result){next.status=prior.status;next.description=prior.description;next.result=prior.result;}
  else if(old.contentAnalysis&&prior&&e.status==='unknown'&&!e.result&&prior.status!=='unknown'){next.status=prior.status;next.description=prior.description;next.result=prior.result;}
  events.set(key,next);}
 const documents=new Map((old.documents||[]).map(d=>[d.url,d]));for(const d of fresh.documents||[])documents.set(d.url,d);
 const ordered=[...events.values()].sort((a,b)=>a.date.localeCompare(b.date));
 // Keep the source's status policy; a bounded older slice must not regress the
 // more recent recorded state or discard a validated summary on an older import.
 const base=(old.eventDate||'')>(fresh.eventDate||'')?{...fresh,...old}:{...old,...fresh};
 if(old.contentAnalysis&&base.status==='unknown'&&old.eventDate===fresh.eventDate&&old.status!=='unknown')base.status=old.status;
 return preserveArticleContent(old,{...base,updatedAt:[old.updatedAt,fresh.updatedAt].filter(Boolean).sort().at(-1),events:ordered,documents:[...documents.values()],identityLinks:[...new Set([old.sourceUrl,fresh.sourceUrl,...old.identityLinks||[],...fresh.identityLinks||[]].map(recordUrl).filter(Boolean))].sort(),identityRecords:[...new Map([...officialRecords(old),...officialRecords(fresh)].map(r=>[recordKey(r),r])).values()]},fresh);
}
export function reconcileTopics(previous,incoming){
 const records=new Map(previous.map(t=>[t.id,{...t}]));
 for(const fresh of activeTopics(incoming)){
  const same=records.get(fresh.id);if(same?.updatedAt&&fresh.updatedAt&&same.updatedAt>fresh.updatedAt)continue;
  const tokens=new Set(links(fresh));let matches=activeTopics([...records.values()]).filter(t=>region(t)===region(fresh)&&(t.id===fresh.id||links(t).some(k=>tokens.has(k))));
  if(same?.identity?.mergedInto){const target=records.get(same.identity.mergedInto);if(target&&!matches.some(t=>t.id===target.id))matches.push(target);}
  const papers=new Set([fresh,...matches].map(paperKey).filter(Boolean));
  if(papers.size>1){records.set(fresh.id,{...(same||fresh),identity:{version:IDENTITY_VERSION,conflict:true}});continue;}
  matches.sort((a,b)=>a.id.localeCompare(b.id));
  const target=matches[0]?.id||fresh.id;
  let merged=matches.reduce((a,t)=>mergeHistory(a,t),{...fresh,events:[],documents:[]});merged=mergeHistory(merged,fresh);
  records.set(target,{...merged,id:target,sourceUrl:paperUrl(fresh)||matches.map(paperUrl).find(Boolean)||merged.sourceUrl,identity:{version:IDENTITY_VERSION}});
  for(const t of [...matches,fresh])if(t.id!==target)records.set(t.id,{...t,updatedAt:[t.updatedAt,fresh.updatedAt].filter(Boolean).sort().at(-1),identity:{version:IDENTITY_VERSION,mergedInto:target}});
  // Existing aliases remain valid if their canonical record is merged again.
  for(const [id,t] of records)if(t.identity?.mergedInto&&matches.some(m=>m.id===t.identity.mergedInto)&&id!==target)records.set(id,{...t,identity:{...t.identity,mergedInto:target}});
 }
 for(const alias of incoming.filter(t=>t.identity?.mergedInto)){
  const target=resolveTopic([...records.values()],alias.identity.mergedInto);
  const old=records.get(alias.id);
  if(target&&target.id!==alias.id&&region(target)===region(alias)&&(!old?.updatedAt||!alias.updatedAt||alias.updatedAt>=old.updatedAt))records.set(alias.id,{...alias,identity:{...alias.identity,mergedInto:target.id}});
 }
 return [...records.values()];
}
export function resolveTopic(topics,id){const byId=new Map(topics.map(t=>[t.id,t]));let t=byId.get(id);const seen=new Set();while(t?.identity?.mergedInto){if(seen.has(t.id))return undefined;seen.add(t.id);t=byId.get(t.identity.mergedInto);}return t;}
