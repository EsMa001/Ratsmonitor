/*
 * plenara.X Signale (Kategorien und Filter: docs/produkt/plenara-x-signale.md): neue Ereignisse je Branche als Liste, nicht
 * als Anteil. 10 Kategorien, je Kategorie ein Filter („Art“) und der Stand. Route GET /api/x/signale. Je Signal die Sachvorgänge (x_cases) mit passenden Fakten (topic_facts aus readReport),
 * die jüngsten zuerst, mit Ort, Stand und Kennzahlen (Fläche, Wohneinheiten, Anlagen, Leistung, Preis, Kosten).
 *
 * Parameter: dieselben Filter wie die Suche (area, scope, from, to, q …), signal=<id>, phase=<Stand>, art=<Filterwert>, offset=<n>.
 * Stand: bei Bauleitplänen der Verfahrensschritt (Fakt plan), bei Vergaben Ausschreibung/Vergabe/Nachtrag, bei Wind Planung/Genehmigung/Betrieb, bei Wärme der Schritt der Wärmeplanung, sonst „Was geschieht“.
 * Antwort: {signals:[{id,name,count}], signal, phases:[{key,name,count}], arts:[{key,name,count}], placeCount, places:[{region,name,ags,count}] (höchstens 300), total, items, builtAt}
 */
import {parseX,source,xState} from './plenara-x-query.mjs';
import {stageName} from '../../shared/stage.mjs';
import {AnalyticsError} from './analytics-diffusion.mjs';
import {where as placeOf} from './member-place.mjs';
import {cardsById} from './monitor-search.mjs';

