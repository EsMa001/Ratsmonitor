'use client';
import {useEffect,useMemo,useState} from 'react';
import {RefreshCw,MapPinned,Play,ArrowUpRight} from 'lucide-react';
import {StandLine} from '@/components/admin-stand';
import type {Stand} from '@/shared/admin-types';
import {AdminHeader,adminHref} from '@/components/admin-chrome';
type Share={areas:number;population:number;lands:Record<string,[number,number]>};
type Bucket={id:string;label:string;color:string;areas:number;population:number};
type SizeRow={id:string;label:string;total:[number,number];connected:[number,number];data:[number,number]};
type Month={month:string;reports:number;areas:number};
type Coverage={stand?:Stand;asOf:string;lands:Record<string,{name:string;short:string}>;total:Share;connected:Share;data:Share&{series:{day:string;areas:number;population:number}[];reports:number;undatedAreas:number};history:{builtAt:string;points:{at:string;commit:string|null;areas:number;population:number}[]};analysis:{statsPending:number;reach:{buckets:Bucket[]};fresh:{buckets:Bucket[]};sizes:SizeRow[];months:Month[];undated:number}};
type Point={t:number;v:number};
type Series={id:string;label:string;color:string;points:Point[]};
const n=(v:number,digits=0)=>v.toLocaleString('de-DE',{maximumFractionDigits:digits,minimumFractionDigits:digits});
const pct=(a:number,b:number,digits=1)=>b?n(100*a/b,digits)+' %':'–';
const mio=(v:number)=>v>=1e6?n(v/1e6,v>=1e8?0:1)+' Mio.':n(v);
const dateTime=(s:string)=>new Date(s).toLocaleString('de-DE',{timeZone:'Europe/Berlin',dateStyle:'short',timeStyle:'short'});
const dayLabel=(t:number)=>new Date(t).toLocaleDateString('de-DE',{timeZone:'Europe/Berlin',day:'2-digit',month:'2-digit',year:'2-digit'});
const monthLabel=(m:string)=>m.slice(5,7)+'.'+m.slice(2,4);
/** Value of a step series at a moment: the last point at or before it, 0 before the first. */
const valueAt=(points:Point[],t:number)=>{let v=0;for(const p of points){if(p.t>t)break;v=p.v;}return v;};
/**
 * Step chart of shares over time: every series holds the value from each of its points on until the next point, the
 * last one up to now. The axis shows the share of the whole; the absolute value stands next to it.
 */
