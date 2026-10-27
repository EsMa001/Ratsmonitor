// Ausweichquelle eines Gebiets (Katalogfeld `fallback`, seit 26.10.2026): Wartet die Servergruppe seines
// Ratsinformationssystems, weil sie nicht erreicht wurde (source_hosts, work-failures.mjs), liest der Abruf stattdessen die
// Bekanntmachungen bzw. das Amtsblatt auf der Website der Kommune (Leser „website“). Die Website ist eine eigene Veröffentlichung
// auf einem anderen Rechner; keine Seite des gesperrten Systems wird gelesen. Antwortet das System wieder, gilt es von selbst.
// Doppelte Sitzungen: Die Ausweichquelle übernimmt nur Sitzungen ab dem Tag des letzten erfolgreichen Abrufs des Systems und
// keinen Sitzungstag, den das System schon hat; das System übernimmt danach keinen neuen Bericht an einem Sitzungstag, den die
// Ausweichquelle hat. Ein Sitzungstag gehört der Quelle, die ihn zuerst hatte (gelöscht wird nichts).
import {NRW_SOURCES} from './source-catalog.mjs';
import {serverOf} from './source-servers.mjs';
import {HISTORY_WINDOWS,historyWindow,windowStart} from './history-window.mjs';
import {hostRow,hostWaiting} from './work-failures.mjs';

const catalog=new Map(NRW_SOURCES.map(s=>[s.id,s]));
const day=v=>String(v||'').slice(0,10);
/** Quelle, mit der die Ausweichquelle gelesen wird, oder null. */
export function fallbackOf(source){
 const f=source?.fallback;
 if(!f||typeof f.base!=='string'||!Array.isArray(f.pages)||!f.pages.length)return null;
 return {...f,id:source.id,name:source.name,kind:source.kind,method:'scraper',adapter:f.adapter||'website'};
}
export const fallbackFor=id=>fallbackOf(catalog.get(id));
/** Servergruppe des Ratsinformationssystems (wie provider() in pipeline-jobs.mjs) und der Ausweichquelle. */
export const primaryServer=source=>source?serverOf(source.system||source.base)||null:null;
/**
 * Servergruppe der Website. Liegt sie in der Gruppe des Systems (ein selbst betriebenes System unter der Domain der Kommune,
 * Wolfsburg, Bielefeld, Fellbach, 27.10.2026), zählt die Website für die Wartestufe als eigener Server `host:<Rechnername>`:
 * sonst wartete sie mit dem System und die Ausweichquelle würde nie aktiv. Der Abstand je Anfrage (request-budget.mjs,
 * serverOf) bleibt der der Gruppe, der Betreiber bekommt nicht mehr Anfragen.
 */
export const fallbackServer=source=>{
 const f=fallbackOf(source);if(!f)return null;
 const group=serverOf(f.base);
 if(group&&group===primaryServer(source)){try{return 'host:'+new URL(f.base).hostname;}catch{return group;}}
 return group;
};
/** Das System gilt als ausgefallen, wenn es so lange keinen Erfolg hatte; so oft wird es dann selbst wieder gefragt. */
export const STALE_MS=7*864e5,PROBE_MS=7*864e5;
/**
 * Liest dieser Abruf die Ausweichquelle? Ja, wenn das Gebiet eine hat, die Website nicht wartet und das System entweder
 * wartet (seine Servergruppe, source_hosts) oder seit STALE_MS keinen Erfolg hatte (coverage.lastSuccessAt; auch ein
 * System, dessen Leser Netzfehler nur als Hinweis meldet, oder ein selbst betriebenes, das die Servergruppe nie wartend
 * sieht). Im zweiten Fall wird das System alle PROBE_MS selbst gefragt: ohne vermerkten Versuch (coverage.fallback.probedAt,
 * fallbackState) oder mit einem älteren gilt das System, liefert es nicht, vermerkt der Abruf den Versuch und die Website
 * ist wieder dran. hosts: Map host → Zeile (hostStates) oder eine Funktion host → Zeile; coverage: der Quellenstand.
 */
export function fallbackActive(source,hosts,now=Date.now(),coverage=null){
 if(!fallbackOf(source))return false;
 const row=h=>typeof hosts==='function'?hosts(h):hosts?.get?.(h);
 if(hostWaiting(row(fallbackServer(source)),now))return false;
 if(hostWaiting(row(primaryServer(source)),now))return true;
 if(!coverage)return false;
 const ok=Date.parse(coverage.lastSuccessAt||'');
 if(ok&&now-ok<STALE_MS)return false;
 const probed=Date.parse(coverage.fallback?.probedAt||'');
 return Boolean(probed)&&now-probed<PROBE_MS;
}
/**
 * Plan eines Abrufs mit Ausweichquelle oder null. since: erster Tag der Ausweichzeit (bleibt, solange sie läuft; sonst der Tag
 * des letzten erfolgreichen Abrufs). window: der angefragte Zeitraum, beim ersten Abruf so weit, dass er since erreicht, danach
 * bis zum letzten Abruf der Ausweichquelle zurück (höchstens 12 Monate).
 * @param {any} source @param {{hosts?:any,coverage?:Record<string,any>,window?:string,now?:Date}} [options]
 */