const F=`SELECT DISTINCT rr.case_key ck FROM topic_facts f JOIN report_rules rr ON rr.topic_id=f.topic_id WHERE`;
/* Filterwerte („Art“) je Vorgang: Zeilen (ck, a) aus Fakten; mehrere Werte je Vorgang möglich */
const A=(kind,{value='f.value',where=''}={})=>`SELECT rr.case_key ck,${value} a FROM topic_facts f JOIN report_rules rr ON rr.topic_id=f.topic_id WHERE f.kind='${kind}'${where?' AND '+where:''}`;
/* Stand je Vorgang: Schritt eines Fakts (Wert oder Detail) oder „Was geschieht“ */
const P=(kind,col='value')=>`(SELECT f.${col} FROM topic_facts f JOIN report_rules rr ON rr.topic_id=f.topic_id WHERE rr.case_key=x.case_key AND +f.kind='${kind}' LIMIT 1)`;
const GEWERBE="('Gewerbe','Industrie','Logistik','Rechenzentrum','Batteriespeicher und Wasserstoff','Hotel, Camping und Freizeit','Einzelhandel')";
const SHOPS="('Supermarkt und Discounter','Drogerie','Fachmarkt')";
/* Die 10 Kategorien von docs/produkt/plenara-x-signale.md, in dieser Reihenfolge. phase: Stand (plan, heat_plan, tender-Detail oder stage). */
export const SIGNALS=[
 {id:'vergaben',name:'Ausschreibungen und Vergaben',who:'Bauindustrie, Ingenieurbüros, Lieferanten, IT',
  cases:`${F} f.kind='tender'`,art:A('tender'),artName:'Leistung',phase:P('tender','detail'),phaseText:'Ausschreibung, Vergabe oder Nachtrag, aus dem Titel.',show:[]},
 {id:'wohnbau',name:'Neue Wohnbaugebiete',who:'Fertighaus, Bauträger, Makler, Banken',
  cases:`${F} (f.kind='plan_use' AND f.value IN ('Wohnen','Mischgebiet')) OR f.kind='plot_price' OR (f.kind='area_dev' AND f.value='Wohnen')`,
  art:A('wohnbau_art'),artName:'Vorhaben',phase:P('plan'),phaseText:'Schritt des Bauleitplanverfahrens, aus Titel und Vorlage.',show:['house_type','plan_area','housing','plot_price']},
 {id:'gewerbe',name:'Gewerbe, Industrie und Handel',who:'Projektentwicklung, Logistik, Handel, Wirtschaftsförderung',
  cases:`${F} (f.kind='plan_use' AND f.value IN ${GEWERBE}) OR f.kind='land_price' OR (f.kind='area_dev' AND f.value IN ('Gewerbe','Industrie')) OR (f.kind='retail' AND f.value IN ${SHOPS})`,
  art:`${A('plan_use',{where:'f.value IN '+GEWERBE})} UNION ALL ${A('area_dev',{where:"f.value IN ('Gewerbe','Industrie')"})} UNION ALL ${A('retail',{value:"CASE f.value WHEN 'Supermarkt und Discounter' THEN 'Nahversorgung' ELSE 'Einzelhandel' END",where:'f.value IN '+SHOPS})} UNION ALL ${A('land_price',{value:"'Grundstücksverkauf'"})}`,artName:'Nutzung',phase:P('plan'),phaseText:'Schritt des Bauleitplanverfahrens, aus Titel und Vorlage.',show:['plan_use','plan_area','land_price']},
 {id:'wind',name:'Windenergie',who:'Projektierer, Stadtwerke, Netzbetreiber, Bürgerenergie',
  cases:`${F} f.kind IN ('wind_step','wind_count') OR (f.kind='ee_power' AND f.value='Wind')`,art:A('wind_step'),artName:'Verfahren',phase:`(SELECT CASE f.value WHEN 'Bauleitplanung' THEN 'Planung' WHEN 'Regionalplanung' THEN 'Planung' WHEN 'Genehmigungsantrag (BImSchG)' THEN 'Genehmigung' WHEN 'Einvernehmen' THEN 'Genehmigung' WHEN 'Bürger- und Kommunalbeteiligung' THEN 'Beteiligung und Betrieb' ELSE 'Sonstiges' END FROM topic_facts f JOIN report_rules rr ON rr.topic_id=f.topic_id WHERE rr.case_key=x.case_key AND +f.kind='wind_step' LIMIT 1)`,phaseText:'Planung (Regional- und Bauleitplanung), Genehmigung (BImSchG, Einvernehmen) oder Beteiligung und Betrieb, aus dem Titel.',show:['wind_count','ee_power','plan_area']},
 {id:'solar',name:'Solarenergie',who:'Projektierer, Landwirtschaft, Netzbetreiber, Handwerk',
  cases:`${F} f.kind='solar' OR (f.kind='ee_power' AND f.value='Photovoltaik')`,art:A('solar'),artName:'Art',phase:'x.stage',phaseText:'Art des Vorgangs, aus dem Titel.',show:['ee_power','plan_area']},
 {id:'waerme',name:'Wärme, Energieeffizienz und Netze',who:'Stadtwerke, Energieberatung, Heizungsbranche, Contracting',
  cases:`${F} f.kind IN ('heat_plan','energy')`,art:`${A('heat_plan',{value:"'Wärmeplanung'"})} UNION ALL ${A('energy')}`,artName:'Art',phase:`coalesce(${P('heat_plan')},'Maßnahme')`,phaseText:'Schritt der Wärmeplanung; Wärmenetze, Heizung, LED und Sanierung als Maßnahme.',show:['heat_plan']},
 {id:'schulen',name:'Schulen, Kitas und Sportstätten',who:'Bau, Modulbau, Ausstattung, Bäderbau',
  cases:`${F} f.kind='school_build'`,art:A('school_build'),artName:'Einrichtung',phase:'x.stage',phaseText:'Art des Vorgangs, aus dem Titel.',show:[]},
 {id:'strasse',name:'Straßen, Brücken und Radwege',who:'Tiefbau, Ingenieurbüros, Verkehrsplanung',
  cases:`${F} f.kind='street'`,art:A('street'),artName:'Vorhaben',phase:P('street','detail'),phaseText:'Planung, Beschluss und Förderung, Vergabe, Bau, Abschluss oder Sachstand, aus dem Titel.',show:['road']},
 {id:'wasser',name:'Wasser, Abwasser und Hochwasserschutz',who:'Ingenieurbüros, Tiefbau, Anlagenbau',
  cases:`${F} f.kind='water'`,art:A('water'),artName:'Vorhaben',phase:P('water','detail'),phaseText:'Planung, Beschluss und Förderung, Vergabe, Bau, Abschluss oder Sachstand, aus dem Titel.',show:[]},
 {id:'breitband',name:'Breitband und Mobilfunk',who:'Telekommunikation, Tiefbau, Netzbetreiber',
  cases:`${F} f.kind='broadband'`,art:A('broadband'),artName:'Vorhaben',phase:P('broadband','detail'),phaseText:'Planung, Beschluss und Förderung, Vergabe, Bau, Abschluss oder Sachstand, aus dem Titel.',show:[]},
 {id:'mobil',name:'Mobilität',who:'Mobilitätsanbieter, Ladeinfrastruktur, ÖPNV',
  cases:`${F} f.kind='project' AND f.value<>'Öffentliches WLAN'`,art:A('project',{where:"f.value<>'Öffentliches WLAN'"}),artName:'Angebot',phase:'x.stage',phaseText:'Art des Vorgangs, aus dem Titel.',show:[]},
];
const BY_ID=new Map(SIGNALS.map(s=>[s.id,s]));
export const SIGNAL_SIZE=50;
const SHOW_KINDS=[...new Set(SIGNALS.flatMap(s=>s.show))];

