import 'server-only';
import {env} from 'cloudflare:workers';
import {loadAdminData,adminReview} from '../integrations/admin-data.mjs';
import {adminTimeline} from '../integrations/admin-timeline.mjs';
import {adminCoverage} from '../integrations/admin-coverage.mjs';
import {adminAtlas} from '../integrations/admin-atlas.mjs';
import {computeEstimate,estimateHead,storedEstimateText} from '../integrations/admin-estimate-store.mjs';
import {readStored,storedMeta} from '../integrations/admin-stored.mjs';
import {buildStatus} from '../integrations/admin-builds.mjs';
import {readDebug} from '../integrations/import-trace.mjs';
import {refreshStep,refreshStatus} from '../integrations/admin-refresh.mjs';
import {adminStand,derivedStand,storedStand,VERSIONS} from '../integrations/admin-stand.mjs';
import {storedQualityChecks} from '../integrations/quality-check.mjs';
import {fnv} from '../services/admin-etag.mjs';
import {AdminError} from '../integrations/admin-access.mjs';
import {TIMELINE_BASES} from '@/shared/timeline.mjs';
import {STATIC_VER} from '../integrations/admin-static-version.mjs';
import {staticAreas,buildAreas,areaNotes} from '../integrations/admin-areas.mjs';
import type {AdminDashboard} from '@/shared/admin-types';
// review:false leaves out the review list of page 2 (a scan of its own); its total is still reported.
export async function getAdminDashboard({review=true}:{review?:boolean}={}):Promise<AdminDashboard>{
 if(!env.DB)throw Error('Datenbank fehlt');
 return await loadAdminData(env.DB,{aiConfigured:!!env.OPENAI_API_KEY,pushConfigured:!!env.VAPID_PRIVATE_KEY&&!!env.VAPID_PUBLIC_KEY,review}) as unknown as AdminDashboard;
}
export async function getAdminReview(issue:string,region:string){if(!env.DB)throw Error('Datenbank fehlt');return adminReview(env.DB,issue,region);}
// The estimate is kept in the database and computed only on request: GET reads (estimateView), POST computes.
export async function computeAdminEstimate(){if(!env.DB)throw Error('Datenbank fehlt');return computeEstimate(env.DB);}
export async function getRunDebug(region:string){if(!env.DB)throw Error('Datenbank fehlt');return readDebug(env.DB,region);}
// Computing steps (server/integrations/admin-refresh.mjs): values per area take steps of 5 s, builds of 8 s.
export async function getRefreshStatus(){if(!env.DB)throw Error('Datenbank fehlt');return refreshStatus(env.DB);}
export async function runRefreshStep({action,target,restart}:{action:string;target:string;restart:boolean}){if(!env.DB)throw Error('Datenbank fehlt');return refreshStep(env.DB,{action,target,restart,budgetMs:target==='regions'?5000:8000});}
// Reading views with ETag and stand (rule R2/R3 of requirements/admin-performance-konzept.md): tag() reads the stand
// (a few small queries) and names the answer; build() runs only if the browser does not hold that answer already.
// Class B views derive from the values per area; class C views are stored evaluations.
// STATIC_VER: version of the deployed catalog, history, atlas and check names (admin-static-version.mjs).
const day=()=>new Date().toISOString().slice(0,10),hour=()=>new Date().toISOString().slice(0,13);
type View={tag:()=>Promise<string>;build:()=>Promise<unknown>};
function view(parts:(s:Stand)=>unknown[],build:(db:D1Database,s:Stand)=>Promise<unknown>,check?:()=>void,load?:(db:D1Database)=>Promise<void>):View{
 let stand:Stand;
 return {
  tag:async()=>{check?.();if(!env.DB)throw Error('Datenbank fehlt');stand=await adminStand(env.DB) as Stand;await load?.(env.DB);return fnv(parts(stand).map(String));},
  build:async()=>build(env.DB as D1Database,stand),
 };
}
type Stand=Awaited<ReturnType<typeof adminStand>>&Record<string,any>;
export const timelineView=(basis:string)=>view(s=>['t1',VERSIONS,basis,s.stockSum,s.seriesStamp,day()],async(db,s)=>({...await adminTimeline(db,{basis}),stand:derivedStand(s)}),()=>{if(!Object.hasOwn(TIMELINE_BASES,basis))throw new AdminError(400,'Ungültiger Zeitbezug.');});
export const coverageView=()=>view(s=>['c1',VERSIONS,s.stockSum,s.seriesStamp,s.statsStamp,STATIC_VER,day()],async(db,s)=>({...await adminCoverage(db),stand:derivedStand(s)}));
export const atlasView=()=>view(s=>['at1',VERSIONS,s.stockSum,s.statsStamp,s.content,STATIC_VER,hour()],async(db,s)=>({...await adminAtlas(db),stand:derivedStand(s,'stats')}));
// The estimate is stored (admin-stored.mjs); its tag reads the head of the stored row only, the answer passes the stored
// text on unparsed.
export const estimateView=()=>{
 let head:{computedAt:string;stockSum?:number;content:number}|null=null;
 return view(s=>['e1',head?.computedAt,head?.stockSum,s.stockSum,s.content],async(db,s)=>{const stand=storedStand(s,head);return await storedEstimateText(db,stand)??{computed:false,stand};},undefined,async db=>{head=await estimateHead(db) as typeof head;});
};
// The quality checks are stored with their time (quality-check.mjs); 24 KB, read with the tag.
export const qualityView=()=>{
 let kept:{checks:Record<string,{checkedAt?:string;stale?:boolean}>;currentRevision:number}={checks:{},currentRevision:0};
 const latest=()=>Object.values(kept.checks).map(c=>c.checkedAt||'').sort().at(-1)||null;
 return view(s=>['q1',latest(),s.stockSum,s.content,STATIC_VER],async(_db,s)=>({...kept,stand:{...storedStand(s,null),computedAt:latest(),stale:Object.values(kept.checks).some(c=>c.stale)}}),undefined,async db=>{kept=await storedQualityChecks(db) as typeof kept;});
};
// Keywords are counted by a build in steps (admin-builds.mjs, "Neu zählen") and stored; the page reads the stored text
// unparsed, with the stand (and a running build) in front.
export const keywordsView=()=>{
 let head:{computedAt:string;stockSum?:number}|null=null,build:Awaited<ReturnType<typeof buildStatus>>=null;
 return view(s=>['k1',head?.computedAt,head?.stockSum,s.stockSum,build?.state,build?.done],async(db,s)=>{
  const stand=storedStand(s,head,build),stored=await readStored(db,'keywords');
  return stored&&stored.text.length>2?'{"stand":'+JSON.stringify(stand)+',"computed":true,'+stored.text.slice(1):{computed:false,stand};
 },undefined,async db=>{[head,build]=await Promise.all([storedMeta(db,'keywords'),buildStatus(db,'keywords')]);});
};
// The list of areas in parts (admin-areas.mjs): static (cached for good under its version), areas (rows of figures) and
// summary (counts, labels, statuses, runs, job; live, small).
export const staticVersion=()=>staticAreas().v;
export const areasView=()=>view(s=>['a1',VERSIONS,s.stockSum,s.statsStamp,s.content,STATIC_VER,staticAreas().v,hour()],async(db,s)=>({...await buildAreas(db),stand:derivedStand(s,'stats')}));
export async function getAdminSummary(){
 if(!env.DB)throw Error('Datenbank fehlt');
 const [data,stand]=await Promise.all([loadAdminData(env.DB,{aiConfigured:!!env.OPENAI_API_KEY,pushConfigured:!!env.VAPID_PRIVATE_KEY&&!!env.VAPID_PUBLIC_KEY,review:false,sources:false}),adminStand(env.DB)]);
 const {sources:_sources,review:_review,...rest}=data as unknown as AdminDashboard;
 return {...rest,stand:derivedStand(stand as Stand,'stats')};
}
export async function getAreaNotes(id:string){if(!env.DB)throw Error('Datenbank fehlt');return areaNotes(env.DB,id);}
export const staticAreasText=()=>JSON.stringify(staticAreas());
