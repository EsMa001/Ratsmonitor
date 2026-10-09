'use client';
import {memo,useCallback,useEffect,useId,useMemo,useRef,useState} from 'react';
import type {AdminSource} from '@/shared/admin-types';
import {ACCESS_STATUSES} from '@/shared/source-access.mjs';
import {REACH_BUCKETS,FRESH_BUCKETS,reachBucket,freshBucket} from '@/shared/coverage.mjs';
import {AC,ACCESS_COLOR,COVERAGE,HATCH_CSS,bucketColor,shareColor} from '@/components/admin-colors';
import {Legend,mm} from '@/components/admin-ui';
const REACH=new Map(REACH_BUCKETS.map(b=>[b.id,bucketColor('reach',b)])),FRESH=new Map(FRESH_BUCKETS.map(b=>[b.id,bucketColor('fresh',b)]));
type Shape={id:string;ags:string;kind:string;path:string;bounds:number[]};
// NRW und Niedersachsen liegen in germany.json (auch Grundlage der öffentlichen Analysekarte),
// die übrigen 14 Länder in de-areas.json (scripts/build-de.mjs).
const FILES=['/geo/germany.json','/geo/de-areas.json'];
// Ausschnitt: Umriss der gezeigten Gebiete mit Rand.
function viewBox(shapes:Shape[]){if(!shapes.length)return '0 0 600 790';let [x0,y0,x1,y1]=[Infinity,Infinity,-Infinity,-Infinity];for(const {bounds:b} of shapes){if(b[0]<x0)x0=b[0];if(b[1]<y0)y0=b[1];if(b[2]>x1)x1=b[2];if(b[3]>y1)y1=b[3];}return (x0-6)+' '+(y0-6)+' '+(x1-x0+12)+' '+(y1-y0+12);}
// Die Flächen werden nur neu gezeichnet, wenn sich Gebiete, Farben oder Auswahl ändern, nicht bei jeder Mausbewegung
// oder Statusmeldung eines laufenden Auftrags: die bundesweite Karte hat mehrere tausend Flächen.
const Regions=memo(function Regions({shapes,fills,titles,selected,fine,onToggle,onHover}:{shapes:Shape[];fills:Map<string,string>;titles:Map<string,string>;selected:Set<string>;fine:boolean;onToggle:(id:string)=>void;onHover:(id:string|null)=>void}){
 return <>{[...shapes].sort((a,b)=>Number(selected.has(a.id))-Number(selected.has(b.id))).map(r=><path key={r.id} d={r.path} fill={fills.get(r.id)} stroke={selected.has(r.id)?AC.selection:'#fff'} strokeWidth={selected.has(r.id)?2.2:fine?.35:.55} vectorEffect="non-scaling-stroke" onClick={()=>onToggle(r.id)} onMouseEnter={()=>onHover(r.id)} onMouseLeave={()=>onHover(null)} className="admin-map-region"><title>{titles.get(r.id)+(selected.has(r.id)?'. Ausgewählt':'')}</title></path>)}</>;
});
export function AdminProcessingMap({sources,selected,onToggle,layer,mode,land='all'}:{sources:AdminSource[];selected:Set<string>;onToggle:(id:string)=>void;layer:string;mode:string;land?:string}){
 const [geo,setGeo]=useState<Shape[]|null>(null),[error,setError]=useState(false),[hover,setHover]=useState<string|null>(null);const pattern='admin-map-'+useId().replaceAll(':','');
 useEffect(()=>{const c=new AbortController();
  // Fehlt die Datei der übrigen Länder, bleibt die Karte von NRW und Niedersachsen nutzbar.
  Promise.all(FILES.map((file,i)=>fetch(file,{signal:c.signal}).then(r=>{if(!r.ok)throw Error();return r.json() as Promise<{regions:Shape[]}>;}).then(g=>g.regions).catch(e=>{if(i===0||e.name==='AbortError')throw e;return [] as Shape[];}))).then(parts=>setGeo(parts.flat())).catch(e=>{if(e.name!=='AbortError')setError(true);});
  return()=>c.abort();},[]);
 const byId=useMemo(()=>new Map(sources.map(s=>[s.id,s])),[sources]);
 const shapes=useMemo(()=>(geo||[]).filter(r=>r.kind===layer&&byId.has(r.id)&&(land==='all'||r.ags.startsWith(land))),[geo,byId,layer,land]);
 const most=useMemo(()=>Math.log10(sources.reduce((n,s)=>Math.max(n,s.count),2)+1),[sources]);
 const {fills,titles}=useMemo(()=>{
  // Reach and freshness: colour of the meeting-day bucket (shared/coverage.mjs); hatched = connected, no reports yet.
  const today=new Date().toISOString().slice(0,10);
  const color=(s:AdminSource)=>{if(mode==='reach'||mode==='fresh'){if(!s.count)return s.canImport?`url(#${pattern})`:AC.zero;return (mode==='reach'?REACH.get(reachBucket(s.firstEventAt,today)):FRESH.get(freshBucket(s.lastEventAt,today)))||AC.zero;}if(mode==='access')return ACCESS_COLOR[s.access]||AC.zero;if(mode==='coverage')return !s.canImport&&!s.count?COVERAGE.none:s.attemptStatus==='failed'?COVERAGE.failed:!s.canImport?COVERAGE.none:!s.count?`url(#${pattern})`:s.partial?COVERAGE.partial:COVERAGE.data;if(!s.count)return `url(#${pattern})`;const amount=mode==='count'?Math.log10(s.count+1)/most:Number(s.processing[mode as keyof typeof s.processing]||0)/s.count;return shareColor(amount);};
  return {fills:new Map(shapes.map(r=>[r.id,color(byId.get(r.id)!)])),titles:new Map(shapes.map(r=>{const s=byId.get(r.id)!;return [r.id,s.name+': '+s.count+' Berichte. '+s.state+(s.accessLabel?'. Zugang: '+s.accessLabel:'')];}))};
 },[shapes,byId,sources,mode,pattern,most]);
 // Die Auswahlfunktion der Seite entsteht bei jedem ihrer Durchläufe neu; die Flächen erhalten eine gleichbleibende.
 const toggleRef=useRef(onToggle);toggleRef.current=onToggle;const toggle=useCallback((id:string)=>toggleRef.current(id),[]);
 const legend=useMemo((): [string,string][]=>{
  const e=(t:number)=>Math.round(10**(t*most)-1).toLocaleString('de-DE'),hatch:[string,string]=[HATCH_CSS,'Angebunden, ohne Berichte'],none:[string,string]=[AC.zero,'Nicht angebunden'];
  if(mode==='coverage')return [[COVERAGE.data,'Berichte, keine Lücke gemeldet'],[COVERAGE.partial,'Teilstand'],[COVERAGE.failed,'Letzter Abruf fehlgeschlagen'],hatch,none];
  if(mode==='reach')return [...REACH_BUCKETS.filter(b=>b.id!=='none').map(b=>[REACH.get(b.id)!,b.label] as [string,string]),hatch,none];
  if(mode==='fresh')return [...FRESH_BUCKETS.filter(b=>b.id!=='none').map(b=>[FRESH.get(b.id)!,b.label] as [string,string]),hatch,none];
  if(mode==='access')return ACCESS_STATUSES.map(z=>[ACCESS_COLOR[z.id]||z.color,z.label] as [string,string]);
  const none0:[string,string]=[HATCH_CSS,'keine Berichte'];
  if(mode==='count')return [[AC.scale[0],'bis '+e(.2)],[AC.scale[1],'bis '+e(.5)],[AC.scale[2],'bis '+e(.8)],[AC.scale[3],'mehr'],none0];
  return [[AC.scale[0],'bis 20 %'],[AC.scale[1],'über 20 bis 50 %'],[AC.scale[2],'über 50 bis 80 %'],[AC.scale[3],'über 80 %'],none0];
 },[mode,most]);
 const h=hover?byId.get(hover):null,connected=shapes.filter(r=>byId.get(r.id)!.canImport).length;
 return <div className="admin-map"><div className="admin-map-canvas">{error?<p role="alert">Karte nicht verfügbar. Alle Gebiete lassen sich in der Liste auswählen.</p>:!geo?<p role="status">Karte wird geladen …</p>:<svg viewBox={viewBox(shapes)} aria-label="Gebiete durch Klicken auswählen; dieselbe Auswahl ist in der Liste erreichbar." role="img"><defs><pattern id={pattern} width="5" height="5" patternUnits="userSpaceOnUse"><rect width="5" height="5" fill="#fff"/><path d="M0 5L5 0" stroke={AC.hatch} strokeWidth="1"/></pattern></defs><Regions shapes={shapes} fills={fills} titles={titles} selected={selected} fine={shapes.length>1500} onToggle={toggle} onHover={setHover}/></svg>}</div><p className="admin-map-hover" aria-live="polite">{h?<><strong>{h.name}</strong> · {h.count.toLocaleString('de-DE')} Berichte · {h.state}{h.accessLabel?' · '+h.accessLabel:''}{h.count>0&&h.lastEventAt?' · Sitzungen '+mm(h.firstEventAt)+' bis '+mm(h.lastEventAt):''}</>:<>{shapes.length.toLocaleString('de-DE')} {layer==='city'?'Städte, Gemeinden und Gemeindeverbände':'Kreise'} auf der Karte, {connected.toLocaleString('de-DE')} mit angebundener Quelle · Dunkle Umrandung: ausgewählt</>}</p><Legend items={legend}/><small>© BKG (2026), <a href="https://www.govdata.de/dl-de/by-2-0" target="_blank" rel="noreferrer">dl-de/by-2-0</a>. Gemeinden und Kreise: VG250, Kreise in NRW: VG2500. Außerhalb von NRW auf Verwaltungsebene: ein Gemeindeverband (Samtgemeinde, Amt, Verbandsgemeinde, Verwaltungsgemeinschaft) ist ein Gebiet; Berlin und Hamburg stehen als je ein Gebiet.</small></div>;
}
