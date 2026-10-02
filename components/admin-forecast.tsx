'use client';
import {ShieldCheck} from 'lucide-react';
import {AdminEstimate} from '@/components/admin-estimate';
/** Admin page 3: Germany-wide estimate of the report volume. Reads only; nothing is started from here. */
export function AdminForecast({displayName,signOutPath}:{displayName:string;signOutPath:string}){
 return <main id="inhalt" className="admin-shell admin-workspace">
  <header className="admin-topbar"><a className="admin-back" href="/" aria-label="Zurück zur Übersicht"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>Zurück</a><a className="wordmark" href="/">Ratsmonitor<span className="wordmark__dot">.</span></a><span className="admin-access"><ShieldCheck size={16}/> Administration</span><a target="_top" href={signOutPath}>Abmelden</a></header>
  <nav className="admin-pages" aria-label="Adminseiten"><a href="/admin">1 <span>Daten & Verarbeitung</span></a><a href="/admin?seite=2">2 <span>Qualität & Betrieb</span></a><a href="/admin?seite=3" aria-current="page">3 <span>Hochrechnung</span></a><a href="/admin?seite=4">4 <span>Stichwörter</span></a></nav>
  <div className="admin-heading"><div><p className="eyebrow">AUFKOMMEN & UMFANG</p><h1>Hochrechnung.</h1><p>{displayName} · Grundlage für die Abschätzung der KI-Kosten</p></div></div>
  <AdminEstimate revision={0}/>
  <footer className="admin-footer">Die Hochrechnung liest nur den gespeicherten Bestand. <a href="/admin">Gebiete abrufen: Daten & Verarbeitung →</a></footer>
 </main>;
}
