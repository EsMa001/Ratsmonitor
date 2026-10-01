import {useEffect,useRef,useState} from 'react';
import {useAccount} from '../state/account';
import {useUi} from '../state/ui';
import {useData} from '../state/data';
import {useSearchResults} from '../state/search';
import {suggestName} from '../lib/savedSearch';
import {useToast} from '../state/toast';
export function SaveSearchDialog(){
 const {saveDialogOpen,closeSaveDialog}=useUi(),{snapshot}=useSearchResults(),{geo}=useData(),{addSaved,saved,ready}=useAccount(),toast=useToast();
 const dialog=useRef<HTMLDialogElement>(null),[name,setName]=useState(''),[error,setError]=useState('');
 useEffect(()=>{if(saveDialogOpen&&!dialog.current?.open){setName(suggestName(snapshot,geo));setError('');dialog.current?.showModal();}else if(!saveDialogOpen)dialog.current?.close();},[saveDialogOpen,snapshot,geo]);
 return <dialog ref={dialog} onClose={closeSaveDialog} aria-labelledby="save-title" className="w-[min(520px,calc(100vw-32px))] rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-pop backdrop:bg-slate-900/40"><form onSubmit={e=>{e.preventDefault();if(!name.trim())return setError('Bitte einen Namen eingeben.');if(saved.some(s=>s.name===name.trim()))return setError('Dieser Name ist bereits vergeben.');try{addSaved(snapshot,name.trim());closeSaveDialog();toast('Suche in diesem Browser gespeichert.');}catch{setError('Der Browser erlaubt derzeit keine dauerhafte Speicherung.');}}}>
 <h2 id="save-title" className="text-xl font-semibold">Suche speichern</h2><p className="mt-2 text-sm text-slate-500">Suchbegriff, Gebiet, Verwaltungsebene und Filter bleiben auf diesem Gerät gespeichert. Es werden keine E-Mails versendet.</p><label className="mt-5 block text-sm">Name<input autoFocus className="field-input mt-2" value={name} maxLength={100} onChange={e=>setName(e.target.value)}/></label>{error&&<p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}<div className="mt-6 flex justify-end gap-3"><button type="button" onClick={closeSaveDialog} className="btn-secondary">Abbrechen</button><button disabled={!ready} className="btn-primary">Suche speichern</button></div></form></dialog>;
}
