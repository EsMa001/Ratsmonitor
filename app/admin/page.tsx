import {env} from 'cloudflare:workers';
// Stile nur der Administration (nicht im öffentlichen CSS); nach globals.css geladen wie zuvor.
import '../admin.css';
import {chatGPTSignInPath,chatGPTSignOutPath,chatGPTSignInAvailable} from '@/app/chatgpt-auth';
import {adminState} from '@/server/services/session';
import {AdminTotp,AdminTotpSetup} from '@/components/admin-totp';
import {accountsConfig} from '@/server/accounts/config.mjs';
import {AdminActivation} from '@/components/admin-activation';
import {AdminFrame,type AdminPage} from '@/components/admin-chrome';
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
import {AdminDebug} from '@/components/admin-debug';
import {AdminAltbestand} from '@/components/admin-altbestand';
import {AdminCockpit} from '@/components/admin-cockpit';
import {AdminFehler} from '@/components/admin-fehler';
import {validRegion,REGIONS} from '@/shared/regions';
export const dynamic='force-dynamic';
export const metadata={title:'Administration · '+BRAND_NAME[DEFAULT_BRAND],robots:{index:false,follow:false}};
// Pages by name; earlier names and the numbers of the first version still lead to their page (uebersicht is now
// "Abdeckung", qualitaet the "Prüfliste", debug "Letzte Nacht"). "auswahl" (areas handed over by the estimate) and
// "filter" (a list filter) open the import page. Without a page: the cockpit. 'start' stands here as text: values from
// admin-chrome.tsx ('use client') arrive in a server component only as client references, not as strings.
const PAGES:Record<string,AdminPage>={start:'start',cockpit:'start',abdeckung:'abdeckung',uebersicht:'abdeckung',atlas:'atlas',nacht:'nacht',debug:'nacht',abruf:'abruf',pdf:'pdf','pdf-import':'pdf',verarbeitung:'verarbeitung',altbestand:'altbestand',regeltexte:'regeltexte',pruefliste:'pruefliste',qualitaet:'pruefliste',bestand:'bestand',zeitplaene:'zeitplaene',jobs:'zeitplaene',fehler:'fehler',speicher:'speicher',todo:'todo',hochrechnung:'hochrechnung',social:'social','1':'abruf','2':'pruefliste','3':'hochrechnung'};
const FILTERS=['all','connected','data','empty','issues','partial','stale','failed','shallow','quiet','selected'];
export default async function AdminPage({searchParams}:{searchParams:Promise<{seite?:string;auswahl?:string;filter?:string}>}){const {seite,auswahl,filter}=await searchParams;
 // "auswahl" preselects areas on the import page; only known area ids are accepted.
 const selection=[...new Set(String(auswahl||'').split(',').filter(id=>id&&validRegion(id)))].slice(0,REGIONS.length);
 const page:AdminPage=PAGES[String(seite||'')]||(selection.length||filter?'abruf':'start');
 return <AdminContent page={page} mobile={String(seite||'')==='mobil'} selection={selection} filter={FILTERS.includes(String(filter))?String(filter):undefined}/>;}
