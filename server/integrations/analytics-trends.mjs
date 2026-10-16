import {LABELS} from '../../shared/labels.mjs';
import {parseMonitorSearch} from './monitor-search.mjs';
import {source,xState,FIRST_DATE} from './plenara-x-query.mjs';
import {AnalyticsError,dataStarts} from './analytics-diffusion.mjs';
import {tokens,FORMAL_ALL} from './analytics-graph.mjs';
import {parseTerms} from './x-terms.mjs';
import {listPage,offsetOf} from './analytics-lists.mjs';

/*
 * Plenara.X – Trends: Welche Begriffe nehmen gegenüber dem Zeitraum davor zu, ab oder tauchen neu auf?
 * Verglichen werden zwei gleich lange Zeitfenster (die letzten W Tage und die W Tage davor). Gezählt werden Vorgänge wie überall in
 * plenara.X: Auswahl über die Suche (source), gezählt in x_cases (ein Sachvorgang je Zeile, ohne Formalien, gleiche Titel je Gebiet
 * einmal), Titel aus der Karte des Vorgangs. Alle Vorgänge je Fenster, keine Stichprobe. Verglichen werden Anteile an den Einträgen, nicht Rohzahlen; Maß ist ein Zwei-Stichproben-z-Test für Anteile.
 * Private Bauanträge zählen nicht.
 */
const WINDOWS=[30,90,180],MIN_RECENT=5,RATIO=1.4,Z_MIN=2.5,LIST=15;
const DAY=86400000;
const iso=d=>new Date(d).toISOString().slice(0,10);

export function parseTrends(params){
 const copy=new URLSearchParams(params);for(const k of ['by','value','offset','span','part','keys'])copy.delete(k);
 /* Der Zeitraum kommt aus dem Fenster, nicht aus der Suche */
 for(const k of ['from','to','month'])copy.delete(k);
 let f;
 try{f=parseMonitorSearch(copy);}catch(e){throw new AnalyticsError(e.message,e.status||400);}
 if(f.groups.flat().some(w=>w.length<3))throw new AnalyticsError('Jedes Suchwort braucht mindestens 3 Buchstaben.');
 const raw=params.get('window')||'90';
 if(!/^\d+$/.test(raw)||!WINDOWS.includes(Number(raw)))throw new AnalyticsError('Ungültiges Zeitfenster.');
 return {f,window:Number(raw)};
}

const labelName=id=>LABELS.find(l=>l.id===id)?.name||null;

