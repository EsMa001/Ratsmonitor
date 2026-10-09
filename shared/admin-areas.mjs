// Puts the list of areas of the import and quality pages together again from its parts (server/integrations/admin-areas.mjs):
// the static list of areas and the rows of figures. The result has the form of `sources` of the former overview, except that
// the notes (issues, warnings) are not in it: issueCount and warningCount say how many there are, and the page reads them
// when somebody opens an area.
const ZERO={total:0,rules:0,summary:0,aiLabel:0,keywords:0,insufficient:0,stale:0,blocked_summary:0,blocked_aiLabel:0,blocked_keywords:0,fetchedAt:null,processedAt:null};
/**
 * @param {{areas:any[]}} staticData
 * @param {{fields:string[],rows:any[][]}} areasData
 */
export function toSources(staticData,areasData){
 const at=Object.fromEntries(areasData.fields.map((f,i)=>[f,i]));
 return staticData.areas.map((a,i)=>{
  const row=areasData.rows[i]||[],get=f=>row[at[f]];
  const count=Number(get('cnt')||0),flags=Number(get('fl')||0);
  const processing=count?{region_id:a.id,total:count,rules:get('rules'),summary:get('sum'),aiLabel:get('ail'),keywords:get('kw'),insufficient:get('ins'),stale:get('stl'),blocked_summary:get('bs'),blocked_aiLabel:get('ba'),blocked_keywords:get('bk'),fetchedAt:get('fat'),processedAt:get('pat')}:{...ZERO};
  return {id:a.id,name:a.name,ags:a.ags,land:a.land,kind:a.kind,count,firstEventAt:get('fe'),lastEventAt:get('le'),pendingAnalysis:Number(get('pa')||0),method:get('m')||'pending',attemptStatus:get('as'),processing,
   configured:!!(flags&8),stale:!!(flags&1),partial:!!(flags&2),attention:!!(flags&4),lastSuccessAt:get('ls'),state:get('st'),canImport:a.canImport,access:a.access,accessLabel:a.accessLabel,channel:a.channel,complete:!!get('cp'),lastAttemptAt:get('la'),nextRetryAt:get('nr'),
   sourceUrl:a.su,issues:[],warnings:[],issueCount:Number(get('ni')||0),warningCount:Number(get('nw')||0)};
 });
}
