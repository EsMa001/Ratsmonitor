'use client';
import {useEffect,useRef,useState} from 'react';
import {ArrowUpRight} from 'lucide-react';
import {Alert,SectionHelp} from '@/components/admin-ui';
import {HELP,QUALITY_EXPLAIN,ZUSTAND} from '@/components/admin-texts';
import {QUALITY_CHECKS,QUALITY_GROUPS,qualitySummary} from '@/shared/quality-checks.mjs';
type Sample={id?:string;regionId?:string;title?:string;date?:string;count?:number;ids?:string[];topicId?:string;committee?:string;regions?:string[];url?:string};
type Result={id:string;count:number;groups?:number;samples:Sample[];checkedAt:string;ms:number;revision:number;stale?:boolean};
type Stored={checks:Record<string,Result>;currentRevision:number};
const n=(v:number)=>v.toLocaleString('de-DE');
const when=(iso:string)=>new Date(iso).toLocaleString('de-DE',{timeZone:'Europe/Berlin',dateStyle:'short',timeStyle:'short'});
const GROUPS=Object.keys(QUALITY_GROUPS) as (keyof typeof QUALITY_GROUPS)[];
async function request<T>(method:'GET'|'POST',body?:unknown):Promise<T>{
 const r=await fetch('/api/admin/quality',{method,cache:method==='GET'?'no-cache':'no-store',...(body?{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
 const d=await r.json() as T&{error?:string};if(!r.ok)throw Error(d.error||'Prüfung nicht erreichbar.');return d;
}
/**
 * Quality page: checks of the stock for duplicates, defects and orphans. The results stay stored on the server; the
 * page shows them at once. A check runs on request in steps of a few seconds over chunks of areas (POST until it is no
 * longer running); "Alle Prüfungen" runs every check in one pass over the stock.
 */
export function AdminQualityCheck({sources=[],disabled=false}:{sources?:{id:string;name:string}[];disabled?:boolean}){
 const [data,setData]=useState<Stored|null>(null),[busy,setBusy]=useState(''),[error,setError]=useState(''),[stopping,setStopping]=useState(false),[progress,setProgress]=useState<{done:number;total:number}|null>(null);
 // Set by "anhalten": no further step is sent; the check keeps its place and continues when it is started again.
 const stopRequested=useRef(false);
 const regionName=(id?:string)=>sources.find(s=>s.id===id)?.name||id||'';
 useEffect(()=>{let gone=false;request<Stored>('GET').then(d=>{if(!gone)setData(d);}).catch(e=>{if(!gone)setError(e instanceof Error?e.message:'Prüfung nicht erreichbar.');});return()=>{gone=true;};},[]);
 type Running={running:true;busy:boolean;done:number;total:number};
 async function drive<T>(check:string):Promise<T|null>{
  let r=await request<T|Running>('POST',{check});
  while((r as Running).running){
   const p=r as Running;setProgress({done:p.done,total:p.total});
   if(stopRequested.current)return null;
   if(p.busy)await new Promise(resolve=>setTimeout(resolve,3000));
   r=await request<T|Running>('POST',{check,continue:true});
  }
  return r as T;
 }
 async function run(ids:string[]){
  setError('');setStopping(false);
  try{
   if(ids.length>1){setBusy('all');const all=await drive<Stored>('all');if(all)setData({checks:all.checks,currentRevision:all.currentRevision});}
   else{const id=ids[0];setBusy(id);const result=await drive<Result>(id);if(result)setData(prev=>({checks:{...(prev?.checks||{}),[id]:result},currentRevision:result.revision}));}
  }
  catch(e){setError(e instanceof Error?e.message:'Prüfung fehlgeschlagen.');}
  finally{setBusy('');setProgress(null);stopRequested.current=false;setStopping(false);}
 }
 const percent=progress&&progress.total?` ${Math.round(100*progress.done/progress.total)} %`:'';
 const checks=data?.checks||{},sum=qualitySummary(checks),latest=Object.values(checks).map(r=>r.checkedAt).sort().at(-1),anyStale=Object.values(checks).some(r=>r.stale);
 return <section id="admin-pruefung" className="admin-section"><div className="admin-section-heading"><h2>{HELP['qualitaet.pruefung']?.title}</h2></div>
  <SectionHelp id="qualitaet.pruefung"/>
  <div className="admin-selection-actions mt-5"><button type="button" className="btn-secondary btn-sm" disabled={!!busy||disabled} onClick={()=>run(QUALITY_CHECKS.map(c=>c.id))}>{busy?'Prüfung läuft …'+percent:sum.checked?'Alle Prüfungen erneut ausführen':'Alle Prüfungen ausführen'}</button>{busy&&<button type="button" className="btn-secondary btn-sm" disabled={stopping} onClick={()=>{stopRequested.current=true;setStopping(true);}}>Anhalten (läuft beim nächsten Start weiter)</button>}</div>
  {sum.checked>0&&<p><strong>{n(sum.duplicates)} Doppelungen</strong> ({n(sum.duplicateGroups)} Vorgänge unter mehreren Gebieten) · <strong>{n(sum.defects)} Defekte</strong> · <strong>{n(sum.orphans)} verwaiste Einträge</strong> · {n(sum.hints)} gleichlautende Punkte als Hinweis{sum.pending.length?` · ${sum.pending.length} von ${QUALITY_CHECKS.length} Prüfungen noch nicht gelaufen`:''}<br/><small className="admin-note">Zuletzt geprüft {latest?when(latest):'–'}{anyStale?' · Bestand seit mindestens einer Prüfung geändert':' · Bestand seither unverändert'}</small></p>}
  {!sum.checked&&data&&<p className="admin-empty">Noch keine Prüfung gelaufen. „Alle Prüfungen ausführen“ liest den Bestand einmal in kurzen Schritten durch; bei einer Million Berichten dauert das einige Minuten, solange diese Seite offen ist.</p>}
  {GROUPS.map(group=><div key={group} className="admin-quality-group"><h3>{QUALITY_GROUPS[group]}</h3><ul className="admin-quality-checks">{QUALITY_CHECKS.filter(c=>c.group===group).map(c=>{const r=checks[c.id];const running=busy===c.id||busy==='all';
   return <li key={c.id} className={r?r.count>0?'is-found':'is-clean':''}><div className="admin-quality-head"><strong>{c.name}</strong><span>{running?'läuft …'+percent:r?<>{n(r.count)}{r.groups!=null&&r.count>0?c.id==='regionUnknown'?` in ${n(r.groups)} Gebieten`:` zu viel in ${n(r.groups)} Gruppen`:''}{r.stale&&<span title={ZUSTAND.pruefungVeraltet}> · veraltet</span>}</>:'nicht geprüft'}</span><button type="button" className="btn-secondary btn-sm" disabled={!!busy||disabled} onClick={()=>run([c.id])}>{r?'Erneut':'Prüfen'}</button></div><small>{QUALITY_EXPLAIN[c.id]??c.explain}{r&&<> · Geprüft {when(r.checkedAt)} in {(r.ms/1000).toFixed(1)} s.</>}</small>
    {r&&r.samples?.length>0&&<details><summary>Beispiele ({n(Math.min(r.samples.length,20))} von {n(r.groups!=null?r.groups:r.count)})</summary><ul className="admin-quality-samples">{r.samples.map((s,i)=><li key={s.id||s.regionId||i}>
     {s.ids?<><strong>{s.count}× „{s.title}“</strong><small>{s.regions?s.regions.map(regionName).join(' · '):regionName(s.regionId)} · {s.date}{s.committee?' · '+s.committee:''}{s.url?' · '+s.url:''}</small><span>{s.ids.map(id=><a key={id} href={'/thema/'+id} target="_blank" rel="noreferrer">{id} <ArrowUpRight size={13}/></a>)}</span></>
     :s.topicId?<><strong>{s.title}</strong><small>Eintrag {s.id}</small></>
     :s.id?<><a href={'/thema/'+s.id} target="_blank" rel="noreferrer">{s.title||s.id} <ArrowUpRight size={13}/></a><small>{regionName(s.regionId)}{s.date?' · '+s.date:''} · {s.id}</small></>
     :<><strong>{s.regionId}</strong><small>{s.title}</small></>}</li>)}</ul></details>}
   </li>;})}</ul></div>)}
  {error&&<Alert>{error}</Alert>}
 </section>;
}
