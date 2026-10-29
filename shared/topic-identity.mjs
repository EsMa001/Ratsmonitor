import {preserveArticleContent} from './article-record.mjs';
// Only official record relations establish identity. Titles, references, PDFs and
// meeting URLs deliberately cannot merge records.
export const IDENTITY_VERSION='official-records-v1';
/* Zulässige Vorgangs-ID (Detailseite, Merken, Folgen): Importe vergeben auch Großbuchstaben, „_“, „.“ und „:“
   (Essen „nrw-05113000-vo-505_64282“, Hamburg „22-1665.01“); eine engere Prüfung macht solche Vorgänge unerreichbar */
export const TOPIC_ID=/^[A-Za-z0-9_.:-]{1,200}$/;
const ID_CHARS=/^[A-Za-z0-9_.:-]*$/,FOLD={ä:'ae',ö:'oe',ü:'ue',Ä:'Ae',Ö:'Oe',Ü:'Ue',ß:'ss'};
// FNV-1a (32 bit) als 8 Hex-Ziffern, wie fnv in server/integrations/source-common.mjs (shared liest nicht aus server/).
const fnv=value=>{let h=0x811c9dc5;for(const c of new TextEncoder().encode(value)){h^=c;h=Math.imul(h,0x01000193);}return (h>>>0).toString(16).padStart(8,'0');};
/* Teil einer Vorgangs-ID aus einem Wert der Quelle (Vorlagennummer, Datensatznummer). Ein Wert aus zulässigen Zeichen bleibt
   unverändert, damit bestehende IDs gleich bleiben; sonst Umlaute ausgeschrieben, Akzente weg, jede Folge anderer Zeichen „-“
   (KOMFA „Vorlage Ö/12“ → „Vorlage-Oe-12“); bleibt nichts übrig, die Prüfsumme des Werts. */
export function safeIdPart(value){
 const s=String(value??'');if(ID_CHARS.test(s))return s;
 return s.replace(/[äöüÄÖÜß]/g,c=>FOLD[c]).normalize('NFKD').replace(/[̀-ͯ]/g,'').replace(/[^A-Za-z0-9_.:-]+/g,'-').replace(/^-+|-+$/g,'')||fnv(s);
}
/* Zulässige Vorgangs-ID (TOPIC_ID) aus der eines Lesers: eine gültige bleibt, wie sie ist; sonst Zeichen wie safeIdPart,
   und über 200 Zeichen gekürzt mit der Prüfsumme der ganzen ID am Ende (eindeutig, beim nächsten Import dieselbe). */
export function safeTopicId(id){
 const s=String(id??'');if(TOPIC_ID.test(s))return s;
 const x=safeIdPart(s)||fnv(s);return x.length<=200?x:x.slice(0,191).replace(/-+$/,'')+'-'+fnv(s);
}
/* Vorgänge eines Imports mit zulässigen IDs (auch der Verweis identity.mergedInto); changed nennt umgeschriebene IDs.
   Jeder Import geht hier durch (collectRegion, mergeImport): kein Leser kann eine ID speichern, die sich nicht öffnen lässt. */
export function withSafeTopicIds(topics){
 const changed=[];
 const fixed=(topics||[]).map(t=>{
  const id=safeTopicId(t.id),into=t.identity?.mergedInto,target=into==null?into:safeTopicId(into);
  if(id===t.id&&target===into)return t;
  if(id!==t.id)changed.push([t.id,id]);
  return {...t,id,...(target!==into?{identity:{...t.identity,mergedInto:target}}:{})};
 });
 return {topics:fixed,changed};
}
/** Warnung des Imports zu umgeschriebenen IDs (null ohne). */
export const safeIdWarning=changed=>changed.length?`${changed.length} Vorgangs-IDs der Quelle mit unzulässigen Zeichen oder über 200 Zeichen umgeschrieben (z. B. „${String(changed[0][0]).slice(0,80)}“ → „${changed[0][1].slice(0,80)}“).`:null;
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
/* Platzhalter statt Gremium: nur „Gremium“ oder „Gremium laut Originalquelle“, auch mehrfach mit Komma; echte Namen wie
 * „Gremium für Verkehrsfragen“ bleiben. */
export const PLACEHOLDER_COMMITTEE=/^\s*gremium(?: laut originalquelle)?(?:\s*,\s*gremium(?: laut originalquelle)?)*\s*$/i;
export function mergeHistory(old,fresh){
 const events=new Map((old.events||[]).map(e=>[JSON.stringify([e.url,e.date,e.committee]),e]));
 for(const e of fresh.events||[]){const key=JSON.stringify([e.url,e.date,e.committee]);let prior=events.get(key);
  // The same meeting read once with a placeholder committee (organization not readable at the time, Goch 06.10.2026)
  // and later with its name is one event: the placeholder gives way instead of standing beside it.
  if(!prior&&e.url&&!PLACEHOLDER_COMMITTEE.test(e.committee||''))for(const [k,x] of events)if(x.url===e.url&&x.date===e.date&&PLACEHOLDER_COMMITTEE.test(x.committee||'')){events.delete(k);prior=x;break;}
  const next={...prior,...e};
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
