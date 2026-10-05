import { newId } from '../lib/uuid';
import {createContext,useContext,useEffect,useMemo,useState,type ReactNode} from 'react';
import type {SavedSearch,NotifyFreq} from '../types';
import {signature,type SearchSnapshot} from '../lib/savedSearch';
import {readSavedSearches,writeSavedSearches} from '../services/api';
type Account={saved:SavedSearch[];ready:boolean;addSaved:(snap:SearchSnapshot,name:string,notify?:{on:boolean;freq:NotifyFreq})=>SavedSearch;updateSaved:(id:string,patch:Partial<SavedSearch>)=>void;removeSaved:(id:string)=>void};
const Context=createContext<Account|null>(null);
export function AccountProvider({children}:{children:ReactNode}){
 const [saved,setSaved]=useState<SavedSearch[]>([]),[ready,setReady]=useState(false);
 useEffect(()=>{setSaved(readSavedSearches());setReady(true);},[]);
 const save=(list:SavedSearch[])=>{writeSavedSearches(list);setSaved(list);};
 const value:Account={saved,ready,addSaved(snap,name){const today=new Date().toISOString().slice(0,10),s:SavedSearch={...snap,id:newId(),name,created:today,lastSeen:today,notify:{on:false,freq:'daily'}};save([s,...saved]);return s;},updateSaved(id,patch){save(saved.map(s=>s.id===id?{...s,...patch}:s));},removeSaved(id){save(saved.filter(s=>s.id!==id));}};
 return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useAccount(){const v=useContext(Context);if(!v)throw Error('AccountProvider fehlt');return v;}
export function useSavedStats(){const {saved}=useAccount();return useMemo(()=>({signatures:new Map(saved.map(s=>[signature(s),s]))}),[saved]);}
