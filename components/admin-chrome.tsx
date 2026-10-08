'use client';
import {ShieldCheck} from 'lucide-react';
import {useDarkMode} from '@/components/ratsmonitor/lib/useDarkMode';
import {Brand} from '@/components/ratsmonitor/components/Brand';

// Kopfzeile aller Adminseiten im Quorumo-Design: Logo wie in der App (führt zur Übersicht), Bereich, Konto.
// Die Startseite des Adminbereichs ist die To-do-Liste (ohne Parameter). Die Seiten heißen in der Adresse nach ihrem Inhalt (?seite=abruf); die alten Nummern 1 bis 4 führen weiter dorthin.
export type AdminPage='todo'|'uebersicht'|'abruf'|'atlas'|'qualitaet'|'hochrechnung'|'stichwoerter';
export const ADMIN_PAGES:{id:AdminPage;label:string}[]=[{id:'todo',label:'To-do-Liste'},{id:'uebersicht',label:'Übersicht'},{id:'abruf',label:'Abruf & Verarbeitung'},{id:'atlas',label:'Lückenatlas'},{id:'qualitaet',label:'Qualität & Betrieb'},{id:'hochrechnung',label:'Hochrechnung'},{id:'stichwoerter',label:'Stichwörter'}];
/** Adresse einer Adminseite, mit weiteren Parametern ("filter=issues"). */
export const adminHref=(page:AdminPage,params='')=>'/admin'+(page==='todo'?(params?'?'+params:''):'?seite='+page+(params?'&'+params:''));

export function AdminBar({displayName,signOutPath}:{displayName?:string;signOutPath?:string}){
 const [dark,setDark]=useDarkMode();
 const label=dark?'Heller Modus':'Dunkler Modus';
 return <header className="admin-masthead"><div className="admin-masthead__inner">
  <Brand/>
  <span className="admin-access"><ShieldCheck size={16}/> Administration</span>
  <button type="button" className="admin-dark-toggle" title={label} aria-label={label} aria-pressed={dark} onClick={()=>setDark(!dark)}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{dark?<><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></>:<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>}</svg></button>
  {signOutPath&&<div className="admin-masthead__account">{displayName&&<span>{displayName}</span>}<a target="_top" href={signOutPath}>Abmelden</a></div>}
 </div></header>;
}

export function AdminHeader({page,displayName,signOutPath}:{page:AdminPage;displayName:string;signOutPath:string}){
 return <>
  <AdminBar displayName={displayName} signOutPath={signOutPath}/>
  <nav className="admin-pages" aria-label="Adminseiten">{ADMIN_PAGES.map(p=><a key={p.id} href={adminHref(p.id)} aria-current={page===p.id?'page':undefined}><span>{p.label}</span></a>)}</nav>
 </>;
}
