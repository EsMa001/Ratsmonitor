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
 * Sammelansicht für den Atlas: view=atlas (Unterthemen oder Themen, Monate, Orte, jüngste Vorgänge in einer Antwort);
 * plenara.X Fakten: view=fakten (Orte und je freigegebenem Wert die Zahlen je Gebiet, MAP_FACTS);
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
import {STAGES,RULE_STAGES,SONST,RULE_SONST,stageName} from '../../shared/stage.mjs';
import {labelName} from '../../shared/labels.mjs';
import {AnalyticsError} from './analytics-diffusion.mjs';
import {where as placeOf} from './member-place.mjs';
import {POPULATION} from '../../shared/catalog.mjs';
import {peerGroup,quantile,classify,windowOf,NORM_RULE} from './peer-norms.mjs';

export const X_BY=['region','month','theme','sub','stage','status'];
export const X_FACTS=['faction','annual_result','plan','plan_use','kita_fee','heat_plan','grant','hebesatz','fee_rate','ee_power','land_price','plot_price','dog_tax','waste_fee','plan_area','wind_count','project','road','house_type','housing','budget','second_home_tax','amusement_tax'];
export const X_SUMS={housing:'Wohneinheiten'};
/* Werte aus den Unterlagen im Atlas je Thema, mit Qualitätstor (Konzept 7: gezeigt ab 90 % gemessener Genauigkeit).
   Messung 13.10.2026 (docs/qualitaet/plenara-x/): Verfahrensschritt Bauleitplanung, Hebesätze, Fraktion nahe 100 %;
   Kita-Beiträge 75 %; übrige noch nicht gemessen. Förderung, Förderbeträge, Kita-Plätze und Parkgebühr seit 15.10.2026 verworfen. */
export const X_FACT_NAMES={annual_result:'Jahresabschlüsse nach Ergebnis',plan:'Bauleitplanung nach Verfahrensschritt',plan_use:'Art des Plangebiets',hebesatz:'Hebesätze nach Steuerart',fee_rate:'Gebührensätze nach Art',
 heat_plan:'Kommunale Wärmeplanung nach Schritt',grant:'Zuschüsse an Vereine und Träger nach Zweck',kita_fee:'Kita-Beiträge nach Richtung',faction:'Anträge und Anfragen nach Fraktion',
 ee_power:'Wind- und Solarvorhaben nach Art',land_price:'Preise für Gewerbegrundstücke',plot_price:'Preise für Wohnbauplätze',dog_tax:'Hundesteuer für den ersten Hund',waste_fee:'Abfallgebühren',plan_area:'Fläche der Plangebiete',wind_count:'Zahl der Windenergieanlagen',project:'Vorhaben (Bürgerbus, Carsharing, WLAN, Ladesäulen)',road:'Straßenbau nach Art',budget:'Haushalt (Aufwendungen, Investitionskredite)',second_home_tax:'Zweitwohnungsteuer',amusement_tax:'Vergnügungssteuer nach Maßstab',house_type:'Art der Wohnbebauung'};
/* Tor seit 17.10.2026: Zahlenfakten nur mit Qualität ab 90 % und Werten für mindestens 10 % der Gemeinden (Admin „Themen & Texte“,
   docs/produkt/signale-und-fakten.md). Das erfüllen Hebesatz, Jahresergebnis und Wassergebühr; Zuschüsse (Qualität 89 %) und
   Gewerbegrundstücke (0,5 % der Gemeinden) nicht. Stand, Art und Fraktion (plan, plan_use, heat_plan, faction) sind keine Zahlenfakten. */
export const X_FACT_GATE={budget:false,second_home_tax:false,amusement_tax:false,house_type:false,road:false,project:false,wind_count:false,waste_fee:false,plan_area:false,plan:true,hebesatz:true,faction:true,annual_result:true,kita_fee:false,plan_use:false,fee_rate:true,heat_plan:true,grant:false,ee_power:false,land_price:false,plot_price:false,dog_tax:false};
export const X_SUM_GATE={housing:false};
// Art des Plangebiets (plan_use) seit 22.10.2026 nicht mehr im Atlas: eine Einordnung, die die Signale aus dem Modell zeigen
const ATLAS_FACTS={bauen:[['plan','housing'],['plan_area'],['plot_price']],finanzen:[['hebesatz'],['annual_result'],['dog_tax']],umwelt:[['heat_plan'],['fee_rate'],['waste_fee'],['ee_power'],['wind_count']],mobilitaet:[['project'],['road']],wirtschaft:[['land_price']],soziales:[['grant']],kultur:[['grant']],
 bildung:[['kita_fee']]};
