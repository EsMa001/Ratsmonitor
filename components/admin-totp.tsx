'use client';
// Zweiter Faktor der Administration (requirements/konten-konzept.md 6.4): Code eingeben (öffentliche Adresse) und
// einmal einrichten (nur im Tunnel). Server: server/accounts/admin-factor.mjs, Routen /api/auth/totp und /api/auth/totp/setup.
import {useState} from 'react';

async function post(path:string,body:unknown){
 const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const data=await r.json().catch(()=>({})) as {error?:string;secret?:string;uri?:string;ok?:boolean};
 if(!r.ok)throw Error(data.error||'Das hat nicht geklappt. Bitte erneut versuchen.');
 return data;
}
function CodeField({id,value,onChange}:{id:string;value:string;onChange:(v:string)=>void}){
 return <input id={id} className="field-input" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]*" maxLength={7} required
  value={value} onChange={e=>onChange(e.target.value.replace(/[^0-9]/g,'').slice(0,6))}/>;
}

/** Code aus der Authenticator-App eingeben; danach gilt die Administration 12 Stunden auf diesem Gerät */
export function AdminTotp(){
 const [code,setCode]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 return <form className="mt-6 max-w-[420px]" onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');
  try{await post('/api/auth/totp',{code});window.location.reload();}
  catch(err){setError(err instanceof Error?err.message:'Bitte erneut versuchen.');setCode('');setBusy(false);}}}>
  <label htmlFor="admin-totp" className="field-label mb-1 block">Code aus der Authenticator-App (6 Ziffern)</label>
  <CodeField id="admin-totp" value={code} onChange={setCode}/>
  {error&&<p role="alert" className="mt-3 text-[14px] text-amber-700">{error}</p>}
  <button type="submit" className="btn-primary mt-4" disabled={busy||code.length!==6}>{busy?'Prüfen …':'Bestätigen'}</button>
 </form>;
}

/**
 * Hinweis und Einrichtung im Tunnel, solange der zweite Faktor fehlt. Ohne ihn geht die Administration nur über den Tunnel;
 * mit ihm auch über die öffentliche Adresse (nach Eingabe eines Codes, einmal am Tag).
 */
export function AdminTotpSetup(){
 const [step,setStep]=useState<'start'|'scan'|'done'>('start');
 const [secret,setSecret]=useState(''),[uri,setUri]=useState(''),[code,setCode]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const begin=async()=>{setBusy(true);setError('');try{const d=await post('/api/auth/totp/setup',{});setSecret(d.secret||'');setUri(d.uri||'');setStep('scan');}catch(err){setError(err instanceof Error?err.message:'Bitte erneut versuchen.');}setBusy(false);};
 const confirm=async(e:React.FormEvent)=>{e.preventDefault();setBusy(true);setError('');try{await post('/api/auth/totp/setup',{code});setStep('done');setSecret('');setUri('');}catch(err){setError(err instanceof Error?err.message:'Bitte erneut versuchen.');setCode('');}setBusy(false);};
 return <section aria-labelledby="totp-setup-title" className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-[14px] text-slate-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-slate-100">
  <h2 id="totp-setup-title" className="text-[16px] font-semibold">Zweiter Faktor für die Administration</h2>
  {step==='start'&&<>
   <p className="mt-2">Über die öffentliche Adresse geht die Administration nur mit einem Code aus einer Authenticator-App (zum Beispiel Google Authenticator, Microsoft Authenticator, 1Password oder Aegis). Einmal hier im Tunnel einrichten, danach fragt die Seite einmal am Tag nach dem Code.</p>
   <button type="button" className="btn-primary mt-3" onClick={begin} disabled={busy}>{busy?'Einen Moment …':'Jetzt einrichten'}</button>
  </>}
  {step==='scan'&&<form onSubmit={confirm}>
   <ol className="mt-2 list-decimal space-y-2 pl-5">
    <li>In der Authenticator-App „Konto hinzufügen“ und „Schlüssel manuell eingeben“ wählen. Name: Plenara. Schlüssel:<br/>
     <code className="mt-1 inline-block select-all rounded bg-white px-2 py-1 font-mono text-[16px] tracking-wider dark:bg-slate-900">{secret}</code></li>
    <li>Oder auf dem Handy diesen Link öffnen: <a className="text-teal-700 underline dark:text-teal-300" href={uri}>in der Authenticator-App öffnen</a></li>
    <li>Den 6-stelligen Code, den die App jetzt zeigt, hier eingeben:</li>
   </ol>
   <label htmlFor="admin-totp-setup" className="field-label mb-1 mt-3 block">Code aus der App</label>
   <CodeField id="admin-totp-setup" value={code} onChange={setCode}/>
   <button type="submit" className="btn-primary mt-3" disabled={busy||code.length!==6}>{busy?'Prüfen …':'Einrichtung abschließen'}</button>
   <p className="mt-2 text-[14px] text-slate-600 dark:text-slate-300">Den Schlüssel nirgends speichern oder weitergeben; er erscheint nur jetzt.</p>
  </form>}
  {step==='done'&&<p role="status" className="mt-2">Eingerichtet. Über die öffentliche Adresse fragt die Administration ab jetzt nach dem Code aus der App.</p>}
  {error&&<p role="alert" className="mt-3 text-amber-700 dark:text-amber-300">{error}</p>}
 </section>;
}