/* Kennzahl lesbar: Werte der Fakten wie im Atlas, Zahlen deutsch */
const num=(v,d=2)=>Number(v).toLocaleString('de-DE',{maximumFractionDigits:d});
const euro=v=>{const n=Number(v);return n>=1e6?`${num(n/1e6,1)} Mio. €`:`${num(n,0)} €`;};
export function factText(kind,value,detail){
 const d=String(detail??''),first=d.split('|')[0];
 switch(kind){
  case 'plan':return value;
  case 'plan_use':return value;
  case 'plan_area':return first?`${num(first)} ha`:'';
  case 'housing':return first?`${num(first,0)} Wohneinheiten`:'';
  case 'plot_price':case 'land_price':return first?`${num(first)} €/m²`:'';
  case 'wind_count':return first?`${first} ${first==='1'?'Anlage':'Anlagen'}`:'';
  case 'ee_power':return first?`${num(first,1)} MW`:'';
  case 'heat_plan':return value;
  case 'road':return first?`${value}, ${euro(first)}`:value;
  case 'project':return value;
  case 'house_type':return value;
  default:return value;
 }
}

/* Schneller Weg über x_signals (Migration 0039, gebaut mit x_cases): Zahl je Signal in einer Abfrage, die Vorgänge des
   gewählten Signals einmal gelesen und in JS nach Stand, Art und Ort gezählt. null, solange die Tabelle fehlt oder leer ist. */
