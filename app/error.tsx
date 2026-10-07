'use client';
import {Brand} from '../components/ratsmonitor/components/Brand';
// Shown in place of a page that could not be rendered, inside the layout. Kept nearly free of imports (only the header logo, which needs no provider): the less this
// page needs to load, the more likely it appears when the server is in trouble.
export default function PageError({error}:{error:Error&{digest?:string};reset?:()=>void}){
 return <main id="inhalt" className="admin-gate"><div style={{display:'flex',alignItems:'center',color:'#0f172a',lineHeight:1,whiteSpace:'nowrap'}}><Brand /></div><p className="eyebrow">SEITE NICHT GELADEN</p><h1>Die Seite konnte gerade nicht geladen werden.</h1><p role="alert">Der Server hat die Anfrage nicht beantwortet, zum Beispiel weil ein laufender Abruf die Datenbank belegt. Gespeicherte Daten und ein laufender Auftrag bleiben erhalten.</p><button type="button" className="page-error-action" onClick={()=>window.location.reload()}>Seite neu laden</button><a className="text-link" href="/">Zur Startseite</a>{error?.digest&&<p className="page-note">Fehlerkennung: {error.digest}</p>}</main>;
}