function TrendChart({series,max,now,fmt,unit,hover,onHover}:{series:Series[];max:number;now:number;fmt:(v:number)=>string;unit:string;hover:number|null;onHover:(t:number|null)=>void}){
 const W=880,H=270,L=66,R=14,T=14,B=34,w=W-L-R,h=H-T-B;
 const t0=Math.min(now,...series.flatMap(s=>s.points.map(p=>p.t))),t1=Math.max(now,t0+86400000);
 const x=(t:number)=>L+(t-t0)/(t1-t0)*w,y=(v:number)=>T+h-h*Math.min(v,max)/max;
 const path=(points:Point[])=>{if(!points.length)return '';let d=`M${x(points[0].t).toFixed(1)} ${y(points[0].v).toFixed(1)}`;for(let i=1;i<points.length;i++)d+=` H${x(points[i].t).toFixed(1)} V${y(points[i].v).toFixed(1)}`;return d+` H${x(t1).toFixed(1)}`;};
 const ticks=[0,.25,.5,.75,1];
 // About six dates along the axis, at day boundaries.
 const days=Math.max(1,Math.round((t1-t0)/86400000)),every=Math.max(1,Math.ceil(days/6)),labels:number[]=[];
 for(let t=t0;t<=t1;t+=every*86400000)labels.push(t);
 return <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={unit+' im Verlauf. Die Werte stehen auch in der Tabelle darunter.'} onMouseLeave={()=>onHover(null)} onMouseMove={e=>{const r=(e.currentTarget as SVGSVGElement).getBoundingClientRect();const px=(e.clientX-r.left)/r.width*W;if(px<L||px>W-R){onHover(null);return;}onHover(t0+(px-L)/w*(t1-t0));}}>
  {ticks.map(f=><g key={f}><line x1={L} x2={W-R} y1={y(f*max)} y2={y(f*max)} stroke={f?'#e3e3e3':'#8a8a8a'} strokeWidth="1"/><text x={L-8} y={y(f*max)+4} textAnchor="end" fontSize="12" fill="#555">{n(100*f)} %</text></g>)}
  {series.map(s=><path key={s.id} d={path(s.points)} fill="none" stroke={s.color} strokeWidth="2.4" strokeLinejoin="round"/>)}
  {labels.map(t=><text key={t} x={x(t)} y={H-8} textAnchor={t===t0?'start':'middle'} fontSize="12" fill="#555">{dayLabel(t)}</text>)}
  {hover!==null&&<g><line x1={x(hover)} x2={x(hover)} y1={T} y2={T+h} stroke="#101d37" strokeWidth="1" strokeDasharray="3 3"/>{series.map(s=><circle key={s.id} cx={x(hover)} cy={y(valueAt(s.points,hover))} r="4.5" fill={s.color} stroke="#fff" strokeWidth="1.5"/>)}</g>}
  <title>{unit}: {series.map(s=>s.label+' '+fmt(valueAt(s.points,now))).join(', ')}</title>
 </svg>;
}
/** Bars of the reports per meeting month (the month a report first stood on an agenda), the areas with meetings as a line. */
function MonthChart({months}:{months:Month[]}){
 const W=880,H=240,L=62,R=56,T=16,B=34,w=W-L-R,h=H-T-B;
 const max=Math.max(1,...months.map(m=>m.reports)),maxAreas=Math.max(1,...months.map(m=>m.areas));
 const slot=w/Math.max(1,months.length),bar=Math.max(3,slot*.62),x=(i:number)=>L+i*slot+(slot-bar)/2,y=(v:number)=>T+h-h*v/max,ya=(v:number)=>T+h-h*v/maxAreas;
 const ticks=[0,.5,1],every=Math.max(1,Math.ceil(months.length/12));
 return <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={'Berichte je Sitzungsmonat: '+months.map(m=>monthLabel(m.month)+' '+n(m.reports)).join(', ')}>
  {ticks.map(f=><g key={f}><line x1={L} x2={W-R} y1={y(f*max)} y2={y(f*max)} stroke={f?'#e3e3e3':'#8a8a8a'} strokeWidth="1"/><text x={L-8} y={y(f*max)+4} textAnchor="end" fontSize="12" fill="#555">{n(f*max)}</text></g>)}
  {[0,1].map(f=><text key={f} x={W-R+8} y={ya(f*maxAreas)+4} fontSize="12" fill="#2352ad">{n(f*maxAreas)}</text>)}
  {months.map((m,i)=><rect key={m.month} x={x(i)} y={y(m.reports)} width={bar} height={T+h-y(m.reports)} fill="#0f766e" rx="2"><title>{monthLabel(m.month)}: {n(m.reports)} Berichte, {n(m.areas)} Gebiete mit Sitzungen</title></rect>)}
  {months.length>1&&<path d={months.map((m,i)=>`${i?'L':'M'}${(x(i)+bar/2).toFixed(1)} ${ya(m.areas).toFixed(1)}`).join(' ')} fill="none" stroke="#2352ad" strokeWidth="2" strokeLinejoin="round"/>}
  {months.map((m,i)=>i%every===0||i===months.length-1?<text key={'l'+m.month} x={x(i)+bar/2} y={H-8} textAnchor="middle" fontSize="12" fill="#555">{monthLabel(m.month)}</text>:null)}
 </svg>;
}
/** Shares of the buckets as one bar, with the figures as chips. Reads only; the atlas has the same bar with filters. */
function BucketBar({buckets,of}:{buckets:Bucket[];of:'areas'|'population'}){
 const total=buckets.reduce((s,b)=>s+b[of],0);
 return <div className="admin-atlas-stack is-static" role="img" aria-label={buckets.map(b=>b.label+': '+n(b[of])).join(', ')}>{buckets.map(b=>b[of]?<i key={b.id} style={{width:(100*b[of]/total)+'%',background:b.color}} title={b.label+': '+(of==='areas'?n(b[of])+' Gebiete':mio(b[of])+' Einwohner')}/>:null)}</div>;
}
/** Admin page "Übersicht": coverage by areas and population, today and over time, and analyses of the stock. Reads only. */
export function AdminOverview({displayName,signOutPath}:{displayName:string;signOutPath:string}){
 const [data,setData]=useState<Coverage|null>(null),[error,setError]=useState(''),[attempt,setAttempt]=useState(0),[hover,setHover]=useState<number|null>(null),[of,setOf]=useState<'areas'|'population'>('areas');
 useEffect(()=>{const c=new AbortController();setError('');
  fetch('/api/admin/coverage',{cache:'no-cache',signal:c.signal}).then(async r=>{const d=await r.json() as Coverage&{error?:string};if(!r.ok)throw Error(d.error||'Die Abdeckung konnte nicht geladen werden.');setData(d);}).catch(e=>{if(!c.signal.aborted)setError(e instanceof Error?e.message:'Die Abdeckung konnte nicht geladen werden.');});
  return()=>c.abort();},[attempt]);
 const view=useMemo(()=>{
  if(!data)return null;
  const now=Date.parse(data.asOf);
  // Connected: one point per catalog state, plus today's state. With reports: one point per day with a change, the day
  // counted at its end (Berlin time).
  const connected={areas:data.history.points.map(p=>({t:Date.parse(p.at),v:p.areas})),population:data.history.points.map(p=>({t:Date.parse(p.at),v:p.population}))};
  for(const key of ['areas','population'] as const){const last=connected[key].at(-1);if(!last||last.v!==data.connected[key])connected[key].push({t:now,v:data.connected[key]});}
  const dayEnd=(day:string)=>Math.min(now,Date.parse(day+'T22:00:00Z'));
  const stored={areas:data.data.series.map(p=>({t:dayEnd(p.day),v:p.areas})),population:data.data.series.map(p=>({t:dayEnd(p.day),v:p.population}))};
  const series=(key:'areas'|'population'):Series[]=>[{id:'connected',label:'Quelle angebunden',color:'#0f766e',points:connected[key]},{id:'stored',label:'Mit gespeicherten Berichten',color:'#2352ad',points:stored[key]}];
  const lands=Object.entries(data.lands).map(([id,l])=>({id,...l,total:data.total.lands[id]||[0,0],connected:data.connected.lands[id]||[0,0],data:data.data.lands[id]||[0,0]})).sort((a,b)=>b.total[1]-a.total[1]);
  // The last 24 meeting months; a bucket is shown only when it holds something.
  const months=data.analysis.months.slice(-24),reach=data.analysis.reach.buckets.filter(b=>b.areas),fresh=data.analysis.fresh.buckets.filter(b=>b.areas);
  const sum=(list:Bucket[],ids:string[])=>list.filter(b=>ids.includes(b.id)).reduce((s,b)=>s+b.areas,0);
  return {now,areas:series('areas'),population:series('population'),lands,months,reach,fresh,shallow:sum(reach,['w','m1']),deep:sum(reach,['y1','y2']),quiet:sum(fresh,['d180','old']),current:sum(fresh,['ahead','d30'])};
 },[data]);
 return <div className="admin-app"><AdminHeader page="uebersicht" displayName={displayName} signOutPath={signOutPath}/><main id="inhalt" className="admin-shell admin-workspace">
  <div className="admin-heading"><div><p className="eyebrow">ÜBERSICHT</p><h1>Wie weit reicht Plenara?</h1><p>{displayName}</p><StandLine stand={data?data.stand??null:undefined} action="Aktualisieren" onAction={()=>setAttempt(a=>a+1)}/></div></div>
  {error&&<p role="alert" className="admin-error">{error} <button type="button" className="admin-timeline-retry" onClick={()=>setAttempt(a=>a+1)}>Erneut laden</button></p>}
  {!data&&!error&&<p role="status" className="admin-note">Abdeckung wird aus Katalog und Datenbank gelesen. Beim ersten Aufruf nach einer Änderung des Bestands dauert das bis zu einer Minute.</p>}
  {data&&data.stand&&data.stand.unbuilt>0&&<p role="status" className="admin-note">Die Werte je Gebiet werden zum ersten Mal berechnet. Bis alle Gebiete fertig sind, zeigt diese Seite keine Zahlen, damit keine Teilsummen wie Ergebnisse aussehen.</p>}
  {data&&view&&!(data.stand&&data.stand.unbuilt>0)&&<>
   <section className="admin-kpis" aria-label="Abdeckung heute">
    <div className="admin-kpi admin-kpi-primary"><span>Gebiete angebunden</span><strong>{n(data.connected.areas)}<em> / {n(data.total.areas)}</em></strong><small>{pct(data.connected.areas,data.total.areas)} aller Städte, Gemeinden, Gemeindeverbände und Kreise haben eine Quelle, die Programme lesen können</small></div>
    <div className="admin-kpi admin-kpi-primary"><span>Einwohner erreicht</span><strong>{pct(data.connected.population,data.total.population)}</strong><small>{mio(data.connected.population)} von {mio(data.total.population)} Einwohnern leben in einem angebundenen Gebiet (Gemeindeebene)</small></div>
    <div className="admin-kpi"><span>Gebiete mit Berichten</span><strong>{n(data.data.areas)}<em> / {n(data.total.areas)}</em></strong><small>{pct(data.data.areas,data.total.areas)} · {n(data.data.reports)} Berichte gespeichert</small></div>
    <div className="admin-kpi"><span>Einwohner mit Berichten</span><strong>{pct(data.data.population,data.total.population)}</strong><small>{mio(data.data.population)} Einwohner in Gebieten mit gespeicherten Berichten</small></div>
   </section>
   <section className="admin-section admin-overview-trend" aria-labelledby="verlauf">
    <div className="admin-section-heading"><div><p className="eyebrow">VERLAUF</p><h2 id="verlauf">Wie hat sich die Abdeckung entwickelt?</h2></div><span className="admin-trend-legend">{view.areas.map(s=><span key={s.id}><i style={{background:s.color}}/>{s.label}</span>)}</span></div>
    <div className="admin-overview-charts">
     <figure><figcaption>Gebiete · Anteil an {n(data.total.areas)} Gebieten</figcaption><TrendChart series={view.areas} max={data.total.areas} now={view.now} fmt={v=>n(v)} unit="Gebiete" hover={hover} onHover={setHover}/></figure>
     <figure><figcaption>Einwohner · Anteil an {mio(data.total.population)}</figcaption><TrendChart series={view.population} max={data.total.population} now={view.now} fmt={mio} unit="Einwohner" hover={hover} onHover={setHover}/></figure>
    </div>
    <p className="admin-map-hover" aria-live="polite">{hover!==null?<><strong>{dateTime(new Date(hover).toISOString())}</strong>{view.areas.map(s=><span key={s.id}> · {s.label}: {n(valueAt(s.points,hover))} Gebiete ({pct(valueAt(s.points,hover),data.total.areas)}), {mio(valueAt(view.population.find(p=>p.id===s.id)!.points,hover))} Einwohner ({pct(valueAt(view.population.find(p=>p.id===s.id)!.points,hover),data.total.population)})</span>)}</>:<>Mit der Maus über ein Diagramm fahren, um die Werte eines Zeitpunkts zu lesen.</>}</p>
    <p className="admin-note">„Quelle angebunden“ folgt dem Quellenkatalog: ein Punkt je Stand, an dem er geändert wurde (seit {dayLabel(Date.parse(data.history.points[0]?.at||data.asOf))}); gezählt gegen den heutigen Katalog. „Mit gespeicherten Berichten“ zählt ein Gebiet ab dem Tag, an dem sein erster Bericht gespeichert wurde; {data.data.undatedAreas>0?`${n(data.data.undatedAreas)} Gebiete, deren Berichte vor Beginn dieser Erfassung (Oktober 2026) gespeichert wurden, zählen ab dem ersten Tag der Reihe. `:''}Einwohner auf der Gemeindeebene; ein Kreis zählt seine Gemeinden nicht doppelt.</p>
    <details><summary>Werte als Tabelle</summary><div className="admin-timeline-table"><table><thead><tr><th scope="col">Stand</th><th scope="col">Gebiete angebunden</th><th scope="col">Einwohner angebunden</th></tr></thead><tbody>{[...data.history.points].reverse().map(p=><tr key={p.at+(p.commit||'')}><td>{dateTime(p.at)}{p.commit?'':' (Arbeitsstand)'}</td><td>{n(p.areas)} ({pct(p.areas,data.total.areas)})</td><td>{mio(p.population)} ({pct(p.population,data.total.population)})</td></tr>)}</tbody></table></div><div className="admin-timeline-table"><table><thead><tr><th scope="col">Tag</th><th scope="col">Gebiete mit Berichten</th><th scope="col">Einwohner mit Berichten</th></tr></thead><tbody>{[...data.data.series].reverse().map(p=><tr key={p.day}><td>{p.day.split('-').reverse().join('.')}</td><td>{n(p.areas)} ({pct(p.areas,data.total.areas)})</td><td>{mio(p.population)} ({pct(p.population,data.total.population)})</td></tr>)}</tbody></table></div></details>
   </section>
   <section className="admin-section" aria-labelledby="tiefe">
    <div className="admin-section-heading"><div><p className="eyebrow">REICHWEITE UND AKTUALITÄT</p><h2 id="tiefe">Wie weit zurück und wie aktuell sind die Berichte?</h2></div><div className="admin-seg" role="group" aria-label="Zählung"><button type="button" aria-pressed={of==='areas'} onClick={()=>setOf('areas')}>Gebiete</button><button type="button" aria-pressed={of==='population'} onClick={()=>setOf('population')}>Einwohner</button></div></div>
    {data.analysis.statsPending>0&&<p role="status" className="admin-notice">Sitzungstage von {n(data.analysis.statsPending)} Gebieten werden noch berechnet; „Aktualisieren“ zeigt sie, sobald sie vorliegen.</p>}
    <div className="admin-overview-charts">
     <figure><figcaption>Rückreichweite · erster Tagesordnungstag je angebundenem Gebiet</figcaption><BucketBar buckets={view.reach} of={of}/><div className="admin-atlas-chips">{view.reach.map(b=><span key={b.id} className="admin-chip is-static"><i style={{background:b.color}}/>{b.label} <span>{of==='areas'?n(b.areas):mio(b.population)}</span></span>)}</div><p className="admin-note">{n(view.deep)} Gebiete reichen mindestens ein Jahr zurück, {n(view.shallow)} unter drei Monate: dort holt ein Abruf mit „12 Monate rückwirkend“ die älteren Sitzungen nach. <a href={adminHref('abruf','filter=shallow')}>Diese Gebiete im Abruf →</a> · <a href={adminHref('atlas','farbe=reach')}>Auf der Karte →</a></p></figure>
     <figure><figcaption>Aktualität · jüngster Sitzungstag je angebundenem Gebiet</figcaption><BucketBar buckets={view.fresh} of={of}/><div className="admin-atlas-chips">{view.fresh.map(b=><span key={b.id} className="admin-chip is-static"><i style={{background:b.color}}/>{b.label} <span>{of==='areas'?n(b.areas):mio(b.population)}</span></span>)}</div><p className="admin-note">{n(view.current)} Gebiete haben eine Sitzung in den letzten 30 Tagen oder angekündigt, {n(view.quiet)} seit über 90 Tagen keine: entweder ruht das Gremium, oder der Abruf stockt. <a href={adminHref('abruf','filter=quiet')}>Diese Gebiete im Abruf →</a> · <a href={adminHref('atlas','farbe=fresh')}>Auf der Karte →</a></p></figure>
    </div>
   </section>
   <section className="admin-section" aria-labelledby="monate">
    <div className="admin-section-heading"><div><p className="eyebrow">SITZUNGEN JE MONAT</p><h2 id="monate">Aus welchen Monaten stammen die Berichte?</h2></div><span className="admin-trend-legend"><span><i style={{background:'#0f766e'}}/>Berichte</span><span><i style={{background:'#2352ad'}}/>Gebiete mit Sitzungen</span></span></div>
    {view.months.length?<figure><MonthChart months={view.months}/></figure>:<p className="admin-empty">Noch keine Berichte mit Sitzungstag.</p>}
    <p className="admin-note">Ein Bericht zählt in dem Monat, in dem er erstmals auf einer Tagesordnung stand. Der linke Rand zeigt, wie weit die Abrufe zurückreichen; Einbrüche in den Sommermonaten sind Sitzungspausen; Monate nach dem heutigen sind angekündigte Sitzungen.{data.analysis.undated>0&&`${n(data.analysis.undated)} Berichte ohne Sitzungstag sind nicht enthalten. `}{data.analysis.months.length>24&&`Gezeigt werden die letzten 24 von ${n(data.analysis.months.length)} Monaten. `}</p>
    <details><summary>Werte als Tabelle</summary><div className="admin-timeline-table"><table><thead><tr><th scope="col">Monat</th><th scope="col">Berichte</th><th scope="col">Gebiete mit Sitzungen</th></tr></thead><tbody>{[...data.analysis.months].reverse().map(m=><tr key={m.month}><td>{monthLabel(m.month)}</td><td>{n(m.reports)}</td><td>{n(m.areas)}</td></tr>)}</tbody></table></div></details>
   </section>
   <section className="admin-section" aria-labelledby="laender">
    <div className="admin-section-heading"><div><p className="eyebrow">JE LAND</p><h2 id="laender">Abdeckung nach Bundesland</h2></div></div>
    <div className="admin-lands" role="region" aria-label="Abdeckung je Land" tabIndex={0}><table><thead><tr><th>Land</th><th>Gebiete</th><th>Angebunden</th><th>Mit Berichten</th><th>Einwohner angebunden</th><th>Einwohner mit Berichten</th></tr></thead><tbody>{view.lands.map(l=><tr key={l.id}><th>{l.name}</th><td>{n(l.total[0])}</td><td><span className="admin-share"><i style={{width:pct(l.connected[0],l.total[0])}}/></span>{n(l.connected[0])} <small>{pct(l.connected[0],l.total[0],0)}</small></td><td><span className="admin-share is-data"><i style={{width:pct(l.data[0],l.total[0])}}/></span>{n(l.data[0])} <small>{pct(l.data[0],l.total[0],0)}</small></td><td>{pct(l.connected[1],l.total[1],0)} <small>{mio(l.connected[1])}</small></td><td>{pct(l.data[1],l.total[1],0)} <small>{mio(l.data[1])}</small></td></tr>)}</tbody><tfoot><tr><th>Deutschland</th><td>{n(data.total.areas)}</td><td>{n(data.connected.areas)} <small>{pct(data.connected.areas,data.total.areas,0)}</small></td><td>{n(data.data.areas)} <small>{pct(data.data.areas,data.total.areas,0)}</small></td><td>{pct(data.connected.population,data.total.population,0)}</td><td>{pct(data.data.population,data.total.population,0)}</td></tr></tfoot></table></div>
   </section>
   <section className="admin-section" aria-labelledby="groesse">
    <div className="admin-section-heading"><div><p className="eyebrow">NACH GEMEINDEGRÖSSE</p><h2 id="groesse">Erreichen wir die Großen wie die Kleinen?</h2></div><span className="admin-note">Einwohner der Gemeindeebene; Kreise umfassen ihre Gemeinden und zählen keine Einwohner.</span></div>
    <div className="admin-lands" role="region" aria-label="Abdeckung je Größenklasse" tabIndex={0}><table><thead><tr><th>Einwohner je Gebiet</th><th>Gebiete</th><th>Angebunden</th><th>Mit Berichten</th><th>Einwohner angebunden</th><th>Einwohner mit Berichten</th></tr></thead><tbody>{data.analysis.sizes.filter(s=>s.total[0]).map(s=><tr key={s.id}><th>{s.label}</th><td>{n(s.total[0])}</td><td><span className="admin-share"><i style={{width:pct(s.connected[0],s.total[0])}}/></span>{n(s.connected[0])} <small>{pct(s.connected[0],s.total[0],0)}</small></td><td><span className="admin-share is-data"><i style={{width:pct(s.data[0],s.total[0])}}/></span>{n(s.data[0])} <small>{pct(s.data[0],s.total[0],0)}</small></td><td>{s.total[1]?<>{pct(s.connected[1],s.total[1],0)} <small>{mio(s.connected[1])}</small></>:'–'}</td><td>{s.total[1]?<>{pct(s.data[1],s.total[1],0)} <small>{mio(s.data[1])}</small></>:'–'}</td></tr>)}</tbody></table></div>
   </section>
   <section className="admin-section admin-next" aria-label="Weiter">
    <a className="admin-next-link" href={adminHref('atlas')}><MapPinned size={20}/><span><strong>Lückenatlas</strong><small>{n(data.total.areas-data.connected.areas)} offene Gebiete: warum, und was sie schließen könnte</small></span><ArrowUpRight size={16}/></a>
    <a className="admin-next-link" href={adminHref('abruf','filter=empty')}><Play size={20}/><span><strong>Abruf starten</strong><small>{n(data.connected.areas-data.data.areas)} angebundene Gebiete haben noch keine Berichte</small></span><ArrowUpRight size={16}/></a>
    <a className="admin-next-link" href={adminHref('qualitaet')}><RefreshCw size={20}/><span><strong>Qualität & Betrieb</strong><small>Prüfliste, Importverlauf, Datenbank</small></span><ArrowUpRight size={16}/></a>
   </section>
  </>}
  <footer className="admin-footer">Kennzahlen aus Quellenkatalog und Datenbank. Berichtszahlen schließen zusammengeführte Verweise aus. <a href="/">Zur öffentlichen Website</a></footer>
 </main></div>;
}
