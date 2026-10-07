import {LABELS} from '../../shared/labels.mjs';
import {parseMonitorSearch,searchFilters} from './monitor-search.mjs';
import {AnalyticsError} from './analytics-diffusion.mjs';
import {tokens} from './analytics-graph.mjs';

/*
 * Plenara.X – Trends und Frühindikatoren: Welche Begriffe nehmen gegenüber dem Zeitraum davor zu, ab oder tauchen neu auf?
 * Verglichen werden zwei gleich lange Zeitfenster (die letzten W Tage und die W Tage davor). Je Fenster werden die Einträge der
 * Suche (dieselben Filter wie die Suche, ohne eigenen Zeitraum) gezählt und gleichmäßig (jede k-te Zeile) auf höchstens CAP Einträge
 * heruntergerechnet. Verglichen werden Anteile an den Einträgen, nicht Rohzahlen; Maß ist ein Zwei-Stichproben-z-Test für Anteile.
 */
const CAP=12000,WINDOWS=[30,90,180],MIN_RECENT=5,RATIO=1.4,Z_MIN=2.5,LIST=15;
const DAY=86400000;
const iso=d=>new Date(d).toISOString().slice(0,10);

export function parseTrends(params){
 const copy=new URLSearchParams(params);
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
 const {page}=await searchFilters(db,catalog,f);
 const end=iso(now+DAY),mid=iso(now+DAY-W*DAY),start=iso(now+DAY-2*W*DAY);
 const byId=new Map(catalog.map(r=>[r.id,r]));
 /* Je Fenster: Zahl der Einträge, dann gleichmäßige Stichprobe */
 const load=async(a,b)=>{
  const range=` AND date>=? AND date<? AND date<>''`;
  const total=(await db.prepare('SELECT count(*) n FROM search_cards WHERE '+page.where+range).bind(...page.args,a,b).first())?.n||0;
  const k=Math.max(1,Math.ceil(total/CAP));
  const {results}=await db.prepare('SELECT date,region_id,label,title FROM search_cards WHERE '+page.where+range+(k>1?' AND rowid % ? = 0':'')).bind(...page.args,a,b,...(k>1?[k]:[])).all();
  return {total,rows:results,k};
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
   for(const [key,word] of tokens(r.title)){
    if(exclude.has(key))continue;
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
 const strip=t=>{const {key,...rest}=t;return rest;};
 return {
  q:f.q,window:W,ranges:{prevStart:start,start:mid,end:iso(now)},weeks,
  totals:{recent:recent.total,prev:prev.total,sampledRecent:Sr,sampledPrev:Sp,capped:recent.k>1||prev.k>1,regions:regionsRecent},
  rising:rising.map(strip),emerging:emerging.map(strip),falling:falling.map(strip),topics,
  all:all.filter(t=>t.nr>=MIN_RECENT).sort((a,b)=>b.nr-a.nr).slice(0,80).map(strip),
 };
}
