/**
 * plenara.X Auszug für die öffentlichen Anwenderseiten (GET /api/x/teaser?id=…), nur fest gewählte Auszüge und nur die Zusammenfassung:
 * Signal (letzte 6 Monate: Zahl, Orte, Stände, Punkte für die Karte, die 3 neuesten Vorhaben, wie xSignals) oder Wert aus den Unterlagen
 * (übliche Spanne, Median, höher/niedriger seit dem vorigen Wert, wie die Fakten-Seite) oder die 3 berichtenswertesten Meldungen der
 * letzten 30 Tage zu einem Begriff (wie Aktuelles, für die Kopfkarte je Chip), die stärksten aufsteigenden Begriffe (wie Trends), die
 * häufigsten Übergänge zwischen Gremien mit Tagen (wie Gremien) oder Anteile beschlossen/vertagt/abgelehnt mit Dauer (wie Ausgang). Listen, Filter und Blättern bleiben Plus.
 * Kein eigenes Datenmodell.
 */
import {xSignals} from './plenara-x-signals.mjs';
import {AnalyticsError} from './analytics-diffusion.mjs';
import {xQuery} from './plenara-x-query.mjs';
import {news as xNews} from './analytics-news.mjs';
import {trends as xTrends} from './analytics-trends.mjs';
import {network as xNetwork} from './analytics-network.mjs';
import {decisions as xDecisions} from './analytics-decisions.mjs';
import {xOffload} from './x-offload.mjs';

/** Freigegebene Auszüge: Schlüssel → Signal (und Art) */
export const TEASERS={
 wohnbau:{signal:'wohnbau'},gewerbe:{signal:'gewerbe'},waerme:{signal:'waerme'},wind:{signal:'wind'},solar:{signal:'solar'},
 planung:{signal:'vergaben',art:'Planungsleistungen'},grundsteuer:{fakt:'hebesatz',wert:'Grundsteuer B'},
 'news-top':{news:{}},'trend-umwelt':{trend:{label:'Umwelt, Klima & Energie'}},'trend-alle':{trend:{}},netz:{netz:{}},ausgang:{ausgang:{}},gewerbesteuer:{fakt:'hebesatz',wert:'Gewerbesteuer'},vergaben:{signal:'vergaben'},schulen:{signal:'schulen'},mobil:{signal:'mobil'},
};
export const TEASER_MONTHS=6;
/* Schritte ohne Aussage: solche Vorhaben kommen in der Kopfkarte und den neuesten Vorhaben nach hinten */
const VAGE=new Set(['Sonstiger Schritt','Maßnahme']);
/* Kurzfassung mit eigenem Inhalt aus der Vorlage (nicht nur der Titel oder ein Standardsatz der Karte) */
const STANDARD=/Ein Beschluss ist dokumentiert|Der Stand ist noch offen|Die Details stehen in den verlinkten|Es liegt eine Empfehlung/;
export const inhalt=(i)=>{const t=(i.teaser||'').trim(),h=(i.title||'').trim();return t.length>=40&&!STANDARD.test(t)&&!t.startsWith(h.slice(0,Math.min(40,h.length)));};

const isoDay=(d)=>d.toISOString().slice(0,10);
export function teaserParams(id,today=new Date()){
 const t=TEASERS[id];if(!t)throw new AnalyticsError('Unbekannter Auszug.',400);
 if(t.fakt)return new URLSearchParams({view:'fakten',fakt:t.fakt,scope:'with',level:'city',noformal:'1'});
 if(t.news){const p=new URLSearchParams({days:'30',n:'3',scope:'with',level:'city',noformal:'1'});if(t.news.q)p.set('q',t.news.q);if(t.news.label)p.set('label',t.news.label);return p;}
 const rest=t.trend||t.netz||t.ausgang;
 if(rest){const p=new URLSearchParams({scope:'with',level:'city',noformal:'1'});if(rest.label)p.set('label',rest.label);return p;}
 const from=new Date(today);from.setMonth(from.getMonth()-TEASER_MONTHS);
 const p=new URLSearchParams({signal:t.signal,from:isoDay(from),to:isoDay(today),scope:'with',level:'city',noformal:'1'});
 if(t.art)p.set('art',t.art);
 return p;
}

/* Wie die Fakten-Seite (FaktenPage.tsx: mid, quart): Median und mittlere Hälfte der jüngsten Werte je Gebiet */
const mid=v=>{const s=[...v].sort((a,b)=>a-b),m=s.length>>1;return s.length%2?s[m]:(s[m-1]+s[m])/2;};
const quart=(v,q)=>{const s=[...v].sort((a,b)=>a-b);return s[Math.min(s.length-1,Math.floor(q*s.length))];};

