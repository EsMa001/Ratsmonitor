'use client';
import {StaticLogo} from '../components/ratsmonitor/components/StaticLogo';
// Shown in place of a page that could not be rendered, inside the layout. Kept nearly free of imports (only the plain-markup logo): the less this
// page needs to load, the more likely it appears when the server is in trouble.
export default function PageError({error}:{error:Error&{digest?:string};reset?:()=>void}){
 return <main id="inhalt" className="admin-gate"><StaticLogo size={32} /><p className="eyebrow">SEITE NICHT GELADEN</p><h1>Die Seite konnte gerade nicht geladen werden.</h1><p role="alert">Der Server hat die Anfrage nicht beantwortet, zum Beispiel weil ein laufender Abruf die Datenbank belegt. Gespeicherte Daten und ein laufender Auftrag bleiben erhalten.</p><button type="button" className="page-error-action" onClick={()=>window.location.reload()}>Seite neu laden</button><a className="text-link" href="/">Zur Startseite</a>{error?.digest&&<p className="page-note">Fehlerkennung: {error.digest}</p>}</main>;
}
