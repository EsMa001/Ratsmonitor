'use client';
import {ShieldCheck} from 'lucide-react';
import {Brand} from '@/components/ratsmonitor/components/Brand';

// Kopfzeile aller Adminseiten im Quorumo-Design: Logo wie in der App (führt zur Übersicht), Bereich, Konto.
const PAGES:[number,string,string][]=[[1,'/admin','Daten & Verarbeitung'],[2,'/admin?seite=2','Qualität & Betrieb'],[3,'/admin?seite=3','Hochrechnung'],[4,'/admin?seite=4','Stichwörter']];

export function AdminBar({displayName,signOutPath}:{displayName?:string;signOutPath?:string}){
 return <header className="admin-bar"><div className="admin-bar__inner">
  <Brand/>
  <span className="admin-access"><ShieldCheck size={16}/> Administration</span>
  {signOutPath&&<div className="admin-bar__account">{displayName&&<span>{displayName}</span>}<a target="_top" href={signOutPath}>Abmelden</a></div>}
 </div></header>;
}

export function AdminHeader({page,displayName,signOutPath}:{page:number;displayName:string;signOutPath:string}){
 return <>
  <AdminBar displayName={displayName} signOutPath={signOutPath}/>
  <nav className="admin-pages" aria-label="Adminseiten">{PAGES.map(([n,href,label])=><a key={n} href={href} aria-current={page===n?'page':undefined}><b>{n}</b> <span>{label}</span></a>)}</nav>
 </>;
}
