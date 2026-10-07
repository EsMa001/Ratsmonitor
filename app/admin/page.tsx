import {Button} from '@/components/ui/button';
import {env} from 'cloudflare:workers';
import {getChatGPTUser,chatGPTSignInPath,chatGPTSignOutPath} from '@/app/chatgpt-auth';
import {adminAccess} from '@/server/integrations/admin-access.mjs';
import {AdminActivation} from '@/components/admin-activation';
import {AdminBar,type AdminPage} from '@/components/admin-chrome';
import {BRAND_NAME,DEFAULT_BRAND} from '@/components/ratsmonitor/lib/brands';
import {AdminLoader} from '@/components/admin-loader';
import {AdminOverview} from '@/components/admin-overview';
import {AdminAtlas} from '@/components/admin-atlas';
import {AdminForecast} from '@/components/admin-forecast';
import {AdminKeywords} from '@/components/admin-keywords';
import {validRegion,REGIONS} from '@/shared/regions';
export const dynamic='force-dynamic';
export const metadata={title:'Administration · '+BRAND_NAME[DEFAULT_BRAND],robots:{index:false,follow:false}};
// Pages by name; the numbers of the first version still lead to their page. "auswahl" (areas handed over by the
// estimate) and "filter" (a list filter) open the import page.
const PAGES:Record<string,AdminPage>={uebersicht:'uebersicht',abruf:'abruf',atlas:'atlas',qualitaet:'qualitaet',hochrechnung:'hochrechnung',stichwoerter:'stichwoerter','1':'abruf','2':'qualitaet','3':'hochrechnung','4':'stichwoerter'};
const FILTERS=['all','connected','data','empty','issues','shallow','quiet','selected'];
export default async function AdminPage({searchParams}:{searchParams:Promise<{seite?:string;auswahl?:string;filter?:string}>}){const {seite,auswahl,filter}=await searchParams;
 // "auswahl" preselects areas on the import page; only known area ids are accepted.
 const selection=[...new Set(String(auswahl||'').split(',').filter(id=>id&&validRegion(id)))].slice(0,REGIONS.length);
 const page=PAGES[String(seite||'')]||(selection.length||filter?'abruf':'uebersicht');
 return <AdminContent page={page} selection={selection} filter={FILTERS.includes(String(filter))?String(filter):undefined}/>;}
async function AdminContent({page,selection,filter}:{page:AdminPage;selection:string[];filter?:string}){
 const user=await getChatGPTUser();
 const frame=(children:React.ReactNode)=><div className="admin-app"><AdminBar/><main id="inhalt" className="admin-gate"><p className="eyebrow">ADMINISTRATION</p>{children}<a className="text-link" href="/">Zur öffentlichen Website</a></main></div>;
 if(!user)return frame(<><h1>Geschützter Bereich</h1><p>Melde dich mit ChatGPT an, um die Administration zu öffnen.</p><Button asChild className="admin-gate-action"><a target="_top" href={chatGPTSignInPath('/admin')}>Mit ChatGPT anmelden</a></Button></>);
 try{
  const access=await adminAccess(env.DB,user);
  if(access.kind==='setup')return frame(<><h1>Admin-Zugang einrichten</h1><p>Angemeldet als <strong>{user.displayName}</strong>. Der einmalige Freischaltcode verknüpft die Administration dauerhaft mit diesem Konto.</p>{env.ADMIN_SETUP_HASH?<AdminActivation/>:<p role="status">Die Freischaltung ist noch nicht eingerichtet: Der Betreiber muss den geheimen Freischalt-Hash setzen und neu deployen.</p>}</>);
  if(access.kind!=='owner')return frame(<><h1>Kein Admin-Zugriff</h1><p>Dieses ChatGPT-Konto ist nicht für die Administration freigeschaltet.</p><a className="text-link" target="_top" href={chatGPTSignOutPath('/admin')}>Konto wechseln</a></>);
  const signOutPath=chatGPTSignOutPath('/');
  if(page==='stichwoerter')return <AdminKeywords displayName={user.displayName} signOutPath={signOutPath}/>;
  if(page==='hochrechnung')return <AdminForecast displayName={user.displayName} signOutPath={signOutPath}/>;
  if(page==='atlas')return <AdminAtlas displayName={user.displayName} signOutPath={signOutPath}/>;
  if(page==='uebersicht')return <AdminOverview displayName={user.displayName} signOutPath={signOutPath}/>;
  // Import and quality pages: the browser loads the dashboard (several MB) itself, see components/admin-loader.tsx.
  return <AdminLoader page={page} displayName={user.displayName} signOutPath={signOutPath} initialSelection={selection} initialFilter={filter}/>;
 }catch{return frame(<><h1>Administration nicht erreichbar</h1><p role="alert">Der Datenbankstand konnte gerade nicht geladen werden. Es werden keine Ersatzzahlen angezeigt.</p><Button asChild className="admin-gate-action"><a href="/admin">Erneut versuchen</a></Button></>);}
}
