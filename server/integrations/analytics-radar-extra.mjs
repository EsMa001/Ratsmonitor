import {POPULATION} from '../../shared/catalog.mjs';
import {HEAT_STEPS,GRANT_PURPOSES} from '../../shared/topic-facts.mjs';

/*
 * Plenara.X – Kopfmodule der Themenradare mit Werten aus den Unterlagen (shared/topic-facts.mjs, Tabelle topic_facts):
 *   finanzen  Hebesätze (kind 'hebesatz': value Steuerart, detail 'neu|bisher')
 *   gebuehren Abwasser- und Wassergebühren (kind 'fee_rate': value Art, detail 'neu|bisher|Einheit')
 *   klima     Stand der kommunalen Wärmeplanung (kind 'heat_plan': value Schritt)
 *   soziales  Zuschüsse der Kommune an Vereine und Träger (kind 'grant': value Zweck, detail Euro oder leer)
 * Grundlage sind die Einträge der Suche (dieselben Filter wie das Radar). Je Gebiet zählt der zuletzt genannte Wert
 * (Sitzungstag); Werte sind genannte Werte, nicht immer beschlossene (Status steht dabei).
 */
/* Gemeindeverbände (Samtgemeinde, Verbandsgemeinde, Amt) beraten auch für ihre Mitgliedsgemeinden: Hebesätze und Gebühren
   gelten dann für die im Titel genannte Gemeinde („Haushaltssatzung der Gemeinde Warberg“), nicht für den Verband */
const UNION=/^(Samtgemeinde|Verbandsgemeinde|Amt|Verwaltungsgemeinschaft|Verwaltungsverband|Gemeindeverwaltungsverband) /;
const MEMBER=/\b(?:der|des)\s+(Ortsgemeinde|Gemeinde|Stadt|Flecken|Markt)\s+([A-ZÄÖÜ][\wäöüß.-]+(?:\s(?:am|an|im|in|bei|ob|a\.|i\.)\s?[A-ZÄÖÜ]?[\wäöüß.-]+)?)/;
export function where(regionName,title){
 if(!UNION.test(regionName))return {key:'',label:regionName};
 const m=String(title||'').match(MEMBER);
 return m?{key:m[2],label:`${m[1]} ${m[2]} (${regionName})`}:{key:'',label:regionName};
}
const median=a=>{if(!a.length)return null;const s=[...a].sort((x,y)=>x-y),m=s.length>>1;return s.length%2?s[m]:(s[m-1]+s[m])/2;};
const LIST=60,LARGEST=15;

async function rows(db,page,kind){
 const cards=`(SELECT id,region_id,date,title,status FROM search_cards WHERE id IN (SELECT topic_id FROM topic_facts WHERE kind=?) AND ${page.where} AND date<>'')`;
 const {results}=await db.prepare(`SELECT c.id id,c.region_id region,c.date date,c.title title,c.status status,x.value value,x.detail detail FROM ${cards} c JOIN topic_facts x ON x.topic_id=c.id AND x.kind=?`).bind(kind,...page.args,kind).all().catch(()=>({results:[]}));
 return results;
}
/* Je Gebiet und Art der zuletzt genannte Wert; bei gleichem Tag der mit „bisher“ (Änderung) */
function latest(list,key,name){
 const by=new Map();
 for(const r of list){const k=r.region+'|'+where(name(r.region),r.title).key+'|'+key(r),o=by.get(k);if(!o||r.date>o.date||r.date===o.date&&r.from&&!o.from)by.set(k,r);}
 return [...by.values()];
}
function rateBlock(list,name,kinds){
 return kinds.map(k=>{
  const items=latest(list.filter(r=>r.kind===k),()=>k,name).sort((a,b)=>b.date.localeCompare(a.date));
  const vals=items.map(i=>i.to);
  return {name:k,regions:items.length,median:median(vals),min:vals.length?Math.min(...vals):null,max:vals.length?Math.max(...vals):null,
   up:items.filter(i=>i.from&&i.to>i.from).length,down:items.filter(i=>i.from&&i.to<i.from).length,unit:items[0]?.unit||'',
   items:items.slice(0,LIST).map(i=>({id:i.id,title:i.title,region:where(name(i.region),i.title).label,date:i.date,status:i.status,from:i.from||null,to:i.to,unit:i.unit||''}))};
 }).filter(b=>b.regions);
}

