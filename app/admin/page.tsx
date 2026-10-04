import {Button} from '@/components/ui/button';
import {env} from 'cloudflare:workers';
import {getChatGPTUser,chatGPTSignInPath,chatGPTSignOutPath} from '@/app/chatgpt-auth';
import {adminAccess} from '@/server/integrations/admin-access.mjs';
import {getAdminDashboard} from '@/server/repositories/admin';
import {AdminActivation} from '@/components/admin-activation';
import {AdminBar} from '@/components/admin-chrome';
import {BRAND_NAME,DEFAULT_BRAND} from '@/components/ratsmonitor/lib/brands';
import {AdminProcessing} from '@/components/admin-processing';
import {AdminDashboardView} from '@/components/admin-dashboard';
import {AdminForecast} from '@/components/admin-forecast';
import {AdminKeywords} from '@/components/admin-keywords';
import {validRegion,REGIONS} from '@/shared/regions';
export const dynamic='force-dynamic';
export const metadata={title:'Administration · '+BRAND_NAME[DEFAULT_BRAND],robots:{index:false,follow:false}};
export default async function AdminPage({searchParams}:{searchParams:Promise<{seite?:string;auswahl?:string}>}){const {seite,auswahl}=await searchParams;
 // "auswahl" preselects areas on page 1; only known area ids are accepted.
 const selection=[...new Set(String(auswahl||'').split(',').filter(id=>id&&validRegion(id)))].slice(0,REGIONS.length);
 return <AdminContent page={seite==='2'?2:seite==='3'?3:seite==='4'?4:1} selection={selection}/>;}
async function AdminContent({page,selection}:{page:number;selection:string[]}){
 const user=await getChatGPTUser();
 const frame=(children:React.ReactNode)=><div className="admin-app"><AdminBar/><main id="inhalt" className="admin-gate"><p className="eyebrow">ADMINISTRATION</p>{children}<a className="text-link" href="/">Zur öffentlichen Website</a></main></div>;
 if(!user)return frame(<><h1>Geschützter Bereich</h1><p>Melde dich mit ChatGPT an, um die Administration zu öffnen.</p><Button asChild className="admin-gate-action"><a target="_top" href={chatGPTSignInPath('/admin')}>Mit ChatGPT anmelden</a></Button></>);
 try{
  const access=await adminAccess(env.DB,user);
  if(access.kind==='setup')return frame(<><h1>Admin-Zugang einrichten</h1><p>Angemeldet als <strong>{user.displayName}</strong>. Der einmalige Freischaltcode verknüpft die Administration dauerhaft mit diesem Konto.</p>{env.ADMIN_SETUP_HASH?<AdminActivation/>:<p role="status">Die Freischaltung ist noch nicht eingerichtet.</p>}<a target="_top" className="text-link" href={chatGPTSignOutPath('/admin')}>Mit einem anderen Konto anmelden</a></>);
  if(access.kind!=='owner')return frame(<><h1>Kein Admin-Zugriff</h1><p>Dieses ChatGPT-Konto ist nicht für die Administration freigeschaltet.</p><a className="text-link" target="_top" href={chatGPTSignOutPath('/admin')}>Konto wechseln</a></>);
  if(page===4)return <AdminKeywords displayName={user.displayName} signOutPath={chatGPTSignOutPath('/')}/>;
  if(page===3)return <AdminForecast displayName={user.displayName} signOutPath={chatGPTSignOutPath('/')}/>;
  if(page===2)return <AdminDashboardView initial={await getAdminDashboard()} displayName={user.displayName} signOutPath={chatGPTSignOutPath('/')}/>;
  return <AdminProcessing initial={await getAdminDashboard({review:false})} displayName={user.displayName} signOutPath={chatGPTSignOutPath('/')} initialSelection={selection}/>;
 }catch{return frame(<><h1>Administration nicht erreichbar</h1><p role="alert">Der Datenbankstand konnte gerade nicht geladen werden. Es werden keine Ersatzzahlen angezeigt.</p><Button asChild className="admin-gate-action"><a href="/admin">Erneut versuchen</a></Button></>);}
}
