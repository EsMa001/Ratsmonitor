'use client';
import {useEffect,useRef,useState} from 'react';
// The notes of one area (issues of the last fetch, warnings), read from /api/admin/area when its details are opened. The
// list of areas carries only their number.
type Notes={issues:string[];warnings:string[]};
export function SourceNotes({id,issueCount,warningCount}:{id:string;issueCount:number;warningCount:number}){
 const [notes,setNotes]=useState<Notes|null>(null),[error,setError]=useState(''),[open,setOpen]=useState(false),box=useRef<HTMLDivElement>(null);
 // The details element around is opened by the reader; the first time it is, the notes are read.
 useEffect(()=>{const details=box.current?.closest('details');if(!details)return;const on=()=>setOpen(details.open);details.addEventListener('toggle',on);on();return()=>details.removeEventListener('toggle',on);},[]);
 useEffect(()=>{
  if(!open||notes||(!issueCount&&!warningCount))return;
  const c=new AbortController();
  fetch('/api/admin/area?id='+encodeURIComponent(id),{cache:'no-store',signal:c.signal}).then(async r=>{const d=await r.json() as Notes&{error?:string};if(!r.ok)throw Error(d.error||'Hinweise konnten nicht geladen werden.');setNotes(d);}).catch(e=>{if(!c.signal.aborted)setError(e instanceof Error?e.message:'Hinweise konnten nicht geladen werden.');});
  return()=>c.abort();
 },[open,notes,id,issueCount,warningCount]);
 return <div ref={box}>
  {issueCount?(notes?<ul>{notes.issues.map((issue,i)=><li key={i}>{issue}</li>)}</ul>:error?<p role="alert">{error}</p>:<p>{issueCount.toLocaleString('de-DE')} Abrufhinweise werden geladen …</p>):<p>Keine Abrufhinweise gespeichert. Das bestätigt keine vollständige Quelle.</p>}
  {warningCount>0&&<><p><strong>Warnungen</strong> – sie machen den Abruf nicht unvollständig:</p>{notes?<ul>{notes.warnings.map((warning,i)=><li key={i}>{warning}</li>)}</ul>:null}</>}
 </div>;
}
