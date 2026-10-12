import {LABELS} from '../../shared/labels.mjs';
import {POPULATION} from '../../shared/catalog.mjs';
import {ALL_LANDS} from '../../shared/lands.mjs';
import {parseMonitorSearch,searchFilters} from './monitor-search.mjs';
import {AnalyticsError} from './analytics-diffusion.mjs';
import {tokens} from './analytics-graph.mjs';
import {routineTitle,titleKey} from '../../shared/topic-facts.mjs';
import {listPage,sqlList,offsetOf} from './analytics-lists.mjs';

/*
 * Plenara.X – Ortsvergleich: Zwei bis vier Orte nebeneinander, gemessen an allen Gebieten als Vergleichsbasis.
 * Je Ort gelten dieselben Filter wie in der Suche (Begriff, Zeitraum, Thema, Status ...). Zahlen je Ort: Einträge (genau, auch je
 * 1.000 Einwohner), Verlauf je Monat (genau); Themenprofil, Stand der Vorlagen, Gremien und typische Begriffe aus einer gleichmäßigen
 * Stichprobe von höchstens CAP Einträgen. „Typisch“ heißt: im Ort deutlich häufiger als in allen Gebieten (Zwei-Stichproben-z-Test).
 * Gezählt werden Vorgänge: derselbe Titel je Gebiet (mehrere Gremien) einmal, ohne einzeln geführte Einwohnerfragen („… - Herr X“);
 * Profile und Begriffe zusätzlich ohne Routinepunkte (Besetzungen, Wahlen, Fragestunden). Ein Ort zählt nur seinen eigenen Rat
 * (die Seite fragt mit scope=only), sonst stiegen die Werte je Einwohner kleiner Orte mit den Vorgängen ihres Kreises.
 */
const CAP=6000,BASE_CAP=12000,MIN=4,Z_MIN=3,RATIO=1.8,TERMS=12,COMMON=10,COMMITTEES=6;
const STATUSES=['announced','consulting','recommended','approved','rejected','postponed','info','unknown'];
const norm=t=>t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replaceAll('ß','ss');
const nameWords=names=>new Set(names.flatMap(n=>String(n).split(/[^A-Za-zÀ-ÿ]+/)).filter(w=>w.length>=3).map(norm));
const PLACEHOLDER=/^gremium laut originalquelle$/i;
const gremiumKey=g=>String(g||'').replace(/\s+/g,' ').trim();

export function parseCompare(params){
 const copy=new URLSearchParams(params);for(const k of ['by','value','offset','place'])copy.delete(k);
 if(!copy.has('to'))copy.set('to',new Date().toISOString().slice(0,10));
 let f;
 try{f=parseMonitorSearch(copy);}catch(e){throw new AnalyticsError(e.message,e.status||400);}
 if(f.groups.flat().some(w=>w.length<3))throw new AnalyticsError('Jedes Suchwort braucht mindestens 3 Buchstaben.');
 const seen=new Set(),places=[];
 for(const p of [{ags:f.area,scope:f.scope},...f.more])if(p.ags){const k=p.ags+':'+p.scope;if(!seen.has(k)){seen.add(k);places.push(p);}}
 if(places.length<2||places.length>4)throw new AnalyticsError('Bitte zwei bis vier Orte wählen.');
 return {f,places};
}

