// The list of areas of the import and quality pages in three parts instead of one 6 MB answer (requirements/
// admin-performance-konzept.md, P23 and P24):
// - static: what only a deploy changes (name, number, kind, access and channel of the configured source), the same for
//   everyone, cached for good under its version (/api/admin/static?v=);
// - areas: per area the figures that change with the data, as rows of numbers in the order of the static list; the state
//   of the source (health) is computed here, with the time of the request, exactly as loadAdminData does;
// - area: the notes of one area (issues, warnings, address of the source), read when somebody opens them.
import {CATALOG as regions} from '../../shared/catalog.mjs';
import {sourceHealth} from '../../shared/admin.mjs';
import {regionFigures,accessFields,configuredById} from './admin-data.mjs';
import {fnv} from '../services/admin-etag.mjs';
/** Columns of a row of `areas`, in this order. */
export const AREA_FIELDS=['cnt','fe','le','pa','rules','sum','ail','kw','ins','stl','bs','ba','bk','fat','pat','m','as','ls','la','cp','nr','ni','nw','st','fl'];
let kept;
/** {v,areas}: one entry per area of the catalog, in catalog order. Built once per isolate. */
export function staticAreas(){
 if(kept)return kept;
 const areas=regions.map(r=>{const config=configuredById.get(r.id);return {id:r.id,name:r.name,ags:r.ags,land:r.ags.slice(0,2),kind:r.kind,canImport:!!config&&config.method!=='pending',cm:config?.method||'pending',su:config?.system||config?.base||null,...accessFields(r.id,config)};});
 const text=JSON.stringify(areas);
 kept={v:fnv([String(text.length),fnv([text])]),areas};
 return kept;
}
/** Row values of the coverage notes of every area: only the fields the list needs, never the notes themselves. */
async function coverageRows(db){
 return (await db.prepare("SELECT region_id,json_extract(payload,'$.method') method,json_extract(payload,'$.attemptStatus') attemptStatus,json_extract(payload,'$.lastSuccessAt') lastSuccessAt,json_extract(payload,'$.importedAt') importedAt,json_extract(payload,'$.lastAttemptAt') lastAttemptAt,json_extract(payload,'$.complete') complete,json_extract(payload,'$.nextRetryAt') nextRetryAt,coalesce(json_array_length(payload,'$.issues'),0) ni,coalesce(json_array_length(payload,'$.warnings'),0) nw FROM source_coverage").all()).results;
}
/**
 * {asOf,staticVersion,fields,rows,pending}: rows[i] belongs to staticAreas().areas[i]. pending: areas whose figures are
 * still being computed (the rows carry their previous figures).
 * @param {any} db
 * @param {{now?:Date}} [options]
 */
export async function buildAreas(db,{now=new Date()}={}){
 const {v,areas}=staticAreas();
 const [figures,coverage]=await Promise.all([regionFigures(db,{now}),coverageRows(db)]);
 const byFigure=new Map((figures?.rows||[]).map(r=>[r.region_id,r])),byCoverage=new Map(coverage.map(r=>[r.region_id,r]));
 const rows=areas.map(a=>{
  const f=byFigure.get(a.id),c=byCoverage.get(a.id),count=Number(f?.count||0);
  const m=c?.method||a.cm||'pending';
  const complete=!!c?.complete;
  const health=sourceHealth({method:m,complete,attemptStatus:c?.attemptStatus||undefined,lastSuccessAt:c?.lastSuccessAt||undefined,importedAt:c?.importedAt||undefined},count,now);
  const attempt=c?.lastAttemptAt||c?.importedAt||null;
  // firstEvent/lastEvent are given only for areas with reports, as in loadAdminData
  return [count,f?.firstEvent||null,f?.lastEvent||null,Number(f?.pendingAnalysis||0),
   count?count-Number(f.pendingAnalysis||0):0,count?f.summary:0,count?f.aiLabel:0,count?f.keywords:0,count?f.insufficient:0,count?f.stale:0,count?f.blocked_summary:0,count?f.blocked_aiLabel:0,count?f.blocked_keywords:0,
   count?f.fetchedAt??null:null,count?f.processedAt??null:null,
   m,c?.attemptStatus||null,health.lastSuccessAt,attempt,complete?1:0,c?.nextRetryAt||null,Number(c?.ni||0),Number(c?.nw||0),health.state,
   (health.stale?1:0)|(health.partial?2:0)|(health.attention?4:0)|(health.configured?8:0)].map(x=>x===undefined?null:x);
 });
 return {asOf:now.toISOString(),staticVersion:v,fields:AREA_FIELDS,rows,...(figures?.pending?{pending:figures.pending}:{})};
}
/** The notes of one area: {id,issues,warnings,sourceUrl}. */
export async function areaNotes(db,id){
 const row=await db.prepare('SELECT payload FROM source_coverage WHERE region_id=?').bind(id).first();
 let c={};try{c=row?JSON.parse(row.payload):{};}catch{}
 const config=configuredById.get(id);
 return {id,issues:Array.isArray(c.issues)?c.issues.map(String):[],warnings:Array.isArray(c.warnings)?c.warnings.map(String):[],sourceUrl:c.sourceUrl||config?.system||config?.base||null};
}
