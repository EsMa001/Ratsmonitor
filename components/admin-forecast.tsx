'use client';
import {AdminHeader} from '@/components/admin-chrome';
import {AdminEstimate} from '@/components/admin-estimate';
/** Admin page 3: Germany-wide estimate of the report volume. Reads only; nothing is started from here. */
export function AdminForecast({displayName,signOutPath}:{displayName:string;signOutPath:string}){
 return <div className="admin-app"><AdminHeader page="hochrechnung" displayName={displayName} signOutPath={signOutPath}/><main id="inhalt" className="admin-shell admin-workspace">
  <div className="admin-heading"><div><p className="eyebrow">AUFKOMMEN & UMFANG</p><h1>Hochrechnung.</h1><p>{displayName} · Grundlage für die Abschätzung der KI-Kosten</p></div></div>
  <AdminEstimate revision={0}/>
  <footer className="admin-footer">Die Hochrechnung liest nur den gespeicherten Bestand. <a href="/admin?seite=abruf">Gebiete abrufen: Daten & Verarbeitung →</a></footer>
 </main></div>;
}
