'use client';
import {memo,useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {X} from 'lucide-react';
import {StandLine} from '@/components/admin-stand';
import type {Stand} from '@/shared/admin-types';
import {AdminHeader,adminHref} from '@/components/admin-chrome';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from '@/components/ui/select';
import {REACH_BUCKETS,FRESH_BUCKETS,reachBucket,freshBucket} from '@/shared/coverage.mjs';
// Same data as the standalone gap atlas (scripts/dashboard/page.html), read live: the catalog and the atlas file of
// the deployed code, reports and imports from the database. Refreshed every five minutes while the page is open.
type Area={id:string;n:string;l:string;g:string;t:string;k:'c'|'i'|'d';p:number;m?:number;c:string;z:string;r?:number;u?:string;o?:string;v?:string;zc?:string;rb?:string;rn?:string;at?:string;cs?:string;nc?:number[];rs?:{url:string;hint?:string;proof?:string}[];cnt?:number;last?:string;st?:'failed'|'partial';fe?:string;le?:string;rk?:string;fk?:string};
type Category={id:string;label:string;open:boolean;color:string;why:string;help:string};
type Access={id:string;label:string;group:string;automated:boolean;color:string;explain:string};
type Atlas={stand?:Stand;asOf:string;builtAt:string;reportDate:string;statsPending:number;reports:number;texts:string[];categories:Category[];access:Access[];lands:Record<string,{name:string;short:string}>;areas:Area[]};
type Shape={id:string;ags:string;kind:string;path:string;bounds:number[]};
type View={x:number;y:number;w:number;h:number};
const FILES=['/geo/germany.json','/geo/de-areas.json'],REFRESH_MS=5*60*1000,PAGE=80,DIM='#e3e8ed';
// Reach (first agenda day) and freshness (latest meeting day) of the reports per area: shared/coverage.mjs.
const REACH_IDS=REACH_BUCKETS.map(b=>b.id),FRESH_IDS=FRESH_BUCKETS.map(b=>b.id),REACH_COLOR=new Map<string,string>(REACH_BUCKETS.map(b=>[b.id,b.color])),FRESH_COLOR=new Map<string,string>(FRESH_BUCKETS.map(b=>[b.id,b.color])),COLOR_MODES=['cat','access','reports','reach','fresh'],HATCH='repeating-linear-gradient(135deg,#f5f5f5 0 2px,#aab1bc 2px 3px)';
const n=(v:number)=>v.toLocaleString('de-DE');
const pct=(a:number,b:number)=>b?(100*a/b).toLocaleString('de-DE',{maximumFractionDigits:1,minimumFractionDigits:1})+' %':'–';
const mio=(v:number)=>v>=1e6?(v/1e6).toLocaleString('de-DE',{maximumFractionDigits:1})+' Mio.':n(v);
const time=(s:string)=>new Date(s).toLocaleString('de-DE',{timeZone:'Europe/Berlin',dateStyle:'short',timeStyle:'short'});
const day=(s:string)=>s?s.slice(0,10).split('-').reverse().join('.'):'';
const month=(s?:string)=>s?s.slice(0,7).split('-').reverse().join('.'):'–';
const isCityLevel=(a:Area)=>a.k!=='d';
const typeLabel=(a:Area)=>a.k==='d'?'Kreis':a.k==='i'?a.t+' (kreisfrei)':a.t;
const kindOf=(a:Area)=>a.k==='d'?'kreis':['Samtgemeinde','Verbandsgemeinde','Amt','Verwaltungsgemeinschaft','Verwaltungsverband'].includes(a.t)?'verb':'gem';
function Choice({label,value,onChange,items}:{label:string;value:string;onChange:(s:string)=>void;items:[string,string][]}){return <label className="admin-field"><span>{label}</span><Select value={value} onValueChange={onChange}><SelectTrigger aria-label={label}><SelectValue/></SelectTrigger><SelectContent>{items.map(([v,name])=><SelectItem key={v} value={v}>{name}</SelectItem>)}</SelectContent></Select></label>;}
// The shapes are drawn again only when fills or the selection change, not on every hover: several thousand paths.
const Regions=memo(function Regions({shapes,fills,selected,fine,onPick,onHover}:{shapes:Shape[];fills:Map<string,string>;selected:string|null;fine:boolean;onPick:(id:string)=>void;onHover:(id:string|null)=>void}){
 return <>{shapes.map(r=><path key={r.id} d={r.path} fill={fills.get(r.id)||DIM} stroke="#fff" strokeWidth={fine?.3:.5} vectorEffect="non-scaling-stroke" className="admin-map-region" onClick={()=>onPick(r.id)} onMouseEnter={()=>onHover(r.id)} onMouseLeave={()=>onHover(null)}/>)}{selected&&shapes.filter(r=>r.id===selected).map(r=><path key={'sel-'+r.id} d={r.path} fill="none" stroke="#101d37" strokeWidth="2.2" vectorEffect="non-scaling-stroke" pointerEvents="none"/>)}</>;
});
/** Admin page "Lückenatlas". Reads only. */
export function AdminAtlas({displayName,signOutPath}:{displayName:string;signOutPath:string}){
 const [data,setData]=useState<Atlas|null>(null),[error,setError]=useState(''),[attempt,setAttempt]=useState(0),[geo,setGeo]=useState<{shapes:Shape[];states:string[]}|null>(null),[geoError,setGeoError]=useState(false);
 const [cats,setCats]=useState<Set<string>|null>(null),[access,setAccess]=useState<Set<string>|null>(null),[reach,setReach]=useState<Set<string>|null>(null),[fresh,setFresh]=useState<Set<string>|null>(null),[colorBy,setColorBy]=useState('cat'),[layer,setLayer]=useState('city'),[land,setLand]=useState('all'),[type,setType]=useState('all'),[operator,setOperator]=useState('all'),[query,setQuery]=useState(''),[sort,setSort]=useState('pop'),[selected,setSelected]=useState<string|null>(null),[hover,setHover]=useState<string|null>(null),[shown,setShown]=useState(PAGE);
 const [view,setView]=useState<View|null>(null);const svgRef=useRef<SVGSVGElement>(null),drag=useRef<{x:number;y:number;view:View;moved:boolean}|null>(null),lastDrag=useRef(0);
 // Data: now and every five minutes; the shapes once.
 useEffect(()=>{const c=new AbortController();setError('');
  const load=()=>fetch('/api/admin/atlas',{cache:'no-cache',signal:c.signal}).then(async r=>{const d=await r.json() as Atlas&{error?:string};if(!r.ok)throw Error(d.error||'Der Lückenatlas konnte nicht geladen werden.');setData(d);}).catch(e=>{if(!c.signal.aborted)setError(e instanceof Error?e.message:'Der Lückenatlas konnte nicht geladen werden.');});
  void load();const timer=setInterval(load,REFRESH_MS);return()=>{c.abort();clearInterval(timer);};},[attempt]);
 useEffect(()=>{const c=new AbortController();
  Promise.all(FILES.map((file,i)=>fetch(file,{signal:c.signal}).then(r=>{if(!r.ok)throw Error();return r.json() as Promise<{regions:Shape[];states?:{path:string}[]}>;}).catch(e=>{if(i===0||e.name==='AbortError')throw e;return {regions:[] as Shape[],states:[] as {path:string}[]};}))).then(parts=>setGeo({shapes:parts.flatMap(p=>p.regions),states:(parts[0].states||[]).map(s=>s.path)})).catch(e=>{if(e.name!=='AbortError')setGeoError(true);});
  return()=>c.abort();},[]);
 // "farbe" in the address preselects the colour of the map (links of the overview).
 useEffect(()=>{const f=new URLSearchParams(window.location.search).get('farbe');if(f&&COLOR_MODES.includes(f))setColorBy(f);},[]);
 // Every area with its reach and freshness bucket, judged at the time of the data.
 const atlasAreas=useMemo(()=>{const today=(data?.asOf||'').slice(0,10);return (data?.areas||[]).map(a=>({...a,rk:reachBucket(a.fe,today),fk:freshBucket(a.le,today)}));},[data]);
 const byId=useMemo(()=>new Map(atlasAreas.map(a=>[a.id,a])),[atlasAreas]);
 const catById=useMemo(()=>new Map((data?.categories||[]).map(c=>[c.id,c])),[data]),accById=useMemo(()=>new Map((data?.access||[]).map(a=>[a.id,a])),[data]);
 const present=useMemo(()=>(data?.categories||[]).filter(c=>atlasAreas.some(a=>a.c===c.id)).map(c=>c.id),[data,atlasAreas]);
 const activeCats=cats||new Set(present),activeAccess=access||new Set((data?.access||[]).map(a=>a.id)),activeReach=reach||new Set(REACH_IDS),activeFresh=fresh||new Set(FRESH_IDS);
 const operators=useMemo(()=>{const count=new Map<string,number>();for(const a of atlasAreas)if(a.o&&catById.get(a.c)?.open)count.set(a.o,(count.get(a.o)||0)+1);return [...count].filter(([,k])=>k>=3).sort((x,y)=>y[1]-x[1]);},[atlasAreas,catById]);
 const matches=useMemo(()=>{
  const q=query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const test=(a:Area)=>activeCats.has(a.c)&&activeAccess.has(a.z)&&activeReach.has(a.rk||'none')&&activeFresh.has(a.fk||'none')&&(land==='all'||a.l===land)&&(type==='all'||kindOf(a)===type)&&(operator==='all'||(operator==='-'?!a.o:a.o===operator))&&(!q.length||q.every(w=>(a.n+' '+a.g+' '+(a.u||'')+' '+(a.r!==undefined?data!.texts[a.r]:'')).toLowerCase().includes(w)));
  return new Set(atlasAreas.filter(test).map(a=>a.id));
 },[data,atlasAreas,activeCats,activeAccess,activeReach,activeFresh,land,type,operator,query]);
 const list=useMemo(()=>{
  const rows=atlasAreas.filter(a=>matches.has(a.id));
  const by:Record<string,(a:Area,b:Area)=>number>={pop:(a,b)=>(isCityLevel(b)?b.p:b.p*.001)-(isCityLevel(a)?a.p:a.p*.001)||a.n.localeCompare(b.n,'de'),name:(a,b)=>a.n.localeCompare(b.n,'de'),land:(a,b)=>a.l.localeCompare(b.l)||a.n.localeCompare(b.n,'de'),reports:(a,b)=>(b.cnt||0)-(a.cnt||0)||a.n.localeCompare(b.n,'de')};
  return rows.sort(by[sort]||by.pop);
 },[atlasAreas,matches,sort]);
 useEffect(()=>setShown(PAGE),[matches,sort]);
 const shapes=useMemo(()=>(geo?.shapes||[]).filter(r=>byId.has(r.id)&&(layer==='city'?r.kind==='city':r.kind==='district')&&(land==='all'||r.ags.startsWith(land))),[geo,byId,layer,land]);
 const colorOf=useCallback((a:Area)=>{if(colorBy==='reach'||colorBy==='fresh'){if(catById.get(a.c)?.open)return DIM;if(!a.cnt)return 'url(#atlas-empty)';return (colorBy==='reach'?REACH_COLOR.get(a.rk||'none'):FRESH_COLOR.get(a.fk||'none'))||DIM;}if(colorBy==='access')return accById.get(a.z)?.color||DIM;if(colorBy==='reports')return !a.cnt?(a.c==='ok'?'#f2ce82':DIM):a.st==='failed'?'#ad392d':a.st==='partial'?'#99f6e4':'#0d9488';return catById.get(a.c)?.color||DIM;},[colorBy,catById,accById]);
 const fills=useMemo(()=>new Map(shapes.map(r=>{const a=byId.get(r.id)!;return [r.id,matches.has(r.id)?colorOf(a):DIM];})),[shapes,byId,matches,colorOf]);
 // The whole map, or the chosen Land; zoom and pan like the standalone page.
 const full=useMemo(()=>{const list=shapes.length?shapes:geo?.shapes||[];let [x0,y0,x1,y1]=[Infinity,Infinity,-Infinity,-Infinity];for(const {bounds:b} of list){if(b[0]<x0)x0=b[0];if(b[1]<y0)y0=b[1];if(b[2]>x1)x1=b[2];if(b[3]>y1)y1=b[3];}return list.length?{x:x0-6,y:y0-6,w:x1-x0+12,h:y1-y0+12}:{x:0,y:0,w:600,h:790};},[shapes,geo]);
 useEffect(()=>setView(null),[land,layer]);
 const current=view||full;
 const zoomAt=(factor:number,cx?:number,cy?:number)=>{const svg=svgRef.current;if(!svg)return;const r=svg.getBoundingClientRect();const px=cx===undefined?current.x+current.w/2:current.x+(cx-r.left)/r.width*current.w,py=cy===undefined?current.y+current.h/2:current.y+(cy-r.top)/r.height*current.h;const w=Math.min(full.w*1.4,Math.max(4,current.w/factor)),h=current.h*w/current.w;setView({x:px-(px-current.x)*w/current.w,y:py-(py-current.y)*h/current.h,w,h});};
 // React registers onWheel passively, so the page would scroll while the map zooms: a native listener instead.
 const zoomRef=useRef(zoomAt);zoomRef.current=zoomAt;
 useEffect(()=>{const svg=svgRef.current;if(!svg)return;const onWheel=(e:WheelEvent)=>{e.preventDefault();zoomRef.current(e.deltaY<0?1.25:.8,e.clientX,e.clientY);};svg.addEventListener('wheel',onWheel,{passive:false});return()=>svg.removeEventListener('wheel',onWheel);},[geo,geoError]);
 const pick=useCallback((id:string)=>{if(Date.now()-lastDrag.current<400)return;setSelected(prev=>prev===id?null:id);},[]);
 const detail=selected?byId.get(selected):null,hovered=hover?byId.get(hover):null;
 const stack=(items:{id:string;label:string;color:string}[],valueOf:(a:Area)=>string,active:Set<string>,setActive:(s:Set<string>|null)=>void,all:string[],pool?:Area[])=>{
  const areas=pool||atlasAreas,total=areas.length;
  return <><div className="admin-atlas-stack">{items.map(it=>{const k=areas.filter(a=>valueOf(a)===it.id).length;return k?<button key={it.id} type="button" style={{width:(100*k/total)+'%',background:it.color}} title={it.label+': '+n(k)+' Gebiete'} aria-label={'Nur '+it.label+' zeigen ('+n(k)+')'} onClick={()=>setActive(new Set([it.id]))}/>:null;})}</div>
  <div className="admin-atlas-chips"><button type="button" className="admin-chip is-group" onClick={()=>setActive(null)}>Alle</button>{items.map(it=>{const k=areas.filter(a=>valueOf(a)===it.id).length;return k?<button key={it.id} type="button" className="admin-chip" aria-pressed={active.has(it.id)} onClick={()=>{const next=new Set(active);if(next.has(it.id)&&next.size===all.length)setActive(new Set([it.id]));else{if(next.has(it.id))next.delete(it.id);else next.add(it.id);setActive(next.size?next:null);}}}><i style={{background:it.color}}/>{it.label} <span>{n(k)}</span></button>:null;})}</div></>;
 };
 const connected=atlasAreas.filter(a=>!catById.get(a.c)?.open),open=atlasAreas.filter(a=>catById.get(a.c)?.open);
 const popAll=atlasAreas.filter(isCityLevel).reduce((s,a)=>s+a.p,0),popOk=connected.filter(isCityLevel).reduce((s,a)=>s+a.p,0),withReports=atlasAreas.filter(a=>a.cnt).length;
 // What each reading method delivers: connected areas per method, reports, median per area with reports, reach, state.
 const methods=useMemo(()=>{
  const by=new Map<string,{areas:number;withReports:number;reports:number;partial:number;failed:number;deep:number;counts:number[]}>();
  for(const a of atlasAreas){if(catById.get(a.c)?.open)continue;const k=a.v||'Unbekannt';const m=by.get(k)||{areas:0,withReports:0,reports:0,partial:0,failed:0,deep:0,counts:[]};m.areas++;if(a.cnt){m.withReports++;m.reports+=a.cnt;m.counts.push(a.cnt);}if(a.st==='partial')m.partial++;if(a.st==='failed')m.failed++;if(a.rk==='y1'||a.rk==='y2')m.deep++;by.set(k,m);}
  return [...by].map(([name,m])=>({name,...m,median:m.counts.length?m.counts.sort((x,y)=>x-y)[Math.floor(m.counts.length/2)]:0})).sort((x,y)=>y.areas-x.areas);
 },[atlasAreas,catById]);
 return <div className="admin-app"><AdminHeader page="atlas" displayName={displayName} signOutPath={signOutPath}/><main id="inhalt" className="admin-shell admin-workspace">
  <div className="admin-heading"><div><p className="eyebrow">LÜCKENATLAS</p><h1>Welche Gebiete lesen wir, welche nicht, und warum?</h1><p>{displayName}</p><StandLine stand={data?data.stand??null:undefined} action="Aktualisieren" onAction={()=>setAttempt(a=>a+1)} extra={data?<> · Gründe aus der Quellensuche vom {data.reportDate}</>:null}/></div></div>
  {error&&<p role="alert" className="admin-error">{error} <button type="button" className="admin-timeline-retry" onClick={()=>setAttempt(a=>a+1)}>Erneut laden</button></p>}
  {!data&&!error&&<p role="status" className="admin-note">Alle {n(5324)} Gebiete werden mit Anbindung, Grund und Berichtsstand geladen …</p>}
  {data&&<>
   {data.statsPending>0&&<p role="status" className="admin-notice">Berichtszahlen von {n(data.statsPending)} Gebieten werden noch berechnet; die nächste Aktualisierung zeigt sie.</p>}
   <section className="admin-kpis" aria-label="Kennzahlen">
    <div className="admin-kpi admin-kpi-primary"><span>Gebiete angebunden</span><strong>{n(connected.length)}<em> / {n(atlasAreas.length)}</em></strong><small>{pct(connected.length,data.areas.length)}</small></div>
    <div className="admin-kpi admin-kpi-primary"><span>Einwohner erreicht</span><strong>{pct(popOk,popAll)}</strong><small>{mio(popOk)} von {mio(popAll)} auf der Gemeindeebene</small></div>
    <div className="admin-kpi"><span>Gebiete offen</span><strong>{n(open.length)}</strong><small>{mio(open.filter(isCityLevel).reduce((s,a)=>s+a.p,0))} Einwohner auf der Gemeindeebene</small></div>
    <div className="admin-kpi"><span>Mit gespeicherten Berichten</span><strong>{n(withReports)}</strong><small>{n(data.reports)} Berichte in der Datenbank</small></div>
   </section>
   <div className="admin-atlas-why">
    <section className="admin-section"><div className="admin-section-heading"><div><p className="eyebrow">ANBINDUNG</p><h2>Warum Gebiete offen sind</h2></div><span className="admin-note">Anklicken filtert Karte und Liste.</span></div>{stack(data.categories.filter(c=>present.includes(c.id)),a=>a.c,activeCats,s=>{setCats(s);setColorBy('cat');},present)}</section>
    <section className="admin-section"><div className="admin-section-heading"><div><p className="eyebrow">ZUGANG FÜR PROGRAMME</p><h2>Bekommen wir Daten, und auf welchem Weg?</h2></div><span className="admin-note">Ja: wird gelesen. Noch nicht: ein Leser fehlt. Nein: Sperre oder nichts gefunden. robots.txt steht beim Gebiet, es wird nicht befolgt.</span></div>{stack(data.access,a=>a.z,activeAccess,s=>{setAccess(s);setColorBy('access');},data.access.map(a=>a.id))}</section>
   </div>
   <div className="admin-atlas-why">
    <section className="admin-section"><div className="admin-section-heading"><div><p className="eyebrow">RÜCKREICHWEITE</p><h2>Wie weit zurück reichen die Berichte?</h2></div><span className="admin-note">Erster Tagesordnungstag je angebundenem Gebiet.</span></div>{stack([...REACH_BUCKETS],a=>a.rk||'none',activeReach,s=>{setReach(s);setColorBy('reach');},REACH_IDS,connected)}</section>
    <section className="admin-section"><div className="admin-section-heading"><div><p className="eyebrow">AKTUALITÄT</p><h2>Wie aktuell sind die Berichte?</h2></div><span className="admin-note">Jüngster Sitzungstag je angebundenem Gebiet.</span></div>{stack([...FRESH_BUCKETS],a=>a.fk||'none',activeFresh,s=>{setFresh(s);setColorBy('fresh');},FRESH_IDS,connected)}</section>
   </div>
   <div className="admin-atlas-main">
    <section className="admin-section admin-atlas-map" aria-label="Karte">
     <div className="admin-atlas-tools">
      <div className="admin-seg" role="group" aria-label="Ebene"><button type="button" aria-pressed={layer==='city'} onClick={()=>setLayer('city')}>Gemeindeebene</button><button type="button" aria-pressed={layer==='district'} onClick={()=>setLayer('district')}>Kreise</button></div>
      <div className="admin-seg" role="group" aria-label="Farbe"><button type="button" aria-pressed={colorBy==='cat'} onClick={()=>setColorBy('cat')}>Anbindung</button><button type="button" aria-pressed={colorBy==='access'} onClick={()=>setColorBy('access')}>Zugang</button><button type="button" aria-pressed={colorBy==='reports'} onClick={()=>setColorBy('reports')}>Berichte</button><button type="button" aria-pressed={colorBy==='reach'} onClick={()=>setColorBy('reach')}>Reichweite</button><button type="button" aria-pressed={colorBy==='fresh'} onClick={()=>setColorBy('fresh')}>Aktualität</button></div>
      <div className="admin-zoom"><button type="button" aria-label="Hineinzoomen" onClick={()=>zoomAt(1.6)}>+</button><button type="button" aria-label="Herauszoomen" onClick={()=>zoomAt(.625)}>−</button><button type="button" onClick={()=>setView(null)}>Ganz</button></div>
     </div>
     <div className="admin-atlas-canvas">{geoError?<p role="alert">Karte nicht verfügbar. Alle Gebiete stehen in der Liste.</p>:!geo?<p role="status">Karte wird geladen …</p>:
      <svg ref={svgRef} viewBox={`${current.x} ${current.y} ${current.w} ${current.h}`} role="img" aria-label="Karte der Gebiete, eingefärbt nach Anbindung, Zugang oder Berichten. Alle Gebiete stehen auch in der Liste."
       onPointerDown={e=>{if(e.button!==0)return;drag.current={x:e.clientX,y:e.clientY,view:current,moved:false};(e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);}}
       onPointerMove={e=>{const d=drag.current;if(!d)return;const dx=e.clientX-d.x,dy=e.clientY-d.y;if(Math.abs(dx)+Math.abs(dy)>4)d.moved=true;if(d.moved){const r=(e.currentTarget as SVGSVGElement).getBoundingClientRect();setView({x:d.view.x-dx/r.width*d.view.w,y:d.view.y-dy/r.height*d.view.h,w:d.view.w,h:d.view.h});}}}
       onPointerUp={()=>{if(drag.current?.moved)lastDrag.current=Date.now();drag.current=null;}} onPointerCancel={()=>{drag.current=null;}}>
       <defs><pattern id="atlas-empty" width="5" height="5" patternUnits="userSpaceOnUse"><rect width="5" height="5" fill="#f5f5f5"/><path d="M0 5L5 0" stroke="#aab1bc" strokeWidth=".5"/></pattern></defs><g className="admin-atlas-states">{geo.states.map((d,i)=><path key={i} d={d} fill="none" stroke="#8a95a5" strokeWidth=".9" vectorEffect="non-scaling-stroke" pointerEvents="none"/>)}</g>
       <Regions shapes={shapes} fills={fills} selected={selected} fine={shapes.length>1500} onPick={pick} onHover={setHover}/>
      </svg>}</div>
     <p className="admin-map-hover" aria-live="polite">{hovered?<><strong>{hovered.n}</strong> · {typeLabel(hovered)} · {catById.get(hovered.c)?.label}{hovered.cnt?` · ${n(hovered.cnt)} Berichte${hovered.fe?' · Sitzungen '+month(hovered.fe)+' bis '+month(hovered.le):''}`:''}{hovered.r!==undefined?<span className="admin-atlas-reason"> · {data.texts[hovered.r]}</span>:''}</>:<>{n(shapes.length)} {layer==='city'?'Städte, Gemeinden und Gemeindeverbände':'Kreise'} auf der Karte, {n(shapes.filter(r=>matches.has(r.id)).length)} passen zu den Filtern. Mausrad oder Plus/Minus zoomt, Ziehen verschiebt, Klick zeigt das Gebiet.</>}</p>
     <div className="admin-map-legend">{(colorBy==='cat'?data.categories.filter(c=>present.includes(c.id)).map(c=>[c.color,c.label]):colorBy==='access'?data.access.map(a=>[a.color,a.label]):colorBy==='reach'?[...REACH_BUCKETS.filter(b=>b.id!=='none').map(b=>[b.color,b.label]),[HATCH,'Angebunden, ohne Berichte'],[DIM,'Nicht angebunden']]:colorBy==='fresh'?[...FRESH_BUCKETS.filter(b=>b.id!=='none').map(b=>[b.color,b.label]),[HATCH,'Angebunden, ohne Berichte'],[DIM,'Nicht angebunden']]:[['#0d9488','Berichte gespeichert'],['#99f6e4','Teilstand'],['#ad392d','Abruf fehlgeschlagen'],['#f2ce82','Angebunden, ohne Berichte'],[DIM,'Nicht angebunden']]).map(([c,t])=><span key={t}><i style={{background:c}}/>{t}</span>)}</div>
    </section>
    <section className="admin-section admin-atlas-list" aria-label="Liste">
     <div className="admin-source-controls">
      <label className="admin-field"><span>Name, Schlüssel, Adresse oder Grund</span><Input value={query} placeholder="Suchen …" onChange={e=>setQuery(e.target.value)}/></label>
      <Choice label="Land" value={land} onChange={setLand} items={[['all','Alle Länder'],...Object.entries(data.lands).sort((a,b)=>a[1].name.localeCompare(b[1].name,'de')).map(([id,l])=>[id,l.name] as [string,string])]}/>
      <Choice label="Art" value={type} onChange={setType} items={[['all','Alle Arten'],['gem','Städte und Gemeinden'],['verb','Gemeindeverbände'],['kreis','Kreise']]}/>
      <Choice label="Betreiber oder Rechner" value={operator} onChange={setOperator} items={[['all','Alle'],['-','ohne gefundene Adresse'],...operators.map(([o,k])=>[o,`${o} (${n(k)} offen)`] as [string,string])]}/>
      <Choice label="Sortierung" value={sort} onChange={setSort} items={[['pop','Einwohner, größte zuerst'],['reports','Berichte, meiste zuerst'],['name','Name'],['land','Land, dann Name']]}/>
     </div>
     <div className="admin-list-meta"><span>{n(list.length)} von {n(atlasAreas.length)} Gebieten · {mio(list.filter(isCityLevel).reduce((s,a)=>s+a.p,0))} Einwohner auf der Gemeindeebene</span><Button variant="link" onClick={()=>{setCats(null);setAccess(null);setReach(null);setFresh(null);setLand('all');setType('all');setOperator('all');setQuery('');setSelected(null);}}>Filter zurücksetzen</Button></div>
     <div className="admin-atlas-rows" role="list">{list.slice(0,shown).map(a=><button key={a.id} type="button" role="listitem" className="admin-atlas-row" aria-current={selected===a.id?'true':undefined} style={{['--c' as string]:colorOf(a)}} onClick={()=>setSelected(a.id)}><span className="admin-atlas-dot"/><span className="admin-atlas-name">{a.n}{a.nc&&<em className="admin-atlas-flag">Neuprüfung</em>}</span><span className="admin-atlas-pop">{data.lands[a.l]?.short}{isCityLevel(a)&&a.p?' · '+n(a.p):''}</span><span className="admin-atlas-meta">{typeLabel(a)} · {catById.get(a.c)?.label}{a.cnt?` · ${n(a.cnt)} Berichte${a.fe?' seit '+month(a.fe):''}`:''}{a.r!==undefined?' · '+data.texts[a.r]:a.v?' · '+a.v:''}</span></button>)}{!list.length&&<p className="admin-empty">Kein Gebiet passt zu diesen Filtern.</p>}{shown<list.length&&<Button variant="outline" onClick={()=>setShown(s=>s+PAGE)}>Weitere {n(Math.min(PAGE,list.length-shown))} anzeigen</Button>}</div>
     {detail&&<div className="admin-atlas-detail" role="region" aria-label={'Gebiet '+detail.n}>
      <div className="admin-atlas-detail-head"><div><p className="eyebrow">{typeLabel(detail)} · {data.lands[detail.l]?.name}</p><h2>{detail.n}</h2><span className="admin-pill" style={{['--c' as string]:catById.get(detail.c)?.color}}><i/>{catById.get(detail.c)?.label}</span> <span className="admin-pill" style={{['--c' as string]:accById.get(detail.z)?.color}}><i/>{accById.get(detail.z)?.label}</span></div><button type="button" className="admin-atlas-close" aria-label="Schließen" onClick={()=>setSelected(null)}><X size={18}/></button></div>
      <dl className="admin-atlas-facts">
       <div><dt>Schlüssel</dt><dd className="admin-mono">{detail.g}</dd></div><div><dt>Einwohner</dt><dd>{detail.p?n(detail.p)+(detail.k==='d'?' (Kreis, umfasst seine Gemeinden)':''):'–'}</dd></div>{detail.m&&<div><dt>Mitgliedsgemeinden</dt><dd>{n(detail.m)}</dd></div>}
       {detail.v&&<div><dt>Verfahren</dt><dd>{detail.v}{detail.zc&&detail.zc!==detail.v?' · '+detail.zc:''}</dd></div>}{detail.rn&&<div><dt>robots.txt</dt><dd>{detail.rn}</dd></div>}{detail.cs&&<div><dt>Freigabe</dt><dd>vom {day(detail.cs)}</dd></div>}{detail.at&&<div><dt>Geprüft</dt><dd>{day(detail.at)}</dd></div>}
       <div><dt>Berichte</dt><dd>{detail.cnt?n(detail.cnt)+(detail.st==='partial'?' · Teilstand':''):'noch keine'}{detail.st==='failed'?' · letzter Abruf fehlgeschlagen':''}</dd></div>{detail.fe&&<div><dt>Sitzungen</dt><dd>{day(detail.fe)} bis {day(detail.le||'')}</dd></div>}{detail.last&&<div><dt>Letzter Abruf</dt><dd>{time(detail.last)}</dd></div>}
       {detail.u&&<div><dt>{catById.get(detail.c)?.open?'Gefundene Adresse':'Adresse'}</dt><dd><a className="admin-mono" href={detail.u} target="_blank" rel="noreferrer noopener">{detail.u}</a></dd></div>}
      </dl>
      {detail.r!==undefined&&<div className="admin-atlas-block"><p className="eyebrow">Grund laut Prüfbericht</p><blockquote style={{['--c' as string]:catById.get(detail.c)?.color}}>{data.texts[detail.r]}</blockquote></div>}
      <div className="admin-atlas-block"><p className="eyebrow">{catById.get(detail.c)?.open?'Warum diese Lücke besteht':'Was das heißt'}</p><p>{catById.get(detail.c)?.why}</p></div>
      <div className="admin-atlas-block"><p className="eyebrow">{catById.get(detail.c)?.open?'Was sie schließen könnte':'Nächster Schritt'}</p><p>{catById.get(detail.c)?.help}</p></div>
      <div className="admin-atlas-block"><p className="eyebrow">Zugang für Programme</p><p>{accById.get(detail.z)?.explain}</p></div>
      {detail.nc&&<div className="admin-atlas-block"><p className="eyebrow">Neuprüfung vorgesehen</p>{detail.nc.map(i=><p key={i}>{data.texts[i]}</p>)}</div>}
      {detail.rs&&<div className="admin-atlas-block"><p className="eyebrow">Kandidaten aus der Länderrecherche (ungeprüft)</p>{detail.rs.map(c=><p key={c.url}><a className="admin-mono" href={c.url} target="_blank" rel="noreferrer noopener">{c.url}</a>{c.hint&&<><br/>{c.hint}</>}{c.proof&&<><br/><small>Beleg: {c.proof}</small></>}</p>)}</div>}
      {detail.cnt?<p><a href={'/datenabdeckung?region='+detail.id}>Quellen und Berichte ansehen →</a> · <a href={adminHref('abruf','auswahl='+detail.id)}>Abrufen →</a></p>:catById.get(detail.c)?.open?null:<p><a href={adminHref('abruf','auswahl='+detail.id)}>Abrufen →</a></p>}
     </div>}
    </section>
   </div>
   <section className="admin-section" aria-labelledby="verfahren">
    <div className="admin-section-heading"><div><p className="eyebrow">NACH VERFAHREN</p><h2 id="verfahren">Was die Leseverfahren liefern</h2></div><span className="admin-note">Angebundene Gebiete je Verfahren; Median über Gebiete mit Berichten; „ab 1 Jahr zurück“ nach dem ersten Tagesordnungstag.</span></div>
    <div className="admin-lands" role="region" aria-label="Berichte je Verfahren" tabIndex={0}><table><thead><tr><th>Verfahren</th><th>Gebiete</th><th>Mit Berichten</th><th>Berichte</th><th>Median je Gebiet</th><th>Ab 1 Jahr zurück</th><th>Teilstand</th><th>Abruf fehlgeschlagen</th></tr></thead><tbody>{methods.map(m=><tr key={m.name}><th>{m.name}</th><td>{n(m.areas)}</td><td>{n(m.withReports)} <small>{pct(m.withReports,m.areas)}</small></td><td>{n(m.reports)}</td><td>{n(m.median)}</td><td>{n(m.deep)} <small>{pct(m.deep,m.areas)}</small></td><td>{n(m.partial)}</td><td>{n(m.failed)}</td></tr>)}</tbody></table></div>
   </section>
  </>}
  <footer className="admin-footer">Anbindung und Gründe aus dem Quellenkatalog und den Prüfberichten des Codes (Lückenatlas-Build), Berichte und Abrufe aus der Datenbank. © BKG (2026), dl-de/by-2-0. <a href={adminHref('uebersicht')}>Zur Übersicht</a></footer>
 </main></div>;
}
