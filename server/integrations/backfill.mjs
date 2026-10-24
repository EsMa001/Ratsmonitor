/**
 * Lückenabruf (23.10.2026): jede Nacht nach dem Abruf des letzten Tages bekommt ein kleiner Teil der Gebiete einen Abruf über
 * BACKFILL.window (12 Monate), reihum, bis alle einmal dran waren; dann beginnt die nächste Runde. So füllen sich Lücken des
 * Erstabrufs und solche, die später entstehen (ein Server hing eine Woche, ein Leser wurde repariert), ohne Lastspitze und ohne
 * Knopfdruck. Schon vollständig gelesene Sitzungen überspringt der Abruf ohnehin (meeting-marks.mjs).
 *
 * Grenzen je Nacht: höchstens `areas` Gebiete, je Anbieter höchstens `perProvider`, und je Anbieter höchstens `requestCap`
 * Anfragen des ganzen Prozesses (der Abruf des letzten Tages zählt mit; request-budget.mjs pacedFetch zählt). Anbieter, die
 * warten oder hochfahren, und Gebiete mit eigenem Termin im Fehlerspeicher lässt die Nacht aus (deferredRegions); sie bleiben
 * in der Runde. Reihenfolge einer Runde: Gebiete im Teilstand zuerst (seit 24.10.2026), darin wie im Rest Gebiete mit wenigen
 * Berichten je Einwohner zuerst (dort sind die Lücken).
 *
 * Stand in system_state BACKFILL_KEY: {round, startedAt, total, remaining:[Gebiete], last:{at, picked, done, kept, failed, minutes}}.
 */
import {provider,selectedRegions} from './pipeline-jobs.mjs';
import {deferredRegions,runDirect} from './pipeline-worker.mjs';
import {POPULATION} from '../../shared/catalog.mjs';
import {rampRank} from './work-failures.mjs';

export const BACKFILL_KEY='backfill-round';
export const BACKFILL=Object.freeze({areas:300,perProvider:25,requestCap:3000,window:'12m'});

