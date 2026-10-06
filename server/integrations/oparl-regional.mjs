import {compactOparl,sourceDecision,publicParticipants} from './source-fields.mjs';
import {windowStart,windowYears,historyWindow} from './history-window.mjs';
import {usableMark,newMark,usableList} from './meeting-marks.mjs';
import {chooseBody} from './body-identity.mjs';
import {publicAgenda} from './public-agenda.mjs';
import {clean,hash,statusOf,sourceSummary,category,parallel} from './oparl.mjs';
import {fetchNoRedirect,SOURCE_USER_AGENT} from './no-redirect.mjs';
const FILTER_MARGIN_DAYS=31,FILTER_PATIENCE_MS=30000;
// Catalog field organizations {include:[…],exclude:[…]}: one OParl body can hold several councils (Bremen: Landtag and
// Stadtbürgerschaft). A pattern is part of an organization's name or short name (case and umlaut spelling ignored) or
// its full address. A meeting is read only if one of its organizations is included, none is excluded and all are known.
const foldName=value=>clean(value).normalize('NFC').toLocaleLowerCase('de-DE').replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss');
const sameId=(a,b)=>String(a).replace(/^http:/,'https:')===String(b).replace(/^http:/,'https:');
/** Returns organizations=>'kept'|'filtered'|'mixed'|'unassigned' for [{id,name,shortName}] of one meeting. */
export function organizationFilter(spec){
 if(!spec||typeof spec!=='object'||Array.isArray(spec))throw Error('Gremienfilter: Angabe muss ein Objekt mit include/exclude sein');
 const patterns=key=>{const v=spec[key];if(v===undefined)return [];if(!Array.isArray(v)||v.some(p=>typeof p!=='string'||!p.trim()))throw Error('Gremienfilter: '+key+' muss eine Liste von Namensmustern sein');return v.map(p=>p.trim());};
 const include=patterns('include'),exclude=patterns('exclude');if(!include.length&&!exclude.length)throw Error('Gremienfilter ohne Namensmuster');
 const hits=(list,o)=>list.some(p=>/^https?:\/\//i.test(p)?Boolean(o.id)&&sameId(o.id,p):[o.name,o.shortName].some(n=>n&&foldName(n).includes(foldName(p))));
 return organizations=>{
  // Fail closed: without a committee, or with one that is neither named nor addressed by a pattern, nothing is read.
  if(!organizations.length||organizations.some(o=>!clean(o.name)&&!clean(o.shortName)&&!hits([...include,...exclude],o)))return 'unassigned';
  const out=organizations.filter(o=>hits(exclude,o)),own=organizations.filter(o=>!hits(exclude,o)&&(!include.length||hits(include,o)));
  // A joint meeting with an excluded committee (staatliche and städtische Deputation) is not read either.
  return !own.length?'filtered':out.length?'mixed':'kept';
 };
}
/**
 * One part of a shared system for readers whose meeting lists name a meeting only by its body (SessionNet, ALLRIS): the
 * catalog field organizations as above, applied to that name. keep(name, key) says whether a meeting is read; a meeting
 * without a name, or one no pattern assigns, is not (fail closed). warnings() names what was left out, each meeting once.
 */
export function committeePart(spec){
 const filter=spec?organizationFilter(spec):null,skipped={filtered:new Set(),unassigned:new Set()};
 const excludes=(spec?.exclude||[]).filter(p=>!/^https?:\/\//i.test(p)).map(foldName);
 return {
  // A meeting kept by the name its calendar gives it is still left out when the body its own page names is excluded:
  // Eutin's ALLRIS lists a meeting of the council of Süsel as "Gemeindevertretung", its page says "Gemeindevertretung
  // Süsel". (Included bodies keep the calendar's decision: a page may name a member's body without the member.)
  excluded(name,key=name){
   const f=foldName(String(name||''));if(!excludes.some(p=>f.includes(p)))return false;
   skipped.filtered.add(String(key));return true;
  },
  keep(name,key=name){
   if(!filter)return true;
   const verdict=filter([{name:String(name||'')}]);if(verdict==='kept')return true;
   skipped[verdict==='filtered'?'filtered':'unassigned'].add(String(key));return false;
  },
  warnings:()=>[
   ...(skipped.filtered.size?[`${skipped.filtered.size} Sitzungen anderer Gremien des gemeinsamen Systems ausgelassen.`]:[]),
   ...(skipped.unassigned.size?[`${skipped.unassigned.size} Sitzungen ohne zuordenbares Gremium ausgelassen.`]:[]),
  ],
 };
}
/** A provider-configured, portable collector. No Cloudflare or app dependencies. */
export async function collectRegionalOparl(source,{now=new Date(),getJson=null,maxRequests=350,maxPages=Math.min(24,source.maxPages||6),maxDurationMs=300000,onProgress=()=>{},window:lookback,trace=null,marks}={}){
 // The page limits were set for a year of meetings; a longer period gets as many for each of its years.
 const years=windowYears(lookback),pageLimit=maxPages*years,sortedLimit=Math.max(maxPages,24)*years;
 const filter=source.organizations?organizationFilter(source.organizations):null,skipped={filtered:0,mixed:0,unassigned:0};
 const since=windowStart(now,lookback);const from=since.toISOString().slice(0,10),issues=[];let requests=0;const cache=new Map();const base=new URL(source.system);const deadline=Date.now()+maxDurationMs;let strategy='plain';
 const allowed=value=>{const u=new URL(value);if(source.upgradeHttpLinks&&u.protocol==='http:'&&u.hostname===base.hostname&&!u.port&&!base.port)u.protocol='https:';if(u.protocol!=='https:'||u.origin!==base.origin||u.username||u.password)throw Error('Quelle außerhalb der freigegebenen OParl-Adresse');return u.href;};
 const load=async(url,patience)=>{if(getJson)return getJson(url);const r=await fetchNoRedirect(url,{signal:AbortSignal.timeout(Math.max(1,Math.min(patience,deadline-Date.now()))),headers:{Accept:'application/json','User-Agent':SOURCE_USER_AGENT}});if(!r.ok)throw Error('OParl HTTP '+r.status);const raw=await r.text();if(raw.length>Math.min(7e6,Math.max(5e6,source.maxResponseChars||5e6)))throw Error('Antwort überschreitet Größenlimit');return JSON.parse(raw);};
 // trace (optional) records every request of this import for the debug view.
 const traced=trace?trace.wrap(load):load;
 // Höchstens 5 gleichzeitige Netzabrufe (Workers erlaubt 6 offene Verbindungen). Die verschachtelten parallel()-Aufrufe
 // könnten sonst bis zu 9 starten; wartende Abrufe verbrauchten dabei schon ihr Zeitlimit. Das Limit beginnt erst mit dem Slot.
 let active=0;const waiting=[];
 const slot=()=>active<5?(active++,Promise.resolve()):new Promise(resolve=>waiting.push(resolve));
 const free=()=>{const next=waiting.shift();if(next)next();else active--;};
 const request=async(url,patience)=>{await slot();try{return await traced(url,patience);}finally{free();}};
 const get=async(url,patience=55000)=>{url=allowed(url);if(Date.now()>=deadline)throw Error('Zeitbudget der Quelle erreicht');if(cache.has(url))return cache.get(url);if(++requests>maxRequests)throw Error('Abrufbudget erreicht');const promise=request(url,patience);cache.set(url,promise);return promise;};
 const object=async x=>typeof x==='string'?get(x):x;
 const fromEnd='Begrenzter Abruf vom Ende der Sitzungsliste; Vollständigkeit des Zeitraums nicht bestätigt.';
 // What ends a step: the time limit (also as an aborted request) or the request budget.
 // A request that is aborted counts only when the time of the step is up; a single slow address is an ordinary failure.
 const exhausted=text=>/Zeitbudget|Abrufbudget/.test(text)||/aborted due to timeout/.test(text)&&Date.now()>=deadline-1000;
 // Page of a filtered meeting list at which reading stopped for lack of time; the next step continues there.
 let listCursor=null;
 const list=async(url,recent=false,resumeAt=null)=>{if(Array.isArray(url))return url;const out=[],seen=new Set();let next=url,pages=0,reverse=false,newestFirst=false,chronological=false,laterPageFirst='';
 const wholeListRead=()=>{const at=issues.indexOf(fromEnd);if(at>=0)issues.splice(at,1);};
 // OParl filter "modified_since". Servers that honour it (e.g. SD.NET) return only the meetings changed lately.
 // Their lists follow the record number, not the date, and a year of planned meetings fills the last pages, so
 // reading from the end misses the recent ones. The agenda of a meeting inside the window was published shortly
 // before it, which changes the meeting; the filter therefore starts FILTER_MARGIN_DAYS before the window.
 // Whether a server honours the filter is tested, not assumed: asked for changes since the year 2100, a filtering
 // server returns nothing. On large installations the filtered query is slower than a page from the end of the
 // list, so in automatic mode its first page must arrive within FILTER_PATIENCE_MS; otherwise the list is read
 // from its end as before. The catalog can fix the method that was verified for a source:
 // meetingScan "filter" (no time box, no fallback), "end" (never ask for the filter) or "forward".
 if(recent&&(resumeAt||source.meetingScan!=='forward'&&source.meetingScan!=='end')){
  const forced=source.meetingScan==='filter'||Boolean(resumeAt);let read=false,asking=null;
  try{
   const withFilter=value=>{const u=new URL(allowed(url));u.searchParams.set('modified_since',value);return u.href;};
   // SD.NET answers an empty result with a bare "[]" instead of a list object.
   const rows=answer=>Array.isArray(answer)?answer:answer?.data;
   const probe=forced?[]:await get(withFilter('2100-01-01T00:00:00+00:00'),FILTER_PATIENCE_MS);
   if(Array.isArray(rows(probe))&&!rows(probe).length){
    const first=resumeAt?allowed(resumeAt):withFilter(new Date(since.getTime()-FILTER_MARGIN_DAYS*86400000).toISOString().slice(0,19)+'+00:00'),visited=new Set([first]);
    if(resumeAt){read=true;strategy='filter';asking=first;}
    let p=await get(first,forced?undefined:FILTER_PATIENCE_MS);read=true;strategy='filter';asking=null;
    for(let page=1;;){
     if(!Array.isArray(rows(p)))throw Error('Keine OParl-Liste');
     out.push(...rows(p));const following=p.links?.next;if(!following||visited.has(following))break;
     if(++page>sortedLimit){issues.push('Listenlimit erreicht; Quelle noch nicht vollständig eingelesen.');break;}
     visited.add(following);asking=following;p=await get(following);asking=null;
    }
   }
  }catch(e){if(read||forced){strategy='filter';issues.push(e.message);read=true;if(asking&&exhausted(e.message))listCursor=asking;}/* otherwise: filter refused or too slow, the plain list is read */}
  if(read)return out;
 }
 strategy=source.meetingScan==='forward'?'forward':'end';
 while(next){if(seen.has(next)){if(reverse&&next===url)wholeListRead();else issues.push('Wiederholte Listenseite');break;}if(++pages>(newestFirst||chronological?sortedLimit:pageLimit)){issues.push('Listenlimit erreicht; Quelle noch nicht vollständig eingelesen.');break;}seen.add(next);try{const p=await get(next);if(!Array.isArray(p.data))throw Error('Keine OParl-Liste');out.push(...p.data);
 // Newest-first meeting lists (e.g. ALLRIS) are read from the start. Their last page holds the oldest meetings,
 // so jumping there finds nothing. Reading ends at the first sorted page that lies entirely before the window.
 const starts=recent?p.data.map(m=>m&&typeof m==='object'&&m.start?String(m.start).slice(0,10):''):[];
 const sorted=starts.length>1&&starts.every(Boolean)&&starts.every((s,i)=>i===0||starts[i-1]>=s);
 if(recent&&pages===1&&sorted&&starts[0]>starts.at(-1)){newestFirst=true;strategy='forward';}
 if(newestFirst&&sorted&&starts[0]<from)break;
 // Some providers expose chronological pages. Follow the supplied last link,
 // then previous links; never infer URLs or claim complete historical coverage.
 if(recent&&!newestFirst&&source.meetingScan!=='forward'&&pages===1&&p.links?.last&&p.links.last!==p.links.self){next=p.links.last;reverse=true;chronological=true;issues.push(fromEnd);}
 else {
  // Read from the end, a list sorted by date is followed back until a page lies entirely before the window.
  // Then the window is covered and the limitation note no longer applies. Unsorted lists keep the fixed page limit.
  if(reverse&&chronological){
   const ascending=starts.length>0&&starts.every(Boolean)&&starts.every((s,i)=>i===0||starts[i-1]<=s)&&(!laterPageFirst||starts.at(-1)<=laterPageFirst);
   if(!ascending)chronological=false;
   else if(starts.at(-1)<from){wholeListRead();break;}
   else laterPageFirst=starts[0];
  }
  next=reverse?p.links?.prev:p.links?.next;
  // Walking back reached the first page: nothing of the list was skipped.
  if(reverse&&!next)wholeListRead();
 }
 }catch(e){issues.push(e.message);break;}}return out;};
 let body;const entry=await get(source.system);
 if(entry.type?.endsWith('/Body'))body=chooseBody([entry],source);else {
  if(!entry.type?.endsWith('/System'))throw Error('Kein OParl-System');
  const rawBodies=await list(entry.body);
  const bodies=await parallel(rawBodies,async b=>{try{return await object(b)}catch(e){issues.push('Körperschaft: '+e.message);return null;}},3);
  body=chooseBody(bodies,source);
 }
 const meetings=[],period=historyWindow(lookback);let kept=null;
 const until=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()+2,0)).toISOString().slice(0,10);
 // marks.list (optional): the meeting list a step read a short while ago for the same period. The step that
 // continues an import then goes straight to the meetings it has not read; each of them is asked for by its address.
 const inPeriod=async raw=>{const found=[];await parallel(raw,async x=>{try{let m=await object(x);if(!m.deleted&&m.start?.slice(0,10)>=from&&m.start.slice(0,10)<=until){if(!m.agendaItem&&m.id)m=await get(m.id);found.push(m);}}catch(e){issues.push(e.message);}},3);return found;};
 const row=m=>[m.id,m.start,m.modified||''];
 if(usableList(marks?.list,period,body.id,now)){
  kept=marks.list;strategy=kept.strategy||strategy;for(const [id,start,modified] of kept.rows)meetings.push({id,start,modified,listed:true});
  // The earlier step did not get to the end of the list: read on at the page where it stopped.
  if(kept.next){
   const before=issues.length,have=new Set(kept.rows.map(r=>r[0])),more=(await inPeriod(await list(body.meeting,true,kept.next))).filter(m=>m.id&&!have.has(m.id));
   meetings.push(...more);
   if(listCursor||issues.length===before)kept={...kept,readAt:now.getTime(),rows:[...kept.rows,...more.map(row)],next:listCursor||undefined};
  }
 }
 else {
  const before=issues.length;meetings.push(...await inPeriod(await list(body.meeting,true)));
  // A list is kept if it was read without a failure or a limit, or if only the time ran out while reading a
  // filtered list: then its beginning is kept together with the page to continue at.
  if(meetings.every(m=>m.id)&&(listCursor||issues.length===before&&meetings.length))kept={window:period,readAt:now.getTime(),body:body.id,strategy,rows:meetings.map(row),...(listCursor?{next:listCursor}:{})};
 }
 // marks (optional): what earlier imports read completely, see meeting-marks.mjs. The meeting object says when it
 // was last modified and lists its agenda; if that is unchanged, the items, papers and files behind it are not
 // asked again. An import that ran out of time or requests continues behind the meetings it read.
 const grouped=new Map(),held={};let unchanged=0,done=0,unread=0,spent=false;
 await parallel(meetings,async m=>{
  const meeting=m.id?{url:allowed(m.id),date:m.start.slice(0,10)}:null,known=meeting&&usableMark(marks,meeting,now);
  if(known?.trusted){held[meeting.url]=marks.known[meeting.url];unchanged++;return;}
  // Time or requests are used up: this meeting is left for the next step. Reading on would store its agenda
  // items without their papers.
  if(spent||Date.now()>=deadline){spent=true;unread++;return;}
  if(m.listed){try{m=await get(m.id);}catch(e){if(exhausted(e.message)){spent=true;unread++;}issues.push(e.message);return;}if(m.deleted||!m.start)return;}
  // Committee filter: decided before the agenda is asked. Organizations are fetched once per address (cache of get).
  // A skipped meeting gets no mark, so a changed filter reads it at the next import.
  let org=null;
  if(filter){const found=[];for(const o of [].concat(m.organization||[])){const id=typeof o==='string'?o:o?.id||'';try{const x=await object(o);found.push({id:x?.id||id,name:clean(x?.name),shortName:clean(x?.shortName)});}catch(e){if(exhausted(e.message)){spent=true;unread++;issues.push(e.message);return;}found.push({id,name:'',shortName:''});}}
   const verdict=filter(found);if(verdict!=='kept'){skipped[verdict]++;return;}org=found.map(o=>o.name||o.shortName||'Gremium laut Originalquelle');}
  const print=(await hash(JSON.stringify([m.modified||'',(m.agendaItem||[]).map(a=>typeof a==='string'?a:[a.id,a.modified||'',a.result||''])]))).slice(0,16);
  if(known?.print===print){held[meeting.url]=marks.known[meeting.url];unchanged++;return;}
  // What went wrong while reading this meeting; a meeting with a failure is read again next time.
  let failed=0,cut=false,events=0;const fail=text=>{failed++;if(exhausted(text))cut=spent=true;issues.push(text);};
  if(!org){org=[];for(const o of m.organization||[]){try{org.push(clean((await object(o))?.name||'Gremium'));}catch{org.push('Gremium laut Originalquelle');}}}
  const attendance=await publicParticipants(m,object,now.toISOString());
  const committee=org.join(', ')||clean(m.name)||'Öffentliche Sitzung';
  const resolved=await parallel(m.agendaItem||[],async a=>{try{return await object(a)}catch(e){fail('Tagesordnungspunkt: '+e.message);return {public:false};}},3);
  const visible=publicAgenda(resolved);if(visible.unclear)issues.push(visible.unclear+' Tagesordnungspunkte ohne eindeutigen Öffentlichkeitsnachweis ausgelassen.');
  for(const a of visible.items){try{let c,p;try{if(a.consultation){c=await object(a.consultation);if(c.paper)p=await object(c.paper);}}catch(e){fail('Verknüpfung: '+e.message);/* Keep the independently public agenda item. A later official paper link can merge it. */}
   if(c?.deleted||p?.deleted)continue;const rawKey=p?.id||a.id;if(!rawKey)continue;const key=allowed(rawKey);const officialTitle=clean(p?.name||a.name);if(!officialTitle)continue;
   let status=statusOf(a,c,m,now);if(m.start.slice(0,10)<=now.toISOString().slice(0,10)&&!clean(a.result))status='unknown';
   const event={date:m.start.slice(0,10),committee,status,description:clean(a.result)||'Öffentlich auf der Tagesordnung; kein Ergebnis im erfassten Feld.',result:clean(a.result),url:allowed(m.id),publicEvidence:a.publicEvidence,attendance};event.decision=sourceDecision(event);
   const documents=[{title:'Amtlicher OParl-Datensatz',url:allowed(key),kind:'oparl'}];
   for(const f0 of [p?.mainFile,...p?.auxiliaryFile||[],a.resolutionFile,...a.auxiliaryFile||[],m.invitation,m.resultsProtocol,m.verbatimProtocol,...m.auxiliaryFile||[]].filter(Boolean)){try{const f=await object(f0);if(f.deleted||!f.accessUrl)continue;documents.push({title:clean(f.name||f.fileName||'Originalunterlage'),url:allowed(f.accessUrl),kind:f.mimeType||'document'});}catch(e){fail('Dokumentverweis: '+e.message);}}
   const topicId=source.id+'-oparl-'+(await hash(key)).slice(0,20);events++;
   if(grouped.has(key)){const prev=grouped.get(key);prev.events.push(event);prev.documents.push(...documents);prev.identityLinks.push(allowed(a.id));}else grouped.set(key,{id:topicId,regionId:source.id,source:source.kind,public:true,title:officialTitle,officialTitle,sourceData:{version:'public-source-fields-v1',method:'oparl',fetchedAt:now.toISOString(),records:[compactOparl(p,'paper'),compactOparl(a,'agenda'),compactOparl(c,'consultation'),compactOparl(m,'meeting')].filter(Boolean)},metadata:{sourceModifiedAt:p?.modified||a.modified||null},reference:clean(p?.reference),category:category(officialTitle),updatedAt:now.toISOString(),sourceUrl:key,identityLinks:[key,allowed(a.id)],events:[event],documents,relevanceReason:'Öffentlicher Vorgang: '+source.name});
  }catch(e){fail('Tagesordnungspunkt: '+e.message);}}
  if(cut)unread++;else if(meeting&&!failed){held[meeting.url]=newMark(meeting,print,now,events);done++;}
 },3);
 const topics=[];for(const t of grouped.values()){t.events.sort((a,b)=>a.date.localeCompare(b.date));const last=t.events.at(-1);Object.assign(t,{status:last.status,eventDate:last.date,committee:last.committee});t.documents=[...new Map(t.documents.map(d=>[d.url,d])).values()];t.sourceText=t.title+'\n'+t.events.map(e=>e.description).join('\n');Object.assign(t,sourceSummary(t));t.longSummary[0]=t.longSummary[0].replace('in Münster','in '+source.name.replace(/^(Stadt|Gemeinde) /,''));t.quality={passed:false,checks:[{name:'Öffentliche Quelle',passed:true,detail:'Öffentlichkeit durch Kennzeichen oder ausdrücklich bezeichneten öffentlichen Sitzungsabschnitt belegt.'},{name:'Inhaltsprüfung',passed:false,detail:'Automatischer Quellenüberblick; keine redaktionelle Freigabe.'}],checkedAt:now.toISOString(),sourceHash:await hash(t.sourceText)};topics.push(t);}
 onProgress(source.name+': '+topics.length+' Artikel');
 // Unchanged meetings are a successful reading: their reports are in the database already.
 if(spent&&!issues.some(exhausted))issues.push('Zeitbudget der Quelle erreicht');
 return {topics,marks:held,...(kept?{list:kept}:{}),readMeetings:done,coverage:{regionId:source.id,method:'oparl',from:meetings.length?from:null,to:meetings.length?now.toISOString().slice(0,10):null,importedAt:meetings.length?now.toISOString():null,lastAttemptAt:now.toISOString(),meetings:meetings.length,...(unchanged?{unchangedMeetings:unchanged}:{}),...(filter?{filteredMeetings:skipped.filtered+skipped.mixed,unassignedMeetings:skipped.unassigned,...(skipped.mixed?{mixedMeetings:skipped.mixed}:{})}:{}),...(issues.some(exhausted)?{resumable:true}:{}),sourceCount:1,quiet:meetings.length===0&&issues.length===0,complete:issues.length===0&&(topics.length>0||unchanged>0),issues:[...new Set(issues)],sourceUrl:source.system,body:body.id,listStrategy:strategy}};
}
