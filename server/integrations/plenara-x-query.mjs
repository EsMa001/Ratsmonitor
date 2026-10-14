/*
 * plenara.X – eine Abfrage für alle Auswertungen (Plan requirements/regel-schritt-plan.md, Schritt 6; Konzept
 * requirements/plenara-x-konzept.md 5.6): Auswahl × Gliederung × Kennzahl, Route GET /api/x.
 *
 * Auswahl: dieselben Filter wie die Suche (q, area, scope, more, within, without, label, status, from, to, month, exact),
 *   dazu theme=<eines der 10 Themen>, sub=<Unterthema>, stage=<Was geschieht>.
 * Gliederung (by): region, month, theme, sub, stage, status, fact:<Art> (Werte aus den Unterlagen, topic_facts aus readReport:
 *   Fraktion, Förderprogramm, Verfahrensschritt eines Plans, Art des Plangebiets, Richtung der Kita-Beiträge, Wärmeplanung,
 *   Zweck eines Zuschusses, Steuerart eines Hebesatzes, Art einer Gebühr).
 * Summe (sum=<Art>): Zahlenwert je Vorgang einmal (der größte), summiert je Gruppe: Wohneinheiten, Kita-Plätze, Förderbeträge.
 * Kennzahl: Vorgänge (count) und Anteil an allen Sachvorgängen derselben Gruppe unter denselben Filtern ohne Thema,
 *   Unterthema und „Was geschieht“ (share).
 * Liste hinter einer Zahl: list=1&by=…&value=…&offset=…
 * Sammelansicht für den Atlas: view=atlas (Unterthemen oder Themen, Was geschieht, Monate, Orte, jüngste Vorgänge in einer Antwort);
 *   mit einem Ort (area=<Schlüssel eines Gebiets>) zusätzlich „Ort im Vergleich“ (compare): Anteil je Unterthema (ohne Thema:
 *   je Thema) an allen Sachvorgängen des eigenen Rats in den letzten 12 Monaten, eingeordnet in der Vergleichsgruppe (gleiche
 *   Art und Größe, zuerst im Land) mit den Regeln aus peer-norms.mjs (Wilson-Spanne gegen die Viertel der Gruppe).
 *
 * Feste Regeln, überall gleich:
 *  - Gezählt werden Vorgänge (report_rules.case_key: Gebiet + normalisierter Titel), nicht Karten, und zwar in x_cases
 *    (eine Zeile je Vorgang, Migration 0036, gebaut im Job rule-texts von x-cases.mjs; Stand builtAt in der Antwort). Ein
 *    Vorgang zählt mit den Werten und im Monat seiner letzten Sitzung bis zum Bautag.
 *  - Nur Sachpunkte: Formalien, Sammelpunkte und Routine (itemKind) zählen nie. Ein noch nicht gelesener Bericht (ohne
 *    Zeile in report_rules) zählt als Sachpunkt, wenn seine Karte keine Formalie ist (search_cards.formal); ihm fehlen
 *    Unterthemen und „Was geschieht“ (unread in der Antwort).
 *  - Thema ist das Label der Karte, also dasselbe wie im Themenfilter der Suche (mit Einordnung von Hand und KI).
 *    Unterthemen zählen nur innerhalb ihres Themas.
 *  - Ohne Angabe `to` zählt nur bis heute. Ohne gebaute Zahlen antwortet die Abfrage mit 503.
 */
import {parseMonitorSearch,searchFilters} from './monitor-search.mjs';
import {THEMES,SUBTOPICS,subtopicName} from '../../shared/themes.mjs';
import {STAGES,SONST,stageName} from '../../shared/stage.mjs';
import {labelName} from '../../shared/labels.mjs';
import {AnalyticsError} from './analytics-diffusion.mjs';
import {where as placeOf} from './member-place.mjs';
import {peerGroup,wilson,quantile,classify,windowOf,NORM_RULE} from './peer-norms.mjs';