async function AdminContent({page,mobile,selection,filter}:{page:AdminPage;mobile:boolean;selection:string[];filter?:string}){
 // Melde-, Einrichtungs- und Fehlerzustände im Rahmen ohne Reiter.
 const gate=(children:React.ReactNode)=><AdminFrame tabs={false}><div className="mx-auto max-w-[640px] py-16">{children}</div></AdminFrame>;
 const title=(text:string)=><h1 className="text-[28px] font-semibold leading-tight">{text}</h1>;
 const text=(children:React.ReactNode)=><p className="mt-3 text-[16px] text-slate-500">{children}</p>;
 const signInLink=<a className="btn-primary mt-6 inline-flex" href="/anmelden?weiter=/admin">Anmelden</a>;
 // Admin ist eine Rolle am Konto und gilt nur über den Tunnel (requirements/konten-konzept.md, 6.1). Auf Cloudflare
 // und im Übergang führt ein Knopf zur ChatGPT-Anmeldung (ADMIN_LEGACY_HEADER=1).
 const signIn=chatGPTSignInAvailable()&&accountsConfig(env).legacyHeader;
 let state;
 try{state=await adminState();}
 catch{state={kind:'unavailable'} as const;}
 if(state.kind==='unavailable')return gate(<>{title('Administration nicht erreichbar')}<p role="alert" className="mt-3 text-[16px] text-slate-500">Die Zugangsprüfung hat gerade nicht geantwortet. Bitte versuchen Sie es gleich noch einmal.</p><a className="btn-primary mt-6 inline-flex" href="/admin">Erneut versuchen</a></>);
 if(state.kind==='anonymous')return gate(<>{title('Geschützter Bereich')}{signIn?<>{text('Melden Sie sich mit ChatGPT an, um die Administration zu öffnen.')}<a target="_top" href={chatGPTSignInPath('/admin')} className="btn-primary mt-6 inline-flex">Mit ChatGPT anmelden</a></>:<>{text('Die Administration öffnet sich nach der Anmeldung mit einem Admin-Konto, nur über den Zugang auf dem Server selbst (Tunnel, http://127.0.0.1:8080). Im Tunnel mit dem Code aus der E-Mail anmelden; der Link darin führt zur öffentlichen Adresse.')}{signInLink}</>}</>);
 if(state.kind==='stale')return gate(<>{title('Bitte neu anmelden')}{text('Die Anmeldung für die Administration ist älter als sieben Tage.')}{signInLink}</>);
 // Öffentliche Adresse: zweiter Faktor (Code aus der Authenticator-App, gilt 12 Stunden auf diesem Gerät)
 if(state.kind==='totp')return gate(<>{title('Zweiter Faktor')}{text(<>Angemeldet als <strong>{state.user?.displayName}</strong>. Bitte den Code aus der Authenticator-App eingeben. Er gilt 12 Stunden auf diesem Gerät.</>)}<AdminTotp/></>);
 if(state.kind==='totp-setup')return gate(<>{title('Zweiten Faktor einrichten')}{text(<>Angemeldet als <strong>{state.user?.displayName}</strong>. Über die öffentliche Adresse geht die Administration nur mit einem Code aus einer Authenticator-App. Bitte einmal über den Zugang auf dem Server einrichten (Tunnel, http://127.0.0.1:8080/admin), oder der Betreiber richtet ihn per Kommandozeile ein.</>)}</>);
 if(state.kind==='setup')return gate(<>{title('Admin-Zugang einrichten')}{text(<>Angemeldet als <strong>{state.user?.displayName}</strong>. Der einmalige Freischaltcode verknüpft die Administration dauerhaft mit diesem Konto.</>)}{env.ADMIN_SETUP_HASH?<AdminActivation/>:<p role="status" className="mt-4 text-[14px] text-slate-500">Die Freischaltung ist noch nicht eingerichtet: Der Betreiber muss den Hash des Freischaltcodes als ADMIN_SETUP_HASH hinterlegen.</p>}</>);
 if(state.kind!=='admin'||!state.user)return gate(<>{title('Kein Admin-Zugriff')}{text('Dieses Konto ist nicht für die Administration freigeschaltet.')}{signIn&&state.legacy&&<a className="mt-6 inline-flex text-[14px] text-teal-600" target="_top" href={chatGPTSignOutPath('/admin')}>Konto wechseln →</a>}</>);
 const user=state.user;
 try{
  // Abmelden: mit ChatGPT-Anmeldung über deren Weg, sonst über das Konto (POST /api/auth/logout)
  const signOutPath=state.legacy&&chatGPTSignInAvailable()?chatGPTSignOutPath('/'):undefined;
  const accountSignOut=!state.legacy;
  // Im Tunnel ohne zweiten Faktor: Einrichtung oben anbieten (danach geht die Administration auch über die öffentliche Adresse)
  const setupBanner=!state.legacy&&state.adminHost&&!state.totpConfirmed?<AdminTotpSetup/>:null;
  const frame=(content:React.ReactNode)=><AdminFrame page={page} displayName={user.displayName} signOutPath={signOutPath} accountSignOut={accountSignOut}>{setupBanner}{content}</AdminFrame>;
  // Abgespeckter Bereich fürs Handy (?seite=mobil): ohne Reiter, nur die Abdeckung des Lückenatlas.
  if(mobile)return <AdminFrame tabs={false} displayName={user.displayName} signOutPath={signOutPath} accountSignOut={accountSignOut}><AdminMobile/></AdminFrame>;
  if(page==='todo')return frame(<AdminTodo/>);
  if(page==='regeltexte')return frame(<AdminRuleTexts/>);
  if(page==='social')return frame(<AdminSocial/>);
  if(page==='pdf')return frame(<AdminPdf/>);
  if(page==='speicher')return frame(<AdminStorage/>);
  if(page==='zeitplaene')return frame(<AdminSchedules/>);
  if(page==='nacht')return frame(<AdminDebug/>);
  if(page==='fehler')return frame(<AdminFehler/>);
  if(page==='altbestand')return frame(<AdminAltbestand/>);
  if(page==='hochrechnung')return frame(<AdminForecast/>);
  if(page==='atlas')return frame(<AdminAtlas/>);
  if(page==='abdeckung')return frame(<AdminOverview/>);
  if(page==='start')return frame(<AdminCockpit/>);
  // Pages on the dashboard (Abruf, Verarbeitung, Prüfliste, Bestandsprüfung): the browser puts it together
  // from three parts, see components/admin-loader.tsx.
  return frame(<AdminLoader page={page} staticVersion={staticVersion()} initialSelection={selection} initialFilter={filter}/>);
 }catch{return gate(<>{title('Administration nicht erreichbar')}<p role="alert" className="mt-3 text-[16px] text-slate-500">Die Zugangsprüfung hat gerade nicht geantwortet. Bitte versuchen Sie es gleich noch einmal.</p><a className="btn-primary mt-6 inline-flex" href="/admin">Erneut versuchen</a></>);}
}