import {MAP_FACTS,MAP_FACT_NAMES} from '../../shared/map-facts.mjs';
import {atRevisionStale,paramsKey} from './revision-cache.mjs';
import {X_REVISION_SQL} from './x-cases.mjs';
import {xOffload} from './x-offload.mjs';
export {MAP_FACTS,MAP_FACT_NAMES};
export const X_LIST_SIZE=50;
/* Zahl hinter einem Wert (erstes Feld von detail) und ihre Einheit; Fakten ohne Eintrag sind nur Kategorien (Schritt, Fraktion).
   Gebührensätze tragen die Einheit im dritten Feld (m³ oder m²). Ein Zuschuss ohne Betrag hat keine Zahl. */
const X_FACT_NUM={road:'€',plan_area:'ha',wind_count:'Anlagen',hebesatz:'%',fee_rate:'€/',annual_result:'€',ee_power:'MW',dog_tax:'€ im Jahr',land_price:'€/m²',plot_price:'€/m²',grant:'€',kita_fee:'€ im Monat',housing:'Wohneinheiten',budget:'€',waste_fee:'€ im Jahr',second_home_tax:'%',amusement_tax:'%'};
const factNum=(kind,detail)=>{if(!X_FACT_NUM[kind])return null;const parts=String(detail??'').split('|'),v=Number(parts[0]);
 return parts[0]!==''&&Number.isFinite(v)&&!(kind==='grant'&&v===0)?{v,unit:kind==='fee_rate'?'€/'+(parts[2]||'m³'):X_FACT_NUM[kind]}:null;};
const fmtNum=(v,unit)=>`${v.toLocaleString('de-DE',{maximumFractionDigits:Math.abs(v)>=100?0:2})} ${unit}`;
const median=vs=>{const s=[...vs].sort((a,b)=>a-b),m=s.length>>1;return s.length%2?s[m]:(s[m-1]+s[m])/2;};
const THEME_IDS=new Set([...THEMES.map(t=>t.id),'unklar']),SUB_BY_ID=new Map(SUBTOPICS.map(s=>[s.id,s]));
// Vorgangsarten des Modells; die Werte der früheren Regel gelten weiter, solange Berichte sie noch tragen
const STAGE_IDS=new Set([...STAGES.map(s=>s.id),SONST,...RULE_STAGES.map(s=>s.id),RULE_SONST]);
const OWN=['theme','sub','stage','by','list','value','offset','view','sum','region'];

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
 return {f,theme:sub?SUB_BY_ID.get(sub).theme:theme,sub,stage,by,fact,sum,region:params.get('region')||'',list:params.get('list')==='1',value:params.get('value')??'',offset};
}

/* Gezählt wird in x_cases (eine Zeile je Sachvorgang, Migration 0036, gebaut von x-cases.mjs); stage '' = noch nicht gelesen */
const KEY={region:'x.region_id',month:'x.month',theme:'x.label',sub:'s.value',stage:'x.stage',status:'x.status'};
const SUB_JOIN=`JOIN json_each('["'||replace(x.subs,',','","')||'"]') s ON s.value<>''`;
/* Werte aus den Unterlagen hängen an Berichten: je Vorgang und Wert eine Zeile über alle Berichte des Vorgangs */
const FACT_JOIN=`JOIN (SELECT DISTINCT rr.case_key ck,f.value v FROM topic_facts f JOIN report_rules rr ON rr.topic_id=f.topic_id WHERE f.kind=?) f ON f.ck=x.case_key`;
const SUM_JOIN=`JOIN (SELECT rr.case_key ck,max(CAST(sv.detail AS REAL)) v FROM topic_facts sv JOIN report_rules rr ON rr.topic_id=sv.topic_id WHERE sv.kind=? GROUP BY rr.case_key) sv ON sv.ck=x.case_key`;
/* Gruppenschlüssel, nötige Verknüpfung und ihre Parameter; perPart: ein Vorgang kann in mehreren Gruppen stehen */
/* Hat ein Vorgang in mehreren Berichten verschiedene Werte, gilt der aus der jüngsten Sitzung (zuletzt beratener Stand);
   bei gleichem Tag entscheidet der Bericht, damit es immer derselbe ist. Für Karte, Median und Listen gleich. */
