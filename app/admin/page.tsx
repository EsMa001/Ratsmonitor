import {env} from 'cloudflare:workers';
import {getChatGPTUser,chatGPTSignInPath,chatGPTSignOutPath} from '@/app/chatgpt-auth';
import {adminAccess} from '@/server/integrations/admin-access.mjs';
import {AdminActivation} from '@/components/admin-activation';
import {AdminFrame,type AdminPage} from '@/components/admin-chrome';
import {BRAND_NAME,DEFAULT_BRAND} from '@/components/ratsmonitor/lib/brands';
import {AdminLoader} from '@/components/admin-loader';
import {staticVersion} from '@/server/repositories/admin';
import {AdminOverview} from '@/components/admin-overview';
import {AdminAtlas} from '@/components/admin-atlas';
import {AdminMobile} from '@/components/admin-mobile';
import {AdminForecast} from '@/components/admin-forecast';
import {AdminKeywords} from '@/components/admin-keywords';
import {AdminRuleTexts} from '@/components/admin-rule-texts';
import {AdminTodo} from '@/components/admin-todo';
import {validRegion,REGIONS} from '@/shared/regions';
export const dynamic='force-dynamic';
export const metadata={title:'Administration · '+BRAND_NAME[DEFAULT_BRAND],robots:{index:false,follow:false}};
// Pages by name; the numbers of the first version still lead to their page. "auswahl" (areas handed over by the
// estimate) and "filter" (a list filter) open the import page.
const PAGES:Record<string,AdminPage>={todo:'todo',uebersicht:'uebersicht',abruf:'abruf',atlas:'atlas',qualitaet:'qualitaet',hochrechnung:'hochrechnung',stichwoerter:'stichwoerter',regeltexte:'regeltexte','1':'abruf','2':'qualitaet','3':'hochrechnung','4':'stichwoerter'};
const FILTERS=['all','connected','data','empty','issues','partial','stale','failed','shallow','quiet','selected'];
export default async function AdminPage({searchParams}:{searchParams:Promise<{seite?:string;auswahl?:string;filter?:string}>}){const {seite,auswahl,filter}=await searchParams;
 // "auswahl" preselects areas on the import page; only known area ids are accepted.
 const selection=[...new Set(String(auswahl||'').split(',').filter(id=>id&&validRegion(id)))].slice(0,REGIONS.length);
 const page=PAGES[String(seite||'')]||(selection.length||filter?'abruf':'todo');
 return <AdminContent page={page} mobile={String(seite||'')==='mobil'} selection={selection} filter={FILTERS.includes(String(filter))?String(filter):undefined}/>;}
async function AdminContent({page,mobile,selection,filter}:{page:AdminPage;mobile:boolean;selection:string[];filter?:string}){
 const user=await getChatGPTUser();
 // Melde-, Einrichtungs- und Fehlerzustände im Rahmen ohne Reiter.
 const gate=(children:React.ReactNode)=><AdminFrame tabs={false}><div className="mx-auto max-w-[640px] py-16">{children}</div></AdminFrame>;
 const title=(text:string)=><h1 className="text-[28px] font-semibold leading-tight">{text}</h1>;
 const text=(children:React.ReactNode)=><p className="mt-3 text-[16px] text-slate-500">{children}</p>;
 if(!user)return gate(<>{title('Geschützter Bereich')}{text('Melden Sie sich mit ChatGPT an, um die Administration zu öffnen.')}<a target="_top" href={chatGPTSignInPath('/admin')} className="btn-primary mt-6 inline-flex">Mit ChatGPT anmelden</a></>);
 try{
  const access=await adminAccess(env.DB,user);
  if(access.kind==='setup')return gate(<>{title('Admin-Zugang einrichten')}{text(<>Angemeldet als <strong>{user.displayName}</strong>. Der einmalige Freischaltcode verknüpft die Administration dauerhaft mit diesem Konto.</>)}{env.ADMIN_SETUP_HASH?<AdminActivation/>:<p role="status" className="mt-4 text-[14px] text-slate-500">Die Freischaltung ist noch nicht eingerichtet: Der Betreiber muss den geheimen Freischalt-Hash setzen und neu deployen.</p>}</>);
  if(access.kind!=='owner')return gate(<>{title('Kein Admin-Zugriff')}{text('Dieses ChatGPT-Konto ist nicht für die Administration freigeschaltet.')}<a className="mt-6 inline-flex text-[14px] text-teal-600" target="_top" href={chatGPTSignOutPath('/admin')}>Konto wechseln →</a></>);
  const signOutPath=chatGPTSignOutPath('/');
  const frame=(content:React.ReactNode)=><AdminFrame page={page} displayName={user.displayName} signOutPath={signOutPath}>{content}</AdminFrame>;
  // Abgespeckter Bereich fürs Handy (?seite=mobil): ohne Reiter, nur die Abdeckung des Lückenatlas.
  if(mobile)return <AdminFrame tabs={false} displayName={user.displayName} signOutPath={signOutPath}><AdminMobile/></AdminFrame>;
  if(page==='todo')return frame(<AdminTodo/>);
  if(page==='stichwoerter')return frame(<AdminKeywords/>);
  if(page==='regeltexte')return frame(<AdminRuleTexts/>);
  if(page==='hochrechnung')return frame(<AdminForecast/>);
  if(page==='atlas')return frame(<AdminAtlas/>);
  if(page==='uebersicht')return frame(<AdminOverview/>);
  // Import and quality pages: the browser puts the dashboard together from three parts, see components/admin-loader.tsx.
  return frame(<AdminLoader page={page} staticVersion={staticVersion()} initialSelection={selection} initialFilter={filter}/>);
 }catch{return gate(<>{title('Administration nicht erreichbar')}<p role="alert" className="mt-3 text-[16px] text-slate-500">Die Zugangsprüfung hat gerade nicht geantwortet. Bitte versuchen Sie es gleich noch einmal.</p><a className="btn-primary mt-6 inline-flex" href="/admin">Erneut versuchen</a></>);}
}
