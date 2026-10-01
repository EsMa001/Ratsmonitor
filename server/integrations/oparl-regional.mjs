import {compactOparl,sourceDecision,publicParticipants} from './source-fields.mjs';
import {windowStart} from './history-window.mjs';
import {chooseBody} from './body-identity.mjs';
import {publicAgenda} from './public-agenda.mjs';
import {clean,hash,statusOf,sourceSummary,category,parallel} from './oparl.mjs';
/** A provider-configured, portable collector. No Cloudflare or app dependencies. */
export async function collectRegionalOparl(source,{now=new Date(),getJson=null,maxRequests=350,maxPages=Math.min(24,source.maxPages||6),maxDurationMs=300000,onProgress=()=>{},window:lookback}={}){
 const since=windowStart(now,lookback);const from=since.toISOString().slice(0,10),issues=[];let requests=0;const cache=new Map();const base=new URL(source.system);const deadline=Date.now()+maxDurationMs;
 const allowed=value=>{const u=new URL(value);if(source.upgradeHttpLinks&&u.protocol==='http:'&&u.hostname===base.hostname&&!u.port&&!base.port)u.protocol='https:';if(u.protocol!=='https:'||u.origin!==base.origin||u.username||u.password)throw Error('Quelle außerhalb der freigegebenen OParl-Adresse');return u.href;};
 const get=async url=>{url=allowed(url);if(Date.now()>=deadline)throw Error('Zeitbudget der Quelle erreicht');if(cache.has(url))return cache.get(url);if(++requests>maxRequests)throw Error('Abrufbudget erreicht');const promise=(async()=>{if(getJson)return getJson(url);const r=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(Math.max(1,Math.min(55000,deadline-Date.now()))),headers:{Accept:'application/json'}});if(!r.ok)throw Error('OParl HTTP '+r.status);const raw=await r.text();if(raw.length>Math.min(7e6,Math.max(5e6,source.maxResponseChars||5e6)))throw Error('Antwort überschreitet Größenlimit');return JSON.parse(raw);})();cache.set(url,promise);return promise;};
 const object=async x=>typeof x==='string'?get(x):x;
 const list=async(url,recent=false)=>{if(Array.isArray(url))return url;const out=[],seen=new Set();let next=url,pages=0,reverse=false;
 while(next){if(seen.has(next)){issues.push('Wiederholte Listenseite');break;}if(++pages>maxPages){issues.push('Listenlimit erreicht; Quelle noch nicht vollständig eingelesen.');break;}seen.add(next);try{const p=await get(next);if(!Array.isArray(p.data))throw Error('Keine OParl-Liste');out.push(...p.data);
 // Some providers expose chronological pages. Follow the supplied last link,
 // then previous links; never infer URLs or claim complete historical coverage.
 if(recent&&source.meetingScan!=='forward'&&pages===1&&p.links?.last&&p.links.last!==p.links.self){next=p.links.last;reverse=true;issues.push('Begrenzter Abruf vom Ende der Sitzungsliste; Vollständigkeit des Zeitraums nicht bestätigt.');}
 else next=reverse?p.links?.prev:p.links?.next;
 }catch(e){issues.push(e.message);break;}}return out;};
 let body;const entry=await get(source.system);
 if(entry.type?.endsWith('/Body'))body=chooseBody([entry],source);else {
  if(!entry.type?.endsWith('/System'))throw Error('Kein OParl-System');
  const rawBodies=await list(entry.body);
  const bodies=await parallel(rawBodies,async b=>{try{return await object(b)}catch(e){issues.push('Körperschaft: '+e.message);return null;}},3);
  body=chooseBody(bodies,source);
 }
 const raw=await list(body.meeting,true);const meetings=[];
 const until=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()+2,0)).toISOString().slice(0,10);
 await parallel(raw,async x=>{try{let m=await object(x);if(!m.deleted&&m.start?.slice(0,10)>=from&&m.start.slice(0,10)<=until){if(!m.agendaItem&&m.id)m=await get(m.id);meetings.push(m);}}catch(e){issues.push(e.message);}},3);
 const grouped=new Map();
 await parallel(meetings,async m=>{
  let org=[];for(const o of m.organization||[]){try{org.push(clean((await object(o))?.name||'Gremium'));}catch{org.push('Gremium laut Originalquelle');}}
  const attendance=await publicParticipants(m,object,now.toISOString());
  const committee=org.join(', ')||clean(m.name)||'Öffentliche Sitzung';
  const resolved=await parallel(m.agendaItem||[],async a=>{try{return await object(a)}catch(e){issues.push('Tagesordnungspunkt: '+e.message);return {public:false};}},3);
  const visible=publicAgenda(resolved);if(visible.unclear)issues.push(visible.unclear+' Tagesordnungspunkte ohne eindeutigen Öffentlichkeitsnachweis ausgelassen.');
  for(const a of visible.items){try{let c,p;try{if(a.consultation){c=await object(a.consultation);if(c.paper)p=await object(c.paper);}}catch(e){issues.push('Verknüpfung: '+e.message);/* Keep the independently public agenda item. A later official paper link can merge it. */}
   if(c?.deleted||p?.deleted)continue;const rawKey=p?.id||a.id;if(!rawKey)continue;const key=allowed(rawKey);const officialTitle=clean(p?.name||a.name);if(!officialTitle)continue;
   let status=statusOf(a,c,m,now);if(m.start.slice(0,10)<=now.toISOString().slice(0,10)&&!clean(a.result))status='unknown';
   const event={date:m.start.slice(0,10),committee,status,description:clean(a.result)||'Öffentlich auf der Tagesordnung; kein Ergebnis im erfassten Feld.',result:clean(a.result),url:allowed(m.id),publicEvidence:a.publicEvidence,attendance};event.decision=sourceDecision(event);
   const documents=[{title:'Amtlicher OParl-Datensatz',url:allowed(key),kind:'oparl'}];
   for(const f0 of [p?.mainFile,...p?.auxiliaryFile||[],a.resolutionFile,...a.auxiliaryFile||[],m.invitation,m.resultsProtocol,m.verbatimProtocol,...m.auxiliaryFile||[]].filter(Boolean)){try{const f=await object(f0);if(f.deleted||!f.accessUrl)continue;documents.push({title:clean(f.name||f.fileName||'Originalunterlage'),url:allowed(f.accessUrl),kind:f.mimeType||'document'});}catch(e){issues.push('Dokumentverweis: '+e.message);}}
   const topicId=source.id+'-oparl-'+(await hash(key)).slice(0,20);
   if(grouped.has(key)){const prev=grouped.get(key);prev.events.push(event);prev.documents.push(...documents);prev.identityLinks.push(allowed(a.id));}else grouped.set(key,{id:topicId,regionId:source.id,source:source.kind,public:true,title:officialTitle,officialTitle,sourceData:{version:'public-source-fields-v1',method:'oparl',fetchedAt:now.toISOString(),records:[compactOparl(p,'paper'),compactOparl(a,'agenda'),compactOparl(c,'consultation'),compactOparl(m,'meeting')].filter(Boolean)},metadata:{sourceModifiedAt:p?.modified||a.modified||null},reference:clean(p?.reference),category:category(officialTitle),updatedAt:now.toISOString(),sourceUrl:key,identityLinks:[key,allowed(a.id)],events:[event],documents,relevanceReason:'Öffentlicher Vorgang: '+source.name});
  }catch(e){issues.push('Tagesordnungspunkt: '+e.message);}}
 },3);
 const topics=[];for(const t of grouped.values()){t.events.sort((a,b)=>a.date.localeCompare(b.date));const last=t.events.at(-1);Object.assign(t,{status:last.status,eventDate:last.date,committee:last.committee});t.documents=[...new Map(t.documents.map(d=>[d.url,d])).values()];t.sourceText=t.title+'\n'+t.events.map(e=>e.description).join('\n');Object.assign(t,sourceSummary(t));t.longSummary[0]=t.longSummary[0].replace('in Münster','in '+source.name.replace(/^(Stadt|Gemeinde) /,''));t.quality={passed:false,checks:[{name:'Öffentliche Quelle',passed:true,detail:'Öffentlichkeit durch Kennzeichen oder ausdrücklich bezeichneten öffentlichen Sitzungsabschnitt belegt.'},{name:'Inhaltsprüfung',passed:false,detail:'Automatischer Quellenüberblick; keine redaktionelle Freigabe.'}],checkedAt:now.toISOString(),sourceHash:await hash(t.sourceText)};topics.push(t);}
 onProgress(source.name+': '+topics.length+' Artikel');return {topics,coverage:{regionId:source.id,method:'oparl',from:meetings.length?from:null,to:meetings.length?now.toISOString().slice(0,10):null,importedAt:meetings.length?now.toISOString():null,lastAttemptAt:now.toISOString(),meetings:meetings.length,sourceCount:1,quiet:meetings.length===0&&issues.length===0,complete:issues.length===0&&topics.length>0,issues:[...new Set(issues)],sourceUrl:source.system,body:body.id}};
}
