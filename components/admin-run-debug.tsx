'use client';
import {useState} from 'react';
import {HISTORY_WINDOWS} from '@/shared/history-window.mjs';
import {Alert,How} from '@/components/admin-ui';
import {PROTOKOLL} from '@/components/admin-texts';
type RequestRow={t:number;ms:number;kind:string;url:string;ok:boolean;size?:number;error?:string};
type Summary={requests:number;failed:number;networkMs:number;kinds:Record<string,{requests:number;failed:number;ms:number}>;errors:Record<string,number>;slowest:{url:string;ms:number;ok:boolean}[]};
type Trace={region:string;window:string|null;startedAt:string;durationMs:number;status?:string;error?:string;adapter?:string|null;meetings?:number;unchangedMeetings?:number;readMeetings?:number|null;reports?:number;stockBefore?:number;written?:{created:number;changed:number;unchanged:number};marksKnown?:number;collectMs?:number;storeMs?:number;issues?:string[];warnings?:string[];summary:Summary;droppedRequests:number;requests:RequestRow[]};
type Run={id:string;startedAt:string;finishedAt:string|null;status:string;mode:string;window:string|null;count:number|null;unchangedMeetings:number|null;error:string|null;issues:string[];warnings:string[];debug:{requests:number;failed:number;networkMs:number;durationMs:number}|null};
type Debug={region:string;last:Trace|null;runs:Run[]};
const n=(v:number|null|undefined)=>v===null||v===undefined?'–':v.toLocaleString('de-DE');
const seconds=(ms:number|null|undefined)=>ms===null||ms===undefined?'–':(ms/1000).toLocaleString('de-DE',{maximumFractionDigits:1,minimumFractionDigits:1})+' s';
const time=(s:string|null|undefined)=>s?new Date(s).toLocaleString('de-DE',{timeZone:'Europe/Berlin',dateStyle:'short',timeStyle:'medium'}):'–';
const STATUS:Record<string,string>={completed:'vollständig',partial:'Teilstand',failed:'fehlgeschlagen',running:'läuft'};
const WINDOWS:Record<string,string>=Object.fromEntries(Object.entries(HISTORY_WINDOWS).map(([id,w])=>[id,w.label]));
/** The record of an area's last import and its recent runs, as text and tables. */
export function RunDebugView({data}:{data:Debug}){
 const t=data.last,s=t?.summary;
 return <>
   {!t&&<p>Für dieses Gebiet ist noch kein Abruf aufgezeichnet. Die Aufzeichnung beginnt mit dem nächsten Abruf.</p>}
   {t&&s&&<>
    <dl>
     <div><dt>Beginn</dt><dd>{time(t.startedAt)}</dd></div>
     <div><dt>Ergebnis</dt><dd>{STATUS[t.status||'']||t.status||'–'}{t.error?<> – {t.error}</>:null}</dd></div>
     <div><dt>Dauer</dt><dd>{seconds(t.durationMs)}{t.collectMs!==undefined?<> · Abruf {seconds(t.collectMs)} · Speichern {seconds(t.storeMs)}</>:null}</dd></div>
     <div><dt>{PROTOKOLL.feld}</dt><dd>{WINDOWS[t.window||'']||t.window||'–'} · {t.adapter||'–'}</dd></div>
     <div><dt>Sitzungen</dt><dd>{n(t.meetings)} gefunden{t.unchangedMeetings?<> · {n(t.unchangedMeetings)} unverändert übersprungen</>:null}{t.readMeetings!==null&&t.readMeetings!==undefined?<> · {n(t.readMeetings)} vollständig gelesen</>:null}</dd></div>
     <div><dt>Berichte</dt><dd>{n(t.reports)} geliefert{t.written?<> · {n(t.written.created)} neu · {n(t.written.changed)} geändert · {n(t.written.unchanged)} unverändert</>:null}{t.stockBefore!==undefined?<> · Bestand vorher {n(t.stockBefore)}</>:null}</dd></div>
     <div><dt>Anfragen an die Quelle</dt><dd>{n(s.requests)}, davon {n(s.failed)} fehlgeschlagen · Wartezeit zusammen {seconds(s.networkMs)} (Anfragen laufen teils gleichzeitig){t.droppedRequests?<> · {n(t.droppedRequests)} weitere nicht aufgezeichnet</>:null}</dd></div>
    </dl>
    {(t.issues?.length||0)>0&&<><h4>Hinweise ({n(t.issues!.length)})</h4><ul>{t.issues!.slice(0,40).map((x,i)=><li key={i}>{x}</li>)}</ul></>}
    {(t.warnings?.length||0)>0&&<><h4>Warnungen ({n(t.warnings!.length)})</h4><ul>{t.warnings!.slice(0,40).map((x,i)=><li key={i}>{x}</li>)}</ul></>}
    <h4>Anfragen nach Art</h4>
    <table><thead><tr><th scope="col">Art</th><th scope="col">Anfragen</th><th scope="col">fehlgeschlagen</th><th scope="col">Ø Dauer</th></tr></thead>
     <tbody>{Object.entries(s.kinds).sort((a,b)=>b[1].requests-a[1].requests).map(([kind,k])=><tr key={kind}><th scope="row">{kind}</th><td>{n(k.requests)}</td><td>{n(k.failed)}</td><td>{n(Math.round(k.ms/k.requests))} ms</td></tr>)}</tbody></table>
    {Object.keys(s.errors).length>0&&<><h4>Fehler</h4><ul>{Object.entries(s.errors).sort((a,b)=>b[1]-a[1]).map(([message,count])=><li key={message}>{n(count)}× {message}</li>)}</ul></>}
    {s.slowest.length>0&&<><h4>Langsamste Anfragen</h4><ul>{s.slowest.map((r,i)=><li key={i}>{n(r.ms)} ms{r.ok?'':' (fehlgeschlagen)'} · <code>{r.url}</code></li>)}</ul></>}
    <details><summary>Alle {n(t.requests.length)} Anfragen in zeitlicher Reihenfolge</summary>
     <div className="admin-run-debug-requests"><table><thead><tr><th scope="col">Start</th><th scope="col">Dauer</th><th scope="col">Ergebnis</th><th scope="col">Adresse</th></tr></thead>
      <tbody>{t.requests.map((r,i)=><tr key={i} className={r.ok?undefined:'is-failed'}><td>{seconds(r.t)}</td><td>{n(r.ms)} ms</td><td>{r.ok?(r.size!==undefined?n(r.size)+' Zeichen':'ok'):r.error}</td><td><code>{r.url}</code></td></tr>)}</tbody></table></div>
    </details>
   </>}
   {data.runs.length>0&&<details><summary>Letzte {n(data.runs.length)} Läufe dieses Gebiets</summary>
    <table><thead><tr><th scope="col">Beginn</th><th scope="col">Ergebnis</th><th scope="col">Zeitraum</th><th scope="col">Berichte</th><th scope="col">Anfragen</th><th scope="col">Dauer</th><th scope="col">Fehler · Hinweise · Warnungen</th></tr></thead>
     <tbody>{data.runs.map(r=><tr key={r.id} className={r.status==='failed'?'is-failed':undefined}><td>{time(r.startedAt)}</td><td>{STATUS[r.status]||r.status}</td><td>{WINDOWS[r.window||'']||r.window||'–'}</td><td>{n(r.count)}{r.unchangedMeetings?<small> · {n(r.unchangedMeetings)} Sitzungen unverändert</small>:null}</td><td>{r.debug?<>{n(r.debug.requests)}{r.debug.failed?<small> · {n(r.debug.failed)} fehlgeschlagen</small>:null}</>:'–'}</td><td>{r.debug?seconds(r.debug.durationMs):'–'}</td><td>{[r.error,r.issues.length?r.issues.length+' Hinweise':'',r.warnings.length?r.warnings.length+' Warnungen':''].filter(Boolean).join(' · ')||'–'}</td></tr>)}</tbody></table>
   </details>}
 </>;
}
/** Protocol of the last import of one area, loaded only when asked for. Reads; starts nothing. */
export function AdminRunDebug({region,name}:{region:string;name:string}){
 const [open,setOpen]=useState(false),[data,setData]=useState<Debug|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function load(){
  setBusy(true);setError('');
  try{const r=await fetch('/api/admin/run-debug?region='+encodeURIComponent(region),{cache:'no-store'}),d=await r.json() as Debug&{error?:string};if(!r.ok)throw Error(d.error||PROTOKOLL.fehler);setData(d);}
  catch(e){setError(e instanceof Error?e.message:PROTOKOLL.fehler);}
  finally{setBusy(false);}
 }
 const save=()=>{if(!data)return;const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,1)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=`abruf-protokoll-${region}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 return <div className="admin-run-debug">
  <button type="button" className="link-btn" aria-expanded={open} onClick={()=>{const next=!open;setOpen(next);if(next)void load();}}>{open?PROTOKOLL.ausblenden:PROTOKOLL.knopf}</button>
  {open&&<div className="admin-run-debug-panel" aria-label={PROTOKOLL.aria(name)}>
   <How label={PROTOKOLL.howTitel}>{PROTOKOLL.how.map(t=><p key={t}>{t}</p>)}</How>
   {busy&&<p role="status">Wird geladen …</p>}
   {error&&<Alert>{error}</Alert>}
   {data&&<RunDebugView data={data}/>}
   {data&&<p className="admin-run-debug-actions"><button type="button" className="link-btn" onClick={()=>void load()}>Neu laden</button> <button type="button" className="link-btn" onClick={save}>Als JSON speichern</button> <span className="text-[12px] text-slate-500">{PROTOKOLL.fuss}</span></p>}
  </div>}
 </div>;
}