export const X_BY=['region','month','theme','sub','stage','status'];
export const X_FACTS=['faction','annual_result','funding','plan','plan_use','kita_fee','heat_plan','grant','hebesatz','fee_rate','park_fee','ee_power','land_price'];
export const X_SUMS={housing:'Wohneinheiten',kita_places:'Kita-Plätze',funding_euro:'Förderbeträge in Euro'};
/* Werte aus den Unterlagen im Atlas je Thema, mit Qualitätstor (Konzept 7: gezeigt ab 90 % gemessener Genauigkeit).
   Messung 13.10.2026 (docs/qualitaet/plenara-x/): Verfahrensschritt Bauleitplanung, Hebesätze, Fraktion nahe 100 %;
   Förderprogramme 85 %, Förderbeträge 83 %, Kita-Beiträge 75 %, Kita-Plätze 68 %; übrige noch nicht gemessen. */
export const X_FACT_NAMES={annual_result:'Jahresabschlüsse nach Ergebnis',plan:'Bauleitplanung nach Verfahrensschritt',plan_use:'Art des Plangebiets',hebesatz:'Hebesätze nach Steuerart',fee_rate:'Gebührensätze nach Art',
 heat_plan:'Kommunale Wärmeplanung nach Schritt',grant:'Zuschüsse an Vereine und Träger nach Zweck',kita_fee:'Kita-Beiträge nach Richtung',funding:'Förderprogramme',faction:'Anträge und Anfragen nach Fraktion',
 park_fee:'Parkgebühren je Stunde',ee_power:'Wind- und Solarvorhaben nach Art',land_price:'Preise für Gewerbegrundstücke'};
export const X_FACT_GATE={plan:true,hebesatz:true,faction:true,annual_result:true,funding:false,kita_fee:false,plan_use:false,fee_rate:true,heat_plan:false,grant:false,park_fee:false,ee_power:false,land_price:true};
export const X_SUM_GATE={housing:false,kita_places:false,funding_euro:false};
const ATLAS_FACTS={bauen:[['plan','housing'],['plan_use']],finanzen:[['hebesatz'],['annual_result']],umwelt:[['heat_plan'],['fee_rate'],['ee_power']],mobilitaet:[['park_fee']],wirtschaft:[['land_price']],soziales:[['grant']],kultur:[['grant']],
 bildung:[['kita_fee','kita_places']],'':[['funding','funding_euro']]};
export const X_LIST_SIZE=50;
const THEME_IDS=new Set([...THEMES.map(t=>t.id),'unklar']),SUB_BY_ID=new Map(SUBTOPICS.map(s=>[s.id,s]));
const STAGE_IDS=new Set([...STAGES.map(s=>s.id),SONST]);
const OWN=['theme','sub','stage','by','list','value','offset','view','sum'];

/** Parameter prüfen: Filter der Suche plus Auswahl und Gliederung */
export function parseX(params){
 const copy=new URLSearchParams(params);for(const k of OWN)copy.delete(k);
 if(!copy.has('to'))copy.set('to',new Date().toISOString().slice(0,10));
 let f;try{f=parseMonitorSearch(copy);}catch(e){throw new AnalyticsError(e.message,e.status||400);}
 const theme=params.get('theme')||'',sub=params.get('sub')||'',stage=params.get('stage')||'',by=params.get('by')||'region';
 if(theme&&!THEME_IDS.has(theme))throw new AnalyticsError('Unbekanntes Thema.');
 if(sub&&!SUB_BY_ID.has(sub))throw new AnalyticsError('Unbekanntes Unterthema.');
 if(sub&&theme&&SUB_BY_ID.get(sub).theme!==theme)throw new AnalyticsError('Das Unterthema gehört zu einem anderen Thema.');
 if(stage&&!STAGE_IDS.has(stage))throw new AnalyticsError('Unbekannter Wert für „Was geschieht“.');
 const fact=by.startsWith('fact:')?by.slice(5):'';
 if(!X_BY.includes(by)&&!X_FACTS.includes(fact))throw new AnalyticsError('Unbekannte Gliederung.');
 const sum=params.get('sum')||'';if(sum&&!X_SUMS[sum])throw new AnalyticsError('Unbekannte Summe.');
 const offset=Math.max(0,Number(params.get('offset'))||0);
 return {f,theme:sub?SUB_BY_ID.get(sub).theme:theme,sub,stage,by,fact,sum,list:params.get('list')==='1',value:params.get('value')??'',offset};
}