const NEWEST_JOIN='LEFT JOIN search_cards nc ON nc.id=f.topic_id',NEWEST_ORDER='ORDER BY nc.date DESC,f.topic_id,f.value,f.detail';
const SEL_COLS='x.case_key,x.subs,x.region_id,x.month,x.label,x.stage,x.status';
const grouping=x=>x.fact?{key:'f.v',join:FACT_JOIN,jargs:[x.fact],perPart:true}
 :{key:KEY[x.by],join:x.by==='sub'?SUB_JOIN:'',jargs:[],perPart:x.by==='sub'};

/** Stand der Zahlen (null: noch nie gebaut) */
export async function xState(db){
 try{const r=await db.prepare("SELECT value FROM system_state WHERE key='x-cases'").first();return r?JSON.parse(r.value):null;}catch{return null;}
}
/* FROM-Teil: die Vorgänge unter den Filtern der Suche. Ohne Suchbegriff gelten die Filter (Gebiet, Thema, Status, Zeitraum)
   direkt für x_cases (dieselben Spaltennamen); mit Suchbegriff sucht die Suche selbst die Karten (mit Wortliste und Volltext),
   gezählt werden deren Vorgänge. „Ohne Formalien“ ist immer erfüllt. */
/* Spalten von x_cases, die jede Auswertung bekommt (ohne die langen Stationen) */
const X_COLS='case_key,region_id,date,month,label,stage,subs,status,card_id,cards,unread,first_date,days,vote,changed';
export async function source(db,catalog,f,opts={}){
 // Ohne Zeitraum bis heute, wie die Suche ohne „Künftige Sitzungen zeigen“: künftige Vorgänge (x_cases) nur, wer ausdrücklich voraus fragt
 const to=f.to||new Date().toISOString().slice(0,10);
 const {page}=await searchFilters(db,catalog,{...f,to,noformal:false,part:'x'});
// Schmale Spalten; die langen Stationen (steps) und Begriffe (terms) nur, wer sie braucht.
// noPrivate: ohne private Bauanträge (x_cases.private_build), einheitlich für Themennetz, Ortsvergleich und Trends
 const np=opts.noPrivate?' AND private_build=0':'';
 const cols=X_COLS+(opts.steps?',steps':'')+(opts.terms?',terms':'')+(opts.factions?',factions,faction_advice':'');
 /* Nur Obergrenze (date<=heute, also fast alle Zeilen): über den Datumsindex liest SQLite die ganze Tabelle in Indexreihenfolge mit
    wahlfreiem Zugriff; der Tabellen-Scan (+date schaltet den Index für diesen Term ab) ist 2- bis 3-mal schneller (Server 17.10.2026:
    Gremiennetz 809→293 ms, Fraktionen 738→226, Themennetz 1283→670, Ausgang 1331→789). Mit Untergrenze (Trends-Fenster, Newsradar)
    liest der Index nur den Ausschnitt und bleibt. Ergebnis unverändert, nur der Zugriffsweg. */
 const where=!f.from&&!f.month?page.where.replace('date<=?','+date<=?'):page.where;
 if(!f.q)return {from:`(SELECT ${cols} FROM x_cases WHERE ${where}${np}) x`,args:page.args};
 // Die Suche einmal je Anfrage: Vorgänge der gefundenen Karten als Liste, alle Zählungen lesen nur noch sie
 const {results}=await db.prepare(`SELECT DISTINCT coalesce(r.case_key,c.region_id||'|'||lower(c.title)) k FROM (SELECT id,region_id,title FROM search_cards WHERE ${page.where}) c LEFT JOIN report_rules r ON r.topic_id=c.id`).bind(...page.args).all();
 return {from:`(SELECT ${cols} FROM x_cases WHERE case_key IN (SELECT value FROM json_each(?))${np}) x`,args:[JSON.stringify(results.map(r=>r.k))]};
}
/** Erste Sitzung eines Vorgangs (x_cases.first_date, beim Bau aus dem Zeitstrahl, Migration 0040); ohne Bau die letzte */
export const FIRST_DATE=`coalesce(nullif(x.first_date,''),x.date)`;
function selection(x){
 const where=['1'],args=[];
 if(x.theme){where.push('x.label=?');args.push(x.theme);}
 if(x.sub){where.push("(','||x.subs||',') LIKE ?");args.push('%,'+x.sub+',%');}
 if(x.stage){where.push('x.stage=?');args.push(x.stage);}
 /* Ein Gebiet (Schlüssel des Katalogs), etwa für die Vorgänge hinter einem Wert in plenara.X Fakten */
 if(x.region){where.push('x.region_id=?');args.push(x.region);}
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
 if(params.get('view')==='fakten')return xFakten(db,catalog,params,x,state);
 const {from,args}=opts.src||await source(db,catalog,x.f),sel=selection(x),{key,join,jargs,perPart}=grouping(x);
 const cond=sel.where.join(' AND '),hit=`CASE WHEN ${cond} THEN 1 ELSE 0 END`,unread=`CASE WHEN ${cond} THEN x.unread ELSE 0 END`;
 let hits,total,all=null;
 if(!perPart){
  // Ein Durchlauf: je Gruppe Vorgänge der Auswahl (n), alle Sachvorgänge der Gruppe unter denselben Filtern (b) und ungelesene
  // (opts.pre: schon gezählt von groupsAtOnce, für den Atlas)
  const {results}=opts.pre?.[x.by]?{results:opts.pre[x.by]}:await db.prepare(`SELECT ${key} k,sum(${hit}) n,count(*) b,sum(${unread}) u FROM ${from} GROUP BY k`).bind(...sel.args,...sel.args,...args).all();
  hits=results.filter(r=>r.n>0);total={n:results.reduce((a,r)=>a+r.n,0),u:results.reduce((a,r)=>a+r.u,0)};
 }else{
  // Unterthemen und Werte: Nenner sind alle Sachvorgänge der Auswahl ohne sie (bei Unterthemen: des Themas)
  // opts.memo (Atlas): Unterthemen und jeder Wert brauchen dieselbe Gesamtzahl, sie wird je Anfrage nur einmal gezählt
  const tSql=`SELECT sum(${hit}) n,sum(${unread}) u,${x.theme?'sum(CASE WHEN x.label=? THEN 1 ELSE 0 END)':'count(*)'} a FROM ${from}`,tArgs=[...sel.args,...sel.args,...(x.theme?[x.theme]:[]),...args];
  const tKey=tSql+JSON.stringify(tArgs),total1=()=>db.prepare(tSql).bind(...tArgs).first();
  if(opts.memo&&!opts.memo.has(tKey))opts.memo.set(tKey,total1());
  const t=await (opts.memo?opts.memo.get(tKey):total1());
  total={n:Number(t?.n||0),u:Number(t?.u||0)};all={n:x.fact?total.n:Number(t?.a||0)};
  // Erst die Auswahl als Zwischenmenge, dann aufteilen (sonst teilt SQLite jede Zeile vor dem Filtern auf: Sekunden statt 0,1 s)
  /* Nur die Spalten, die Gliederung, Werte und Summen lesen (nicht x.*) */
  const cte=`WITH sel AS MATERIALIZED (SELECT ${SEL_COLS} FROM ${from} WHERE ${cond})`;
  hits=(await (x.fact
   ?db.prepare(`${cte} SELECT f.value k,count(DISTINCT rr.case_key) n FROM topic_facts f JOIN report_rules rr ON rr.topic_id=f.topic_id WHERE f.kind=? AND rr.case_key IN (SELECT case_key FROM sel) GROUP BY k`).bind(...args,...sel.args,x.fact)
   :db.prepare(`${cte} SELECT ${key} k,count(*) n FROM sel x ${join} GROUP BY k`).bind(...args,...sel.args,...jargs)).all()).results;
 }
 // Summe eines Zahlenwerts: je Vorgang der größte Wert, je Gruppe summiert
 // Zahlenwerte: je Vorgang und Wert die erste Zahl, je Gruppe der Median (nur Fakten mit Zahl)
 let medians=null;
 if(x.fact&&X_FACT_NUM[x.fact]){
  const {results}=await db.prepare(`WITH sel AS MATERIALIZED (SELECT ${SEL_COLS} FROM ${from} WHERE ${cond}) SELECT f.value k,rr.case_key ck,f.detail d FROM topic_facts f JOIN report_rules rr ON rr.topic_id=f.topic_id ${NEWEST_JOIN} WHERE f.kind=? AND f.detail<>'' AND rr.case_key IN (SELECT case_key FROM sel) ${NEWEST_ORDER}`).bind(...args,...sel.args,x.fact).all();
  const per=new Map();for(const r of results){const num=factNum(x.fact,r.d);if(!num)continue;const g=per.get(r.k)||new Map();if(!g.has(r.ck))g.set(r.ck,num);per.set(r.k,g);}
  medians=new Map([...per].map(([k,g])=>{const nums=[...g.values()],units=new Map();for(const u of nums)units.set(u.unit,(units.get(u.unit)||0)+1);
   const unit=[...units].sort((a,b)=>b[1]-a[1])[0][0],vs=nums.filter(u=>u.unit===unit).map(u=>u.v);return [k,{median:median(vs),unit,n:vs.length}];}));
 }
 const sums=x.sum?new Map((await db.prepare(`WITH sel AS MATERIALIZED (SELECT ${SEL_COLS} FROM ${from} WHERE ${cond}) SELECT k,sum(v) v FROM (SELECT ${key} k,x.case_key cs,max(sv.v) v FROM sel x ${join} ${SUM_JOIN} GROUP BY k,cs) GROUP BY k`).bind(...args,...sel.args,...jargs,x.sum).all()).results.map(r=>[r.k,r.v])):null;
 const byId=new Map(catalog.map(r=>[r.id,r]));
 const rows=hits.map(h=>{const b=perPart?Number(all?.n||0):h.b||0;
  return {key:h.k??'',name:nameOf(x.by,h.k,byId),...(x.by==='region'?{ags:byId.get(h.k)?.ags||'',...(byId.get(h.k)?.members?.length?{members:byId.get(h.k).members.map(m=>m.ags).filter(Boolean)}:{})}:{}),count:h.n,base:b,share:b?Math.round(1000*h.n/b)/10:null,...(sums?{sum:sums.get(h.k)??0}:{}),...(medians?.has(h.k)?{median:medians.get(h.k)}:{})};})
  .sort((a,b)=>x.by==='month'?String(a.key).localeCompare(String(b.key)):b.count-a.count||String(a.key).localeCompare(String(b.key)));
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
  db.prepare(`SELECT p.case_key ck,p.card_id id,p.region_id region,c.title,c.gremium,p.date,p.status,p.stage,p.subs,p.cards times FROM (SELECT ${distinct}x.* FROM ${from} ${join} WHERE ${cond} ORDER BY x.date DESC,x.case_key LIMIT ? OFFSET ?) p JOIN search_cards c ON c.id=p.card_id ORDER BY p.date DESC,p.case_key`).bind(...args,...jargs,...sel.args,X_LIST_SIZE,x.offset).all(),
  counted?db.prepare(`SELECT count(${distinct}x.case_key) n FROM ${from} ${join} WHERE ${cond}`).bind(...args,...jargs,...sel.args).first():null,
 ]);
 const byId=new Map(catalog.map(r=>[r.id,r])),name=r=>byId.get(r)?.name||r;
 // Wert des Vorgangs zum gewählten Fakt (bei mehreren, etwa Grundsteuer A und B, alle verschiedenen)
 const values=new Map();
 if(x.fact&&X_FACT_NUM[x.fact]&&results.length){
  const {results:fs}=await db.prepare(`SELECT rr.case_key ck,f.value v,f.detail d FROM topic_facts f JOIN report_rules rr ON rr.topic_id=f.topic_id ${NEWEST_JOIN} WHERE f.kind=? AND rr.case_key IN (SELECT value FROM json_each(?))${x.value!==''?' AND f.value=?':''} ${NEWEST_ORDER}`).bind(x.fact,JSON.stringify(results.map(r=>r.ck)),...(x.value!==''?[x.value]:[])).all();
  for(const f of fs){const num=factNum(x.fact,f.d);if(!num)continue;const t=fmtNum(num.v,num.unit),l=values.get(f.ck)||[];if(!l.includes(t))l.push(t);values.set(f.ck,l);}
 }
 return {offset:x.offset,size:X_LIST_SIZE,total:Number(count?.n||0),
  items:results.map(r=>({id:r.id,title:r.title,region:placeOf(name(r.region),r.title,r.gremium,byId.get(r.region)?.members).label,date:String(r.date).slice(0,10),status:r.status,gremium:r.gremium||undefined,
   stage:r.stage||null,subs:r.subs?r.subs.split(','):[],times:r.times,...(values.has(r.ck)?{value:values.get(r.ck).slice(0,3).join(' · ')}:{})}))};
}