export async function trends(db,catalog,params,now=Date.now()){
 const {f,window:W}=parseTrends(params);
 if(!(await xState(db)))throw new AnalyticsError('Die Zahlen für plenara.X werden gerade aufgebaut. Bitte später erneut versuchen.',503);
 const src=await source(db,catalog,f,{terms:true,noPrivate:true});
 const end=iso(now+DAY),mid=iso(now+DAY-W*DAY),start=iso(now+DAY-2*W*DAY);
 /* Je Fenster: alle Vorgänge, dazu ihre Titel */
 const load=async(a,b)=>{
  const range='x.date>=? AND x.date<?';
  // Alle Vorgänge des Fensters, keine Stichprobe
  // Begriffe liegen je Vorgang in x_cases (beim Bau aus dem Titel), private Bauanträge filtert source (noPrivate)
  const {results:pick}=await db.prepare(`SELECT x.card_id id,x.date,x.region_id,x.label,x.terms FROM ${src.from} WHERE ${range}`).bind(...src.args,a,b).all();
  const total=pick.length,k=1;
  const rows=pick;
  return {total,rows,k};
 };
 const [recent,prev]=[await load(mid,end),await load(start,mid)];
 const Sr=recent.rows.length,Sp=prev.rows.length;
 const exclude=new Set(f.groups.flat());
 const weeks=Math.ceil(2*W/7),t0=Date.parse(start+'T00:00:00Z');
 const bucket=d=>Math.min(weeks-1,Math.max(0,Math.floor((Date.parse(d.slice(0,10)+'T00:00:00Z')-t0)/(7*DAY))));
 const sizes=Array(weeks).fill(0);
 /* Begriffe: Karten je Fenster, Gebiete je Fenster, Karten je Woche */
 const stat=new Map();
 const scan=(rows,which)=>{
  for(const r of rows){
   const b=bucket(r.date);sizes[b]++;
   for(const [key,word] of parseTerms(r.terms)){
    // Wörter des Sitzungsbetriebs (Wahl, Bestellung, Sachstand …) sind kein Trend
    if(exclude.has(key)||FORMAL_ALL.has(key))continue;
    let s=stat.get(key);if(!s){s={word,nr:0,np:0,rr:new Set(),rp:new Set(),wk:Array(weeks).fill(0)};stat.set(key,s);}
    if(which==='r'){s.nr++;s.rr.add(r.region_id);}else{s.np++;s.rp.add(r.region_id);}
    s.wk[b]++;
   }
  }
 };
 scan(recent.rows,'r');scan(prev.rows,'p');
 const regionsRecent=new Set(recent.rows.map(r=>r.region_id)).size;
 const minRegions=Math.min(3,regionsRecent);
 const one=(key,s)=>{
  const pr=s.nr/Math.max(1,Sr),pp=s.np/Math.max(1,Sp);
  const pool=(s.nr+s.np)/Math.max(1,Sr+Sp),se=Math.sqrt(pool*(1-pool)*(1/Math.max(1,Sr)+1/Math.max(1,Sp)))||1e-9;
  const eps=0.5/Math.max(1,Sr,Sp);
  return {term:s.word,key,nr:s.nr,np:s.np,ratio:Math.round(((pr+eps)/(pp+eps))*100)/100,z:Math.round(((pr-pp)/se)*10)/10,regions:s.rr.size,regionsPrev:s.rp.size,series:s.wk.map((n,i)=>sizes[i]?Math.round((n/sizes[i])*10000)/10000:0)};
 };
 const all=[...stat].filter(([,s])=>s.nr+s.np>=MIN_RECENT).map(([k,s])=>one(k,s));
 /* Neu: im Zeitraum davor (fast) nicht vorhanden, jetzt in mehreren Gebieten */
 const emerging=all.filter(t=>t.nr>=MIN_RECENT+1&&t.np<=Math.max(1,Math.floor(t.nr*0.15))&&t.regions>=minRegions).sort((a,b)=>b.nr-a.nr||b.z-a.z).slice(0,10);
 const isNew=new Set(emerging.map(t=>t.key));
 const rising=all.filter(t=>!isNew.has(t.key)&&t.nr>=MIN_RECENT&&t.ratio>=RATIO&&t.z>=Z_MIN).sort((a,b)=>b.z-a.z).slice(0,LIST);
 const falling=all.filter(t=>t.np>=MIN_RECENT&&t.ratio<=1/RATIO&&t.z<=-Z_MIN).sort((a,b)=>a.z-b.z).slice(0,10);
 /* Themenfelder: Anteil je Fenster */
 const share=(rows)=>{const m=new Map();for(const r of rows)m.set(r.label,(m.get(r.label)||0)+1);return m;};
 const tr=share(recent.rows),tp=share(prev.rows);
 const topics=LABELS.filter(l=>l.id!=='unklar').map(l=>{
  const a=(tr.get(l.id)||0)/Math.max(1,Sr),b=(tp.get(l.id)||0)/Math.max(1,Sp);
  return {id:l.id,name:l.name,recent:Math.round(a*10000)/100,prev:Math.round(b*10000)/100,change:Math.round((a-b)*10000)/100,n:tr.get(l.id)||0};
 }).filter(t=>t.n>0||t.prev>0).sort((a,b)=>b.change-a.change);
 return {
  q:f.q,window:W,ranges:{prevStart:start,start:mid,end:iso(now)},weeks,
  totals:{recent:recent.total,prev:prev.total,sampledRecent:Sr,sampledPrev:Sp,capped:recent.k>1||prev.k>1,regions:regionsRecent,step:Math.max(recent.k,prev.k)},
  rising:rising,emerging:emerging,falling:falling,topics,
  all:all.filter(t=>t.nr>=MIN_RECENT).sort((a,b)=>b.nr-a.nr).slice(0,80),
 };
}

/** Liste hinter einem Begriff: by=term&value=Begriff (Schlüssel), span=recent (Standard) oder prev; alle Vorgänge */
export async function trendList(db,catalog,params,now=Date.now()){
 const key=params.get('value')||'';
 if(params.get('by')!=='term'||key.length<3)throw new AnalyticsError('Unbekannte Liste.',400);
 const {f,window:W}=parseTrends(params);
 const src=await source(db,catalog,f,{noPrivate:true});
 const end=iso(now+DAY),mid=iso(now+DAY-W*DAY),start=iso(now+DAY-2*W*DAY);
 const [a,b]=params.get('span')==='prev'?[start,mid]:[mid,end];
 // Dieselben Vorgänge wie in der Zählung (x_cases), Begriff im Titel
 const {results}=await db.prepare(`SELECT c.id,x.region_id region,c.title,c.gremium,x.date,x.status FROM ${src.from} JOIN search_cards c ON c.id=x.card_id WHERE x.date>=? AND x.date<? AND c.search LIKE ? ORDER BY x.date DESC`).bind(...src.args,a,b,'%'+key+'%').all();
 const rows=results.filter(r=>tokens(r.title).has(key));
 return listPage(rows,catalog,offsetOf(params));
}