/* Gezählt wird in x_cases (eine Zeile je Sachvorgang, Migration 0036, gebaut von x-cases.mjs); stage '' = noch nicht gelesen */
const KEY={region:'x.region_id',month:'x.month',theme:'x.label',sub:'s.value',stage:'x.stage',status:'x.status'};
const SUB_JOIN=`JOIN json_each('["'||replace(x.subs,',','","')||'"]') s ON s.value<>''`;
/* Werte aus den Unterlagen hängen an Berichten: je Vorgang und Wert eine Zeile über alle Berichte des Vorgangs */
const FACT_JOIN=`JOIN (SELECT DISTINCT rr.case_key ck,f.value v FROM topic_facts f JOIN report_rules rr ON rr.topic_id=f.topic_id WHERE f.kind=?) f ON f.ck=x.case_key`;
const SUM_JOIN=`JOIN (SELECT rr.case_key ck,max(CAST(sv.detail AS REAL)) v FROM topic_facts sv JOIN report_rules rr ON rr.topic_id=sv.topic_id WHERE sv.kind=? GROUP BY rr.case_key) sv ON sv.ck=x.case_key`;
/* Gruppenschlüssel, nötige Verknüpfung und ihre Parameter; perPart: ein Vorgang kann in mehreren Gruppen stehen */
const grouping=x=>x.fact?{key:'f.v',join:FACT_JOIN,jargs:[x.fact],perPart:true}
 :{key:KEY[x.by],join:x.by==='sub'?SUB_JOIN:'',jargs:[],perPart:x.by==='sub'};

/** Stand der Zahlen (null: noch nie gebaut) */
async function xState(db){
 try{const r=await db.prepare("SELECT value FROM system_state WHERE key='x-cases'").first();return r?JSON.parse(r.value):null;}catch{return null;}
}
/* FROM-Teil: die Vorgänge unter den Filtern der Suche. Ohne Suchbegriff gelten die Filter (Gebiet, Thema, Status, Zeitraum)
   direkt für x_cases (dieselben Spaltennamen); mit Suchbegriff sucht die Suche selbst die Karten (mit Wortliste und Volltext),
   gezählt werden deren Vorgänge. „Ohne Formalien“ ist immer erfüllt. */
async function source(db,catalog,f){
 const {page}=await searchFilters(db,catalog,{...f,noformal:false,part:'x'});
 if(!f.q)return {from:`(SELECT * FROM x_cases WHERE ${page.where}) x`,args:page.args};
 // Die Suche einmal je Anfrage: Vorgänge der gefundenen Karten als Liste, alle Zählungen lesen nur noch sie
 const {results}=await db.prepare(`SELECT DISTINCT coalesce(r.case_key,c.region_id||'|'||lower(c.title)) k FROM (SELECT id,region_id,title FROM search_cards WHERE ${page.where}) c LEFT JOIN report_rules r ON r.topic_id=c.id`).bind(...page.args).all();
 return {from:'(SELECT * FROM x_cases WHERE case_key IN (SELECT value FROM json_each(?))) x',args:[JSON.stringify(results.map(r=>r.k))]};
}
function selection(x){
 const where=['1'],args=[];
 if(x.theme){where.push('x.label=?');args.push(x.theme);}
 if(x.sub){where.push("(','||x.subs||',') LIKE ?");args.push('%,'+x.sub+',%');}
 if(x.stage){where.push('x.stage=?');args.push(x.stage);}
 return {where,args};
}
const nameOf=(by,key,byId)=>by==='region'?byId.get(key)?.name||key:by==='theme'?labelName(key):by==='sub'?subtopicName(key):by==='stage'?stageName(key||SONST):key;

