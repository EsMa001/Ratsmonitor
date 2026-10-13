import {env} from 'cloudflare:workers';
// Stile nur der Administration (nicht im öffentlichen CSS); nach globals.css geladen wie zuvor.
import '../admin.css';
import {chatGPTSignInPath,chatGPTSignOutPath,chatGPTSignInAvailable} from '@/app/chatgpt-auth';
import {adminState} from '@/server/services/session';
import {AdminActivation} from '@/components/admin-activation';
import {AdminFrame,START_PAGE,type AdminPage} from '@/components/admin-chrome';
import {BRAND_NAME,DEFAULT_BRAND} from '@/components/ratsmonitor/lib/brands';
import {AdminLoader} from '@/components/admin-loader';
import {staticVersion} from '@/server/repositories/admin';
import {AdminOverview} from '@/components/admin-overview';
import {AdminAtlas} from '@/components/admin-atlas';
import {AdminMobile} from '@/components/admin-mobile';
import {AdminForecast} from '@/components/admin-forecast';
import {AdminRuleTexts} from '@/components/admin-rule-texts';
import {AdminTodo} from '@/components/admin-todo';
import {AdminSocial} from '@/components/admin-social';
import {AdminPdf} from '@/components/admin-pdf';
import {AdminStorage} from '@/components/admin-storage';
import {AdminSchedules} from '@/components/admin-schedules';
import {validRegion,REGIONS} from '@/shared/regions';
export const dynamic='force-dynamic';
export const metadata={title:'Administration · '+BRAND_NAME[DEFAULT_BRAND],robots:{index:false,follow:false}};
// Pages by name; the numbers of the first version still lead to their page. "auswahl" (areas handed over by the
// estimate) and "filter" (a list filter) open the import page. Without a page: the overview (START_PAGE).
const PAGES:Record<string,AdminPage>={todo:'todo',uebersicht:'uebersicht',abruf:'abruf',atlas:'atlas',qualitaet:'qualitaet',hochrechnung:'hochrechnung',regeltexte:'regeltexte',social:'social',pdf:'pdf','pdf-import':'pdf',speicher:'speicher',zeitplaene:'zeitplaene',jobs:'zeitplaene','1':'abruf','2':'qualitaet','3':'hochrechnung'};
const FILTERS=['all','connected','data','empty','issues','partial','stale','failed','shallow','quiet','selected'];
export default async function AdminPage({searchParams}:{searchParams:Promise<{seite?:string;auswahl?:string;filter?:string}>}){const {seite,auswahl,filter}=await searchParams;
 // "auswahl" preselects areas on the import page; only known area ids are accepted.
 const selection=[...new Set(String(auswahl||'').split(',').filter(id=>id&&validRegion(id)))].slice(0,REGIONS.length);
 const page=PAGES[String(seite||'')]||(selection.length||filter?'abruf':START_PAGE);
 return <AdminContent page={page} mobile={String(seite||'')==='mobil'} selection={selection} filter={FILTERS.includes(String(filter))?String(filter):undefined}/>;}