const readState=async db=>{const r=await db.prepare('SELECT value FROM system_state WHERE key=?').bind(BACKFILL_KEY).first();try{return r?JSON.parse(r.value):null;}catch{return null;}};
const saveState=(db,state)=>db.prepare('INSERT INTO system_state(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(BACKFILL_KEY,JSON.stringify(state)).run();
const people=id=>{const p=POPULATION instanceof Map?POPULATION.get(id):POPULATION[id];return Number(typeof p==='object'?p?.population:p)||0;};

/** Reihenfolge einer Runde: Berichte je 1.000 Einwohner aufsteigend (ohne Zahl: zuerst), gleiche in fester Streuung (rampRank) */
export function roundOrder(ids,counts){
 const density=id=>{const n=counts.get(id);if(!n)return -1;const p=people(id);return p>0?n/p*1000:n;};
 return [...ids].sort((a,b)=>density(a)-density(b)||rampRank(a)-rampRank(b)||a.localeCompare(b));
}
async function reportCounts(db){
 try{const {results}=await db.prepare("SELECT region_id,json_extract(stats,'$.count') AS n FROM region_stats").all();return new Map((results||[]).map(r=>[r.region_id,Number(r.n)||0]));}
 catch{return new Map();}
}
/**
 * Gebiete im Teilstand (24.10.2026): Bestand vorhanden, aber der gespeicherte Zeitraum wurde nie vollständig gelesen
 * (source_coverage.complete false, letzter Abruf nicht gescheitert). Ein voller Abruf über 12 Monate macht ihn vollständig.
 */
async function partialRegions(db){
 try{const {results}=await db.prepare("SELECT region_id FROM source_coverage WHERE json_extract(payload,'$.complete')=0 AND coalesce(json_extract(payload,'$.attemptStatus'),'')<>'failed' AND coalesce(json_extract(payload,'$.importedAt'),'')<>''").all();return new Set((results||[]).map(r=>r.region_id));}
 catch{return new Set();}
}
/** Gebiete im Teilstand zuerst, sonst die Reihenfolge der Runde (stabil) */
export function partialFirst(remaining,partial){return [...remaining.filter(id=>partial.has(id)),...remaining.filter(id=>!partial.has(id))];}
/** Die laufende Runde, oder eine neue (carry: Gebiete der alten Runde, die nie dran waren, kommen zuerst); Teilstand jeweils vorn */
export async function currentRound(db,{now=Date.now(),ids=selectedRegions('sources')}={}){
 const state=await readState(db),known=new Set(ids);
 if(state?.remaining?.length){state.remaining=state.remaining.filter(id=>known.has(id));if(state.remaining.length){state.remaining=partialFirst(state.remaining,await partialRegions(db));return state;}}
 const fresh=await newRound(db,{now,ids,carry:[],previous:state});
 fresh.remaining=partialFirst(fresh.remaining,await partialRegions(db));return fresh;
}
async function newRound(db,{now,ids,carry,previous}){
 const rest=roundOrder(ids.filter(id=>!carry.includes(id)),await reportCounts(db));
 const state={round:(previous?.round||0)+1,startedAt:new Date(now).toISOString(),total:ids.length,remaining:[...carry,...rest],last:previous?.last||null};
 await saveState(db,state);return state;
}
/**
 * Gebiete für heute Nacht: der Reihe nach, ohne zurückgestellte, je Anbieter höchstens perProvider. Findet sich keins, obwohl
 * die Runde noch Gebiete hat (nur wartende Anbieter übrig), beginnt die nächste Runde mit diesen vorn.
 */
export async function pickTonight(db,{now=Date.now(),areas=BACKFILL.areas,perProvider=BACKFILL.perProvider,ids=selectedRegions('sources')}={}){
 let state=await currentRound(db,{now,ids});
 const choose=async list=>{
  const deferred=await deferredRegions(db,list,now),per=new Map(),out=[];
  for(const id of list){if(out.length>=areas)break;if(deferred[id])continue;const p=provider(id);if((per.get(p)||0)>=perProvider)continue;per.set(p,(per.get(p)||0)+1);out.push(id);}
  return out;
 };
 let picked=await choose(state.remaining);
 if(!picked.length&&state.remaining.length&&state.remaining.length<state.total){state=await newRound(db,{now,ids,carry:state.remaining,previous:state});picked=await choose(state.remaining);}
 return {state,picked};
}
/**
 * Lückenabruf einer Nacht. run: die Importfunktion (importRunner); counts: Map Servergruppe → Anfragen dieses Prozesses
 * (pacedFetch.counts), für requestCap. Erledigt sind Gebiete, deren Abruf zu Ende kam (gelungen oder gescheitert: der Fehlerspeicher
 * übernimmt); in der Runde bleiben die wegen der Grenze ausgelassenen und die, deren Abruf an der Zeitgrenze fortsetzbar endete.
 */
export async function backfillNight(db,run,{now=Date.now(),areas=BACKFILL.areas,perProvider=BACKFILL.perProvider,requestCap=BACKFILL.requestCap,window=BACKFILL.window,lanes=8,counts=new Map(),stop=()=>false,ids}={}){
 const started=Date.now(),{state,picked}=await pickTonight(db,{now,areas,perProvider,...(ids?{ids}:{})});
 const allow=region=>(counts.get(provider(region))||0)<requestCap;
 const out=picked.length?await runDirect(db,run,picked,{window,lanes,origin:'backlog',stop,allow}):[];
 const ran=new Map(out.map(r=>[r.region,r]));
 const kept=picked.filter(id=>{const r=ran.get(id);return !r||r.skipped||r.resume;});
 const done=picked.filter(id=>!kept.includes(id));
 const fresh=await readState(db)||state;
 fresh.remaining=(fresh.remaining||[]).filter(id=>!done.includes(id));
 fresh.last={at:new Date(started).toISOString(),round:fresh.round,picked:picked.length,done:done.length,kept:kept.length,
  failed:out.filter(r=>!r.skipped&&!(r.status===200&&!r.refused)).length,minutes:Math.round((Date.now()-started)/6000)/10};
 await saveState(db,fresh);
 return {...fresh.last,remaining:fresh.remaining.length,total:fresh.total};
}
/** Für die Anzeige: Runde, Fortschritt und letzte Nacht, ohne die Liste der Gebiete */
export async function backfillView(db){
 const s=await readState(db);
 return s?{round:s.round,startedAt:s.startedAt,total:s.total,remaining:s.remaining?.length||0,last:s.last||null}:null;
}
