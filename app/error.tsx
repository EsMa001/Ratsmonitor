'use client';
import {useEffect} from 'react';
import {Brand} from '../components/ratsmonitor/components/Brand';
import {reportError} from '../components/ratsmonitor/lib/reportError';
// Shown in place of a page that could not be rendered, inside the layout. Kept nearly free of imports (only the header logo, which needs no provider): the less this
// page needs to load, the more likely it appears when the server is in trouble.
export default function PageError({error}:{error:Error&{digest?:string};reset?:()=>void}){
 // Fehler beim Aufbau der Seite an den eigenen Server melden (Server-Log)
 useEffect(()=>{reportError('render',error);},[error]);
// eslint-disable-next-line @next/next/no-html-link-for-pages -- nach einem Fehler bewusst ganz neu laden, nicht innerhalb der App wechseln
 return <main id="inhalt" className="admin-gate"><div style={{display:'flex',alignItems:'center',color:'var(--rm-c900)',lineHeight:1,whiteSpace:'nowrap'}}><Brand /></div><p className="eyebrow">SEITE NICHT GELADEN</p><h1>Die Seite konnte gerade nicht geladen werden.</h1><p role="alert">Der Server hat die Anfrage nicht beantwortet, zum Beispiel weil ein laufender Abruf die Datenbank belegt. Gespeicherte Daten und ein laufender Auftrag bleiben erhalten.</p><button type="button" className="page-error-action" onClick={()=>window.location.reload()}>Seite neu laden</button><a className="text-link" href="/">Zur Startseite</a>{error?.digest&&<p className="page-note">Fehlerkennung: {error.digest}</p>}</main>;
}