async function fastSignals(db,catalog,{sig,from,args,phase,art,offset,state}){
 let counts;
 try{counts=(await db.prepare(`SELECT s.signal k,count(DISTINCT s.case_key) n FROM ${from} JOIN x_signals s ON s.case_key=x.case_key GROUP BY s.signal`).bind(...args).all()).results;}catch{return null;}
 if(!state.signals)return null;
 const {results}=await db.prepare(`SELECT x.case_key ck,x.card_id id,x.region_id region,x.date date,x.status status,s.phase ph,s.art a FROM ${from} JOIN x_signals s ON s.case_key=x.case_key WHERE s.signal=?`).bind(...args,sig.id).all();
 const cases=new Map();
 for(const r of results){let c=cases.get(r.ck);if(!c){c={...r,arts:new Set()};cases.set(r.ck,c);}if(r.a)c.arts.add(r.a);}
 const all=[...cases.values()],okPh=c=>!phase||c.ph===(phase===' '?'':phase),okArt=c=>!art||c.arts.has(art);
 const tally=(list,key)=>{const m=new Map();for(const c of list)for(const k of key(c))m.set(k,(m.get(k)||0)+1);return [...m].map(([k,n])=>({k,n})).sort((a,b)=>b.n-a.n);};
 const sel=all.filter(c=>okPh(c)&&okArt(c)).sort((a,b)=>a.date<b.date?1:a.date>b.date?-1:a.ck<b.ck?-1:1);
 const pageRows=sel.slice(offset,offset+SIGNAL_SIZE);
 const titles=new Map();
 if(pageRows.length)for(const r of (await db.prepare('SELECT id,title,gremium FROM search_cards WHERE id IN (SELECT value FROM json_each(?))').bind(JSON.stringify(pageRows.map(r=>r.id))).all()).results)titles.set(r.id,r);
 const countBy=new Map(counts.map(r=>[r.k,r.n]));
 return finish(db,catalog,{sig,state,offset,counts:SIGNALS.map(s=>({n:countBy.get(s.id)||0})),
  phases:tally(all.filter(okArt),c=>[c.ph||'']),arts:tally(all.filter(okPh),c=>c.arts),places:tally(sel,c=>[c.region]),total:sel.length,
  page:pageRows.map(r=>({...r,title:titles.get(r.id)?.title||'',gremium:titles.get(r.id)?.gremium||''}))});
}

