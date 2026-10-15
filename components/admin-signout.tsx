'use client';
// Abmelden in der Administration über das Konto: POST /api/auth/logout, danach zur Anmeldung.
import {useState} from 'react';
export function AdminSignOut(){
 const [busy,setBusy]=useState(false);
 const signOut=async()=>{
  setBusy(true);
  try{await fetch('/api/auth/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});}catch{/* trotzdem weiter */}
  window.location.href='/anmelden';
 };
 return <button type="button" onClick={signOut} disabled={busy} className="btn-secondary btn-sm">Abmelden</button>;
}
