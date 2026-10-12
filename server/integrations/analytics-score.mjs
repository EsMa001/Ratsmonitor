import {atRevision} from './revision-cache.mjs';
import {base,mapGroups,mapKeysOf,mapOk,quantile,radarMap,windowOf,NORM_RULE} from './analytics-radar-norms.mjs';
import {AnalyticsError} from './analytics-diffusion.mjs';

/*
 * plenara.X Score (docs/produkt/plenara-score-konzept.md, Stand 11.10.2026): je Gemeinde und je Kreis eine ganze Zahl von 0 bis
 * 100, nur aus den Ratsunterlagen des eigenen Rats (Kreise: Kreistag und Ausschüsse). 50 heißt „wie üblich bei vergleichbaren
 * Gebieten“; der Score ordnet ein, er bewertet keine Politik.
 *   Themen (85 %): je Thema der Rang des Gebiets in seiner Vergleichsgruppe nach dem Anteil des Themas an allen Sachvorgängen
 *     der letzten 12 Monate (dieselbe Rechnung wie die Karten der Radare, radarMap). Mittel der gültigen Themen.
 *   Arbeitsweise (15 %): Rang nach dem Anteil vertagter Vorgänge an allen mit Entscheidung (beschlossen, abgelehnt, vertagt);
 *     weniger Vertagungen = höherer Wert. Erst ab MIN_DECIDED Vorgängen mit Entscheidung.
 *   Bonus: +OPARL_BONUS, wenn das Gebiet über eine OParl-Schnittstelle gelesen wird, höchstens 100.
 * Zu wenig Daten: Gebiet unter den Mindestmengen der Radare (kein Score), weniger als die Hälfte der genutzten Themen gültig (kein Score),
 * Arbeitsweise ungültig (Score nur aus den Themen, so ausgewiesen). Ein Thema fällt heraus, wenn dort zu wenige Vorgänge zu
 * erwarten sind oder das Thema bundesweit zu selten für einen Vergleich ist.
 * Karte: vier Stufen nach dem Rang des Scores unter allen Gebieten der Ebene (Viertel); Mittelwerte mehrerer Ränge liegen eng um 50,
 * feste Grenzen (25/50/75) hätten fast nur zwei Farben ergeben. Die Spannen der Viertel stehen in bands.
 */
export const SCORE_THEMES=[
 ['versorgung','radar:versorgung','Versorgung und Infrastruktur'],
 ['verkehr','radar:verkehr','Verkehr und Mobilität'],
 ['klima','radar:klima','Klima und Energie'],
 ['bauleitplanung','plan','Bauen und Entwicklung'],
 ['soziales','radar:soziales','Soziales, Jugend, Vereine'],
 ['kita','kita_fee','Kinder und Familie'],
 ['foerderung','funding','Fördermittel'],
 ['beteiligung','radar:beteiligung','Beteiligung'],
];
export const SCORE_RULE={themeWeight:0.85,workWeight:0.15,oparlBonus:2,minDecided:50};
const {themeWeight,workWeight,oparlBonus:OPARL_BONUS,minDecided:MIN_DECIDED}=SCORE_RULE;
/* Neue Rechnung höchstens so lange im Hintergrund, bis dahin gilt der letzte Stand (die erste Rechnung nach einem Import dauert) */
const STALE_MS=6*3600e3;