const PERSONAL_Q="title NOT LIKE '% - Herr %' AND title NOT LIKE '% - Frau %' AND title NOT LIKE '% - Herr' AND title NOT LIKE '% - Frau'";
const sample=async(db,where,args,cap)=>{
 const range=" AND date<>'' AND "+PERSONAL_Q;
 // Ein Durchlauf über die Karten (bei einem Suchbegriff über alle Karten teuer): Treffer einmal zwischenspeichern, daraus
 // Zahl und Stichprobe (jede k-te Karte, k aus der Zahl); früher zwei Abfragen mit je einem Durchlauf
 const {results}=await db.prepare(`WITH m AS MATERIALIZED (SELECT rowid id,date,region_id,label,status,gremium,title FROM search_cards WHERE ${where}${range}),
  t AS (SELECT count(DISTINCT region_id||'|'||lower(title)) total FROM m)
  SELECT t.total,m.region_id,m.label,m.status,m.gremium,m.title FROM t LEFT JOIN m ON m.id % max(1,(t.total+?-1)/?) = 0 ORDER BY m.date,m.id`).bind(...args,cap,cap).all();
 const total=results[0]?.total||0,k=Math.max(1,Math.ceil(total/cap));
 if(results.length===1&&results[0].title==null)results.length=0;
 const seen=new Set(),rows=results.filter(r=>{if(routineTitle(r.title))return false;const key=r.region_id+'|'+titleKey(r.title);if(seen.has(key))return false;seen.add(key);return true;});
 // Gremien: Titel je Gremium einmal (ein Titel aus Ausschuss und Rat zählt bei beiden), wie die Liste dahinter
 const byGremium=new Map();for(const r of results){if(routineTitle(r.title))continue;const g=gremiumKey(r.gremium);if(!byGremium.has(g))byGremium.set(g,new Set());byGremium.get(g).add(r.region_id+'|'+titleKey(r.title));}
 return {total,rows,capped:k>1,byGremium};
};
const shares=(rows,pick,keys)=>{const m=new Map();let n=0;for(const r of rows){const v=pick(r);if(v!==null&&v!==undefined){m.set(v,(m.get(v)||0)+1);n++;}}return {n,list:keys.map(k=>({id:k,n:m.get(k)||0,share:n?Math.round(((m.get(k)||0)/n)*10000)/100:0}))};};
const termStats=(rows,exclude)=>{
 const df=new Map(),shown=new Map();
 for(const r of rows)for(const [k,w] of tokens(r.title)){if(exclude.has(k))continue;df.set(k,(df.get(k)||0)+1);if(!shown.has(k))shown.set(k,w);}
 return {df,shown,n:rows.length};
};
/* Die Vergleichsbasis (alle Gebiete) hängt nur von den Filtern ab, nicht von den Orten: kurz im Speicher halten (5 Minuten, höchstens 20) */
const baseCaches=new WeakMap();
const cachedBase=async(db,where,args)=>{
 const baseCache=baseCaches.get(db)||baseCaches.set(db,new Map()).get(db);
 const key=where+'|'+JSON.stringify(args),hit=baseCache.get(key);
 if(hit&&Date.now()-hit.at<300000)return hit.value;
 const value=await sample(db,where,args,BASE_CAP);
 baseCache.set(key,{at:Date.now(),value});
 if(baseCache.size>20)baseCache.delete(baseCache.keys().next().value);
 return value;
};
const REAL=LABELS.filter(l=>l.id!=='unklar').map(l=>l.id);