/** Atlas: alle Gliederungen einer Auswahl in einer Antwort (ohne Thema: je Thema, mit Thema: je Unterthema) */
async function xAtlas(db,catalog,params,x,opts,state){
 const src=await source(db,catalog,x.f);
 const memo=new Map(),pre=await groupsAtOnce(db,src,x,x.theme?['month','region']:['theme','month','region']);
 const at=(by,sum)=>{const p=new URLSearchParams(params);p.delete('view');p.set('by',by);if(sum)p.set('sum',sum);return xQuery(db,catalog,p,{src,memo,...(sum?{}:{pre})});};
 // Werte aus den Unterlagen: nur auf Anfrage (facts=1; die Seite zeigt sie seit 14.10.2026 nicht, SHOW_FACTS in XAtlasView.tsx)
 // und nur, was das Qualitätstor erreicht (gesperrte Summen entfallen, der Wert bleibt)
 const wanted=params.get('facts')!=='1'?[]:(ATLAS_FACTS[x.theme]||[]).filter(([k])=>X_FACT_GATE[k]).map(([k,sum])=>[k,sum&&X_SUM_GATE[sum]?sum:'']);
 const [parts,months,regions,recent,maps,...facts]=await Promise.all([at(x.theme?'sub':'theme'),at('month'),at('region'),
  xList(db,catalog,{...x,by:'region',value:'',offset:0},{count:false,src}),factMaps(db,catalog,src,x,wanted.map(([k])=>k)),...wanted.map(([k,sum])=>at('fact:'+k,sum))]);
 return {selection:parts.selection,total:parts.total,unread:parts.unread,builtAt:state.builtAt,parts:parts.rows,months:months.rows,
  regions:regions.rows,recent:recent.items.slice(0,10),
  facts:facts.map((f,i)=>({kind:wanted[i][0],name:X_FACT_NAMES[wanted[i][0]],sum:f.sum||null,rows:f.rows,map:maps.get(wanted[i][0])||[]})).filter(f=>f.rows.length),compare:await xCompare(db,catalog,x,params,opts)};
}