/** Zahlen je Gruppe: Vorgänge der Auswahl, Sachvorgänge der Gruppe insgesamt, Anteil */
/** @param {{pop?:Record<string,number>}} [opts] pop: Einwohner je Gebiet (Standard: Katalog), für Tests */
export async function xQuery(db,catalog,params,opts={}){
 const x=parseX(params);
 const state=await xState(db);
 if(!state)throw new AnalyticsError('Die Zahlen für plenara.X werden gerade aufgebaut.',503);
 if(x.list)return xList(db,catalog,x,opts);
 if(params.get('view')==='atlas')return xAtlas(db,catalog,params,x,opts,state);
 const {from,args}=opts.src||await source(db,catalog,x.f),sel=selection(x),{key,join,jargs,perPart}=grouping(x);
 const cond=sel.where.join(' AND '),hit=`CASE WHEN ${cond} THEN 1 ELSE 0 END`,unread=`CASE WHEN ${cond} THEN x.unread ELSE 0 END`;
 let hits,total,all=null;
 if(!perPart){
  // Ein Durchlauf: je Gruppe Vorgänge der Auswahl (n), alle Sachvorgänge der Gruppe unter denselben Filtern (b) und ungelesene
  const {results}=await db.prepare(`SELECT ${key} k,sum(${hit}) n,count(*) b,sum(${unread}) u FROM ${from} GROUP BY k`).bind(...sel.args,...sel.args,...args).all();
  hits=results.filter(r=>r.n>0);total={n:results.reduce((a,r)=>a+r.n,0),u:results.reduce((a,r)=>a+r.u,0)};
 }else{
  // Unterthemen und Werte: Nenner sind alle Sachvorgänge der Auswahl ohne sie (bei Unterthemen: des Themas)
  const t=await db.prepare(`SELECT sum(${hit}) n,sum(${unread}) u,${x.theme?'sum(CASE WHEN x.label=? THEN 1 ELSE 0 END)':'count(*)'} a FROM ${from}`).bind(...sel.args,...sel.args,...(x.theme?[x.theme]:[]),...args).first();
  total={n:Number(t?.n||0),u:Number(t?.u||0)};all={n:x.fact?total.n:Number(t?.a||0)};
  // Erst die Auswahl als Zwischenmenge, dann aufteilen (sonst teilt SQLite jede Zeile vor dem Filtern auf: Sekunden statt 0,1 s)
  const cte=`WITH sel AS MATERIALIZED (SELECT x.* FROM ${from} WHERE ${cond})`;
  hits=(await (x.fact
   ?db.prepare(`${cte} SELECT f.value k,count(DISTINCT rr.case_key) n FROM topic_facts f JOIN report_rules rr ON rr.topic_id=f.topic_id WHERE f.kind=? AND rr.case_key IN (SELECT case_key FROM sel) GROUP BY k`).bind(...args,...sel.args,x.fact)
   :db.prepare(`${cte} SELECT ${key} k,count(*) n FROM sel x ${join} GROUP BY k`).bind(...args,...sel.args,...jargs)).all()).results;
 }
 // Summe eines Zahlenwerts: je Vorgang der größte Wert, je Gruppe summiert
 const sums=x.sum?new Map((await db.prepare(`WITH sel AS MATERIALIZED (SELECT x.* FROM ${from} WHERE ${cond}) SELECT k,sum(v) v FROM (SELECT ${key} k,x.case_key cs,max(sv.v) v FROM sel x ${join} ${SUM_JOIN} GROUP BY k,cs) GROUP BY k`).bind(...args,...sel.args,...jargs,x.sum).all()).results.map(r=>[r.k,r.v])):null;
 const byId=new Map(catalog.map(r=>[r.id,r]));
 const rows=hits.map(h=>{const b=perPart?Number(all?.n||0):h.b||0;
  return {key:h.k??'',name:nameOf(x.by,h.k,byId),...(x.by==='region'?{ags:byId.get(h.k)?.ags||''}:{}),count:h.n,base:b,share:b?Math.round(1000*h.n/b)/10:null,...(sums?{sum:sums.get(h.k)??0}:{})};})
  .sort((a,b)=>x.by==='month'?String(a.key).localeCompare(String(b.key)):b.count-a.count);
 return {selection:{theme:x.theme,sub:x.sub,stage:x.stage,q:x.f.q},by:x.by,...(x.sum?{sum:{kind:x.sum,name:X_SUMS[x.sum]}}:{}),total:Number(total?.n||0),unread:Number(total?.u||0),builtAt:state.builtAt,rows};
}

