'use client';
import {memo,useCallback,useEffect,useId,useMemo,useRef,useState} from 'react';
import type {AdminSource} from '@/shared/admin-types';
type Shape={id:string;ags:string;kind:string;path:string;bounds:number[]};
// NRW und Niedersachsen liegen in germany.json (auch Grundlage der öffentlichen Analysekarte),
// die übrigen 14 Länder in de-areas.json (scripts/build-de.mjs).
const FILES=['/geo/germany.json','/geo/de-areas.json'];
// Ausschnitt: Umriss der gezeigten Gebiete mit Rand.
function viewBox(shapes:Shape[]){if(!shapes.length)return '0 0 600 790';let [x0,y0,x1,y1]=[Infinity,Infinity,-Infinity,-Infinity];for(const {bounds:b} of shapes){if(b[0]<x0)x0=b[0];if(b[1]<y0)y0=b[1];if(b[2]>x1)x1=b[2];if(b[3]>y1)y1=b[3];}return (x0-6)+' '+(y0-6)+' '+(x1-x0+12)+' '+(y1-y0+12);}
// Die Flächen werden nur neu gezeichnet, wenn sich Gebiete, Farben oder Auswahl ändern, nicht bei jeder Mausbewegung
// oder Statusmeldung eines laufenden Auftrags: die bundesweite Karte hat mehrere tausend Flächen.
const Regions=memo(function Regions({shapes,fills,titles,selected,fine,onToggle,onHover}:{shapes:Shape[];fills:Map<string,string>;titles:Map<string,string>;selected:Set<string>;fine:boolean;onToggle:(id:string)=>void;onHover:(id:string|null)=>void}){
 return <>{[...shapes].sort((a,b)=>Number(selected.has(a.id))-Number(selected.has(b.id))).map(r=><path key={r.id} d={r.path} fill={fills.get(r.id)} stroke={selected.has(r.id)?'#101d37':'#fff'} strokeWidth={selected.has(r.id)?2.2:fine?.35:.55} vectorEffect="non-scaling-stroke" onClick={()=>onToggle(r.id)} onMouseEnter={()=>onHover(r.id)} onMouseLeave={()=>onHover(null)} className="admin-map-region"><title>{titles.get(r.id)+(selected.has(r.id)?'. Ausgewählt':'')}</title></path>)}</>;
});
export function AdminProcessingMap({sources,selected,onToggle,layer,mode,land='all'}:{sources:AdminSource[];selected:Set<string>;onToggle:(id:string)=>void;layer:string;mode:string;land?:string}){
 const [geo,setGeo]=useState<Shape[]|null>(null),[error,setError]=useState(false),[hover,setHover]=useState<string|null>(null);const pattern='admin-map-'+useId().replaceAll(':','');
 useEffect(()=>{const c=new AbortController();
  // Fehlt die Datei der übrigen Länder, bleibt die Karte von NRW und Niedersachsen nutzbar.
  Promise.all(FILES.map((file,i)=>fetch(file,{signal:c.signal}).then(r=>{if(!r.ok)throw Error();return r.json() as Promise<{regions:Shape[]}>;}).then(g=>g.regions).catch(e=>{if(i===0||e.name==='AbortError')throw e;return [] as Shape[];}))).then(parts=>setGeo(parts.flat())).catch(e=>{if(e.name!=='AbortError')setError(true);});
  return()=>c.abort();},[]);
 const byId=useMemo(()=>new Map(sources.map(s=>[s.id,s])),[sources]);
 const shapes=useMemo(()=>(geo||[]).filter(r=>r.kind===layer&&byId.has(r.id)&&(land==='all'||r.ags.startsWith(land))),[geo,byId,layer,land]);
 const {fills,titles}=useMemo(()=>{
  const most=Math.log10(sources.reduce((n,s)=>Math.max(n,s.count),2)+1);
  const color=(s:AdminSource)=>{if(mode==='coverage')return !s.canImport&&!s.count?'#e4e7eb':s.attemptStatus==='failed'?'#ad392d':!s.canImport?'#e4e7eb':!s.count?'#f2ce82':s.partial?'#99f6e4':'#0d9488';if(!s.count)return `url(#${pattern})`;const amount=mode==='count'?Math.log10(s.count+1)/most:Number(s.processing[mode as keyof typeof s.processing]||0)/s.count;return amount>.8?'#0f766e':amount>.5?'#0d9488':amount>.2?'#72d4ca':'#b9eae4';};
  return {fills:new Map(shapes.map(r=>[r.id,color(byId.get(r.id)!)])),titles:new Map(shapes.map(r=>{const s=byId.get(r.id)!;return [r.id,s.name+': '+s.count+' Berichte. '+s.state];}))};
 },[shapes,byId,sources,mode,pattern]);
 // Die Auswahlfunktion der Seite entsteht bei jedem ihrer Durchläufe neu; die Flächen erhalten eine gleichbleibende.
 const toggleRef=useRef(onToggle);toggleRef.current=onToggle;const toggle=useCallback((id:string)=>toggleRef.current(id),[]);
 const h=hover?byId.get(hover):null,connected=shapes.filter(r=>byId.get(r.id)!.canImport).length;
 return <div className="admin-map"><div className="admin-map-canvas">{error?<p role="alert">Karte nicht verfügbar. Alle Gebiete lassen sich in der Liste auswählen.</p>:!geo?<p role="status">Karte wird geladen …</p>:<svg viewBox={viewBox(shapes)} aria-label="Gebiete durch Klicken auswählen; dieselbe Auswahl ist in der Liste erreichbar." role="img"><defs><pattern id={pattern} width="5" height="5" patternUnits="userSpaceOnUse"><rect width="5" height="5" fill="#f5f5f5"/><path d="M0 5L5 0" stroke="#aab1bc" strokeWidth=".5"/></pattern></defs><Regions shapes={shapes} fills={fills} titles={titles} selected={selected} fine={shapes.length>1500} onToggle={toggle} onHover={setHover}/></svg>}</div><p className="admin-map-hover" aria-live="polite">{h?<><strong>{h.name}</strong> · {h.count.toLocaleString('de-DE')} Berichte · {h.state}</>:<>{shapes.length.toLocaleString('de-DE')} {layer==='city'?'Städte, Gemeinden und Gemeindeverbände':'Kreise'} auf der Karte, {connected.toLocaleString('de-DE')} mit angebundener Quelle · Dunkle Umrandung: ausgewählt</>}</p><div className="admin-map-legend">{(mode==='coverage'?[['#0d9488','Daten vorhanden'],['#99f6e4','Teilbestand'],['#ad392d','Abruf fehlgeschlagen'],['#f2ce82','Angebunden, ohne Daten'],['#e4e7eb','Nicht angebunden']]:[['#b9eae4','Wenig / 0'],['#72d4ca','Mehr'],['#0f766e','Viel / vollständig']]).map(([c,t])=><span key={t}><i style={{background:c}}/>{t}</span>)}</div><small>© BKG (2026), <a href="https://www.govdata.de/dl-de/by-2-0" target="_blank" rel="noreferrer">dl-de/by-2-0</a>. Gemeinden und Kreise: VG250, Kreise in NRW: VG2500. Außerhalb von NRW auf Verwaltungsebene: ein Gemeindeverband (Samtgemeinde, Amt, Verbandsgemeinde, Verwaltungsgemeinschaft) ist ein Gebiet; Berlin und Hamburg stehen als je ein Gebiet. {mode!=='coverage'&&'Helle Farbe bei vorhandenem Bestand bedeutet 0, Schraffur bedeutet keine Berichte.'}</small></div>;
}