/* Mehrere einfache Gliederungen (Thema, Monat, Ort) in einem Durchgang: die Auswahl einmal lesen (über den schlanken Index
   idx_x_cases_atlas, drizzle/0045), dann je Gliederung zählen. Dieselben Zahlen wie je Gliederung einzeln, statt dreimal
   alle Vorgänge zu lesen (Server 16.10.2026: ohne Begriff 1,0 statt 0,35 s, rat 2,0 statt 0,8 s). */
async function groupsAtOnce(db,src,x,bys){
 const sel=selection(x),cond=sel.where.join(' AND ');
 const cols=[...new Set(bys.map(b=>KEY[b]))].map(c=>`${c} ${c.slice(2)}`).join(',');
 const parts=bys.map(b=>`SELECT '${b}' g,${KEY[b].slice(2)} k,sum(h) n,count(*) b,sum(h*unread) u FROM s GROUP BY k`).join(' UNION ALL ');
 const {results}=await db.prepare(`WITH s AS MATERIALIZED (SELECT ${cols},x.unread unread,CASE WHEN ${cond} THEN 1 ELSE 0 END h FROM ${src.from}) ${parts}`).bind(...sel.args,...src.args).all();
 const out=Object.fromEntries(bys.map(b=>[b,[]]));
 for(const r of results)out[r.g].push({k:r.k,n:r.n,b:r.b,u:r.u});
 return out;
}

