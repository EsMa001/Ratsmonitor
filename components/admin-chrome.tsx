'use client';
import {ShieldCheck} from 'lucide-react';
import {Brand} from '@/components/ratsmonitor/components/Brand';

// Kopfzeile aller Adminseiten im Quorumo-Design: Logo wie in der App (führt zur Übersicht), Bereich, Konto.
// Die Seiten heißen in der Adresse nach ihrem Inhalt (?seite=abruf); die alten Nummern 1 bis 4 führen weiter dorthin.
export type AdminPage='uebersicht'|'abruf'|'atlas'|'qualitaet'|'hochrechnung'|'stichwoerter';
export const ADMIN_PAGES:{id:AdminPage;label:string}[]=[{id:'uebersicht',label:'Übersicht'},{id:'abruf',label:'Abruf & Verarbeitung'},{id:'atlas',label:'Lückenatlas'},{id:'qualitaet',label:'Qualität & Betrieb'},{id:'hochrechnung',label:'Hochrechnung'},{id:'stichwoerter',label:'Stichwörter'}];
/** Adresse einer Adminseite, mit weiteren Parametern ("filter=issues"). */
export const adminHref=(page:AdminPage,params='')=>'/admin'+(page==='uebersicht'?(params?'?'+params:''):'?seite='+page+(params?'&'+params:''));

export function AdminBar({displayName,signOutPath}:{displayName?:string;signOutPath?:string}){
 return <header className="admin-masthead"><div className="admin-masthead__inner">
  <Brand/>
  <span className="admin-access"><ShieldCheck size={16}/> Administration</span>
  {signOutPath&&<div className="admin-masthead__account">{displayName&&<span>{displayName}</span>}<a target="_top" href={signOutPath}>Abmelden</a></div>}
 </div></header>;
}

export function AdminHeader({page,displayName,signOutPath}:{page:AdminPage;displayName:string;signOutPath:string}){
 return <>
  <AdminBar displayName={displayName} signOutPath={signOutPath}/>
  <nav className="admin-pages" aria-label="Adminseiten">{ADMIN_PAGES.map(p=><a key={p.id} href={adminHref(p.id)} aria-current={page===p.id?'page':undefined}><span>{p.label}</span></a>)}</nav>
 </>;
}
