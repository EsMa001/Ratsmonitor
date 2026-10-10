import {compactOparl,sourceDecision,publicParticipants} from './source-fields.mjs';
import {windowStart} from './history-window.mjs';
import {budgeted} from './request-budget.mjs';
import {fetchNoRedirect,SOURCE_USER_AGENT} from './no-redirect.mjs';
import {bodyJson} from './body-bytes.mjs';
// Public OParl 1.1 only. No HTML scraper or alternative RIS data path.
export const OPARL='https://oparl.stadt-muenster.de/system';
export const BODY='https://oparl.stadt-muenster.de/bodies/0001';
export const RIS='https://www.stadt-muenster.de/sessionnet/sessionnetbi/';
export function checkedUrl(value){const u=new URL(value);if(u.protocol!=='https:'||u.hostname!=='oparl.stadt-muenster.de'||u.username||u.password)throw Error('Unzulässige OParl-Adresse');return u.href}
// A lost or reset connection gets one more attempt. An HTTP status, a redirect or a timeout is an answer of its own
// and is not repeated.
export async function requestJson(url,timeoutMs=55000){
 for(let attempt=0;;attempt++){
  try{const r=await fetchNoRedirect(checkedUrl(url),{signal:AbortSignal.timeout(timeoutMs),headers:{Accept:'application/json','User-Agent':SOURCE_USER_AGENT}});if(!r.ok){await r.body?.cancel();throw Object.assign(Error('OParl HTTP '+r.status),{answered:true});}return await bodyJson(r,8e6,{message:'Antwort überschreitet Größenlimit'});}
  catch(e){if(attempt>=1||e.answered||e.name==='TimeoutError'||/Weiterleitung|Nicht freigegeben|Fremde/.test(String(e.message)))throw e;await new Promise(done=>setTimeout(done,400));}
 }
}
// The source refuses the record itself (HTTP 401 or 403): it exists but is not public.
const notPublic=e=>/HTTP (401|403)\b/.exec(String(e?.message))?.[1]||null;
export async function readList(url,get=requestJson){let next=url,out=[],seen=new Set();while(next){next=checkedUrl(next.replace(/\+/g,'%2B'));if(seen.has(next))throw Error('Wiederholte OParl-Listenseite');seen.add(next);if(seen.size>100)throw Error('OParl-Seitenlimit erreicht');const j=await get(next);if(!Array.isArray(j.data))throw Error('Ungültige OParl-Liste');out.push(...j.data);next=j.links?.next;}return out}
export async function parallel(items,fn,n=3){const result=new Array(items.length);let i=0;await Promise.all(Array.from({length:Math.min(n,items.length)},async()=>{while(i<items.length){const at=i++;result[at]=await fn(items[at],at)}}));return result}
export const clean=s=>String(s||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
export function category(s){if(/sport|theater|kultur|künste/i.test(s))return 'Kultur & Freizeit';if(/gesundheit|pflege|sozial/i.test(s))return 'Gesundheit & Soziales';if(/radverkehr|radweg|verkehr|mobilität|bus|bahn|parkplatz|parken|straße|strasse/i.test(s))return 'Mobilität';if(/schule|kita|kind|jugend|bildung/i.test(s))return 'Bildung & Familie';if(/klima|energie|wärme|umwelt|natur|\bbaum\b|bäume|solar|grün|recycling/i.test(s))return 'Klima & Umwelt';if(/wohnung|wohnen|bau|quartier|stadtentwicklung/i.test(s))return 'Bauen & Wohnen';if(/kultur|theater|museum|sport|bibliothek|künste|kunst/i.test(s))return 'Kultur & Freizeit';if(/haushalt|finanz|gebühr|steuer|wirtschaft/i.test(s))return 'Finanzen & Wirtschaft';return 'Stadtleben'}
export function statusOf(item,consultation,meeting,now=new Date()){
 const result=clean(item?.result); if(new Date(meeting.start)>now)return item?.consultation?'consulting':'announced';
 if(/zurückgestellt|vertagt|abgesetzt/i.test(result))return 'postponed';
 if(/abgelehnt|nicht zugestimmt/i.test(result))return consultation?.authoritative===true||/entscheidung|beschlussfassung/i.test(consultation?.role||'')?'rejected':'recommended';
 if(/kenntnis/i.test(result))return 'info';
 if(/beschlossen|zugestimmt|angenommen/i.test(result)){
  if(consultation?.authoritative===true||/entscheidung|beschlussfassung/i.test(consultation?.role||''))return 'approved';
  return 'recommended';
 }
 if(/empfohlen/i.test(result))return 'recommended';
 return item?.consultation?'consulting':'announced';
}
export async function hash(s){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))].map(x=>x.toString(16).padStart(2,'0')).join('')}
export async function qualityCheck(t){const checks=[{name:'Originalquelle',passed:t.sourceUrl.startsWith(BODY+'/'),detail:'Offizielle Münsteraner OParl-ID.'},{name:'Verfahrensstand',passed:!['approved','rejected','recommended','info','postponed'].includes(t.status)||t.events.some(e=>e.status===t.status&&e.result),detail:'Ergebnisse werden nur aus dem result-Feld einer öffentlichen Beratung übernommen.'},{name:'Kurze Ansicht',passed:t.shortSummary.split(/\s+/).length<=60,detail:'Höchstens 60 Wörter, Zielwert etwa 45 Wörter.'},{name:'Öffentlichkeit',passed:t.public===true,detail:'Nur öffentliche Tagesordnungspunkte oder öffentlich über OParl ausgegebene Vorlagen.'}];return {passed:checks.every(c=>c.passed),checks,checkedAt:new Date().toISOString(),sourceHash:await hash(t.sourceText+'\n'+JSON.stringify(t.events))}}
export function sourceSummary(t){const state={approved:'Ein Beschluss ist dokumentiert.',recommended:'Ein Gremium hat zugestimmt; die abschließende Entscheidung ist noch nicht belegt.',rejected:'Eine Ablehnung ist dokumentiert.',info:'Die Information wurde zur Kenntnis genommen.',postponed:'Die Behandlung wurde verschoben.',consulting:'Eine Vorlage steht zur Beratung.',announced:'Das Thema ist angekündigt.',unknown:'Der Stand ist noch offen.'}[t.status];const words=t.officialTitle.split(/\s+/);const title=words.length>24?words.slice(0,24).join(' ')+' …':t.officialTitle;return {shortSummary:`${title.replace(/[.!?]$/,'')}. ${state} Die Details stehen in den verlinkten Originalunterlagen.`,longSummary:[`Das Thema „${t.officialTitle}“ wird in Münster behandelt. ${state}`,`Zuständig ist in der zuletzt erfassten Beratung: ${t.committee}. ${t.reference?'Die Vorlage trägt das Aktenzeichen '+t.reference+'.':''}`],generatedBy:'Automatischer Quellenüberblick'}}
export function fileDocs(files){return (files||[]).filter(f=>f&&!f.deleted&&f.accessUrl).map(f=>({title:clean(f.name||f.fileName||'Originaldokument'),url:checkedUrl(f.accessUrl),kind:f.mimeType||'document'}))}
export async function collectOparl({now=new Date(),getJson=requestJson,maxDurationMs=300000,onProgress=()=>{},window:lookback}={}){
 const fetchJson=budgeted(getJson,maxDurationMs),cache=new Map();getJson=url=>{if(!cache.has(url))cache.set(url,fetchJson(url));return cache.get(url);};
 const from=windowStart(now,lookback);const fromDay=from.toISOString().slice(0,10);const since=new Date(from);since.setUTCDate(since.getUTCDate()-45);const query='?limit=1000&modified_since='+encodeURIComponent(since.toISOString());const issues=[],warnings=[];
 const system=await getJson(OPARL);const bodies=await readList(system.body,getJson);const body=bodies.find(b=>b.id===BODY);if(!body)throw Error('Stadt Münster fehlt in der OParl-Schnittstelle');
 const [meetingsRaw,papersRaw,organizations]=await Promise.all([readList(body.meeting+query,getJson),readList(body.paper+query,getJson),readList(body.organization+'?limit=1000&omit_internal=true',getJson)]);
 const meetings=meetingsRaw.filter(m=>!m.deleted&&m.start&&m.start.slice(0,10)>=fromDay);
 const orgs=new Map(organizations.filter(o=>!o.deleted).map(o=>[o.id,clean(o.name)]));const papers=new Map(papersRaw.filter(p=>!p.deleted).map(p=>[p.id,p]));const consultations=new Map();for(const p of papers.values())for(const c of p.consultation||[])if(!c.deleted)consultations.set(c.id,c);
 const items=meetings.flatMap(m=>(m.agendaItem||[]).filter(a=>a.public===true&&!a.deleted).map(a=>({a,m})));
 const missing=[...new Set(items.map(x=>x.a.consultation).filter(id=>id&&!consultations.has(id)))];onProgress(`OParl: ${meetings.length} Sitzungen, ${items.length} öffentliche Tagesordnungspunkte, ${missing.length} zusätzliche Beratungsverknüpfungen.`);
 await parallel(missing,async id=>{try{const c=await getJson(id);if(!c.deleted)consultations.set(id,c)}catch(e){if(notPublic(e))warnings.push(`Beratungsverknüpfung nicht öffentlich (HTTP ${notPublic(e)}): ${id}`);else issues.push('Beratungsverknüpfung nicht erreichbar: '+id)}});
 const missingPapers=[...new Set([...consultations.values()].map(c=>c.paper).filter(id=>id&&!papers.has(id)))];await parallel(missingPapers,async id=>{try{const p=await getJson(id);if(!p.deleted)papers.set(id,p)}catch(e){if(notPublic(e))warnings.push(`Vorlage nicht öffentlich (HTTP ${notPublic(e)}): ${id}`);else issues.push('Vorlage nicht erreichbar: '+id)}});
 const attendances=new Map();await parallel(meetings,async m=>attendances.set(m.id,await publicParticipants(m,getJson,now.toISOString())));
 const grouped=new Map();for(const {a,m} of items){const c=consultations.get(a.consultation),p=c&&papers.get(c.paper);const key=p?.id||a.id;if(!grouped.has(key))grouped.set(key,{paper:p,items:[]});grouped.get(key).items.push({a,m,c})}
 // Publish new public papers even before they have a meeting in the current period.
 for(const p of papers.values())if(!grouped.has(p.id)&&(p.created||p.date||'').slice(0,10)>=fromDay)grouped.set(p.id,{paper:p,items:[]});
 const topics=await parallel([...grouped.entries()],async([key,g])=>{
 const events=g.items.map(({a,m,c})=>({date:m.start.slice(0,10),committee:(m.organization||[]).map(id=>orgs.get(id)||'Gremium').join(', '),status:statusOf(a,c,m,now),description:clean(a.result)||(m.start.slice(0,10)>now.toISOString().slice(0,10)?'Beratung ist angekündigt.':'Die Schnittstelle enthält hierzu noch kein Ergebnis.'),result:clean(a.result),url:m.id,created:a.created,modified:a.modified,attendance:attendances.get(m.id)})).sort((a,b)=>a.date.localeCompare(b.date));
 for(const event of events)event.decision=sourceDecision(event);
 const last=events.filter(e=>['approved','rejected'].includes(e.status)).at(-1)||events.at(-1),p=g.paper;const officialTitle=clean(p?.name||g.items[0]?.a.name||'Öffentlicher Vorgang');const id=key.slice(BODY.length+1).replace(/\//g,'-');
 const docs=[...fileDocs(p?.mainFile?[p.mainFile]:[]),...fileDocs(p?.auxiliaryFile),...g.items.flatMap(({a,m})=>[...fileDocs(a.resolutionFile?[a.resolutionFile]:[]),...fileDocs(a.auxiliaryFile),...fileDocs(m.resultsProtocol?[m.resultsProtocol]:[]),...fileDocs(m.verbatimProtocol?[m.verbatimProtocol]:[]),...fileDocs(m.auxiliaryFile),...fileDocs(m.invitation?[m.invitation]:[])]),{title:'Vollständiger OParl-Datensatz',url:key,kind:'oparl'}];
 const sourceData={version:'public-source-fields-v1',method:'oparl',fetchedAt:now.toISOString(),records:[compactOparl(p,'paper'),...g.items.flatMap(({a,m,c})=>[compactOparl(a,'agenda'),compactOparl(c,'consultation'),compactOparl(m,'meeting')])].filter(Boolean)};
 const t={id,sourceData,public:true,source:'city',title:officialTitle,officialTitle,status:last?.status||'consulting',category:category(officialTitle),committee:last?.committee||'Noch keiner Sitzung zugeordnet',eventDate:last?.date||p?.date||(p?.created||now.toISOString()).slice(0,10),updatedAt:[p?.modified,...g.items.map(x=>x.a.modified)].filter(Boolean).sort().at(-1)||now.toISOString(),metadata:{sourceModifiedAt:[p?.modified,...g.items.map(x=>x.a.modified)].filter(Boolean).sort().at(-1)||null},reference:p?.reference||'',documents:[...new Map(docs.map(d=>[d.url,d])).values()],events,relevanceReason:'Öffentlicher Vorgang der Stadt Münster.',sourceUrl:key,identityLinks:[key,...g.items.map(x=>x.a.id)],sourceText:officialTitle+'\n'+(p?.paperType||'')+'\n'+events.map(e=>`${e.date} ${e.committee}: ${e.description}`).join('\n'),paperType:p?.paperType||'',documentText:'',generatedBy:''};Object.assign(t,sourceSummary(t));t.quality=await qualityCheck(t);return t;
 });
 topics.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));return {topics,coverage:{from:fromDay,to:now.toISOString().slice(0,10),importedAt:now.toISOString(),meetings:meetings.length,sourceCount:1,quiet:meetings.length===0&&issues.length===0,complete:issues.length===0,issues,...(warnings.length?{warnings}:{})}};
}