/**
 * Ausbreitung je Begriff für die Seite Trends (part=spread&keys=a,b,…): je Begriff und Gebiet die erste Sitzung des frühesten
 * Vorgangs mit dem Begriff im Titel (FIRST_DATE, wie die Ausbreitung), über den ganzen Bestand bis heute, gleiche Auswahl wie die
 * Trends (Suche, ohne private Bauanträge). „Neu erreicht“ zählt ein Gebiet, dessen erste Sitzung im aktuellen Zeitraum liegt und
 * dessen Bestand vor dem Zeitraum davor beginnt (neu angebundene Gebiete wären sonst überall „neu“).
 */
const CHUNK=20000;
const KEY=/^[\p{L}\d][\p{L}\d-]{2,40}$/u,MAX_KEYS=40;
export async function trendSpread(db,catalog,params,now=Date.now()){
 const {f,window:W}=parseTrends(params);
 const keys=[...new Set((params.get('keys')||'').split(',').filter(k=>KEY.test(k)))].slice(0,MAX_KEYS);
 if(!keys.length)throw new AnalyticsError('Keine Begriffe.',400);
 if(!(await xState(db)))throw new AnalyticsError('Die Zahlen für plenara.X werden gerade aufgebaut. Bitte später erneut versuchen.',503);
 const src=await source(db,catalog,f,{terms:true,noPrivate:true});
 const end=iso(now+DAY),mid=iso(now+DAY-W*DAY),start=iso(now+DAY-2*W*DAY);
 // Begriffe stehen je Vorgang als Zeilen „Schlüssel<TAB>Wort“ in x_cases.terms. Ein Durchgang in Stücken (nach case_key) und
 // der Abgleich in JS ist um ein Vielfaches schneller als je Begriff eine Textsuche über alle Vorgänge.
 const want=new Set(keys),first=new Map(keys.map(k=>[k,new Map()]));
 const scan=async()=>{
  let after='';
  for(;;){
   const {results}=await db.prepare(`SELECT x.case_key c,x.region_id r,substr(${FIRST_DATE},1,10) d,x.terms t FROM ${src.from} WHERE x.case_key>? AND x.terms<>'' ORDER BY x.case_key LIMIT ${CHUNK}`).bind(...src.args,after).all();
   for(const row of results)for(const line of row.t.split('\n')){
    const k=line.slice(0,line.indexOf('\t'));if(!want.has(k))continue;
    const m=first.get(k),o=m.get(row.r);if(!o||row.d<o)m.set(row.r,row.d);
   }
   if(results.length<CHUNK)break;
   after=results.at(-1).c;
  }
 };
 const [,starts]=await Promise.all([scan(),dataStarts(db)]);
 /* Zwölf Monatsenden bis heute: erreichte Gebiete kumuliert */
 const months=[];for(let i=11;i>=0;i--){const d=new Date(now);d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()-i+1);d.setUTCDate(0);months.push(iso(Math.min(d.getTime(),now)));}
 const byKey=new Map();
 for(const [k,m] of first)byKey.set(k,[...m]);
 const fresh=(r,d)=>d>=mid&&d<end&&(starts.get(r)||'9999').slice(0,10)<start;
 const moving=new Map(),seen=new Set();
 const terms=keys.map(k=>{
  const list=byKey.get(k).sort((a,b)=>a[1].localeCompare(b[1]));
  const added=list.filter(([r,d])=>fresh(r,d));
  for(const [r] of added)moving.set(r,(moving.get(r)||0)+1);
  for(const [r] of list)seen.add(r);
  return {key:k,reached:list.length,added:added.length,first:list[0]?.[1]||null,curve:months.map(m=>list.filter(([,d])=>d<=m).length),regions:list};
 });
 /* Gebiete: Schlüssel des Katalogs → Name und Kartenflächen (Gemeinden, bei Verbänden die Mitglieder) */
 const byId=new Map(catalog.map(r=>[r.id,r])),places={};
 for(const id of seen){const r=byId.get(id);if(r)places[id]={name:r.name,ags:r.members?.length?r.members.map(m=>m.ags):r.formerAgs??[r.ags]};}
 return {window:W,ranges:{prevStart:start,start:mid,end:iso(now)},months,terms,moving:Object.fromEntries(moving),places};
}