/** plenara.X Fakten: Orte (für Schlüssel und Mitgliedsgemeinden) und je freigegebenem Fakt die Werte je Gebiet */
async function xFakten(db,catalog,params,x,state){
 const src=await source(db,catalog,x.f),kinds=MAP_FACTS.filter(([,,on])=>on);
 const p=new URLSearchParams(params);p.delete('view');p.set('by','region');
 const [regions,maps,we]=await Promise.all([xQuery(db,catalog,p,{src}),factMaps(db,catalog,src,x,kinds.map(([k])=>k).filter(k=>k!=='housing')),
  kinds.some(([k])=>k==='housing')?housingMap(db,src,x):[]]);
 if(we.length)maps.set('housing',we);
 return {builtAt:state.builtAt,regions:regions.rows,facts:kinds.map(([kind,dir])=>({kind,dir,name:MAP_FACT_NAMES[kind],map:maps.get(kind)||[]})).filter(f=>f.map.length)};
}

/** Wohneinheiten je Gebiet: Summe der geplanten Wohneinheiten (je Vorgang der größte Wert; dieselbe Zahl in mehreren Schritten eines Plans zählt einmal), je 1.000 Einwohner; ohne Einwohnerzahl
    kein Eintrag (sonst lägen große Städte immer vorn) */
