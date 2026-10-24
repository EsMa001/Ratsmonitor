import {createContext,useContext,useEffect,useState,type ReactNode} from 'react';
import {usePathname} from 'next/navigation';
import {GeoModel} from '../lib/geo/geoModel';
import {PlaceIndex} from '../lib/place';
import type {MapData} from '../types';
const DataContext=createContext<{geo:GeoModel|null;place:PlaceIndex|null;geoError:boolean}>({geo:null,place:null,geoError:false});
// Der Browser hält die Karte einen Tag (public/_headers). Nach einer Änderung von de_map.json die Version erhöhen.
// Grenzen: BKG VG250, Stand 2025 (scripts/build-map.mjs).
const MAP_URL='/data/de_map.json?v=2025-1';

/* Seiten, die die Karte gleich zeichnen: Suche und plenara.X Atlas, Fakten, Trends (dort stand sonst bis zu 4 s „Karte wird
   aufgebaut …“, bevor der Abruf überhaupt begann). Signale und Ausschreibungen zeigen die Karte erst auf Knopfdruck. */
const MAP_NOW=new Set(['/suche','/analytics/atlas','/analytics/fakten','/analytics/trends']);

/**
 * Karten- und Ortsdaten (de_map.json, ca. 1,2 MB komprimiert). Auf den Seiten mit Karte (MAP_NOW) sofort geladen;
 * sonst erst, wenn der Browser untätig ist, damit der erste Seitenaufbau nicht wartet.
 */
export function DataProvider({children}:{children:ReactNode}){
 const [data,setData]=useState({geo:null as GeoModel|null,place:null as PlaceIndex|null,geoError:false});
 const pathname=usePathname();
 const [wanted,setWanted]=useState(MAP_NOW.has(pathname));
 /* Auf einer Seite mit Karte sofort (beim Rendern gemerkt, bleibt auch nach dem Wegnavigieren), sonst im Leerlauf */
 if(!wanted&&MAP_NOW.has(pathname))setWanted(true);
 const want=wanted||MAP_NOW.has(pathname);
 useEffect(()=>{
  if(want)return;
  const w=window as Window&{requestIdleCallback?:(cb:()=>void,o?:{timeout:number})=>number;cancelIdleCallback?:(id:number)=>void};
  if(w.requestIdleCallback){const id=w.requestIdleCallback(()=>setWanted(true),{timeout:4000});return()=>w.cancelIdleCallback?.(id);}
  const t=setTimeout(()=>setWanted(true),2500);return()=>clearTimeout(t);
 },[want]);
 useEffect(()=>{
  if(!want)return;
  const ctrl=new AbortController();
  fetch(MAP_URL,{signal:ctrl.signal}).then(r=>{if(!r.ok)throw Error();return r.json() as Promise<MapData>}).then(d=>{if(ctrl.signal.aborted)return;const geo=new GeoModel(d);setData({geo,place:new PlaceIndex(d,geo),geoError:false});}).catch(()=>{if(!ctrl.signal.aborted)setData({geo:null,place:null,geoError:true});});
  return()=>ctrl.abort();
 },[want]);
 return <DataContext.Provider value={data}>{children}</DataContext.Provider>;
}
export const useData=()=>useContext(DataContext);
