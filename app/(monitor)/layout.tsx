import {cookies} from 'next/headers';
import MonitorApp from '@/components/ratsmonitor/App';
/* Sitzungs-Cookie vorhanden? (Namen wie server/accounts/http.mjs cookieNames). Nur ein Hinweis für den ersten Aufbau: Gäste bekommen die
   Vorschau der plenara.X-Seiten gleich im HTML; die Stufe selbst kommt weiter aus /api/me. */
const SESSION_COOKIES=['__Host-rm_session','rm_session','rm_dev_session'];
export default async function MonitorLayout({children}:{children:React.ReactNode}){
 const jar=await cookies();
 const signedIn=SESSION_COOKIES.some(n=>jar.has(n));
 return <>{children}<MonitorApp signedIn={signedIn}/></>;
}
