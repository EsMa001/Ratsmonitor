import {env} from 'cloudflare:workers';
import {getRegionCoverage} from '@/server/repositories/regions';
import {atRevision} from '@/server/integrations/revision-cache.mjs';
import {REGIONS} from '@/shared/regions';

const METHOD:Record<string,string>={oparl:'OParl-Schnittstelle','official-api':'Offizielle Portalschnittstelle',scraper:'Öffentliche RIS-Seiten'};

async function sourcesSummary(){
 const coverage:any[]=await getRegionCoverage();
 const byId=new Map(REGIONS.map(r=>[r.id,r]));
 const connected=coverage.filter(c=>c.method&&c.method!=='pending');
 const sources=connected.map(c=>{const r=byId.get(c.regionId);return {
  id:c.regionId,name:r?.name??c.regionId,kind:r?.kind??'city',method:METHOD[c.method]??'Öffentliche RIS-Seiten',
  lastImport:c.lastSuccessAt||c.importedAt||null,articles:Math.max(0,Number(c.articleCount)||0),meetings:Number(c.meetings)||0,
  from:c.from||null,complete:!!c.complete,failed:c.attemptStatus==='failed',
 };}).sort((a,b)=>b.articles-a.articles||a.name.localeCompare(b.name,'de'));
 const latest=sources.map(s=>s.lastImport).filter(Boolean).sort().at(-1)??null;
 return {totals:{areas:coverage.length,connected:sources.length,withArticles:sources.filter(s=>s.articles>0).length,articles:sources.reduce((n,s)=>n+s.articles,0),latest},sources};
}

/** Öffentliche Übersicht für „Quellen & Abdeckung“: nur angebundene Gebiete, kompakt, ohne Rohdaten */
export async function GET(){
 try{
  // Ändert sich nur mit Importen: gehalten, solange der Datenstand gleich bleibt, und im Browser kurz wiederverwendbar.
  const summary=env.DB?await atRevision(env.DB,'sources',sourcesSummary):await sourcesSummary();
  return Response.json(summary,{headers:{'Cache-Control':'public, max-age=300, stale-while-revalidate=3600'}});
 }catch{return Response.json({error:'Der Quellenstand ist gerade nicht erreichbar.'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
