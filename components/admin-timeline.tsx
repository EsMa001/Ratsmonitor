'use client';
import {useEffect,useMemo,useState} from 'react';
import {ADMIN_REGIONS_DONE} from '@/components/admin-store';
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from '@/components/ui/select';
import {mergeAreas,rangeStart,timelineSeries,timelineStats,TIMELINE_BUCKETS,TIMELINE_RANGES,TIMELINE_BASES} from '@/shared/timeline.mjs';
type Dataset={basis:string;asOf:string;today:string;total:number;days:string[];areas:Record<string,[number,number][]>;undated:Record<string,number>};
type Point={start:string;count:number;total:number};
const n=(v:number,digits=0)=>v.toLocaleString('de-DE',{maximumFractionDigits:digits,minimumFractionDigits:digits});
const day=(s:string)=>new Date(s+'T12:00:00Z').toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'UTC'});
const bucketLabel=(start:string,bucket:string)=>bucket==='month'?new Date(start+'T12:00:00Z').toLocaleDateString('de-DE',{month:'long',year:'numeric',timeZone:'UTC'}):bucket==='week'?'Woche ab '+day(start):day(start);
function Choice({label,value,onChange,items}:{label:string;value:string;onChange:(s:string)=>void;items:[string,string][]}){return <label className="admin-field"><span>{label}</span><Select value={value} onValueChange={onChange}><SelectTrigger aria-label={label}><SelectValue/></SelectTrigger><SelectContent>{items.map(([v,name])=><SelectItem key={v} value={v}>{name}</SelectItem>)}</SelectContent></Select></label>;}
// Upper axis bound: the next "round" number (1, 2, 2.5 or 5 times a power of ten).
const niceMax=(v:number)=>{if(v<=4)return 4;const p=10**Math.floor(Math.log10(v));return [1,2,2.5,5,10].map(m=>m*p).find(m=>m>=v)!;};
function Chart({points,value,kind,bucket,color,unit,hover,onHover}:{points:Point[];value:(p:Point)=>number;kind:'line'|'bars';bucket:string;color:string;unit:string;hover:number|null;onHover:(i:number|null)=>void}){
 const W=880,H=240,L=58,R=10,T=12,B=30,w=W-L-R,h=H-T-B,max=niceMax(Math.max(1,...points.map(value))),step=w/Math.max(1,points.length);
 const x=(i:number)=>L+i*step,y=(v:number)=>T+h-h*v/max;
 const ticks=[0,.25,.5,.75,1].map(f=>f*max);
 // About six date labels along the axis, whatever the number of buckets.
 const every=Math.max(1,Math.ceil(points.length/6));
 const axisLabel=(s:string)=>bucket==='month'?new Date(s+'T12:00:00Z').toLocaleDateString('de-DE',{month:'short',year:'2-digit',timeZone:'UTC'}):new Date(s+'T12:00:00Z').toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'2-digit',timeZone:'UTC'});
 const line=points.map((p,i)=>(i?'L':'M')+(x(i)+step/2).toFixed(1)+' '+y(value(p)).toFixed(1)).join(' ');
 return <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={unit+' je '+TIMELINE_BUCKETS[bucket as keyof typeof TIMELINE_BUCKETS]+'. Die Werte stehen auch in der Tabelle darunter.'} onMouseLeave={()=>onHover(null)}>
  {ticks.map(t=><g key={t}><line x1={L} x2={W-R} y1={y(t)} y2={y(t)} stroke={t?'#e3e3e3':'#8a8a8a'} strokeWidth="1"/><text x={L-8} y={y(t)+4} textAnchor="end" fontSize="12" fill="#555">{n(t,max<8&&t%1?1:0)}</text></g>)}
  {kind==='bars'?points.map((p,i)=><rect key={p.start} x={x(i)+Math.min(1,step*.1)} y={y(value(p))} width={Math.max(.6,step-Math.min(2,step*.2))} height={Math.max(0,T+h-y(value(p)))} fill={hover===i?'#101d37':color}/>)
   :<><path d={line+` L${(x(points.length-1)+step/2).toFixed(1)} ${T+h} L${(x(0)+step/2).toFixed(1)} ${T+h} Z`} fill={color} opacity=".12"/><path d={line} fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round"/>{hover!==null&&points[hover]&&<circle cx={x(hover)+step/2} cy={y(value(points[hover]))} r="4.5" fill="#101d37"/>}</>}
  {points.map((p,i)=>i%every===0&&<text key={p.start} x={x(i)+step/2} y={H-8} textAnchor={i===0?'start':'middle'} fontSize="12" fill="#555">{axisLabel(p.start)}</text>)}
  {points.map((p,i)=><rect key={p.start} x={x(i)} y={T} width={step} height={h} fill="transparent" onMouseEnter={()=>onHover(i)}><title>{bucketLabel(p.start,bucket)+': '+n(value(p))+' '+unit}</title></rect>)}
 </svg>;
}
/** Stock and inflow of stored reports over time, for the map selection or all areas. Reads only. */
export function AdminTimeline({selected,revision,initial}:{selected:Set<string>;revision:number;initial?:Dataset}){
 const [scope,setScope]=useState('selection'),[basis,setBasis]=useState('event'),[bucket,setBucket]=useState('week'),[range,setRange]=useState('12m');
 const [loaded,setLoaded]=useState<Record<string,Dataset>>(initial?{[initial.basis+':'+revision]:initial}:{}),[failed,setFailed]=useState<Record<string,string>>({}),[hover,setHover]=useState<number|null>(null);
 // round: values per area just computed by the catch-up steps (admin-store.ts) are read again.
 const [round,setRound]=useState(0);
 useEffect(()=>{const again=()=>setRound(r=>r+1);window.addEventListener(ADMIN_REGIONS_DONE,again);return()=>window.removeEventListener(ADMIN_REGIONS_DONE,again);},[]);
 const key=basis+':'+revision+(round?':'+round:''),dataset=loaded[key],error=failed[key]||'';
 useEffect(()=>{
  if(loaded[key]||failed[key])return;const c=new AbortController();
  fetch('/api/admin/timeline?basis='+basis,{cache:'no-cache',signal:c.signal}).then(async r=>{const d=await r.json() as Dataset&{error?:string};if(!r.ok)throw Error(d.error||'Verlauf konnte nicht geladen werden.');setLoaded(prev=>({...prev,[key]:d}));}).catch(e=>{if(e.name!=='AbortError')setFailed(prev=>({...prev,[key]:e instanceof Error?e.message:'Verlauf konnte nicht geladen werden.'}));});
  return()=>c.abort();
 },[key,basis,loaded,failed]);
 const view=useMemo(()=>{
  if(!dataset)return null;
  const merged=mergeAreas(dataset,scope==='all'?null:selected),to=dataset.today,from=rangeStart(range,to,merged.counts);
  return {merged,from,to,series:timelineSeries(merged.counts,{bucket,from,to,undated:merged.undated}),stats:timelineStats(merged.counts,{from,to})};
 },[dataset,scope,selected,range,bucket]);
 const point=view&&hover!==null?view.series.points[hover]:null;
 return <section className="admin-timeline" id="admin-verlauf">
  <div className="admin-section-heading"><div><p className="eyebrow">BESTAND & ZULAUF</p><h2>Wie viele Berichte sind gespeichert, wie viele kommen neu hinzu?</h2></div>{view&&<span>{scope==='all'?'Alle Gebiete':n(selected.size)+' ausgewählte Gebiete'} · {n(view.merged.areas)} mit Berichten</span>}</div>
  <div className="admin-timeline-controls">
   <Choice label="Gebiete" value={scope} onChange={setScope} items={[["selection",`Auswahl der Karte (${n(selected.size)})`],["all","Alle Gebiete"]]}/>
   <Choice label="Zeitraum" value={range} onChange={s=>{setRange(s);setHover(null);}} items={Object.entries(TIMELINE_RANGES).map(([id,r])=>[id,r.label]) as [string,string][]}/>
   <Choice label="Zeitraster" value={bucket} onChange={s=>{setBucket(s);setHover(null);}} items={Object.entries(TIMELINE_BUCKETS).map(([id,name])=>[id,'je '+name]) as [string,string][]}/>
   <Choice label="Zeitbezug" value={basis} onChange={s=>{setBasis(s);setHover(null);}} items={Object.entries(TIMELINE_BASES) as [string,string][]}/>
  </div>
  {error&&<p role="alert" className="admin-error">{error} <button type="button" className="admin-timeline-retry" onClick={()=>setFailed(prev=>{const next={...prev};delete next[key];return next;})}>Erneut laden</button></p>}
  {!view&&!error&&<p role="status" className="admin-note">Verlauf wird aus der Datenbank gelesen …</p>}
  {view&&(scope==='selection'&&!selected.size?<p className="admin-empty">Keine Gebiete ausgewählt. Gebiete auf der Karte oder in der Liste auswählen, oder oben „Alle Gebiete“ einstellen.</p>:<>
   <div className="admin-kpis">
    <div className="admin-kpi admin-kpi-primary"><span>Bestand heute</span><strong>{n(view.series.total)}</strong><small>{view.series.after?`dazu ${n(view.series.after)} für kommende Sitzungen bereits erfasst`:'Berichte bis einschließlich heute'}</small></div>
    <div className="admin-kpi"><span>Neu pro Tag</span><strong>{n(view.stats.perDay,1)}</strong><small>Durchschnitt über {n(view.stats.days)} Kalendertage · {n(view.stats.perActiveDay,1)} an den {n(view.stats.activeDays)} Tagen mit Zulauf</small></div>
    <div className="admin-kpi"><span>Neu pro Woche</span><strong>{n(view.stats.perWeek,1)}</strong><small>{view.stats.peakWeek?`Spitzenwoche ab ${day(view.stats.peakWeek.start)}: ${n(view.stats.peakWeek.count)}`:'Kein Zulauf im Zeitraum'}</small></div>
    <div className="admin-kpi"><span>Hochgerechnet pro Jahr</span><strong>{n(Math.round(view.stats.perYear))}</strong><small>{view.stats.peakDay?`Spitzentag ${day(view.stats.peakDay.day)}: ${n(view.stats.peakDay.count)}`:'Kein Zulauf im Zeitraum'}</small></div>
   </div>
   <p className="admin-note">{n(view.stats.total)} neue Berichte vom {day(view.from)} bis {day(view.to)}. {basis==='event'?'Ein Bericht zählt an dem Tag, an dem er erstmals auf einer Tagesordnung stand. So fällt der Zulauf auch im laufenden Betrieb an.':`Ein Bericht zählt am Tag seiner ersten Speicherung. Dieses Datum wird erst seit Oktober 2026 erfasst: ${n(view.merged.undated)} Berichte der Auswahl haben keines und stehen nur im Bestand, nicht im Zulauf.`} Der Durchschnitt unterschätzt den künftigen Zulauf, wenn Gebiete der Auswahl nicht für den ganzen Zeitraum eingelesen sind.</p>
   <div className="admin-timeline-charts">
    <figure><figcaption>Neue Berichte je {TIMELINE_BUCKETS[bucket as keyof typeof TIMELINE_BUCKETS]}</figcaption><Chart points={view.series.points} value={p=>p.count} kind="bars" bucket={bucket} color="#0d9488" unit="neue Berichte" hover={hover} onHover={setHover}/></figure>
    <figure><figcaption>Gesamtzahl der gespeicherten Berichte</figcaption><Chart points={view.series.points} value={p=>p.total} kind="line" bucket={bucket} color="#0d9488" unit="Berichte im Bestand" hover={hover} onHover={setHover}/></figure>
   </div>
   <p className="admin-map-hover" aria-live="polite">{point?<><strong>{bucketLabel(point.start,bucket)}</strong> · {n(point.count)} neue Berichte · Bestand {n(point.total)}</>:<>Mit der Maus über ein Diagramm fahren, um die Werte eines Zeitabschnitts zu lesen.</>}</p>
   <details><summary>Werte als Tabelle</summary><div className="admin-timeline-table"><table><thead><tr><th scope="col">Zeitabschnitt</th><th scope="col">Neue Berichte</th><th scope="col">Bestand</th></tr></thead><tbody>{[...view.series.points].reverse().map(p=><tr key={p.start}><td>{bucketLabel(p.start,bucket)}</td><td>{n(p.count)}</td><td>{n(p.total)}</td></tr>)}</tbody></table></div></details>
  </>)}
 </section>;
}