async function housingMap(db,src,x){
 const sel=selection(x);
 const {results}=await db.prepare(`SELECT x.region_id g,count(*) n,sum(DISTINCT sv.v) s FROM ${src.from} ${SUM_JOIN} WHERE ${sel.where.join(' AND ')} GROUP BY x.region_id`).bind(...src.args,'housing',...sel.args).all();
 return results.filter(r=>POPULATION[r.g]).map(r=>({key:r.g,n:r.n,v:{Wohneinheiten:{n:r.n,median:Math.round(10000*r.s/POPULATION[r.g])/10,unit:'je 1.000 Einwohner',sum:r.s}}}));
}

/* Jüngster Wert (Median der Vorgänge am letzten Sitzungstag) und der davor (letzter Tag mit anderem Wert): für „steht heute“
   und „steigt oder fällt“ in plenara.X Fakten */
function latest(nums){
 const days=[...new Set(nums.map(u=>u.dt))].sort().reverse(),at=d=>median(nums.filter(u=>u.dt===d).map(u=>u.v));
 const last=at(days[0]),prevDay=days.slice(1).find(d=>at(d)!==last);
 return {last,lastDate:days[0],...(prevDay?{prev:at(prevDay),prevDate:prevDay}:{})};
}

/** Karte der Werte: je Fakt und Gebiet die Zahl der Vorgänge mit Wert (n) und je Wert mit Zahl der Median (v: Wert → {n, median, unit}).
    In Gemeindeverbänden gehört ein Vorgang zur Mitgliedsgemeinde, die Gremium oder Titel nennen (where, wie in den Listen): dann
    ein eigener Eintrag mit ihrem Gemeindeschlüssel (ags), sonst gilt er für den Verband. */