/** Die Vorgänge hinter einer Zahl: je Vorgang einmal mit seiner jüngsten Sitzung, die jüngsten zuerst */
async function xList(db,catalog,x,{count:counted=true,src=null}={}){
 const {from,args}=src||await source(db,catalog,x.f),sel=selection(x);
 const {key,join,jargs}=grouping(x);
 if(x.value!==''){sel.where.push(`${key}=?`);sel.args.push(x.value);}
 const cond=sel.where.join(' AND '),distinct=x.fact?'DISTINCT ':'';
 const [{results},count]=await Promise.all([
  // Erst die Seite aus der schmalen Tabelle, dann Titel und Gremium nur für diese Vorgänge
  db.prepare(`SELECT p.card_id id,p.region_id region,c.title,c.gremium,p.date,p.status,p.stage,p.subs,p.cards times FROM (SELECT ${distinct}x.* FROM ${from} ${join} WHERE ${cond} ORDER BY x.date DESC,x.case_key LIMIT ? OFFSET ?) p JOIN search_cards c ON c.id=p.card_id ORDER BY p.date DESC,p.case_key`).bind(...args,...jargs,...sel.args,X_LIST_SIZE,x.offset).all(),
  counted?db.prepare(`SELECT count(${distinct}x.case_key) n FROM ${from} ${join} WHERE ${cond}`).bind(...args,...jargs,...sel.args).first():null,
 ]);
 const byId=new Map(catalog.map(r=>[r.id,r])),name=r=>byId.get(r)?.name||r;
 return {offset:x.offset,size:X_LIST_SIZE,total:Number(count?.n||0),
  items:results.map(r=>({id:r.id,title:r.title,region:placeOf(name(r.region),r.title,r.gremium,byId.get(r.region)?.members).label,date:String(r.date).slice(0,10),status:r.status,
   stage:r.stage||null,subs:r.subs?r.subs.split(','):[],times:r.times}))};
}

/** Atlas: alle Gliederungen einer Auswahl in einer Antwort (ohne Thema: je Thema, mit Thema: je Unterthema) */
async function xAtlas(db,catalog,params,x,opts,state){
 const src=await source(db,catalog,x.f);
 const at=(by,sum)=>{const p=new URLSearchParams(params);p.delete('view');p.set('by',by);if(sum)p.set('sum',sum);return xQuery(db,catalog,p,{src});};
 // Werte aus den Unterlagen: nur, was das Qualitätstor erreicht (gesperrte Summen entfallen, der Wert bleibt)
 const wanted=(ATLAS_FACTS[x.theme]||[]).filter(([k])=>X_FACT_GATE[k]).map(([k,sum])=>[k,sum&&X_SUM_GATE[sum]?sum:'']);
 const [parts,stages,months,regions,recent,...facts]=await Promise.all([at(x.theme?'sub':'theme'),at('stage'),at('month'),at('region'),
  xList(db,catalog,{...x,by:'region',value:'',offset:0},{count:false,src}),...wanted.map(([k,sum])=>at('fact:'+k,sum))]);
 return {selection:parts.selection,total:stages.total,unread:stages.unread,builtAt:state.builtAt,parts:parts.rows,stages:stages.rows,months:months.rows,
  regions:regions.rows,recent:recent.items.slice(0,10),
  facts:facts.map((f,i)=>({kind:wanted[i][0],name:X_FACT_NAMES[wanted[i][0]],sum:f.sum||null,rows:f.rows})).filter(f=>f.rows.length),compare:await xCompare(db,catalog,x,params,opts)};
}

