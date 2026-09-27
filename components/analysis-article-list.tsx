'use client';
import {useEffect,useRef,useState} from 'react';
import {Button} from '@/components/ui/button';
import {labelName} from '@/shared/labels.mjs';
type Item={id:string;title:string;label?:string;analysisPending?:boolean;reason?:string;sourceUrl?:string};
type Page={items:Item[];total:number;nextOffset:number|null;revision:string;storageAvailable:boolean};
export function AnalysisArticleList({query,target,scope='matches',title,total,id}:{query:Record<string,string>;target?:string;scope?:'local'|'matches';title:string;total:number;id?:string}){
 const [open,setOpen]=useState(false),[page,setPage]=useState<Page|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[changed,setChanged]=useState(false);
 const request=useRef<AbortController|null>(null),pageRef=useRef<Page|null>(null);
 async function load(offset=0){
  request.current?.abort();const controller=new AbortController();request.current=controller;setBusy(true);setError('');setChanged(false);
  const timeout=setTimeout(()=>controller.abort('timeout'),12000);
  try{
   const params=new URLSearchParams({...query,scope,target:target||'',offset:String(offset),...(offset&&pageRef.current?{revision:pageRef.current.revision}:{})});
   const response=await fetch('/api/analytics/articles?'+params,{signal:controller.signal});
   const data=await response.json() as Page & {error?:string};
   if(response.status===409){setChanged(true);throw Error('Der Bestand hat sich geändert. Bitte die Liste neu laden.');}
   if(!response.ok)throw Error(data.error||'Laden fehlgeschlagen.');
   const next={...data,items:offset?[...(pageRef.current?.items||[]),...data.items]:data.items};pageRef.current=next;setPage(next);
  }catch(e){if(!controller.signal.aborted||controller.signal.reason==='timeout')setError(controller.signal.reason==='timeout'?'Der Abruf dauert zu lange. Bitte erneut versuchen.':e instanceof Error?e.message:'Laden fehlgeschlagen.');}
  finally{clearTimeout(timeout);if(request.current===controller)setBusy(false);}
 }
 useEffect(()=>{if(open&&!pageRef.current&&total>0)void load();return ()=>request.current?.abort();},[open]);
 return <details className="analysis-details" id={id} onToggle={e=>setOpen(e.currentTarget.open)}><summary>{title}</summary>{open&&<>
  {!total&&!page?<p>Keine passenden Vorgänge im verfügbaren Bestand.</p>:null}
  {page?.storageAvailable===false&&<p className="page-note">Datenbank nicht erreichbar. Angezeigt wird ein gespeicherter Ersatzstand.</p>}
  {page?.items.map(t=><div className="comparison-result" key={t.id}><a href={'/thema/'+t.id}>{t.title}</a>{t.label&&<p>{t.analysisPending?'Analyse ausstehend':labelName(t.label)}</p>}{t.reason&&<p>{t.reason}</p>}{t.sourceUrl&&<a href={t.sourceUrl} target="_blank" rel="noopener noreferrer">Originalquelle</a>}</div>)}
  {page&&<p className="page-note">{page.items.length} von {page.total} Vorgängen geladen.</p>}
  {busy&&<p role="status">Vorgänge werden geladen …</p>}
  {error&&<p role="alert" className="analysis-notice">{error}</p>}
  {!busy&&(error||page?.nextOffset!=null)&&<Button variant="outline" onClick={()=>load(changed?0:page?.nextOffset||0)}>{changed?'Liste neu laden':error?'Erneut versuchen':'Weitere 30 Vorgänge'}</Button>}
 </>}</details>;
}
