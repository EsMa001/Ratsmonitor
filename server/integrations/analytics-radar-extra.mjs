import {POPULATION} from '../../shared/catalog.mjs';
import {HEAT_STEPS,GRANT_PURPOSES} from '../../shared/topic-facts.mjs';
import {LANDS} from './analytics-radar-norms.mjs';

/*
 * Plenara.X – Kopfmodule der Themenradare mit Werten aus den Unterlagen (shared/topic-facts.mjs, Tabelle topic_facts):
 *   finanzen  Hebesätze (kind 'hebesatz': value Steuerart, detail 'neu|bisher')
 *   gebuehren Abwasser- und Wassergebühren (kind 'fee_rate': value Art, detail 'neu|bisher|Einheit')
 *   klima     Stand der kommunalen Wärmeplanung (kind 'heat_plan': value Schritt)
 *   soziales  Zuschüsse der Kommune an Vereine und Träger (kind 'grant': value Zweck, detail Euro oder leer)
 * Grundlage sind die Einträge der Suche (dieselben Filter wie das Radar). Je Gebiet zählt der zuletzt genannte Wert
 * (Sitzungstag); Werte sind genannte Werte, nicht immer beschlossene (Status steht dabei). Abgelehnte Vorschläge zählen nicht.
 * Mittelwerte nur je Land: Grundsteuermodelle und Gebührenordnungen unterscheiden sich je Land stark.
 */
/* Gemeindeverbände (Samtgemeinde, Verbandsgemeinde, Amt) beraten auch für ihre Mitgliedsgemeinden: Hebesätze und Gebühren
   gelten dann für die Gemeinde, deren Rat berät („Ortsgemeinderat Limbach“) oder die der Titel nennt („Haushaltssatzung der
   Gemeinde Warberg“), nicht für den Verband */
const UNION=/^(Samtgemeinde|Verbandsgemeinde|Amt|Verwaltungsgemeinschaft|Verwaltungsverband|Gemeindeverwaltungsverband) /;
const MEMBER=/\b(?:der|des)\s+(Ortsgemeinde|Gemeinde|Stadt|Flecken|Markt)\s+([A-ZÄÖÜ][\wäöüß.-]+(?:\s(?:am|an|im|in|bei|ob|a\.|i\.)\s?[A-ZÄÖÜ]?[\wäöüß.-]+)?)/;
const COUNCIL=/^(?:Ortsgemeinderat|Gemeinderat|Stadtrat|Rat|Gemeindevertretung|Stadtvertretung|Stadtverordnetenversammlung)\s+(?:der\s+|des\s+)?(?:(Ortsgemeinde|Gemeinde|Stadt|Flecken|Markt)\s+)?([A-ZÄÖÜ][\wäöüß.-]+(?:\s(?:am|an|im|in|bei|ob|a\.|i\.)\s?[A-ZÄÖÜ]?[\wäöüß.-]+)?)/;
/* members (optional, aus dem Katalog): Nennt der Titel genau eine Mitgliedsgemeinde als ganzes Wort („Leichenhalle Niederehe“),
   gilt sie, wenn weder Gremium noch „der Gemeinde X“ eine nennen */
const esc=x=>x.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
export function where(regionName,title,gremium='',members=null){
 if(!UNION.test(regionName))return {key:'',label:regionName};
 const g=String(gremium||'').match(COUNCIL);
 if(g&&!/gemeinde$|^(Samt|Verbands)|^Amt/i.test(g[2]))return {key:g[2],label:`${/^Ortsgemeinderat/.test(gremium)?'Ortsgemeinde':g[1]||'Gemeinde'} ${g[2]} (${regionName})`};
 const m=String(title||'').match(MEMBER);
 if(m)return {key:m[2],label:`${m[1]} ${m[2]} (${regionName})`};
 const named=(members||[]).filter(x=>x.name&&new RegExp(`(^|[^\\wäöüß])${esc(x.name)}($|[^\\wäöüß-])`).test(String(title||'')));
 const own=named.length===1&&!regionName.endsWith(' '+named[0].name);
 return own?{key:named[0].name,label:`${/^Ortsgemeinderat/.test(gremium)?'Ortsgemeinde':'Gemeinde'} ${named[0].name} (${regionName})`}:{key:'',label:regionName};
}
const median=a=>{if(!a.length)return null;const s=[...a].sort((x,y)=>x-y),m=s.length>>1;return s.length%2?s[m]:(s[m-1]+s[m])/2;};
// Listen vollständig (je Gebiet ein Eintrag), damit ein Klick auf eine Zahl alle zugehörigen Gebiete zeigt
const LIST=2000,LARGEST=15;

