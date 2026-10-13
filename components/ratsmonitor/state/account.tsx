import { newId } from '../lib/uuid';
import {createContext,useCallback,useContext,useEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import type {SavedSearch,NotifyFreq} from '../types';
import {signature,snapshotOf,type SearchSnapshot} from '../lib/savedSearch';
import {AccountApiError,api,touchAccount,useMe} from '../lib/account';
import {openLimitGate} from '../components/GateDialog';
import {useData} from './data';
import {savedSearchQuery} from './search';

/**
 * Gespeicherte Suchen des Kontos (/api/me/searches). Änderungen erscheinen sofort und werden bei einem Fehler
 * zurückgenommen; die Funktionen liefern dann eine Meldung (null: erledigt oder Hinweis zur Grenze offen).
 * Ohne Anmeldung ist die Liste leer (Gäste können nicht speichern).
 */
type Result=Promise<string|null>;
type Account={saved:SavedSearch[];ready:boolean;signedIn:boolean;
 addSaved:(snap:SearchSnapshot,name:string)=>Result;
 updateSaved:(id:string,patch:Partial<Pick<SavedSearch,'name'|'notify'|'lastSeen'>>)=>Result;
 removeSaved:(id:string)=>Result;restoreSaved:(s:SavedSearch,index:number)=>Result;
 /** Abfrage nachtragen, wenn sie beim Speichern fehlte (Karte noch nicht geladen) */
 noteQuery:(s:SavedSearch,query:string)=>void};
type ServerSearch={id:string;name:string;signature:string;state:SearchSnapshot;query:string|null;position:number;active:boolean;notify:{mail:boolean;freq:NotifyFreq|null};created:string;lastSeen:string|null};
const EMPTY:SavedSearch[]=[];
const fromServer=(r:ServerSearch):SavedSearch=>({...r.state,id:r.id,name:r.name,notify:{on:false,freq:r.notify?.freq||'daily',mail:!!r.notify?.mail},created:r.created,lastSeen:r.lastSeen||r.created||'',active:r.active,position:r.position,query:r.query});
/** Meldung zu einem Fehler; 409 mit Grenze öffnet den Hinweis */
function failure(e:unknown):string|null{
 if(e instanceof AccountApiError){
  if(e.status===409&&e.data.duplicate)return 'Diese Suche ist schon gespeichert.';
  if(e.status===409&&openLimitGate(e.data.limit))return null;
  if(e.status===401)return 'Bitte melden Sie sich an.';
  return e.message;
 }
 return 'Das hat nicht geklappt. Bitte erneut versuchen.';
}
const Context=createContext<Account|null>(null);
export function AccountProvider({children}:{children:ReactNode}){
 const me=useMe(),{geo,place}=useData();
 /* Schlüssel des Stands: Konto und Kontostand (anmelden, abmelden, Änderung in einem anderen Tab) */
 const key=me.ready?(me.user?`${me.user.id}:${me.rev}`:'-'):'';
 const [got,setGot]=useState<{key:string;list:SavedSearch[]}>({key:'',list:EMPTY});
 /* Aktueller Stand auch für mehrere Änderungen hintereinander: jede baut auf der vorigen auf */
 const list=useRef<SavedSearch[]>(EMPTY);
 const user=me.user?.id??'';
 useEffect(()=>{
  if(!key||key==='-'){list.current=EMPTY;return;}
  let live=true;
  api<{searches?:ServerSearch[]}>('/api/me/searches').then(d=>{if(!live)return;const l=(d.searches??[]).map(fromServer);list.current=l;setGot({key,list:l});},()=>{if(live){list.current=EMPTY;setGot({key,list:EMPTY});}});
  return()=>{live=false;};
 },[key]);
 const saved=key&&key!=='-'&&got.key===key?got.list:EMPTY;
 const ready=key==='-'||(!!key&&got.key===key);
 const put=useCallback((next:SavedSearch[])=>{list.current=next;setGot(g=>({...g,list:next}));},[]);
 const queryOf=useCallback(async(s:SavedSearch)=>s.query??(geo&&place?await savedSearchQuery(s,geo,place).catch(()=>null):null),[geo,place]);
 const addSaved=useCallback(async(snap:SearchSnapshot,name:string)=>{
  if(!user)return 'Bitte melden Sie sich an.';
  const now=new Date().toISOString(),state=snapshotOf(snap);
  const s:SavedSearch={...state,id:newId(),name,created:now,lastSeen:now,notify:{on:false,freq:'daily'},active:true,query:null};
  put([s,...list.current]);
  try{
   const query=await queryOf(s);
   await api('/api/me/searches',{method:'POST',body:{id:s.id,name,signature:signature(state),state,query}});
   put(list.current.map(x=>x.id===s.id?{...x,query}:x));touchAccount();return null;
  }catch(e){put(list.current.filter(x=>x.id!==s.id));return failure(e);}
 },[user,put,queryOf]);
 const updateSaved=useCallback(async(id:string,patch:Partial<Pick<SavedSearch,'name'|'notify'|'lastSeen'>>)=>{
  const before=list.current.find(s=>s.id===id);if(!before)return null;
  put(list.current.map(s=>s.id===id?{...s,...patch}:s));
  try{
   if(patch.name!==undefined)await api('/api/me/searches',{method:'PATCH',body:{id,name:patch.name}});
   if(patch.notify)await api('/api/me/searches',{method:'PATCH',body:{id,notify:{mail:!!patch.notify.mail,freq:patch.notify.freq}}});
   if(patch.lastSeen!==undefined)await api('/api/me/searches',{method:'PATCH',body:{id,seen:true}});
   if(patch.name!==undefined||patch.notify)touchAccount();
   return null;
  }catch(e){put(list.current.map(s=>s.id===id?before:s));return failure(e);}
 },[put]);
 const removeSaved=useCallback(async(id:string)=>{
  const index=list.current.findIndex(s=>s.id===id);if(index<0)return null;
  const hit=list.current[index];
  put(list.current.filter(s=>s.id!==id));
  try{await api('/api/me/searches',{method:'DELETE',body:{id}});touchAccount();return null;}
  catch(e){const rest=list.current.filter(x=>x.id!==id);put([...rest.slice(0,index),hit,...rest.slice(index)]);return failure(e);}
 },[put]);
 /* „Rückgängig“ nach dem Entfernen: an alter Stelle und mit altem Listenplatz wieder einsetzen */
 const restoreSaved=useCallback(async(s:SavedSearch,index:number)=>{
  if(!user)return 'Bitte melden Sie sich an.';
  const rest=list.current.filter(x=>x.id!==s.id);
  put([...rest.slice(0,index),s,...rest.slice(index)]);
  try{
   const state=snapshotOf(s),query=await queryOf(s);
   await api('/api/me/searches',{method:'POST',body:{id:s.id,name:s.name,signature:signature(state),state,query,notify:{mail:!!s.notify.mail,freq:s.notify.freq}}});
   if(typeof s.position==='number')await api('/api/me/searches',{method:'PATCH',body:{id:s.id,position:s.position}}).catch(()=>{});
   touchAccount();return null;
  }catch(e){put(list.current.filter(x=>x.id!==s.id));return failure(e);}
 },[user,put,queryOf]);
 /* Je Suche höchstens einmal je Sitzung nachtragen */
 const noted=useRef(new Set<string>());
 const noteQuery=useCallback((s:SavedSearch,query:string)=>{
  if(!user||s.query||noted.current.has(s.id))return;
  noted.current.add(s.id);
  const state=snapshotOf(s);
  api('/api/me/searches',{method:'PATCH',body:{id:s.id,state,signature:signature(state),query}}).then(()=>put(list.current.map(x=>x.id===s.id?{...x,query}:x)),()=>{});
 },[user,put]);
 const value=useMemo<Account>(()=>({saved,ready,signedIn:!!user,addSaved,updateSaved,removeSaved,restoreSaved,noteQuery}),[saved,ready,user,addSaved,updateSaved,removeSaved,restoreSaved,noteQuery]);
 return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useAccount(){const v=useContext(Context);if(!v)throw Error('AccountProvider fehlt');return v;}
export function useSavedStats(){const {saved}=useAccount();return useMemo(()=>({signatures:new Map(saved.map(s=>[signature(s),s]))}),[saved]);}
