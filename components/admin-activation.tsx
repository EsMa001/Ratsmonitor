'use client';
import {useState} from 'react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
export function AdminActivation(){
 const [code,setCode]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 return <form className="admin-activation" onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{const r=await fetch('/api/admin/claim',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code})});const data=await r.json() as {error?:string};if(!r.ok)throw Error(data.error||'Freischaltung fehlgeschlagen.');setCode('');window.location.reload();}catch(e){setError(e instanceof Error?e.message:'Bitte erneut versuchen.');setBusy(false);}}}><label htmlFor="admin-code">Einmaliger Freischaltcode</label><Input id="admin-code" type="password" autoComplete="off" autoCapitalize="none" required maxLength={128} value={code} onChange={e=>setCode(e.target.value)} disabled={busy}/><Button type="submit" disabled={busy||!code.trim()}>{busy?'Wird freigeschaltet …':'Admin-Zugang freischalten'}</Button>{error&&<p role="alert" className="admin-error">{error}</p>}</form>;
}
