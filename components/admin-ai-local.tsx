'use client';
import {useEffect,useState} from 'react';
import {Check,ChevronLeft,ChevronRight,Copy,LoaderCircle,RefreshCw} from 'lucide-react';
import {AdminChoice,dd} from '@/components/admin-ui';
import {HISTORY_WINDOWS} from '@/shared/history-window.mjs';
import type {AdminDashboard,AdminSource} from '@/shared/admin-types';

type Coverage={total:number;available:number;missing:number;partial:number;complete:boolean};
type LocalArticle={id:string;title:string;regionId:string;eventDate:string;state:string;ready:boolean;coverage:Coverage;inputHash:string;legacy:boolean;agent?:string;expiresAt?:string;attempts?:unknown;lastError?:string};
type ArticlePage={method:string;items:LocalArticle[];nextCursor:string|null;checked:number;hasMore:boolean;asOf?:string};
type Filters={scope:'selection'|'all';window:string;limit:string;state:string};
type ResponseState={key:string;value:ArticlePage|null;error:string;unsupported:boolean;loading:boolean};
const number=(value:number)=>value.toLocaleString('de-DE');
const states:[string,string][]=[['open','Offene Berichte'],['all','Alle Berichte'],['completed','Vollständig'],['processing','In Bearbeitung'],['failed','Fehlgeschlagen'],['insufficient_source','Unzureichende Quelle'],['legacy','Frühere KI-Fassung'],['waiting_text','Wartet auf Text'],['stale','Veraltet']];
const stateNames:Record<string,string>={open:'Bereit',pending:'Bereit',completed:'Vollständig',processing:'In Bearbeitung',failed:'Fehlgeschlagen',insufficient_source:'Unzureichende Quelle',legacy:'Frühere KI-Fassung',waiting_text:'Wartet auf Text',stale:'Veraltet'};
const windows=Object.entries(HISTORY_WINDOWS).map(([id,value])=>[id,value.label] as [string,string]);

function AttemptDetails({article}:{article:LocalArticle}){
 const attempts=article.attempts&&typeof article.attempts==='object'?Object.entries(article.attempts).flatMap(([kind,value])=>{
  if(!value||typeof value!=='object')return [];
  const entry=value as {reason?:unknown;status?:unknown;count?:unknown;at?:unknown};
  return typeof entry.reason==='string'&&entry.reason?[{kind,reason:entry.reason,count:typeof entry.count==='number'?entry.count:null,at:typeof entry.at==='string'?entry.at:null}]:[];
 }):[];
 if(!article.lastError&&!attempts.length&&!article.agent)return null;
 return <details className="admin-ai-local-details"><summary>Details</summary>
  {article.lastError&&<p>{article.lastError}{typeof article.attempts==='number'&&article.attempts>0&&<small>{number(article.attempts)} {article.attempts===1?'Versuch':'Versuche'}</small>}</p>}
  {attempts.map(attempt=><p key={attempt.kind}>{attempt.reason}{attempt.count!==null&&<small>{number(attempt.count)} {attempt.count===1?'Versuch':'Versuche'}{attempt.at?' · '+dd(attempt.at):''}</small>}</p>)}
  {article.agent&&<p>{article.agent}{article.expiresAt&&<small>Reserviert bis {new Date(article.expiresAt).toLocaleString('de-DE',{timeZone:'Europe/Berlin',dateStyle:'short',timeStyle:'short'})}</small>}</p>}
 </details>;
}

async function copyText(text:string){
 if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);return;}
 const input=document.createElement('textarea');input.value=text;input.setAttribute('readonly','');input.style.position='fixed';input.style.opacity='0';document.body.appendChild(input);input.select();
 try{if(!document.execCommand('copy'))throw Error('Die IDs konnten nicht kopiert werden.');}finally{input.remove();}
}