async function AdminContent({page,mobile,selection,filter}:{page:AdminPage;mobile:boolean;selection:string[];filter?:string}){
 // Melde-, Einrichtungs- und Fehlerzustände im Rahmen ohne Reiter.
 const gate=(children:React.ReactNode)=><AdminFrame tabs={false}><div className="mx-auto max-w-[640px] py-16">{children}</div></AdminFrame>;
 const title=(text:string)=><h1 className="text-[28px] font-semibold leading-tight">{text}</h1>;
 const text=(children:React.ReactNode)=><p className="mt-3 text-[16px] text-slate-500">{children}</p>;
 const signInLink=<a className="btn-primary mt-6 inline-flex" href="/anmelden?weiter=/admin">Anmelden</a>;
 // Admin ist eine Rolle am Konto und gilt nur über den Tunnel (requirements/konten-konzept.md, 6.1). Auf Cloudflare
 // und im Übergang führt ein Knopf zur ChatGPT-Anmeldung (ADMIN_LEGACY_HEADER=1).
 const signIn=chatGPTSignInAvailable()&&env.ADMIN_LEGACY_HEADER==='1';
 let state;
 try{state=await adminState();}
 catch{state={kind:'unavailable'} as const;}
 if(state.kind==='unavailable')return gate(<>{title('Administration nicht erreichbar')}<p role="alert" className="mt-3 text-[16px] text-slate-500">Die Zugangsprüfung hat gerade nicht geantwortet. Bitte versuchen Sie es gleich noch einmal.</p><a className="btn-primary mt-6 inline-flex" href="/admin">Erneut versuchen</a></>);
 if(state.kind==='anonymous')return gate(<>{title('Geschützter Bereich')}{signIn?<>{text('Melden Sie sich mit ChatGPT an, um die Administration zu öffnen.')}<a target="_top" href={chatGPTSignInPath('/admin')} className="btn-primary mt-6 inline-flex">Mit ChatGPT anmelden</a></>:<>{text('Die Administration öffnet sich nach der Anmeldung mit einem Admin-Konto, nur über den Zugang auf dem Server selbst (Tunnel, http://127.0.0.1:8080).')}{signInLink}</>}</>);
 if(state.kind==='stale')return gate(<>{title('Bitte neu anmelden')}{text('Die Anmeldung für die Administration ist älter als sieben Tage.')}{signInLink}</>);
 if(state.kind==='setup')return gate(<>{title('Admin-Zugang einrichten')}{text(<>Angemeldet als <strong>{state.user?.displayName}</strong>. Der einmalige Freischaltcode verknüpft die Administration dauerhaft mit diesem Konto.</>)}{env.ADMIN_SETUP_HASH?<AdminActivation/>:<p role="status" className="mt-4 text-[14px] text-slate-500">Die Freischaltung ist noch nicht eingerichtet: Der Betreiber muss den Hash des Freischaltcodes als ADMIN_SETUP_HASH hinterlegen.</p>}</>);
 if(state.kind!=='admin'||!state.user)return gate(<>{title('Kein Admin-Zugriff')}{text('Dieses Konto ist nicht für die Administration freigeschaltet, oder die Anfrage kam nicht über den Zugang auf dem Server (Tunnel).')}{signIn&&state.legacy&&<a className="mt-6 inline-flex text-[14px] text-teal-600" target="_top" href={chatGPTSignOutPath('/admin')}>Konto wechseln →</a>}</>);
 const user=state.user;
 try{
  // Abmelden: mit ChatGPT-Anmeldung über deren Weg, sonst über das Konto (POST /api/auth/logout)
  const signOutPath=state.legacy&&chatGPTSignInAvailable()?chatGPTSignOutPath('/'):undefined;
  const accountSignOut=!state.legacy;
  const frame=(content:React.ReactNode)=><AdminFrame page={page} displayName={user.displayName} signOutPath={signOutPath} accountSignOut={accountSignOut}>{content}</AdminFrame>;
  // Abgespeckter Bereich fürs Handy (?seite=mobil): ohne Reiter, nur die Abdeckung des Lückenatlas.
  if(mobile)return <AdminFrame tabs={false} displayName={user.displayName} signOutPath={signOutPath} accountSignOut={accountSignOut}><AdminMobile/></AdminFrame>;
  if(page==='todo')return frame(<AdminTodo/>);
  if(page==='regeltexte')return frame(<AdminRuleTexts/>);
  if(page==='social')return frame(<AdminSocial/>);
  if(page==='pdf')return frame(<AdminPdf/>);
  if(page==='speicher')return frame(<AdminStorage/>);
  if(page==='zeitplaene')return frame(<AdminSchedules/>);
  if(page==='hochrechnung')return frame(<AdminForecast/>);
  if(page==='atlas')return frame(<AdminAtlas/>);
  if(page==='uebersicht')return frame(<AdminOverview/>);
  // Import and quality pages: the browser puts the dashboard together from three parts, see components/admin-loader.tsx.
  return frame(<AdminLoader page={page} staticVersion={staticVersion()} initialSelection={selection} initialFilter={filter}/>);
 }catch{return gate(<>{title('Administration nicht erreichbar')}<p role="alert" className="mt-3 text-[16px] text-slate-500">Die Zugangsprüfung hat gerade nicht geantwortet. Bitte versuchen Sie es gleich noch einmal.</p><a className="btn-primary mt-6 inline-flex" href="/admin">Erneut versuchen</a></>);}
}
