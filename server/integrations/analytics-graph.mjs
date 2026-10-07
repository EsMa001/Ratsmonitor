import {LABELS} from '../../shared/labels.mjs';
import {ALL_LANDS} from '../../shared/lands.mjs';
import {parseMonitorSearch,searchFilters} from './monitor-search.mjs';
import {AnalyticsError} from './analytics-diffusion.mjs';

/*
 * Plenara Analytics – Knowledge Graph: Welche Begriffe, Themen, Gremien und Länder hängen mit einem Suchbegriff zusammen?
 * Grundlage sind allein die Karten der Datenbank, die zur Suche passen (dieselben Filter wie die Suche, die jüngsten zuerst).
 * Kanten entstehen, wenn zwei Dinge in derselben Karte vorkommen (Ko-Okkurrenz); ihr Gewicht ist der Jaccard-Index.
 * Begriffe werden nach Häufigkeit in der Auswahl gegenüber der Häufigkeit im ganzen Bestand gewichtet (wie tf-idf), damit
 * nicht Füllwörter („Antrag“, „Sitzung“) das Bild bestimmen.
 */
const SAMPLE=3000,TERMS=22,PER_KIND=6,MIN_DF=3;
const STOP=new Set('aber alle allen aller alles als also auch auf aus bei beim bis dass dem den der des die diese diesem diesen dieser dieses doch durch ein eine einem einen einer eines für gegen hat haben ihre ihrem ihren ihrer ist kann mit nach nicht noch nur oder ohne sich sind über und unter vom von vor wird wurde zum zur zwischen sowie sowohl weitere weiteren weiterer weiteres neue neuen neuer neues dazu hierzu hierfür dafür dagegen darüber darauf daraus davon damit wegen innerhalb außerhalb bezüglich betreffend gemäß nr nummer vom im am an zu so wie was wer wo wenn dann denn mehr sehr schon bereits'.split(' '));
/* Formalien tragen nichts zum Thema bei */
const FORMAL=new Set('sitzung sitzungen niederschrift niederschriften protokoll tagesordnung tagesordnungspunkt mitteilung mitteilungen anfrage anfragen anfragen antrag anträge antrags beschluss beschlüsse beschlussvorlage vorlage vorlagen vorlagenummer verschiedenes bekanntgaben bekanntgabe genehmigung feststellung eröffnung öffentlich öffentliche öffentlichen nichtöffentlich nichtöffentlichen teil ortsrat ortsrates gemeinderat gemeinderates stadtrat stadtrates kreistag kreistages rat rates ausschuss ausschusses fachausschuss einwohnerfragestunde fragestunde top punkt hier änderung beteiligung stellungnahme beratung entwurf gemeinde stadt gmbh sachlichen aufstellung beschlussfassung kenntnisnahme bericht berichte information informationen verfahren'.split(' '));
const norm=s=>s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replaceAll('ß','ss');
const tokens=title=>{
 const found=new Map();
 for(const raw of String(title).split(/[^A-Za-zÀ-ÿ]+/)){
  if(raw.length<4)continue;
  const w=raw.toLowerCase();
  if(STOP.has(w)||FORMAL.has(w))continue;
  const key=norm(w);
  if(!found.has(key))found.set(key,w);
 }
 return found;
};
const gremiumKey=g=>String(g||'').replace(/\s+/g,' ').trim();
const jaccard=(c,a,b)=>c/(a+b-c);

/** Gleiche Filter wie die Suche; Begriff erforderlich */
export function parseGraph(params){
 let f;
 try{f=parseMonitorSearch(params);}catch(e){throw new AnalyticsError(e.message,e.status||400);}
 if(!f.groups.length)throw new AnalyticsError('Bitte einen Begriff eingeben.');
 if(f.groups.flat().some(w=>w.length<3))throw new AnalyticsError('Jedes Suchwort braucht mindestens 3 Buchstaben.');
 return f;
}