export function fallbackPlan(source,{hosts,coverage={},window,now=new Date()}={}){
 if(!fallbackActive(source,hosts,now.getTime(),coverage))return null;
 const state=coverage.fallback?.active?coverage.fallback:null;
 // Ohne je einen Erfolg des Systems (nie geliefert) beginnt die Ausweichzeit 12 Monate zurück, wie ein erster Abruf.
 const since=state?.since||day(coverage.lastSuccessAt||windowStart(now,'12m').toISOString());
 const reach=state?.lastRunAt?day(new Date(Date.parse(state.lastRunAt)-864e5).toISOString()):since;
 const from=reach>since?reach:since,keys=Object.keys(HISTORY_WINDOWS),start=Math.max(0,keys.indexOf(historyWindow(window)));
 const fit=keys.slice(start,keys.indexOf('12m')+1).find(k=>day(windowStart(now,k).toISOString())<=from)||'12m';
 return {since,window:fit,server:fallbackServer(source),primary:primaryServer(source)};
}
/**
 * Wie fallbackPlan, mit den Serverstufen aus der Datenbank (für runSync).
 * @param {any} db @param {string} region @param {{coverage?:Record<string,any>,window?:string,now?:Date}} [options]
 */
export async function planFallback(db,region,{coverage={},window,now=new Date()}={}){
 const source=catalog.get(region);
 if(!fallbackOf(source))return null;
 const rows=new Map();
 for(const host of [primaryServer(source),fallbackServer(source)])if(host)rows.set(host,await hostRow(db,host));
 return fallbackPlan(source,{hosts:rows,coverage,window,now});
}
/** Alle Sitzungstage eines Berichts (Datum und Termine). */
export const meetingDays=t=>[day(t.eventDate),...(t.events||[]).map(e=>day(e.date))].filter(Boolean);
const daysOf=(topics,pick)=>{const out=new Set();for(const t of topics)if(pick(t))for(const d of meetingDays(t))out.add(d);return out;};
/**
 * Neue Berichte der Ausweichquelle ohne Sitzungen vor since und ohne Sitzungstage, die das System schon hat. Berichte, die schon
 * gespeichert sind, bleiben (Aktualisierung). Alle tragen viaFallback.
 */
export function keepFallbackTopics(fresh,old,since){
 const stored=old instanceof Map?old:new Map(old.map(t=>[t.id,t])),primary=daysOf(stored.values(),t=>!t.viaFallback);
 return fresh.filter(t=>stored.has(t.id)||day(t.eventDate)>=since&&!primary.has(day(t.eventDate))).map(t=>({...t,viaFallback:true}));
}
/** Neue Berichte des Systems ohne die Sitzungstage, die die Ausweichquelle schon hat (nach dem Ende einer Ausweichzeit). */
export function keepPrimaryTopics(fresh,old){
 const stored=old instanceof Map?old:new Map(old.map(t=>[t.id,t])),taken=daysOf(stored.values(),t=>t.viaFallback);
 if(!taken.size)return fresh;
 return fresh.filter(t=>stored.has(t.id)||!taken.has(day(t.eventDate)));
}
/**
 * Stand der Ausweichzeit im Quellenstand: aktiv mit Plan, beendet nach einem Abruf, bei dem das System wieder geliefert hat
 * (reached). Ein Abruf beim System ohne Erfolg (gescheiterte Stichprobe, Netzfehler, nichts gelesen) beendet nichts und
 * wird als probedAt vermerkt: so weiß fallbackActive, dass das System gefragt wurde (STALE_MS, PROBE_MS).
 */
export function fallbackState(previous,plan,at,reached=true){
 if(!plan&&!reached)return {...(previous||{}),probedAt:at};
 if(plan)return {active:true,since:plan.since,server:plan.server,primary:plan.primary,lastRunAt:at,...(previous?.probedAt?{probedAt:previous.probedAt}:{}),...(previous?.active&&previous.startedAt?{startedAt:previous.startedAt}:{startedAt:at})};
 if(!previous)return undefined;
 const {probedAt,...rest}=previous;
 return {...rest,active:false,...(previous.active?{endedAt:at}:{})};
}