/* Vorgänge mit Entscheidung und davon vertagte je Gebiet (gleiche Titel einmal) */
async function decided(db,w){
 return atRevision(db,`score-decided|${w.from}|${w.to}`,async()=>{
  const {results}=await db.prepare(`SELECT region_id r,count(DISTINCT lower(title)) n,count(DISTINCT CASE WHEN status='postponed' THEN lower(title) END) k FROM search_cards WHERE date>=? AND date<=? AND status IN ('approved','rejected','postponed') GROUP BY region_id`).bind(w.from,w.to).all();
  return new Map(results.map(x=>[x.r,{n:x.n,k:x.k}]));
 });
}
/* Gebiete, die über OParl gelesen werden (Quellenstand des letzten Imports) */
async function oparlRegions(db){
 const {results}=await db.prepare(`SELECT region_id r FROM source_coverage WHERE json_extract(payload,'$.method')='oparl'`).all().catch(()=>({results:[]}));
 return new Set(results.map(x=>x.r));
}
/** Rang (0–1) eines Werts in einer Liste, gleiche Werte zur Hälfte */
const rank=(list,v)=>(list.filter(x=>x<v).length+list.filter(x=>x===v).length/2)/list.length;
const recent=new WeakMap();
/** Score-Karte einer Ebene; nach einem Import zuerst der letzte Stand, die neue Rechnung läuft im Hintergrund */
export async function scoreMap(db,catalog,{level='city',today}={}){
 if(level!=='city'&&level!=='district')throw new AnalyticsError('Ebene unbekannt.');
 const key=`${level}|${windowOf(today).from}`;
 if(!recent.has(db))recent.set(db,new Map());
 const kept=recent.get(db),hit=kept.get(key);
 const fresh=()=>computeScore(db,catalog,level,today).then(v=>{kept.set(key,{v,at:Date.now()});return v;});
 if(hit&&Date.now()-hit.at<STALE_MS){
  if(!hit.busy){hit.busy=true;fresh().catch(()=>{}).finally(()=>{hit.busy=false;});}
  return hit.v;
 }
 return fresh();
}
async function computeScore(db,catalog,level,today){
 const w=windowOf(today);
 return atRevision(db,`score-map-${level}|${w.from}|${w.to}`,async()=>{
  const [b,dec,oparl,...maps]=await Promise.all([base(db,w),decided(db,w),oparlRegions(db),...SCORE_THEMES.map(([,kind])=>radarMap(db,catalog,kind,{level,today}))]);
  const ok=mapOk(b);
  const regs=catalog.filter(r=>r.kind===level&&b.has(r.id));
  // Themen, die bundesweit zu selten für einen Vergleich sind (Karte im Anzahl-Modus), fallen ganz heraus
  const themes=SCORE_THEMES.map(([id,,name],i)=>({id,name,used:maps[i].mode==='vergleich',by:new Map(maps[i].items.map(x=>[x.id,x]))}));
  const groupOf=mapGroups(regs,ok);
  const minThemes=Math.max(2,Math.ceil(themes.filter(t=>t.used).length/2));
  const postponed=id=>{const d=dec.get(id);return d&&d.n>=MIN_DECIDED?d.k/d.n:null;};
  const items=[],counts=[0,0,0,0,0];
  for(const r of regs){
   const values={};let reason='';
   for(const t of themes){const x=t.by.get(r.id);values[t.id]=t.used&&x&&x.p!==null?x.p:null;}
   let work=null;
   if(!ok(r.id))reason='daten';
   else{
    const own=postponed(r.id),group=groupOf(r);
    if(own!==null&&group){
     const shares=group.map(g=>postponed(g.id)).filter(v=>v!==null).sort((a,c)=>a-c);
     // weniger Vertagungen = höherer Wert; Gruppe braucht selbst genug Gebiete mit Entscheidungen
     if(shares.length>=NORM_RULE.minGroup)work={p:Math.round((1-rank(shares,own))*100),share:Math.round(own*1000)/10,median:Math.round(quantile(shares,0.5)*1000)/10,n:dec.get(r.id).n};
    }
   }
   const valid=Object.values(values).filter(v=>v!==null);
   let score=null,themeScore=null;
   if(!reason&&valid.length<minThemes)reason=themes.some(t=>t.by.get(r.id)?.reason==='gruppe')?'gruppe':'themen';
   if(!reason){
    themeScore=valid.reduce((a,v)=>a+v,0)/valid.length;
    const raw=work?themeWeight*themeScore+workWeight*work.p:themeScore;
    score=Math.min(100,Math.round(raw)+(oparl.has(r.id)?OPARL_BONUS:0));
   }
   items.push({id:r.id,name:r.name,ags:mapKeysOf(r),score,band:0,themes:values,themeScore:themeScore===null?null:Math.round(themeScore),work,oparl:oparl.has(r.id),n:b.get(r.id).n,reason});
  }
  const scores=items.filter(i=>i.score!==null).map(i=>i.score).sort((a,c)=>a-c),bands=[null,null,null,null];
  for(const i of items){
   if(i.score!==null){const p=rank(scores,i.score);i.band=p<0.25?1:p<0.5?2:p<0.75?3:4;const b=bands[i.band-1];bands[i.band-1]=b?[Math.min(b[0],i.score),Math.max(b[1],i.score)]:[i.score,i.score];}
   counts[i.band]++;
  }
  return {window:w,level,counts,bands,items,themes:themes.map(({id,name,used})=>({id,name,used})),rule:{...NORM_RULE,...SCORE_RULE,minThemes}};
 });
}

/** GET /api/analytics/score?level=city|district */
export async function score(db,catalog,params){
 return scoreMap(db,catalog,{level:params.get('level')||'city'});
}