export function AdminAiLocal({sources,selected,revision,legacyJob}:{sources:AdminSource[];selected:Set<string>;revision:number;legacyJob:AdminDashboard['processing']['aiJob']}){
 const [filters,setFilters]=useState<Filters>({scope:'selection',window:'all',limit:'25',state:'open'});
 const [history,setHistory]=useState<{key:string;cursors:(string|null)[];index:number}>({key:'',cursors:[null],index:0});
 const [refresh,setRefresh]=useState(0),[response,setResponse]=useState<ResponseState>({key:'',value:null,error:'',unsupported:false,loading:false});
 const [selection,setSelection]=useState<{key:string;ids:Set<string>}>({key:'',ids:new Set()}),[copyState,setCopyState]=useState<{key:string;text:string;error:boolean}>({key:'',text:'',error:false});
 const regionIds=[...selected].sort(),regions=filters.scope==='all'?'all':regionIds.join(','),hasScope=filters.scope==='all'||regionIds.length>0;
 const filterKey=JSON.stringify([regions,filters.window,filters.limit,filters.state]),page=history.key===filterKey?history.index:0,cursor=history.key===filterKey?history.cursors[page]:null;
 const requestKey=JSON.stringify([filterKey,cursor]),current=response.key===requestKey?response:null,loading=hasScope&&(!current||current.loading);
 const data=hasScope?current?.value:null,items=data?.items||[],selectedIds=selection.key===requestKey?selection.ids:new Set<string>();
 const shownSelection=items.filter(article=>selectedIds.has(article.id)),allSelected=items.length>0&&shownSelection.length===items.length;
 const regionNames=new Map(sources.map(source=>[source.id,source.name])),chosen=sources.filter(source=>selected.has(source.id)),total=chosen.reduce((sum,source)=>sum+source.count,0);
 const change=(name:keyof Filters,value:string)=>setFilters(previous=>({...previous,[name]:value}));
 const toggle=(id:string,checked:boolean)=>setSelection(previous=>{const ids=new Set(previous.key===requestKey?previous.ids:[]);if(checked)ids.add(id);else ids.delete(id);return {key:requestKey,ids};});
 const selectPage=(checked:boolean)=>setSelection({key:requestKey,ids:new Set(checked?items.map(article=>article.id):[])});

 useEffect(()=>{
  if(!hasScope)return;
  const abort=new AbortController();
  const params=new URLSearchParams({regions,window:filters.window,limit:filters.limit,state:filters.state});if(cursor)params.set('cursor',cursor);
  const timer=setTimeout(()=>{
   setResponse(previous=>({key:requestKey,value:previous.key===requestKey?previous.value:null,error:'',unsupported:false,loading:true}));
   void fetch('/api/admin/ai-local?'+params,{cache:'no-store',signal:abort.signal}).then(async result=>{
    const body:unknown=await result.json().catch(()=>null);
    if(abort.signal.aborted)return;
    const value=body&&typeof body==='object'?body as Record<string,unknown>:null;
    if(!result.ok){setResponse({key:requestKey,value:null,error:typeof value?.error==='string'?value.error:'Die Berichte konnten nicht geladen werden.',unsupported:result.status===503||result.status===501,loading:false});return;}
    if(!value||!Array.isArray(value.items)||typeof value.checked!=='number'||(value.nextCursor!==null&&typeof value.nextCursor!=='string'))throw Error('Der Server hat eine unvollständige Antwort geliefert.');
    if(!abort.signal.aborted)setResponse({key:requestKey,value:value as ArticlePage,error:'',unsupported:false,loading:false});
   }).catch(error=>{if(!abort.signal.aborted)setResponse({key:requestKey,value:null,error:error instanceof TypeError?'Der Server ist nicht erreichbar.':error instanceof Error?error.message:'Die Berichte konnten nicht geladen werden.',unsupported:false,loading:false});});
  },250);
  return()=>{clearTimeout(timer);abort.abort();};
 },[hasScope,requestKey,regions,filters.window,filters.limit,filters.state,cursor,refresh,revision]);

 const nextPage=()=>{if(!data?.nextCursor)return;setHistory(previous=>{const cursors=previous.key===filterKey?previous.cursors.slice(0,page+1):[null];return {key:filterKey,cursors:[...cursors,data.nextCursor],index:page+1};});};
 const previousPage=()=>setHistory(previous=>previous.key===filterKey?{...previous,index:Math.max(0,previous.index-1)}:previous);
 const copyIds=async(selectedOnly:boolean)=>{
  const ids=(selectedOnly?shownSelection:items).map(article=>article.id);if(!ids.length)return;
  try{await copyText(ids.join('\n'));setCopyState({key:requestKey,text:number(ids.length)+' '+(ids.length===1?'ID kopiert':'IDs kopiert'),error:false});}
  catch{setCopyState({key:requestKey,text:'Die IDs konnten nicht kopiert werden.',error:true});}
 };

 return <section className="admin-stage admin-stage-ai admin-ai-local" id="abruf-ki-lokal">
  <div className="admin-stage-number">03</div><h3>KI-Inhalte erarbeiten</h3>
  <ul className="admin-ai-local-outputs" aria-label="Ergebnisse je KI-Bearbeitung">{['Kurzfassung','Inhaltszusammenfassung','KI-Thema'].map(name=><li key={name}><Check size={16} aria-hidden="true"/>{name}</li>)}</ul>
  <div className="admin-ai-local-filters">
   <AdminChoice id="abruf-ki-gebiete" label="Welche Gebiete" value={filters.scope} onChange={value=>change('scope',value)} items={[["selection",`Ihre Auswahl (${number(chosen.length)} Gebiete, ${number(total)} Berichte)`],["all","Ganz Deutschland"]]}/>
   <AdminChoice id="abruf-ki-zeitraum" label="Zeitraum rückwirkend" value={filters.window} onChange={value=>change('window',value)} items={[["all","Alle gespeicherten Berichte"],...windows]}/>
   <AdminChoice id="abruf-ki-status" label="Bearbeitungsstand" value={filters.state} onChange={value=>change('state',value)} items={states}/>
   <AdminChoice id="abruf-ki-menge" label="Einträge je Seite" value={filters.limit} onChange={value=>change('limit',value)} items={['10','25','50','100'].map(value=>[value,value+' Einträge'])}/>
  </div>
  <div className="admin-ai-local-toolbar">
   <span>{data?`${number(items.length)} ${items.length===1?'Bericht':'Berichte'} auf dieser Seite`:hasScope?'Berichte':'Kein Gebiet ausgewählt'}{shownSelection.length>0&&` · ${number(shownSelection.length)} ausgewählt`}</span>
   <div className="admin-ai-local-tools">
    <button type="button" className="admin-ai-local-icon" title="Ausgewählte IDs kopieren" aria-label="Ausgewählte IDs kopieren" disabled={loading||!shownSelection.length} onClick={()=>void copyIds(true)}><Copy size={18}/><span className="admin-ai-local-count" aria-hidden="true">{shownSelection.length||''}</span></button>
    <button type="button" className="admin-ai-local-icon" title="Alle IDs auf dieser Seite kopieren" aria-label="Alle IDs auf dieser Seite kopieren" disabled={loading||!items.length} onClick={()=>void copyIds(false)}><Copy size={18}/></button>
    <button type="button" className="admin-ai-local-icon" title="Berichte aktualisieren" aria-label="Berichte aktualisieren" disabled={loading||!hasScope} onClick={()=>setRefresh(value=>value+1)}>{loading?<LoaderCircle size={18} className="admin-ai-local-spin"/>:<RefreshCw size={18}/>}</button>
   </div>
  </div>
  {copyState.key===requestKey&&copyState.text&&<p className={'admin-ai-local-feedback'+(copyState.error?' is-error':'')} role={copyState.error?'alert':'status'}>{copyState.text}</p>}
  {hasScope&&current?.error&&<div className="admin-ai-local-error" role="alert"><p>{current.unsupported?'Lokale Textablage nicht verfügbar.':'Berichte konnten nicht geladen werden.'}</p><p>{current.error}</p>{!current.unsupported&&<button type="button" className="link-btn" onClick={()=>setRefresh(value=>value+1)}>Erneut laden</button>}</div>}
  <div className="admin-ai-local-list" aria-busy={loading}>
   {loading&&!data?<p className="admin-ai-local-empty" role="status"><LoaderCircle size={18} className="admin-ai-local-spin" aria-hidden="true"/>Berichte werden geladen …</p>:!hasScope?<p className="admin-ai-local-empty">Kein Gebiet ausgewählt.</p>:data&&!items.length?<p className="admin-ai-local-empty">{data.nextCursor?'Keine passenden Berichte auf dieser Seite.':'Keine passenden Berichte.'}</p>:items.length>0&&<table className="admin-ai-local-table">
    <caption className="sr-only">KI-Verarbeitung der gespeicherten Berichte</caption><thead><tr><th scope="col" className="admin-ai-local-select"><input type="checkbox" aria-label="Alle Berichte auf dieser Seite auswählen" checked={allSelected} disabled={loading} ref={input=>{if(input)input.indeterminate=shownSelection.length>0&&!allSelected;}} onChange={event=>selectPage(event.target.checked)}/></th><th scope="col">Bericht / ID</th><th scope="col">Sitzung</th><th scope="col">Gespeicherte Texte</th><th scope="col">Bearbeitungsstand</th></tr></thead>
    <tbody>{items.map(article=><tr key={article.id} className={selectedIds.has(article.id)?'is-selected':''}>
     <td className="admin-ai-local-select"><input type="checkbox" aria-label={article.title+' auswählen'} checked={selectedIds.has(article.id)} disabled={loading} onChange={event=>toggle(article.id,event.target.checked)}/></td>
     <td className="admin-ai-local-article"><a href={'/beschluss/'+encodeURIComponent(article.id)} target="_blank" rel="noopener noreferrer">{article.title}</a><small>{regionNames.get(article.regionId)||article.regionId}</small><code>{article.id}</code></td>
     <td data-label="Sitzung">{dd(article.eventDate)}</td>
     <td data-label="Gespeicherte Texte"><span>{number(article.coverage.available)} / {number(article.coverage.total)}</span><small>{article.coverage.missing>0?number(article.coverage.missing)+' fehlen':article.coverage.partial?'Teilweise lesbar':article.coverage.complete?'Vollständig':'Kein Sachtext'}</small></td>
     <td data-label="Bearbeitungsstand"><span className={article.state==='completed'?'admin-ai-local-completed':''}>{stateNames[article.state]||article.state}</span><AttemptDetails article={article}/></td>
    </tr>)}</tbody>
   </table>}
  </div>
  {data&&<div className="admin-ai-local-pagination"><small>{number(data.checked)} Einträge geprüft</small><div><button type="button" className="admin-ai-local-icon" title="Vorherige Seite" aria-label="Vorherige Seite" disabled={loading||page===0} onClick={previousPage}><ChevronLeft size={20}/></button><span>Seite {number(page+1)}</span><button type="button" className="admin-ai-local-icon" title="Weitere Berichte" aria-label="Weitere Berichte" disabled={loading||!data.nextCursor} onClick={nextPage}><ChevronRight size={20}/></button></div></div>}
  {legacyJob&&<details className="admin-ai-local-legacy" id="abruf-kiauftrag"><summary>Früherer KI-Auftrag · {number(legacyJob.applied)} / {number(legacyJob.count)} gespeichert</summary><p>{legacyJob.status==='prepared'?'Reserviert':legacyJob.status==='cancelled'?'Verworfen':'Abgeschlossen'} · {dd(legacyJob.createdAt)}</p><code>{legacyJob.id}</code><progress value={legacyJob.applied} max={legacyJob.count||1} aria-label="Gespeicherte Berichte des früheren KI-Auftrags"/></details>}
 </section>;
}
