import {useEffect,useRef,useState} from 'react';
import {useAccount} from '../state/account';
import {useUi} from '../state/ui';
import {useData} from '../state/data';
import {useSearchResults} from '../state/search';
import {suggestName} from '../lib/savedSearch';
import {useToast} from '../state/toast';
export function SaveSearchDialog(){
 const {saveDialogOpen,closeSaveDialog}=useUi(),{snapshot}=useSearchResults(),{geo}=useData(),{addSaved,saved,ready}=useAccount(),toast=useToast();
 const dialog=useRef<HTMLDialogElement>(null),[name,setName]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{if(saveDialogOpen&&!dialog.current?.open){setName(suggestName(snapshot,geo));setError('');dialog.current?.showModal();}else if(!saveDialogOpen)dialog.current?.close();},[saveDialogOpen,snapshot,geo]);
 const submit=async()=>{
  const n=name.trim();
  if(!n)return setError('Bitte einen Namen eingeben.');
  if(saved.some(s=>s.name===n))return setError('Dieser Name ist bereits vergeben.');
  setBusy(true);
  const err=await addSaved(snapshot,n);
  setBusy(false);
  if(err)return setError(err);
  closeSaveDialog();toast('Suche im Konto gespeichert.');
 };
 return <dialog ref={dialog} onClose={closeSaveDialog} aria-labelledby="save-title" className="w-[min(520px,calc(100vw-32px))] rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-pop backdrop:bg-slate-900/40"><form onSubmit={e=>{e.preventDefault();void submit();}}>
 <h2 id="save-title" className="text-[22px] font-semibold">Suche speichern</h2><p className="mt-2 text-[14px] text-slate-500">Suchbegriff, Gebiet, Verwaltungsebene und Filter werden in Ihrem Konto gespeichert. Es werden keine E-Mails versendet.</p><label className="mt-5 block text-[14px]">Name<input autoFocus className="field-input mt-2" value={name} maxLength={100} onChange={e=>setName(e.target.value)} aria-invalid={error?true:undefined} aria-describedby={error?'save-error':undefined}/></label>{error&&<p id="save-error" role="alert" className="mt-3 text-[14px] text-rose-700">{error}</p>}<div className="mt-6 flex justify-end gap-3"><button type="button" onClick={closeSaveDialog} className="btn-secondary">Abbrechen</button><button disabled={!ready||busy} className="btn-primary">Suche speichern</button></div></form></dialog>;
}
