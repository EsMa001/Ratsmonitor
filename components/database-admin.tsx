'use client';
import {useState} from 'react';
import {Table,TableHeader,TableBody,TableRow,TableHead,TableCell} from '@/components/ui/table';
import {AdminAreaPick,Alert,How,SectionHelp} from '@/components/admin-ui';
import {FIELD_FOOT,FIELD_HELP,HELP,QUALITY_TEXT} from '@/components/admin-texts';
import {downloadDatabase} from '@/shared/download-database.mjs';
type Audit={region:string;total:number;complete:number;incomplete:number;fields:{id:string;name:string;complete:number;missing:number}[];note:string};
const n=(v:number)=>v.toLocaleString('de-DE');
export function DatabaseAdmin({sources=[],disabled=false}:{sources?:{id:string;name:string}[];disabled?:boolean}){
 const [audit,setAudit]=useState<Audit|null>(null),[region,setRegion]=useState('all'),[busy,setBusy]=useState(''),[message,setMessage]=useState(''),[error,setError]=useState('');
 async function request<T=Audit>(params:Record<string,string>):Promise<T>{const r=await fetch('/api/admin/database?'+new URLSearchParams(params),{cache:'no-store'});const d=await r.json() as T & {error?:string};if(!r.ok)throw Error(d.error||'Datenbank nicht erreichbar');return d;}
 async function check(){setBusy('audit');setError('');setMessage('');try{setAudit(await request({action:'audit',region}));}catch(e){setError(e instanceof Error?e.message:'Prüfung fehlgeschlagen');}finally{setBusy('');}}
 async function download(){setBusy('export');setError('');setMessage('Export wird vorbereitet …');try{
  const {parts}=await downloadDatabase(request,(done:number,total:number)=>setMessage(n(done)+' von '+n(total)+' gespeicherten Datensätzen übertragen.'));
  const raw=new Blob(parts,{type:'application/x-ndjson'});const compressed=typeof CompressionStream!=='undefined';
  const blob=compressed?await new Response(raw.stream().pipeThrough(new CompressionStream('gzip'))).blob():raw;
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='plenara-data-'+new Date().toISOString().slice(0,10)+'.jsonl'+(compressed?'.gz':'');a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);setMessage('Export geprüft und heruntergeladen. Die Anleitung im Projekt beschreibt die lokale Wiederherstellung.');
 }catch(e){setError(e instanceof Error?e.message:'Export fehlgeschlagen');setMessage('');}finally{setBusy('');}}
 return <section id="admin-vollstaendig" className="admin-section"><div className="admin-section-heading"><h2>{HELP['qualitaet.vollstaendig']?.title}</h2></div>
 <SectionHelp id="qualitaet.vollstaendig"/>
 <div className="mt-5 flex flex-wrap items-start gap-x-4 gap-y-3"><div className="min-w-[240px] max-w-[420px] flex-1"><AdminAreaPick id="database-region" label="Bestand prüfen" value={region} onChange={v=>{setRegion(v);setAudit(null);}} options={sources} allLabel="Alle Gebiete" disabled={!!busy||disabled}/></div><button type="button" className="btn-secondary btn-sm sm:mt-[26px]" onClick={check} disabled={!!busy||disabled}>{busy==='audit'?'Wird geprüft …':'Vollständigkeit prüfen'}</button></div>
 {audit&&<div className="mt-5"><p><strong>{QUALITY_TEXT.exportErgebnis(n(audit.complete),n(audit.total),n(audit.incomplete))}</strong></p>
  <div className="mt-3"><Table className="admin-table"><TableHeader><TableRow><TableHead>Pflichtangabe</TableHead><TableHead className="admin-number">Vorhanden</TableHead><TableHead className="admin-number">Offen</TableHead></TableRow></TableHeader><TableBody>{audit.fields.map(f=><TableRow key={f.id}><TableCell title={FIELD_HELP[f.id]}>{f.name}</TableCell><TableCell className="admin-number">{n(f.complete)}</TableCell><TableCell className="admin-number">{n(f.missing)}</TableCell></TableRow>)}</TableBody></Table></div>
  <p className="mt-2 text-[12px] text-slate-500">{FIELD_FOOT}</p>
  <How label="Was bedeuten die Pflichtangaben?"><ul className="m-0 list-none space-y-1 p-0">{audit.fields.map(f=><li key={f.id}><span className="text-slate-900">{f.name}:</span> {FIELD_HELP[f.id]}</li>)}</ul></How>
  {audit.note&&<p className="admin-note">{audit.note}</p>}</div>}
 <h3 className="mt-10">{QUALITY_TEXT.exportTitel}</h3>
 <p className="admin-note">Enthält alle gespeicherten Berichte mit Metadaten, Zusammenfassungen, Sachgebieten, Stichwörtern, Sitzungsangaben und Originalverweisen sowie frühere Fassungen und Quellenstände. Fehlende Inhalte werden als solche mit übertragen.</p>
 <div className="mt-3"><button type="button" className="btn-secondary btn-sm" onClick={download} disabled={!!busy||disabled}>{busy==='export'?'Export läuft …':'Vollständigen Datenexport herunterladen'}</button></div>
 <p className="admin-note">Während des Exports keine Abrufe starten. Änderungen am Bestand brechen die Kopie ab. Anmeldung, Zugangsschlüssel und Push-Abonnements werden nicht übertragen. Dies ist eine Sicherung zu einem Zeitpunkt, keine automatische Synchronisation.</p>
 {message&&<p role="status" className="admin-notice">{message}</p>}{error&&<Alert>{error}</Alert>}
 </section>;
}
