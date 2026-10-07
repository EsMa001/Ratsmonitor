import {env} from 'cloudflare:workers';
import {getRegionCoverage} from '@/server/repositories/regions';
import {atRevision} from '@/server/integrations/revision-cache.mjs';
import {REGIONS} from '@/shared/regions';
import {POPULATION} from '@/shared/catalog.mjs';
import {ALL_LANDS} from '@/shared/lands.mjs';

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
 /* Reichweite: Gemeinden (Samtgemeinden zählen mit ihren Mitgliedern) und Einwohner, die mindestens einen Eintrag haben, gesamt und je Land */
 const withData=new Set(sources.filter(s=>s.articles>0).map(s=>s.id));
 const lands=new Map<string,{id:string;name:string;total:number;covered:number;population:number;populationCovered:number}>();
 let total=0,covered=0,pop=0,popCovered=0,districts=0,districtsCovered=0;
 for(const r of REGIONS){
  if(r.kind==='district'){districts++;if(withData.has(r.id))districtsCovered++;continue;}
  const m=r.members?.length||1,p=(POPULATION as Record<string,number>)[r.id]||0,ok=withData.has(r.id),id=r.ags.slice(0,2);
  total+=m;pop+=p;if(ok){covered+=m;popCovered+=p;}
  const l=lands.get(id)||{id,name:ALL_LANDS.find((x:{id:string})=>x.id===id)?.name||id,total:0,covered:0,population:0,populationCovered:0};
  l.total+=m;l.population+=p;if(ok){l.covered+=m;l.populationCovered+=p;}
  lands.set(id,l);
 }
 const reach={municipalities:{total,covered},population:{total:pop,covered:popCovered},districts:{total:districts,covered:districtsCovered},lands:[...lands.values()].filter(l=>l.total>0).sort((a,b)=>b.population-a.population)};
 return {totals:{areas:coverage.length,connected:sources.length,withArticles:sources.filter(s=>s.articles>0).length,articles:sources.reduce((n,s)=>n+s.articles,0),latest},reach,sources};
}

/** Öffentliche Übersicht für „Quellen & Abdeckung“: nur angebundene Gebiete, kompakt, ohne Rohdaten */
export async function GET(){
 try{
  // Ändert sich nur mit Importen: gehalten, solange der Datenstand gleich bleibt, und im Browser kurz wiederverwendbar.
  const summary=env.DB?await atRevision(env.DB,'sources',sourcesSummary):await sourcesSummary();
  return Response.json(summary,{headers:{'Cache-Control':'public, max-age=300, stale-while-revalidate=3600'}});
 }catch{return Response.json({error:'Der Quellenstand ist gerade nicht erreichbar.'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
