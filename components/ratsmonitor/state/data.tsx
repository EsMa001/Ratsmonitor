import {createContext,useContext,useEffect,useState,type ReactNode} from 'react';
import {GeoModel} from '../lib/geo/geoModel';
import {PlaceIndex} from '../lib/place';
import type {MapData} from '../types';
const DataContext=createContext<{geo:GeoModel|null;place:PlaceIndex|null;geoError:boolean}>({geo:null,place:null,geoError:false});
export function DataProvider({children}:{children:ReactNode}){
 const [data,setData]=useState({geo:null as GeoModel|null,place:null as PlaceIndex|null,geoError:false});
 useEffect(()=>{const ctrl=new AbortController();fetch('/data/de_map.json',{signal:ctrl.signal}).then(r=>{if(!r.ok)throw Error();return r.json() as Promise<MapData>}).then(d=>{if(ctrl.signal.aborted)return;const geo=new GeoModel(d);setData({geo,place:new PlaceIndex(d,geo),geoError:false});}).catch(()=>{if(!ctrl.signal.aborted)setData({geo:null,place:null,geoError:true});});return()=>ctrl.abort();},[]);
 return <DataContext.Provider value={data}>{children}</DataContext.Provider>;
}
export const useData=()=>useContext(DataContext);