/* Die Rechnung im plenara.X-Worker (x-offload.mjs, Arten wie in x-registry.mjs): serve.mjs fragt nach jedem Bau alle
   Auszüge nacheinander ab, das hielt den Hauptprozess bis dahin sekundenlang an. Ohne Worker rechnet der Prozess selbst. */
const inWorker=(kind,fn)=>async(db,catalog,params)=>(await xOffload(kind,params))??fn(db,catalog,params);
const SIGNALS=inWorker('x-signale-v9',xSignals),QUERY=inWorker('x-v7',xQuery),NEWS=inWorker('news',xNews),
 TRENDS=inWorker('trends',xTrends),NETWORK=inWorker('network',xNetwork),DECISIONS=inWorker('decisions',xDecisions);
export async function xTeaser(db,catalog,id,{today=new Date(),signals=SIGNALS,query=QUERY,newsFn=NEWS,trendsFn=TRENDS,networkFn=NETWORK,decisionsFn=DECISIONS}={}){
 const t=TEASERS[id];
 if(t?.trend){
  const r=await trendsFn(db,catalog,teaserParams(id,today));
  return {id,trend:true,label:t.trend.label||'',window:r.window,items:(r.rising||[]).slice(0,5).map(x=>({term:x.term,count:x.nr,ratio:x.ratio,regions:x.regions,regionsPrev:x.regionsPrev}))};
 }
 if(t?.netz){
  const r=await networkFn(db,catalog,teaserParams(id,today));
  return {id,netz:true,paths:r.paths,items:[...(r.edges||[])].sort((a,b)=>b.n-a.n).slice(0,4).map(e=>({from:e.a,to:e.b,count:e.n,days:e.days}))};
 }
 if(t?.ausgang){
  const r=await decisionsFn(db,catalog,teaserParams(id,today));
  return {id,ausgang:true,decided:r.totals?.decided??0,approval:r.rates?.approval??null,postponement:r.rates?.postponement??null,rejection:r.rates?.rejection??null,
   median:r.duration?.median??null,unanimous:r.votes?.all?.unanimous??null};
 }
 if(t?.news){
  const r=await newsFn(db,catalog,teaserParams(id,today));
  return {id,news:true,q:t.news.q||'',items:(r.items||[]).slice(0,3).map(i=>({id:i.id,headline:i.headline,place:i.dateline?.place||i.place||'',committee:i.dateline?.committee||'',date:i.dateline?.date||'',quote:i.quote||''}))};
 }
 if(t?.fakt){
  const r=await query(db,catalog,teaserParams(id,today));
  const f=(r.facts||[]).find(x=>x.kind===t.fakt),vals=(f?.map||[]).map(m=>m.v?.[t.wert]).filter(Boolean);
  const lasts=vals.map(x=>x.last??x.median),moved=vals.filter(x=>x.prev!==undefined&&x.prev!==null&&x.prev!==(x.last??x.median));
  return {id,fakt:t.fakt,wert:t.wert,name:f?.name||'',unit:vals[0]?.unit||'',builtAt:r.builtAt||null,count:lasts.length,
   median:lasts.length?mid(lasts):null,q1:lasts.length?quart(lasts,0.25):null,q3:lasts.length?quart(lasts,0.75):null,
   up:moved.filter(x=>(x.last??x.median)>x.prev).length,down:moved.filter(x=>(x.last??x.median)<x.prev).length};
 }
 const r=await signals(db,catalog,teaserParams(id,today));
 return {id,signal:r.signal?.id,name:r.signal?.name,art:TEASERS[id].art||null,months:TEASER_MONTHS,builtAt:r.builtAt||null,
  total:r.total,placeCount:r.placeCount??r.places?.length??0,firstCount:r.firstCount??0,phases:r.phases||[],
  places:(r.places||[]).map(p=>({ags:p.ags,count:p.count,...(p.members?{members:p.members}:{})})),
  items:[...(r.items||[])].map(i=>({i,rank:Number(!i.phase||VAGE.has(i.phase))+2*Number(!inhalt(i))})).sort((a,b)=>a.rank-b.rank).slice(0,3)
   .map(({i})=>({id:i.id,date:i.date,status:i.status,title:i.title,place:i.gemeinde||'',phase:VAGE.has(i.phase)?'':i.phase||'',teaser:inhalt(i)?i.teaser.slice(0,240):''}))};
}