export async function compare(db,catalog,params){
 const {f,places}=parseCompare(params);
 const exclude=new Set(f.groups.flat());
 /* Vergleichsbasis: alle Gebiete (Gemeindeebene) mit denselben übrigen Filtern */
 /* part:'facets': Begriffe bis FTS_FACETS_MAX Treffer über den Volltextindex statt über den Suchtext jeder Karte (Ergebnis gleich) */
 const {page:basePage}=await searchFilters(db,catalog,{...f,part:'facets',area:'',more:[],scope:'with',within:null,without:null});
 const base=await cachedBase(db,basePage.where,basePage.args);
 const bt=termStats(base.rows,exclude);
 const baseTopics=shares(base.rows,r=>REAL.includes(r.label)?r.label:null,REAL),baseStatus=shares(base.rows,r=>r.status,STATUSES);
 const out=[];
 for(const p of places){
  const {page,scopedIds,byId}=await searchFilters(db,catalog,{...f,part:'facets',area:p.ags,scope:p.scope,more:[],within:null,without:null});
  const s=await sample(db,page.where,page.args,CAP);
  const {results:monthRows}=await db.prepare("SELECT substr(date,1,7) m,count(DISTINCT region_id||'|'||lower(title)) n FROM search_cards WHERE "+page.where+" AND date<>'' AND "+PERSONAL_Q+" GROUP BY m ORDER BY m").bind(...page.args).all();
  const regions=[...scopedIds].map(id=>byId.get(id)).filter(Boolean);
  const cities=regions.filter(r=>r.kind==='city');
  const pop=(cities.length?cities:regions).reduce((sum,r)=>sum+(POPULATION[r.id]||0),0)||null;
  /* Der Ortsname selbst (und sein Land) ist nie „typisch“ */
  const own=nameWords([...regions.map(r=>r.name),...regions.flatMap(r=>(r.members||[]).map(m=>m.name)),ALL_LANDS.find(l=>l.id===p.ags.slice(0,2))?.name||'']);
  const ts=termStats(s.rows,new Set([...exclude,...own]));
  /* Typische Begriffe: im Ort deutlich häufiger als überall (z-Test für Anteile) */
  const typical=[];
  for(const [k,n] of ts.df){
   if(n<MIN)continue;
   const pp=n/Math.max(1,ts.n),pb=(bt.df.get(k)||0)/Math.max(1,bt.n),pool=(n+(bt.df.get(k)||0))/Math.max(1,ts.n+bt.n);
   const se=Math.sqrt(pool*(1-pool)*(1/Math.max(1,ts.n)+1/Math.max(1,bt.n)))||1e-9,z=(pp-pb)/se,ratio=(pp+0.5/ts.n)/(pb+0.5/bt.n);
   if(z>=Z_MIN&&ratio>=RATIO)typical.push({term:ts.shown.get(k),key:k,n,share:Math.round(pp*10000)/100,base:Math.round(pb*10000)/100,ratio:Math.round(ratio*10)/10,z:Math.round(z*10)/10});
  }
  typical.sort((a,b)=>b.z-a.z);
  const committees=new Map();for(const [g,set] of s.byGremium)if(g.length>=4&&!PLACEHOLDER.test(g))committees.set(g,set.size);
  out.push({
   ags:p.ags,scope:p.scope,population:pop,total:s.total,sampled:s.rows.length,capped:s.capped,
   perThousand:pop?Math.round((s.total/pop)*10000)/10:null,
   topics:shares(s.rows,r=>REAL.includes(r.label)?r.label:null,REAL),status:shares(s.rows,r=>r.status,STATUSES),
   committees:[...committees].sort((a,b)=>b[1]-a[1]).slice(0,COMMITTEES).map(([name,n])=>({name,n})),
   months:monthRows.map(r=>({m:r.m,n:r.n})),
   typical:typical.slice(0,TERMS).map(({key,...rest})=>rest),
   df:ts,
  });
 }
 /* Gemeinsame Begriffe: in jedem Ort vorhanden, nach dem kleinsten Anteil geordnet */
 const common=[];
 for(const [k,n0] of out[0].df.df){
  if(n0<3)continue;
  const per=out.map(o=>o.df.df.get(k)||0);
  if(per.some(n=>n<3))continue;
  common.push({term:out[0].df.shown.get(k),shares:out.map((o,i)=>Math.round((per[i]/Math.max(1,o.df.n))*10000)/100),min:Math.min(...out.map((o,i)=>per[i]/Math.max(1,o.df.n)))});
 }
 common.sort((a,b)=>b.min-a.min);
 for(const o of out)delete o.df;
 const months=[...new Set(out.flatMap(o=>o.months.map(m=>m.m)))].sort();
 return {
  q:f.q,places:out,months,
  common:common.slice(0,COMMON).map(({min,...rest})=>rest),
  base:{total:base.total,sampled:base.rows.length,topics:baseTopics,status:baseStatus},
 };
}

/** Liste hinter einer Zahl eines Orts (place=Schlüssel): by=all (alle Vorgänge), label (Themenfeld), committee (Gremium) oder
    term (Begriff aus den Titeln). Zählt wie die Seite: gleiche Titel je Gebiet einmal, ohne „… - Herr X“; Profile, Gremien und
    Begriffe der Seite stammen bei großen Orten aus einer Stichprobe, die Liste zeigt alle Vorgänge. */
export async function compareList(db,catalog,params){
 const by=params.get('by'),value=params.get('value')||'',ags=params.get('place')||'';
 if(!['all','label','committee','term'].includes(by)||by!=='all'&&!value)throw new AnalyticsError('Unbekannte Liste.',400);
 const {f,places}=parseCompare(params);
 const p=places.find(x=>x.ags===ags);if(!p)throw new AnalyticsError('Unbekannter Ort.',400);
 const {page}=await searchFilters(db,catalog,{...f,area:p.ags,scope:p.scope,more:[],within:null,without:null});
 const base=`${page.where} AND date<>'' AND ${PERSONAL_Q}`,offset=offsetOf(params);
 if(by==='all')return sqlList(db,catalog,base,page.args,offset);
 if(by==='label')return sqlList(db,catalog,`${base} AND label=?`,[...page.args,value],offset);
 const {results}=await db.prepare(`SELECT id,region_id region,title,gremium,date,status FROM search_cards WHERE ${base}${by==='term'?' AND search LIKE ?':''}`).bind(...page.args,...(by==='term'?['%'+norm(value)+'%']:[])).all();
 const key=norm(value);
 const rows=results.filter(r=>!routineTitle(r.title)&&(by==='committee'?gremiumKey(r.gremium)===value:tokens(r.title).has(key)));
 return listPage(rows,catalog,offset);
}