/* Sachvorgänge je Gebiet im Zeitfenster und Monate mit Sitzungen; Vorgänge je Gebiet und Teil (Unterthema des Themas, ohne
   Thema: Thema). Über alle Gebiete. */
async function winBase(db,w){
 const {results}=await db.prepare('SELECT region_id g,count(*) n,count(DISTINCT month) m FROM x_cases WHERE date>=? AND date<=? GROUP BY g').bind(w.from,w.to).all();
 return new Map(results.map(x=>[x.g,{n:x.n,m:x.m}]));
}
async function winParts(db,w,theme){
 const {results}=theme
  ?await db.prepare(`SELECT x.region_id g,s.value k,count(*) n FROM x_cases x ${SUB_JOIN} WHERE x.date>=? AND x.date<=? AND x.label=? GROUP BY g,k`).bind(w.from,w.to,theme).all()
  :await db.prepare('SELECT region_id g,label k,count(*) n FROM x_cases WHERE date>=? AND date<=? GROUP BY g,k').bind(w.from,w.to).all();
 const by=new Map();for(const x of results){if(!by.has(x.g))by.set(x.g,new Map());by.get(x.g).set(x.k,x.n);}
 return by;
}
const pct1=v=>Math.round(v*1000)/10;
/** Ort im Vergleich: nur mit genau einem Gebiet als Ort und ohne Suchbegriff (eine freie Suche hat keine Vergleichsgruppe) */
async function xCompare(db,catalog,x,params,opts={}){
 const area=params.get('area')||'';if(!area||x.f.q||x.sub||x.stage)return null;
 /* Kreisfreie Stadt: die Suche nennt sie mit dem Kreisschlüssel (05515), der Katalog mit dem Gemeindeschlüssel (05515000);
    gibt es kein Gebiet mit dem 5-stelligen Schlüssel, ist die Stadt selbst gemeint (wie ownCity in monitor-search.mjs) */
 const place=catalog.find(r=>r.ags===area&&!r.members)||catalog.find(r=>r.ags===area)||(area.length===5?catalog.find(r=>r.ags===area+'000'):null);if(!place)return null;
 const w=windowOf(params.get('today')?new Date(params.get('today')):undefined);
 const [b,parts]=await Promise.all([winBase(db,w),winParts(db,w,x.theme)]);
 const own=b.get(place.id)||{n:0,m:0};
 const ok=id=>{const v=b.get(id);return !!v&&v.n>=NORM_RULE.minItems&&v.m>=NORM_RULE.minMonths;};
 const head={region:place.name,from:w.from,to:w.to,n:own.n,months:own.m,rule:NORM_RULE};
 if(!ok(place.id))return {...head,insufficient:own.n<NORM_RULE.minItems?'items':'months'};
 const group=peerGroup(place,catalog,ok,opts.pop);if(!group)return {...head,insufficient:'group'};
 const keys=x.theme?SUBTOPICS.filter(s=>s.theme===x.theme).map(s=>s.id):[...THEMES.map(t=>t.id)];
 const mine=parts.get(place.id)||new Map();
 const rows=keys.map(key=>{
  const shares=group.regions.map(r=>((parts.get(r.id)?.get(key))||0)/b.get(r.id).n).sort((a,c)=>a-c);
  const q1=quantile(shares,0.25),med=quantile(shares,0.5),q3=quantile(shares,0.75),k=mine.get(key)||0,cls=classify(k,own.n,q1,q3);
  return {key,name:x.theme?subtopicName(key):labelName(key),k,share:pct1(k/own.n),q1:pct1(q1),median:pct1(med),q3:pct1(q3),
   ratio:med>0&&(cls==='mehr'||cls==='weniger')?Math.round((k/own.n/med)*10)/10:null,class:cls};
 });
 return {...head,group:{label:group.label,n:group.regions.length},rows};
}