async function factMaps(db,catalog,src,x,kinds){
 const out=new Map();if(!kinds.length)return out;
 const sel=selection(x),byId=new Map(catalog.map(r=>[r.id,r]));
 /* Von den Fakten aus (wenige) und je Fakt den Vorgang über seinen Schlüssel nachschlagen, statt erst alle Vorgänge der Auswahl
    abzulegen und dafür jedes Mal ein Hilfsregister zu bauen (Server 16.10.2026: 2,0 s). CROSS JOIN hält die Reihenfolge fest. Je Vorgang zählt der Wert der jüngsten Sitzung (NEWEST_ORDER). */
 const {results}=await db.prepare(`SELECT x.region_id g,x.card_id card,x.date dt,rr.case_key ck,f.kind kind,f.value v,f.detail d FROM topic_facts f CROSS JOIN report_rules rr ON rr.topic_id=f.topic_id CROSS JOIN ${src.from} ON x.case_key=rr.case_key ${NEWEST_JOIN} WHERE f.kind IN (SELECT value FROM json_each(?)) AND ${sel.where.join(' AND ')} ${NEWEST_ORDER}`).bind(...src.args,JSON.stringify(kinds),...sel.args).all();
 // Mitgliedsgemeinde je Vorgang, nur in Verbänden
 const cards=[...new Set(results.filter(r=>byId.get(r.g)?.members?.length).map(r=>r.card))],member=new Map();
 if(cards.length){
  const {results:cs}=await db.prepare('SELECT id,region_id g,title,gremium FROM search_cards WHERE id IN (SELECT value FROM json_each(?))').bind(JSON.stringify(cards)).all();
  for(const c of cs){const r=byId.get(c.g),w=placeOf(r.name,c.title,c.gremium,r.members);const m=w.key&&r.members.find(x=>x.name===w.key||x.name.replace(/\s*\(.*\)$/,'')===w.key);if(m?.ags)member.set(c.id,m.ags);}
 }
 const by=new Map();
 for(const r of results){
  const ags=member.get(r.card)||'',key=r.g+'|'+ags;
  const k=by.get(r.kind)||new Map();by.set(r.kind,k);const g=k.get(key)||{g:r.g,ags,cases:new Set(),v:new Map()};k.set(key,g);g.cases.add(r.ck);
  let num=factNum(r.kind,r.d);if(!num)continue;
  // Haushalt je Einwohner: nur mit Einwohnerzahl des Gebiets, nicht für genannte Mitgliedsgemeinden
  if(r.kind==='budget'){if(ags||!POPULATION[r.g])continue;num={v:Math.round(num.v/POPULATION[r.g]),unit:'€ je Einwohner'};}const vv=g.v.get(r.v)||new Map();g.v.set(r.v,vv);if(!vv.has(r.ck))vv.set(r.ck,{...num,dt:String(r.dt||'').slice(0,10)});
 }
 for(const [kind,k] of by)out.set(kind,[...k.values()].map(({g,ags,cases,v})=>({key:g,...(ags?{ags}:{}),n:cases.size,v:Object.fromEntries([...v].map(([val,m])=>{const nums=[...m.values()],unit=nums[0].unit,vs=nums.filter(u=>u.unit===unit).map(u=>u.v);return [val,{n:vs.length,median:median(vs),unit,...latest(nums.filter(u=>u.unit===unit))}];}))})));
 return out;
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

/** Ein Zwischenspeicher für alle plenara.X-Routen: je Art, Parameter und Bau von x_cases (X_REVISION_SQL) einmal gerechnet;
    nach einem neuen Bau kommt kurz der alte Stand, während im Hintergrund neu gerechnet wird (atRevisionStale). */
export function xCached(db,kind,params,compute){
 return atRevisionStale(db,paramsKey(kind,params),async()=>(await xOffload(kind,params))??compute(),{revisionSql:X_REVISION_SQL});
}

/* Platzhalter statt Gremium: nur „Gremium“ oder „Gremium laut Originalquelle“, auch mehrfach mit Komma; echte Namen wie
 * „Gremium für Verkehrsfragen“ bleiben. Eine Regel für Themennetz, Ortsvergleich, Gremiennetz und Newsradar. */
export const PLACEHOLDER=/^\s*gremium(?: laut originalquelle)?(?:\s*,\s*gremium(?: laut originalquelle)?)*\s*$/i;
