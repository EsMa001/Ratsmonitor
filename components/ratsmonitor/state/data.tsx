import {createContext,useContext,useEffect,useState,type ReactNode} from 'react';
import {usePathname} from 'next/navigation';
import {GeoModel} from '../lib/geo/geoModel';
import {PlaceIndex} from '../lib/place';
import type {MapData} from '../types';
const DataContext=createContext<{geo:GeoModel|null;place:PlaceIndex|null;geoError:boolean}>({geo:null,place:null,geoError:false});
// Der Browser hält die Karte einen Tag (public/_headers). Nach einer Änderung von de_map.json die Version erhöhen.
const MAP_URL='/data/de_map.json?v=2018-1';

/**
 * Karten- und Ortsdaten (de_map.json, ca. 1,2 MB komprimiert). Auf der Startseite sofort geladen;
 * auf Detail- und Kontoseiten erst, wenn der Browser untätig ist, damit der erste Seitenaufbau nicht wartet.
 */
export function DataProvider({children}:{children:ReactNode}){
 const [data,setData]=useState({geo:null as GeoModel|null,place:null as PlaceIndex|null,geoError:false});
 const pathname=usePathname();
 const [wanted,setWanted]=useState(pathname==='/');
 useEffect(()=>{
  if(wanted)return;
  if(pathname==='/'){setWanted(true);return;}
  const w=window as Window&{requestIdleCallback?:(cb:()=>void,o?:{timeout:number})=>number;cancelIdleCallback?:(id:number)=>void};
  if(w.requestIdleCallback){const id=w.requestIdleCallback(()=>setWanted(true),{timeout:4000});return()=>w.cancelIdleCallback?.(id);}
  const t=setTimeout(()=>setWanted(true),2500);return()=>clearTimeout(t);
 },[pathname,wanted]);
 useEffect(()=>{
  if(!wanted)return;
  const ctrl=new AbortController();
  fetch(MAP_URL,{signal:ctrl.signal}).then(r=>{if(!r.ok)throw Error();return r.json() as Promise<MapData>}).then(d=>{if(ctrl.signal.aborted)return;const geo=new GeoModel(d);setData({geo,place:new PlaceIndex(d,geo),geoError:false});}).catch(()=>{if(!ctrl.signal.aborted)setData({geo:null,place:null,geoError:true});});
  return()=>ctrl.abort();
 },[wanted]);
 return <DataContext.Provider value={data}>{children}</DataContext.Provider>;
}
export const useData=()=>useContext(DataContext);