async function rows(db,page,kind){
 const cards=`(SELECT id,region_id,date,title,status,gremium FROM search_cards WHERE id IN (SELECT topic_id FROM topic_facts WHERE kind=?) AND ${page.where} AND date<>'')`;
 const {results}=await db.prepare(`SELECT c.id id,c.region_id region,c.date date,c.title title,c.status status,c.gremium gremium,x.value value,x.detail detail FROM ${cards} c JOIN topic_facts x ON x.topic_id=c.id AND x.kind=?`).bind(kind,...page.args,kind).all().catch(()=>({results:[]}));
 return results;
}
/* Je Gebiet (bei Verbänden je Mitgliedsgemeinde) und Art der zuletzt genannte Wert; bei gleichem Tag der mit „bisher“.
   Abgelehnte Vorschläge zählen nicht. memberOnly: Werte eines Verbands ohne erkannte Mitgliedsgemeinde weglassen (Hebesätze
   legen die Gemeinden fest, nicht der Verband). */
function latest(list,key,name,memberOnly){
 const by=new Map();
 for(const r of list){
  if(r.status==='rejected')continue;
  const w=where(name(r.region),r.title,r.gremium);if(memberOnly&&UNION.test(name(r.region))&&!w.key)continue;
  const k=r.region+'|'+w.key+'|'+key(r),o=by.get(k);if(!o||r.date>o.date||r.date===o.date&&r.from&&!o.from)by.set(k,{...r,label:w.label});
 }
 return [...by.values()];
}
function rateBlock(list,name,land,kinds,memberOnly=false){
 return kinds.map(k=>{
  const items=latest(list.filter(r=>r.kind===k),()=>k,name,memberOnly).sort((a,b)=>b.date.localeCompare(a.date));
  const vals=items.map(i=>i.to),lands=new Map();
  for(const i of items){const l=land(i.region);if(!lands.has(l))lands.set(l,[]);lands.get(l).push(i.to);}
  return {name:k,regions:items.length,min:vals.length?Math.min(...vals):null,max:vals.length?Math.max(...vals):null,
   lands:[...lands].map(([l,v])=>({land:LANDS[l]||l,regions:v.length,median:median(v)})).sort((a,b)=>b.regions-a.regions),
   up:items.filter(i=>i.from&&i.to>i.from).length,down:items.filter(i=>i.from&&i.to<i.from).length,unit:items[0]?.unit||'',
   items:items.slice(0,LIST).map(i=>({id:i.id,title:i.title,region:i.label,date:i.date,status:i.status,from:i.from||null,to:i.to,unit:i.unit||''}))};
 }).filter(b=>b.regions);
}

export async function radarExtra(db,id,page,name,land=()=>''){
 if(id==='finanzen'){
  const list=(await rows(db,page,'hebesatz')).map(r=>{const [to,from]=String(r.detail).split('|');return {...r,kind:r.value,to:Number(to),from:from?Number(from):0};});
  return list.length?{kind:'hebesatz',blocks:rateBlock(list,name,land,['Grundsteuer B','Gewerbesteuer','Grundsteuer A'],true)}:null;
 }
 if(id==='gebuehren'){
  const list=(await rows(db,page,'fee_rate')).map(r=>{const [to,from,unit]=String(r.detail).split('|');return {...r,kind:r.value+' je '+unit,unit,to:Number(to),from:from?Number(from):0};});
  return list.length?{kind:'fee_rate',blocks:rateBlock(list,name,land,['Schmutzwasser je m³','Niederschlagswasser je m²','Trinkwasser je m³','Niederschlagswasser je m³'])}:null;
 }
 if(id==='klima'){
  const list=await rows(db,page,'heat_plan');if(!list.length)return null;
  // Reihenfolge der Schritte; ein Beschluss zählt als „beschlossen“ nur mit Status beschlossen
  const ORDER=['Start und Beauftragung','Analyse und Zwischenstand','Entwurf und Beteiligung','Wärmeplan vorgelegt','Wärmeplan beschlossen','Umsetzung und Fortschreibung'];
  const by=new Map();
  for(const r of list){
   const step=r.value==='Wärmeplan vorgelegt'&&r.status==='approved'?'Wärmeplan beschlossen':r.value;
   const k=r.region+'|'+where(name(r.region),r.title,r.gremium).key,o=by.get(k),rank=ORDER.indexOf(step);
   if(!o||rank>o.rank||rank===o.rank&&r.date>o.date)by.set(k,{...r,step,rank});
  }
  const regions=[...by.values()].sort((a,b)=>b.rank-a.rank||b.date.localeCompare(a.date));
  return {kind:'heat_plan',steps:ORDER.map(s=>({name:s,regions:regions.filter(r=>r.step===s).length})),topics:new Set(list.map(r=>r.id)).size,
   regions:regions.slice(0,LIST).map(r=>({id:r.id,title:r.title,region:where(name(r.region),r.title,r.gremium).label,date:r.date,status:r.status,step:r.step})),total:regions.length,known:HEAT_STEPS.length};
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
   largest:amounts.sort((a,b)=>b.euro-a.euro).slice(0,LARGEST).map(r=>({id:r.id,title:r.title,region:where(name(r.region),r.title,r.gremium).label,pop:pop(r.region),date:r.date,status:r.status,purpose:r.value,euro:r.euro}))};
 }
 return null;
}
