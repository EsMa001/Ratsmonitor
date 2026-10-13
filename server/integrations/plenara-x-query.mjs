/*
 * plenara.X – eine Abfrage für alle Auswertungen (Plan requirements/regel-schritt-plan.md, Schritt 6; Konzept
 * requirements/plenara-x-konzept.md 5.6): Auswahl × Gliederung × Kennzahl, Route GET /api/x.
 *
 * Auswahl: dieselben Filter wie die Suche (q, area, scope, more, within, without, label, status, from, to, month, exact),
 *   dazu theme=<eines der 10 Themen>, sub=<Unterthema>, stage=<Was geschieht>.
 * Gliederung (by): region, month, theme, sub, stage, status.
 * Kennzahl: Vorgänge (count) und Anteil an allen Sachvorgängen derselben Gruppe unter denselben Filtern ohne Thema,
 *   Unterthema und „Was geschieht“ (share).
 * Liste hinter einer Zahl: list=1&by=…&value=…&offset=…
 *
 * Feste Regeln, überall gleich:
 *  - Gezählt werden Vorgänge (report_rules.case_key: Gebiet + normalisierter Titel), nicht Karten.
 *  - Nur Sachpunkte: Formalien, Sammelpunkte und Routine (itemKind) zählen nie. Ein noch nicht gelesener Bericht (ohne
 *    Zeile in report_rules) zählt als Sachpunkt, wenn seine Karte keine Formalie ist (search_cards.formal); ihm fehlen
 *    Unterthemen und „Was geschieht“ (unread in der Antwort).
 *  - Thema ist das Label der Karte, also dasselbe wie im Themenfilter der Suche (mit Einordnung von Hand und KI).
 *    Unterthemen zählen nur innerhalb ihres Themas.
 *  - Ohne Angabe `to` zählt nur bis heute.
 */
import {parseMonitorSearch,searchFilters} from './monitor-search.mjs';
import {THEMES,SUBTOPICS,subtopicName} from '../../shared/themes.mjs';
import {STAGES,SONST,stageName} from '../../shared/stage.mjs';
import {labelName} from '../../shared/labels.mjs';
import {AnalyticsError} from './analytics-diffusion.mjs';
import {where as placeOf} from './analytics-radar-extra.mjs';

export const X_BY=['region','month','theme','sub','stage','status'];
export const X_LIST_SIZE=50;
const THEME_IDS=new Set([...THEMES.map(t=>t.id),'unklar']),SUB_BY_ID=new Map(SUBTOPICS.map(s=>[s.id,s]));
const STAGE_IDS=new Set([...STAGES.map(s=>s.id),SONST]);
const OWN=['theme','sub','stage','by','list','value','offset'];

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
 if(!X_BY.includes(by))throw new AnalyticsError('Unbekannte Gliederung.');
 const offset=Math.max(0,Number(params.get('offset'))||0);
 return {f,theme:sub?SUB_BY_ID.get(sub).theme:theme,sub,stage,by,list:params.get('list')==='1',value:params.get('value')??'',offset};
}

const CASE="coalesce(r.case_key,c.region_id||'|'||lower(c.title))";
const SUBJECT="coalesce(r.item_kind,CASE WHEN c.formal=1 THEN 'formal' ELSE 'subject' END)='subject'";
/* Gruppenschlüssel je Gliederung; bei sub eine Zeile je Unterthema (json_each über die durch Komma getrennte Liste) */
const KEY={region:'c.region_id',month:'substr(c.date,1,7)',theme:'c.label',sub:'s.value',stage:"coalesce(r.stage,'')",status:'c.status'};
const SUB_JOIN=`JOIN json_each('["'||replace(coalesce(r.subs,''),',','","')||'"]') s ON s.value<>''`;

/* FROM-Teil: die Karten der Suche (eigene Unterabfrage, damit rowid und Spalten der Suche eindeutig bleiben), dazu report_rules */
async function source(db,catalog,f){
 const {page}=await searchFilters(db,catalog,f);
 return {from:`(SELECT * FROM search_cards WHERE ${page.where}) c LEFT JOIN report_rules r ON r.topic_id=c.id`,args:page.args};
}
function selection(x){
 const where=[SUBJECT],args=[];
 if(x.theme){where.push('c.label=?');args.push(x.theme);}
 if(x.sub){where.push("(','||coalesce(r.subs,'')||',') LIKE ?");args.push('%,'+x.sub+',%');}
 if(x.stage){where.push("coalesce(r.stage,'"+SONST+"')=?");args.push(x.stage);}
 return {where,args};
}
const nameOf=(by,key,byId)=>by==='region'?byId.get(key)?.name||key:by==='theme'?labelName(key):by==='sub'?subtopicName(key):by==='stage'?stageName(key||SONST):key;

