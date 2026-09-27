'use client';
import {useState} from 'react';
import {Button} from '@/components/ui/button';
import {Table,TableHeader,TableBody,TableRow,TableHead,TableCell} from '@/components/ui/table';
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
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='ratsmonitor-data-'+new Date().toISOString().slice(0,10)+'.jsonl'+(compressed?'.gz':'');a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);setMessage('Export geprüft und heruntergeladen. Die Anleitung im Projekt beschreibt die lokale Wiederherstellung.');
 }catch(e){setError(e instanceof Error?e.message:'Export fehlgeschlagen');setMessage('');}finally{setBusy('');}}
 return <section id="admin-datenbank" className="admin-section"><p className="eyebrow">DATENBANK & VOLLSTÄNDIGKEIT</p><h2>Was ist wirklich gespeichert?</h2>
 <p>Online und lokal gilt derselbe Mindestdatensatz. Die Prüfung liest ausschließlich vorhandene Daten. Sie erstellt keine Labels oder KI-Texte.</p>
 <div className="admin-source-controls"><div className="admin-field"><label htmlFor="database-region">Bestand prüfen</label><select id="database-region" value={region} disabled={!!busy||disabled} onChange={e=>{setRegion(e.target.value);setAudit(null);}}><option value="all">Alle Gebiete</option>{sources.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div><Button variant="outline" onClick={check} disabled={!!busy||disabled}>{busy==='audit'?'Wird geprüft …':'Vollständigkeit prüfen'}</Button></div>
 {audit&&<><p><strong>{n(audit.complete)} von {n(audit.total)} Artikeln erfüllen alle Mindestangaben.</strong> {n(audit.incomplete)} benötigen Ergänzungen.</p><Table><TableHeader><TableRow><TableHead>Pflichtangabe</TableHead><TableHead>Vorhanden</TableHead><TableHead>Offen</TableHead></TableRow></TableHeader><TableBody>{audit.fields.map(f=><TableRow key={f.id}><TableCell>{f.name}</TableCell><TableCell>{n(f.complete)}</TableCell><TableCell>{n(f.missing)}</TableCell></TableRow>)}</TableBody></Table><p className="admin-note">{audit.note} Anwesenheit bezieht sich auf die Sitzung, nicht auf einen einzelnen Tagesordnungspunkt. Zehn bloß aus Titeln abgeleitete Stichwörter erfüllen die Inhaltsanforderung nicht.</p></>}
 <h3>Gesamten Artikelbestand sichern</h3><p>Enthält alle gespeicherten Artikel mit Metadaten, Zusammenfassungen, Labels, Stichwörtern, Sitzungsangaben und Originalverweisen sowie frühere Fassungen und Quellenstände. Fehlende Inhalte werden als solche mit übertragen.</p>
 <Button variant="outline" onClick={download} disabled={!!busy||disabled}>{busy==='export'?'Export läuft …':'Vollständigen Datenexport herunterladen'}</Button>
 <p className="admin-note">Während des Exports keine Importe starten. Änderungen am Bestand brechen die Kopie ab. Anmeldung, Zugangsschlüssel und Push-Abonnements werden nicht übertragen. Dies ist eine Sicherung zu einem Zeitpunkt, keine automatische Synchronisation.</p>
 {message&&<p role="status" className="admin-notice">{message}</p>}{error&&<p role="alert" className="admin-error">{error}</p>}
 </section>;
}