export async function radarExtra(db,id,page,name){
 if(id==='finanzen'){
  const list=(await rows(db,page,'hebesatz')).map(r=>{const [to,from]=String(r.detail).split('|');return {...r,kind:r.value,to:Number(to),from:from?Number(from):0};});
  return list.length?{kind:'hebesatz',blocks:rateBlock(list,name,['Grundsteuer B','Gewerbesteuer','Grundsteuer A'])}:null;
 }
 if(id==='gebuehren'){
  const list=(await rows(db,page,'fee_rate')).map(r=>{const [to,from,unit]=String(r.detail).split('|');return {...r,kind:r.value+' je '+unit,unit,to:Number(to),from:from?Number(from):0};});
  return list.length?{kind:'fee_rate',blocks:rateBlock(list,name,['Schmutzwasser je m³','Niederschlagswasser je m²','Trinkwasser je m³','Niederschlagswasser je m³'])}:null;
 }
 if(id==='klima'){
  const list=await rows(db,page,'heat_plan');if(!list.length)return null;
  // Reihenfolge der Schritte; ein Beschluss zählt als „beschlossen“ nur mit Status beschlossen
  const ORDER=['Start und Beauftragung','Analyse und Zwischenstand','Entwurf und Beteiligung','Wärmeplan zur Beschlussfassung','Wärmeplan beschlossen','Umsetzung und Fortschreibung'];
  const by=new Map();
  for(const r of list){
   const step=r.value==='Wärmeplan zur Beschlussfassung'&&r.status==='approved'?'Wärmeplan beschlossen':r.value;
   const k=r.region+'|'+where(name(r.region),r.title).key,o=by.get(k),rank=ORDER.indexOf(step);
   if(!o||rank>o.rank||rank===o.rank&&r.date>o.date)by.set(k,{...r,step,rank});
  }
  const regions=[...by.values()].sort((a,b)=>b.rank-a.rank||b.date.localeCompare(a.date));
  return {kind:'heat_plan',steps:ORDER.map(s=>({name:s,regions:regions.filter(r=>r.step===s).length})),topics:new Set(list.map(r=>r.id)).size,
   regions:regions.slice(0,LIST).map(r=>({id:r.id,title:r.title,region:where(name(r.region),r.title).label,date:r.date,status:r.status,step:r.step})),total:regions.length,known:HEAT_STEPS.length};
 }
 if(id==='soziales'){
  const list=await rows(db,page,'grant');if(!list.length)return null;
  const purposes=new Map([...GRANT_PURPOSES.map(([n])=>n),'Sonstige Vereine und Träger'].map(n=>[n,{n:0,approved:0,regions:new Set(),euro:0,amounts:0}]));
  const seen=new Set(),amounts=[];
  for(const r of list){
   const p=purposes.get(r.value)||{n:0,approved:0,regions:new Set(),euro:0,amounts:0};purposes.set(r.value,p);
   p.n++;p.regions.add(r.region);if(r.status==='approved')p.approved++;
   const euro=Number(r.detail)||0,k=`${r.region}|${r.value}|${euro}|${r.title.toLowerCase()}`;
   // Derselbe Zuschuss in mehreren Gremien eines Gebiets zählt einmal
   if(euro&&!seen.has(k)){seen.add(k);p.euro+=euro;p.amounts++;amounts.push({...r,euro});}
  }
  const pop=r=>POPULATION[r]||null;
  return {kind:'grant',topics:list.length,regions:new Set(list.map(r=>r.region)).size,
   euro:amounts.reduce((a,r)=>a+r.euro,0),amounts:amounts.length,median:median(amounts.map(r=>r.euro)),
   purposes:[...purposes].map(([n,p])=>({name:n,n:p.n,approved:p.approved,regions:p.regions.size,euro:p.euro,amounts:p.amounts})).filter(p=>p.n).sort((a,b)=>b.n-a.n),
   largest:amounts.sort((a,b)=>b.euro-a.euro).slice(0,LARGEST).map(r=>({id:r.id,title:r.title,region:where(name(r.region),r.title).label,pop:pop(r.region),date:r.date,status:r.status,purpose:r.value,euro:r.euro}))};
 }
 return null;
}
