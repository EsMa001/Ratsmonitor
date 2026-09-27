import {Button} from '@/components/ui/button';
import {env} from 'cloudflare:workers';
import {getChatGPTUser,chatGPTSignInPath,chatGPTSignOutPath} from '@/app/chatgpt-auth';
import {adminAccess} from '@/server/integrations/admin-access.mjs';
import {getAdminDashboard} from '@/server/repositories/admin';
import {AdminActivation} from '@/components/admin-activation';
import {AdminDashboardView} from '@/components/admin-dashboard';
export const dynamic='force-dynamic';
export const metadata={title:'Administration · vor Ort',robots:{index:false,follow:false}};
export default async function AdminPage(){return <AdminContent/>;}
async function AdminContent(){
 const user=await getChatGPTUser();
 const frame=(children:React.ReactNode)=><main id="inhalt" className="admin-gate"><a className="wordmark" href="/">vor Ort<span className="wordmark__dot">.</span></a><p className="eyebrow">ADMINISTRATION</p>{children}<a className="text-link" href="/">Zur öffentlichen Website</a></main>;
 if(!user)return frame(<><h1>Geschützter Bereich</h1><p>Melde dich mit ChatGPT an, um die Administration zu öffnen.</p><Button asChild className="admin-gate-action"><a target="_top" href={chatGPTSignInPath('/admin')}>Mit ChatGPT anmelden</a></Button></>);
 try{
  const access=await adminAccess(env.DB,user);
  if(access.kind==='setup')return frame(<><h1>Admin-Zugang einrichten</h1><p>Angemeldet als <strong>{user.displayName}</strong>. Der einmalige Freischaltcode verknüpft die Administration dauerhaft mit diesem Konto.</p>{env.ADMIN_SETUP_HASH?<AdminActivation/>:<p role="status">Die Freischaltung ist noch nicht eingerichtet.</p>}<a target="_top" className="text-link" href={chatGPTSignOutPath('/admin')}>Mit einem anderen Konto anmelden</a></>);
  if(access.kind!=='owner')return frame(<><h1>Kein Admin-Zugriff</h1><p>Dieses ChatGPT-Konto ist nicht für die Administration freigeschaltet.</p><a className="text-link" target="_top" href={chatGPTSignOutPath('/admin')}>Konto wechseln</a></>);
  return <AdminDashboardView initial={await getAdminDashboard()} displayName={user.displayName} signOutPath={chatGPTSignOutPath('/')}/>;
 }catch{return frame(<><h1>Administration nicht erreichbar</h1><p role="alert">Der Datenbankstand konnte gerade nicht geladen werden. Es werden keine Ersatzzahlen angezeigt.</p><Button asChild className="admin-gate-action"><a href="/admin">Erneut versuchen</a></Button></>);}
}