export async function knowledgeGraph(db,catalog,params){
 const f=parseGraph(params);
 const {page}=await searchFilters(db,catalog,f);
 const {results:rows}=await db.prepare('SELECT region_id,label,gremium,title FROM search_cards WHERE '+page.where+' ORDER BY date DESC LIMIT ?').bind(...page.args,SAMPLE+1).all();
 const capped=rows.length>SAMPLE;if(capped)rows.pop();
 const total=rows.length;
 const byId=new Map(catalog.map(r=>[r.id,r]));
 const exclude=new Set(f.groups.flat());
 /* Je Karte: Begriffe, Thema, Gremium, Land */
 const docs=rows.map(r=>{
  const region=byId.get(r.region_id),land=region?region.ags.slice(0,2):null;
  return {terms:new Map([...tokens(r.title)].filter(([k])=>!exclude.has(k))),label:r.label,gremium:gremiumKey(r.gremium),land};
 });
 /* Häufigkeit der Begriffe in der Auswahl; Gewichtung gegen den ganzen Bestand (search_words) */
 const df=new Map(),shown=new Map();
 for(const d of docs)for(const [k,w] of d.terms){df.set(k,(df.get(k)||0)+1);if(!shown.has(k))shown.set(k,w);}
 const cand=[...df].filter(([,n])=>n>=Math.min(MIN_DF,Math.max(2,Math.floor(total*0.02)))).sort((a,b)=>b[1]-a[1]).slice(0,120);
 let global=new Map(),all=0;
 if(cand.length){
  try{
   const {results:g}=await db.prepare('SELECT word,cards FROM search_words WHERE word IN (SELECT value FROM json_each(?))').bind(JSON.stringify(cand.map(([k])=>k))).all();
   global=new Map(g.map(x=>[x.word,x.cards]));
   all=(await db.prepare('SELECT max(rowid) n FROM search_cards').first())?.n||0;
  }catch{global=new Map();}
 }
 const idf=k=>global.size&&all?Math.log(1+all/Math.max(1,global.get(k)||df.get(k))):1;
 const chosen=cand.map(([k,n])=>({k,n,score:n*idf(k)})).sort((a,b)=>b.score-a.score).slice(0,TERMS);
 const termSet=new Set(chosen.map(c=>c.k));
 /* Themen, Gremien, Länder: je Art die häufigsten */
 const count=pick=>{const m=new Map();for(const d of docs){const v=pick(d);if(v)m.set(v,(m.get(v)||0)+1);}return [...m].sort((a,b)=>b[1]-a[1]).slice(0,PER_KIND);};
 const labelName=id=>LABELS.find(l=>l.id===id)?.name||null;
 const topics=count(d=>labelName(d.label)&&d.label!=='unklar'?d.label:null),committees=count(d=>d.gremium.length>=4?d.gremium:null),lands=count(d=>d.land);
 const nodes=[{id:'q',type:'center',label:f.q,count:total}];
 for(const c of chosen)nodes.push({id:'t:'+c.k,type:'term',label:shown.get(c.k),count:c.n});
 for(const [id,n] of topics)nodes.push({id:'k:'+id,type:'topic',label:labelName(id),count:n});
 for(const [g,n] of committees)nodes.push({id:'g:'+g,type:'committee',label:g.length>46?g.slice(0,44)+'…':g,count:n});
 for(const [id,n] of lands)nodes.push({id:'l:'+id,type:'land',label:ALL_LANDS.find(l=>l.id===id)?.name||id,count:n});
 const size=new Map(nodes.map(n=>[n.id,n.count]));
 /* Ko-Okkurrenz zählen */
 const co=new Map();
 const bump=(a,b)=>{if(a===b)return;const key=a<b?a+'|'+b:b+'|'+a;co.set(key,(co.get(key)||0)+1);};
 for(const d of docs){
  const ids=[...[...d.terms.keys()].filter(k=>termSet.has(k)).map(k=>'t:'+k)];
  if(size.has('k:'+d.label))ids.push('k:'+d.label);
  if(size.has('g:'+d.gremium))ids.push('g:'+d.gremium);
  if(size.has('l:'+d.land))ids.push('l:'+d.land);
  for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++)bump(ids[i],ids[j]);
 }
 const edges=[];
 for(const [key,n] of co){
  const [a,b]=key.split('|');
  const w=jaccard(n,size.get(a),size.get(b));
  /* Themen, Gremien und Länder verbinden sich nur mit Begriffen; sonst ist jeder mit jedem verbunden */
  const kinds=a[0]+b[0];
  if(kinds!=='tt'&&!kinds.includes('t'))continue;
  if(n>=2&&w>=0.04)edges.push({a,b,w:Math.round(w*1000)/1000,n});
 }
 /* Je Knoten nur seine stärksten Kanten behalten, damit das Bild lesbar bleibt */
 const keep=new Set(),perNode=new Map();
 for(const e of edges.sort((x,y)=>y.w-x.w)){
  const ca=perNode.get(e.a)||0,cb=perNode.get(e.b)||0;
  if(ca<4||cb<4){keep.add(e);perNode.set(e.a,ca+1);perNode.set(e.b,cb+1);}
 }
 const links=[...keep];
 /* Jeder Knoten hängt am Zentrum (Stärke: Anteil der Auswahl) */
 for(const n of nodes.slice(1))links.push({a:'q',b:n.id,w:Math.round((n.count/Math.max(1,total))*1000)/1000,n:n.count,center:true});
 return {q:f.q,total,capped,sample:SAMPLE,nodes,edges:links,stats:{terms:chosen.length,topics:topics.length,committees:committees.length,lands:lands.length,links:links.length-nodes.length+1}};
}