/** Signale unter den Filtern der Suche */
export async function xSignals(db,catalog,params){
 const id=params.get('signal')||SIGNALS[0].id,sig=BY_ID.get(id);if(!sig)throw new AnalyticsError('Unbekanntes Signal.');
 const phase=params.get('phase')||'',art=params.get('art')||'',offset=Math.max(0,Number(params.get('offset'))||0);
 const copy=new URLSearchParams(params);for(const k of ['signal','phase','art','offset'])copy.delete(k);
 const state=await xState(db);if(!state)throw new AnalyticsError('Die Zahlen für plenara.X werden gerade aufgebaut.',503);
 const x=parseX(copy),{from,args}=await source(db,catalog,x.f);
 const fast=await fastSignals(db,catalog,{sig,from,args,phase,art,offset,state});if(fast)return fast;
 // Zahl je Signal (für die Auswahl oben), dann die Vorgänge des gewählten Signals einmal als Zwischenmenge
 const counts=await Promise.all(SIGNALS.map(s=>db.prepare(`SELECT count(*) n FROM ${from} WHERE x.case_key IN (${s.cases})`).bind(...args).first()));
 const sel=`WITH sel AS MATERIALIZED (SELECT x.*,${sig.phase} ph FROM ${from} WHERE x.case_key IN (${sig.cases}))`;
 // Art (zweiter Filter): Vorgänge mit diesem Filterwert
 const IN_ART=`case_key IN (SELECT ck FROM (${sig.art}) WHERE a=?)`;
 const where=[],pa=[];
 if(phase){where.push("coalesce(ph,'')=?");pa.push(phase===' '?'':phase);}
 if(art){where.push(IN_ART);pa.push(art);}
 const cond=where.length?' WHERE '+where.join(' AND '):'';
 const condPh=phase?" WHERE coalesce(ph,'')=?":'',paPh=phase?[phase===' '?'':phase]:[];
 const condArt=art?` WHERE ${IN_ART}`:'',paArt=art?[art]:[];
 const [phases,arts,places,total,page]=await Promise.all([
  db.prepare(`${sel} SELECT coalesce(ph,'') k,count(*) n FROM sel${condArt} GROUP BY k ORDER BY n DESC`).bind(...args,...paArt).all(),
  db.prepare(`${sel} SELECT av.a k,count(DISTINCT av.ck) n FROM (${sig.art}) av WHERE av.ck IN (SELECT case_key FROM sel${condPh}) GROUP BY k ORDER BY n DESC`).bind(...args,...paPh).all(),
  db.prepare(`${sel} SELECT region_id k,count(*) n FROM sel${cond} GROUP BY k ORDER BY n DESC`).bind(...args,...pa).all(),
  db.prepare(`${sel} SELECT count(*) n FROM sel${cond}`).bind(...args,...pa).first(),
  db.prepare(`${sel} SELECT p.case_key ck,p.card_id id,p.region_id region,c.title,c.gremium,p.date,p.status,p.stage,p.ph FROM (SELECT * FROM sel${cond} ORDER BY date DESC,case_key LIMIT ? OFFSET ?) p JOIN search_cards c ON c.id=p.card_id ORDER BY p.date DESC,p.case_key`).bind(...args,...pa,SIGNAL_SIZE,offset).all(),
 ]);
 return finish(db,catalog,{sig,state,offset,counts,phases:phases.results,arts:arts.results,places:places.results,total:Number(total?.n||0),page:page.results});
}
/* Antwort aus den gezählten Werten: Kennzahlen und Karten nur für die Vorgänge der Seite */
async function finish(db,catalog,{sig,state,offset,counts,phases,arts,places,total,page}){
 // Kennzahlen der Seite: alle angezeigten Fakten der Vorgänge
 const cks=page.map(r=>r.ck),facts=new Map();
 if(cks.length){
  const {results}=await db.prepare(`SELECT rr.case_key ck,f.kind k,f.value v,f.detail d FROM report_rules rr JOIN topic_facts f ON f.topic_id=rr.topic_id WHERE rr.case_key IN (SELECT value FROM json_each(?)) AND +f.kind IN (SELECT value FROM json_each(?))`).bind(JSON.stringify(cks),JSON.stringify(SHOW_KINDS)).all();
  for(const r of results){const m=facts.get(r.ck)||new Map();facts.set(r.ck,m);const t=factText(r.k,r.v,r.d);if(!t)continue;const l=m.get(r.k)||[];if(!l.includes(t))l.push(t);m.set(r.k,l);}
 }
 const byId=new Map(catalog.map(r=>[r.id,r])),name=r=>byId.get(r)?.name||r;
 // Karte wie in der Trefferliste der Suche (Kurztext, Gremium, Thema, Verlauf)
 const cards=new Map((await cardsById(db,catalog,page.map(r=>r.id))).map(c=>[c.id,c]));
 const phaseName=k=>sig.phase==='x.stage'?(k?stageName(k):'Noch nicht eingeordnet'):(k||'Ohne Angabe');
 return {
  signals:SIGNALS.map((s,i)=>({id:s.id,name:s.name,who:s.who,count:Number(counts[i]?.n||0)})),
  signal:{id:sig.id,name:sig.name,who:sig.who,phaseText:sig.phaseText,art:sig.artName},
  phases:phases.map(r=>({key:r.k||' ',name:phaseName(r.k),count:r.n})),
  arts:arts.map(r=>({key:r.k,name:r.k,count:r.n})),
  placeCount:places.length,
  places:places.slice(0,300).map(r=>({region:r.k,name:name(r.k),ags:byId.get(r.k)?.ags||'',count:r.n})),
  total,offset,size:SIGNAL_SIZE,builtAt:state.builtAt,
  items:page.map(r=>{const m=facts.get(r.ck)||new Map();
   const c=cards.get(r.id)||{};
   return {...c,id:r.id,title:r.title,region:placeOf(name(r.region),r.title,r.gremium,byId.get(r.region)?.members).label,date:String(r.date).slice(0,10),
    status:r.status,phase:phaseName(r.ph||''),facts:sig.show.flatMap(k=>(m.get(k)||[]).slice(0,2).map(t=>({kind:k,text:t})))};}),
 };
}