/** Zahlen je Gruppe: Vorgänge der Auswahl, Sachvorgänge der Gruppe insgesamt, Anteil */
export async function xQuery(db,catalog,params){
 const x=parseX(params);
 if(x.list)return xList(db,catalog,x);
 const {from,args}=await source(db,catalog,x.f),sel=selection(x),key=KEY[x.by],join=x.by==='sub'?SUB_JOIN:'';
 const [hits,base,unread]=await Promise.all([
  db.prepare(`SELECT ${key} k,count(DISTINCT ${CASE}) n FROM ${from} ${join} WHERE ${sel.where.join(' AND ')} GROUP BY k`).bind(...args,...sel.args).all(),
  // Nenner: alle Sachvorgänge der Gruppe unter denselben Filtern (bei Unterthemen: alle Sachvorgänge des Themas)
  x.by==='sub'?null:db.prepare(`SELECT ${key} k,count(DISTINCT ${CASE}) n FROM ${from} WHERE ${SUBJECT} GROUP BY k`).bind(...args).all(),
  db.prepare(`SELECT count(DISTINCT ${CASE}) n FROM ${from} WHERE ${sel.where[0]} AND r.topic_id IS NULL`).bind(...args).first(),
 ]);
 const total=await db.prepare(`SELECT count(DISTINCT ${CASE}) n FROM ${from} WHERE ${sel.where.join(' AND ')}`).bind(...args,...sel.args).first();
 const all=x.by==='sub'?await db.prepare(`SELECT count(DISTINCT ${CASE}) n FROM ${from} WHERE ${SUBJECT}${x.theme?' AND c.label=?':''}`).bind(...args,...(x.theme?[x.theme]:[])).first():null;
 const baseBy=new Map((base?.results||[]).map(b=>[b.k,b.n])),byId=new Map(catalog.map(r=>[r.id,r]));
 const rows=hits.results.map(h=>{const b=x.by==='sub'?Number(all?.n||0):baseBy.get(h.k)||0;
  return {key:h.k??'',name:nameOf(x.by,h.k,byId),...(x.by==='region'?{ags:byId.get(h.k)?.ags||''}:{}),count:h.n,base:b,share:b?Math.round(1000*h.n/b)/10:null};})
  .sort((a,b)=>x.by==='month'?String(a.key).localeCompare(String(b.key)):b.count-a.count);
 return {selection:{theme:x.theme,sub:x.sub,stage:x.stage,q:x.f.q},by:x.by,total:Number(total?.n||0),unread:Number(unread?.n||0),rows};
}

/** Die Vorgänge hinter einer Zahl: je Vorgang einmal mit seiner jüngsten Sitzung, die jüngsten zuerst */
async function xList(db,catalog,x){
 const {from,args}=await source(db,catalog,x.f),sel=selection(x);
 const key=KEY[x.by],join=x.by==='sub'?SUB_JOIN:'';
 if(x.value!==''){sel.where.push(`${key}=?`);sel.args.push(x.value);}
 const cond=sel.where.join(' AND ');
 const [{results},count]=await Promise.all([
  db.prepare(`SELECT c.id,c.region_id region,c.title,c.gremium,max(c.date) date,c.status,r.stage,r.subs,count(*) times FROM ${from} ${join} WHERE ${cond} GROUP BY ${CASE} ORDER BY date DESC LIMIT ? OFFSET ?`).bind(...args,...sel.args,X_LIST_SIZE,x.offset).all(),
  db.prepare(`SELECT count(DISTINCT ${CASE}) n FROM ${from} ${join} WHERE ${cond}`).bind(...args,...sel.args).first(),
 ]);
 const byId=new Map(catalog.map(r=>[r.id,r])),name=r=>byId.get(r)?.name||r;
 return {offset:x.offset,size:X_LIST_SIZE,total:Number(count?.n||0),
  items:results.map(r=>({id:r.id,title:r.title,region:placeOf(name(r.region),r.title,r.gremium,byId.get(r.region)?.members).label,date:String(r.date).slice(0,10),status:r.status,
   stage:r.stage||null,subs:r.subs?r.subs.split(','):[],times:r.times}))};
}
