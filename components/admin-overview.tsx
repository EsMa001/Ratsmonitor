'use client';
import {useEffect,useMemo,useState} from 'react';
import {RefreshCw,MapPinned,Play,ArrowUpRight} from 'lucide-react';
import {AdminHeader,adminHref} from '@/components/admin-chrome';
import {Button} from '@/components/ui/button';
type Share={areas:number;population:number;lands:Record<string,[number,number]>};
type Coverage={asOf:string;lands:Record<string,{name:string;short:string}>;total:Share;connected:Share;data:Share&{series:{day:string;areas:number;population:number}[];reports:number;undatedAreas:number};history:{builtAt:string;points:{at:string;commit:string|null;areas:number;population:number}[]}};
type Point={t:number;v:number};
type Series={id:string;label:string;color:string;points:Point[]};
const n=(v:number,digits=0)=>v.toLocaleString('de-DE',{maximumFractionDigits:digits,minimumFractionDigits:digits});
const pct=(a:number,b:number,digits=1)=>b?n(100*a/b,digits)+' %':'–';
const mio=(v:number)=>v>=1e6?n(v/1e6,v>=1e8?0:1)+' Mio.':n(v);
const dateTime=(s:string)=>new Date(s).toLocaleString('de-DE',{timeZone:'Europe/Berlin',dateStyle:'short',timeStyle:'short'});
const dayLabel=(t:number)=>new Date(t).toLocaleDateString('de-DE',{timeZone:'Europe/Berlin',day:'2-digit',month:'2-digit',year:'2-digit'});
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
/** Admin page "Übersicht": coverage by areas and population, today and over time. Reads only. */
export function AdminOverview({displayName,signOutPath}:{displayName:string;signOutPath:string}){
 const [data,setData]=useState<Coverage|null>(null),[error,setError]=useState(''),[attempt,setAttempt]=useState(0),[hover,setHover]=useState<number|null>(null);
 useEffect(()=>{const c=new AbortController();setError('');
  fetch('/api/admin/coverage',{cache:'no-store',signal:c.signal}).then(async r=>{const d=await r.json() as Coverage&{error?:string};if(!r.ok)throw Error(d.error||'Die Abdeckung konnte nicht geladen werden.');setData(d);}).catch(e=>{if(!c.signal.aborted)setError(e instanceof Error?e.message:'Die Abdeckung konnte nicht geladen werden.');});
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
  return {now,areas:series('areas'),population:series('population'),lands};
 },[data]);
 return <div className="admin-app"><AdminHeader page="uebersicht" displayName={displayName} signOutPath={signOutPath}/><main id="inhalt" className="admin-shell admin-workspace">
  <div className="admin-heading"><div><p className="eyebrow">ÜBERSICHT</p><h1>Wie weit reicht Ratsmonitor?</h1><p>{displayName}{data&&<> · Stand {dateTime(data.asOf)}</>}</p></div><Button variant="outline" disabled={!data&&!error} onClick={()=>{setData(null);setAttempt(a=>a+1);}}><RefreshCw size={16}/> Aktualisieren</Button></div>
  {error&&<p role="alert" className="admin-error">{error} <button type="button" className="admin-timeline-retry" onClick={()=>setAttempt(a=>a+1)}>Erneut laden</button></p>}
  {!data&&!error&&<p role="status" className="admin-note">Abdeckung wird aus Katalog und Datenbank gelesen. Beim ersten Aufruf nach einer Änderung des Bestands dauert das bis zu einer Minute.</p>}
  {data&&view&&<>
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
   <section className="admin-section" aria-labelledby="laender">
    <div className="admin-section-heading"><div><p className="eyebrow">JE LAND</p><h2 id="laender">Abdeckung nach Bundesland</h2></div></div>
    <div className="admin-lands" role="region" aria-label="Abdeckung je Land" tabIndex={0}><table><thead><tr><th>Land</th><th>Gebiete</th><th>Angebunden</th><th>Mit Berichten</th><th>Einwohner angebunden</th><th>Einwohner mit Berichten</th></tr></thead><tbody>{view.lands.map(l=><tr key={l.id}><th>{l.name}</th><td>{n(l.total[0])}</td><td><span className="admin-share"><i style={{width:pct(l.connected[0],l.total[0])}}/></span>{n(l.connected[0])} <small>{pct(l.connected[0],l.total[0],0)}</small></td><td><span className="admin-share is-data"><i style={{width:pct(l.data[0],l.total[0])}}/></span>{n(l.data[0])} <small>{pct(l.data[0],l.total[0],0)}</small></td><td>{pct(l.connected[1],l.total[1],0)} <small>{mio(l.connected[1])}</small></td><td>{pct(l.data[1],l.total[1],0)} <small>{mio(l.data[1])}</small></td></tr>)}</tbody><tfoot><tr><th>Deutschland</th><td>{n(data.total.areas)}</td><td>{n(data.connected.areas)} <small>{pct(data.connected.areas,data.total.areas,0)}</small></td><td>{n(data.data.areas)} <small>{pct(data.data.areas,data.total.areas,0)}</small></td><td>{pct(data.connected.population,data.total.population,0)}</td><td>{pct(data.data.population,data.total.population,0)}</td></tr></tfoot></table></div>
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
