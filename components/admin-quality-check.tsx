'use client';
import {useEffect,useRef,useState} from 'react';
import {ArrowUpRight,Play} from 'lucide-react';
import {Button} from '@/components/ui/button';
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
 * page shows them at once and runs the checks one after another on request, every result as soon as it arrives.
 */
export function AdminQualityCheck({sources=[],disabled=false}:{sources?:{id:string;name:string}[];disabled?:boolean}){
 const [data,setData]=useState<Stored|null>(null),[busy,setBusy]=useState(''),[error,setError]=useState(''),[stopping,setStopping]=useState(false);
 // Set by "anhalten": the running check finishes and is stored, no further check is started.
 const stopRequested=useRef(false);
 const regionName=(id?:string)=>sources.find(s=>s.id===id)?.name||id||'';
 useEffect(()=>{let gone=false;request<Stored>('GET').then(d=>{if(!gone)setData(d);}).catch(e=>{if(!gone)setError(e instanceof Error?e.message:'Prüfung nicht erreichbar.');});return()=>{gone=true;};},[]);
 async function run(ids:string[]){
  setError('');setStopping(false);
  try{for(const id of ids){setBusy(id);const result=await request<Result>('POST',{check:id});setData(prev=>({checks:{...(prev?.checks||{}),[id]:result},currentRevision:result.revision}));if(stopRequested.current)break;}}
  catch(e){setError(e instanceof Error?e.message:'Prüfung fehlgeschlagen.');}
  finally{setBusy('');stopRequested.current=false;setStopping(false);}
 }
 const checks=data?.checks||{},sum=qualitySummary(checks),latest=Object.values(checks).map(r=>r.checkedAt).sort().at(-1),anyStale=Object.values(checks).some(r=>r.stale);
 return <section id="admin-pruefung" className="admin-section"><p className="eyebrow">DUPLIKATE & DEFEKTE</p><h2>Ist der Bestand in sich stimmig?</h2>
  <p>Vierzehn Prüfungen lesen den gespeicherten Bestand: Doppelungen (derselbe Vorgang unter mehreren Gebieten), unvollständige oder widersprüchliche Berichte, Einträge ohne Ziel und als Hinweis gleichlautende Punkte derselben Sitzung. Jede Prüfung ist eine eigene Anfrage, ihr Ergebnis bleibt gespeichert. Nichts wird verändert oder zusammengeführt; die Beispiele führen zum Bericht.</p>
  <div className="admin-selection-actions"><Button variant="outline" disabled={!!busy||disabled} onClick={()=>run(QUALITY_CHECKS.map(c=>c.id))}><Play size={15}/> {busy?'Prüfung läuft …':sum.checked?'Alle Prüfungen erneut ausführen':'Alle Prüfungen ausführen'}</Button>{busy&&<Button variant="outline" disabled={stopping} onClick={()=>{stopRequested.current=true;setStopping(true);}}>Nach der laufenden Prüfung anhalten</Button>}</div>
  {sum.checked>0&&<p><strong>{n(sum.duplicates)} Doppelungen</strong> ({n(sum.duplicateGroups)} Vorgänge unter mehreren Gebieten) · <strong>{n(sum.defects)} Defekte</strong> · <strong>{n(sum.orphans)} verwaiste Einträge</strong> · {n(sum.hints)} gleichlautende Punkte als Hinweis{sum.pending.length?` · ${sum.pending.length} von ${QUALITY_CHECKS.length} Prüfungen noch nicht gelaufen`:''}<br/><small className="admin-note">Zuletzt geprüft {latest?when(latest):'–'}{anyStale?' · Bestand seit mindestens einer Prüfung geändert':' · Bestand seither unverändert'}</small></p>}
  {!sum.checked&&data&&<p className="admin-empty">Noch keine Prüfung gelaufen. „Alle Prüfungen ausführen“ liest den Bestand einmal durch; bei einer Million Berichten dauert jede Prüfung einige Sekunden bis eine Minute.</p>}
  {GROUPS.map(group=><div key={group} className="admin-quality-group"><h3>{QUALITY_GROUPS[group]}</h3><ul className="admin-quality-checks">{QUALITY_CHECKS.filter(c=>c.group===group).map(c=>{const r=checks[c.id];const running=busy===c.id;
   return <li key={c.id} className={r?r.count>0?'is-found':'is-clean':''}><div className="admin-quality-head"><strong>{c.name}</strong><span>{running?'läuft …':r?<>{n(r.count)}{r.groups!=null&&r.count>0?c.id==='regionUnknown'?` in ${n(r.groups)} Gebieten`:` zu viel in ${n(r.groups)} Gruppen`:''}{r.stale?' · veraltet':''}</>:'nicht geprüft'}</span><button type="button" className="admin-timeline-retry" disabled={!!busy||disabled} onClick={()=>run([c.id])}>{r?'Erneut':'Prüfen'}</button></div><small>{c.explain}{r&&<> · Geprüft {when(r.checkedAt)} in {(r.ms/1000).toFixed(1)} s.</>}</small>
    {r&&r.samples?.length>0&&<details><summary>Beispiele ({n(Math.min(r.samples.length,20))} von {n(r.groups!=null?r.groups:r.count)})</summary><ul className="admin-quality-samples">{r.samples.map((s,i)=><li key={s.id||s.regionId||i}>
     {s.ids?<><strong>{s.count}× „{s.title}“</strong><small>{s.regions?s.regions.map(regionName).join(' · '):regionName(s.regionId)} · {s.date}{s.committee?' · '+s.committee:''}{s.url?' · '+s.url:''}</small><span>{s.ids.map(id=><a key={id} href={'/thema/'+id} target="_blank" rel="noreferrer">{id} <ArrowUpRight size={13}/></a>)}</span></>
     :s.topicId?<><strong>{s.title}</strong><small>Eintrag {s.id}</small></>
     :s.id?<><a href={'/thema/'+s.id} target="_blank" rel="noreferrer">{s.title||s.id} <ArrowUpRight size={13}/></a><small>{regionName(s.regionId)}{s.date?' · '+s.date:''} · {s.id}</small></>
     :<><strong>{s.regionId}</strong><small>{s.title}</small></>}</li>)}</ul></details>}
   </li>;})}</ul></div>)}
  {error&&<p role="alert" className="admin-error">{error}</p>}
 </section>;
}
