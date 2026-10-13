import { newId } from '../lib/uuid';
import {createContext,useCallback,useContext,useEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import type {SavedSearch,NotifyFreq} from '../types';
import {signature,type SearchSnapshot} from '../lib/savedSearch';
import {readSavedSearches,writeSavedSearches,SAVED_SEARCHES_KEY} from '../services/api';
import {onOtherTab} from '../lib/otherTab';
import {todayLocal} from '../lib/text';
type Account={saved:SavedSearch[];ready:boolean;addSaved:(snap:SearchSnapshot,name:string,notify?:{on:boolean;freq:NotifyFreq})=>SavedSearch;updateSaved:(id:string,patch:Partial<SavedSearch>)=>void;removeSaved:(id:string)=>void;restoreSaved:(s:SavedSearch,index:number)=>void;clearSaved:()=>void};
const Context=createContext<Account|null>(null);
export function AccountProvider({children}:{children:ReactNode}){
 const [saved,setSaved]=useState<SavedSearch[]>([]),[ready,setReady]=useState(false);
 /* Aktueller Stand auch für mehrere Änderungen hintereinander (z. B. in einer Schleife): jede baut auf der vorigen auf */
 const list=useRef<SavedSearch[]>([]);
 useEffect(()=>{list.current=readSavedSearches();setSaved(list.current);setReady(true);
  /* Ein anderer Tab hat Suchen gespeichert, geändert oder entfernt: übernehmen, damit er sie hier nicht überschreibt */
  return onOtherTab([SAVED_SEARCHES_KEY],()=>{list.current=readSavedSearches();setSaved(list.current);});},[]);
 /* Schreiben; false, wenn der Browser nichts dauerhaft speichern lässt (der Stand gilt dann bis zum Neuladen) */
 const save=useCallback((next:SavedSearch[])=>{list.current=next;setSaved(next);return writeSavedSearches(next);},[]);
 const addSaved=useCallback((snap:SearchSnapshot,name:string)=>{
  const today=todayLocal(),s:SavedSearch={...snap,id:newId(),name,created:today,lastSeen:today,notify:{on:false,freq:'daily'}};
  /* Ohne dauerhaften Speicher nicht als gespeichert ausgeben: der Aufrufer zeigt den Hinweis */
  if(!writeSavedSearches([s,...list.current]))throw Error('Speichern nicht möglich');
  list.current=[s,...list.current];setSaved(list.current);return s;
 },[]);
 const updateSaved=useCallback((id:string,patch:Partial<SavedSearch>)=>{save(list.current.map(s=>s.id===id?{...s,...patch}:s));},[save]);
 const removeSaved=useCallback((id:string)=>{save(list.current.filter(s=>s.id!==id));},[save]);
 /* „Rückgängig“ nach dem Entfernen: an alter Stelle wieder einsetzen */
 const restoreSaved=useCallback((s:SavedSearch,index:number)=>{const rest=list.current.filter(x=>x.id!==s.id);save([...rest.slice(0,index),s,...rest.slice(index)]);},[save]);
 const clearSaved=useCallback(()=>{save([]);},[save]);
 const value=useMemo<Account>(()=>({saved,ready,addSaved,updateSaved,removeSaved,restoreSaved,clearSaved}),[saved,ready,addSaved,updateSaved,removeSaved,restoreSaved,clearSaved]);
 return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useAccount(){const v=useContext(Context);if(!v)throw Error('AccountProvider fehlt');return v;}
export function useSavedStats(){const {saved}=useAccount();return useMemo(()=>({signatures:new Map(saved.map(s=>[signature(s),s]))}),[saved]);}
