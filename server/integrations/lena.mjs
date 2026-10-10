// Lena antwortet nur mit dem, was in den Daten steht: Vorlagen mit eingesetzten Werten, jede Angabe mit Fundstelle.
// Ruft ausschließlich bestehende Funktionen (Suche, Abdeckung, Trends). Konzept: docs/produkt/lena-konzept.md
import {parseQuestion,STATUS_NAMES,labelName} from '../../shared/lena/parse.mjs';
import {lookupGlossary} from '../../shared/lena/glossary.mjs';
import {cachedSearch,cachedCoverage,SearchError} from './monitor-search.mjs';
import {trends} from './analytics-trends.mjs';

const fmt=d=>d&&/^\d{4}-\d{2}-\d{2}/.test(d)?d.slice(8,10)+'.'+d.slice(5,7)+'.'+d.slice(0,4):'';
const enc=encodeURIComponent;
const searchLink=p=>'/?q='+enc(p.topic||'');
const source=a=>({id:a.id,title:a.title,date:a.date,status:STATUS_NAMES[a.status]||a.status,gemeinde:a.gemeinde,gremium:a.gremium,link:'/beschluss/'+enc(a.id)});
const placeName=p=>p?.regions?.[0]?.name||'';
const n=(k,one,many)=>k===1?'1 '+one:k+' '+many;

async function search(db,catalog,p,{size=20,status='',sort='desc'}={}){
 const q=new URLSearchParams({q:p.topic||'',part:'page',size:String(size),sort});
 const r=p.place?.regions?.[0];
 if(r){q.set('area',r.ags);q.set('scope',r.kind==='district'?'with':'only');q.set('level',r.kind==='district'?'district':'city');}
 if(p.time){q.set('from',p.time.from);q.set('to',p.time.to);}
 if(status)q.set('status',status);
 return cachedSearch(db,catalog,q);
}
const next=(p,text)=>({text,link:searchLink(p)});

/**
 * @param {any} db @param {any[]} catalog @param {string} question
 * @returns {Promise<{intent:string,text:string,sources:any[],links:{text:string,link:string}[],ask?:{text:string,options:{text:string,question:string}[]},parsed:any}>}
 */
export async function answer(db,catalog,question,{now=Date.now()}={}){
 const p=parseQuestion(question,catalog,now);
 const base={intent:p.intent,sources:[],links:[],parsed:{intent:p.intent,place:placeName(p.place),topic:p.topic,status:p.status,time:p.time?{from:p.time.from,to:p.time.to}:null,labels:p.labels}};
 const where=p.place?' in '+placeName(p.place):'';
 /* Rückfrage statt Raten: mehrdeutiger Ort, fehlender Ort bei Ortsfragen, keine erkennbare Absicht. Höchstens eine je Frage. */
 if(p.ambiguous)return {...base,text:'Welches Gebiet meinen Sie?',ask:{text:'Welches Gebiet meinen Sie?',options:p.ambiguous.regions.slice(0,4).map(r=>({text:r.name,question:p.question.replace(new RegExp(p.ambiguous.matched.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i'),r.name)}))}};
 if(p.needsPlace)return {...base,text:p.intent==='vergleich'?'Welche zwei Gebiete soll ich vergleichen? Bitte nennen Sie beide, zum Beispiel „Vergleiche Köln und Dortmund“.':'Welches Gebiet meinen Sie? Nennen Sie bitte eine Gemeinde oder einen Kreis.'};
 if(!p.intent)return {...base,text:'Das habe ich nicht verstanden. Fragen Sie nach einem Thema und Ort („Was gibt es zu Photovoltaik in Billerbeck?“), nach dem Stand eines Vorgangs, nach der Entwicklung eines Themas oder ob ein Gebiet dabei ist.',links:[{text:'Zur Suche',link:'/'},{text:'Fragen und Antworten',link:'/faq'}]};

 if(p.intent==='hilfe'){
  const g=lookupGlossary(p.question);
  if(g)return {...base,text:g.text,links:[{text:'Mehr dazu',link:g.link}]};
  return {...base,text:'Dazu habe ich keinen Hilfetext. Die häufigsten Fragen stehen in den Fragen und Antworten; für alles andere hilft das Kontaktformular.',links:[{text:'Fragen und Antworten',link:'/faq'},{text:'Kontakt',link:'/kontakt'}]};
 }
 if(p.intent==='abdeckung'){
  const r=p.place.regions[0],c=await cachedCoverage(db,catalog,r.kind==='district'?'district':'city');
  const rows=c.coverage.filter(x=>r.members?r.members.some(m=>m.ags===x.ags):x.ags===r.ags);
  const count=rows.reduce((s,x)=>s+x.count,0);
  if(!count)return {...base,text:r.name+' ist noch nicht dabei: Es liegen keine Vorgänge aus diesem Gebiet vor. Sobald die Quelle angebunden ist, erscheint das Gebiet in der Datenabdeckung.',links:[{text:'Datenabdeckung',link:'/datenabdeckung'}]};
  return {...base,text:r.name+' ist dabei: '+n(count,'Vorgang','Vorgänge')+(rows.every(x=>x.complete)?', die Quelle wird vollständig abgerufen':', der Abruf ist noch nicht vollständig')+'.'+(c.updatedAt?' Datenstand '+fmt(c.updatedAt)+'.':''),links:[{text:'Vorgänge aus '+r.name,link:'/?q='+enc(r.shortName||r.name)},{text:'Datenabdeckung',link:'/datenabdeckung'}]};
 }
 if(p.intent==='alarm'){
  if(!p.topic&&!p.place)return {...base,text:'Wozu soll ich Bescheid sagen? Nennen Sie ein Thema, gern mit Ort („Sag mir Bescheid bei Windkraft in Coesfeld“).'};
  return {...base,text:'Dafür speichern Sie die Suche „'+(p.topic||placeName(p.place))+'“'+where+'. Neue Treffer kommen dann als Benachrichtigung. Ich öffne die Suche mit den passenden Einstellungen; dort wählen Sie „Suche speichern“.',links:[{text:'Suche öffnen und speichern',link:searchLink(p)}]};
 }
 if(p.intent==='vergleich'){
  const [a,b]=p.places.map(x=>x.regions[0]);
  const q=new URLSearchParams({q:p.topic||'',area:a.ags,scope:'with',more:b.ags+':with',to:new Date(now).toISOString().slice(0,10)});
  return {...base,text:'Den Vergleich von '+a.name+' und '+b.name+(p.topic?' zum Thema „'+p.topic+'“':'')+' zeigt der Gebietsvergleich mit Zahlen je Gebiet und Zeitraum.',links:[{text:'Gebietsvergleich öffnen',link:'/analytics/compare?'+q.toString()}]};
 }
 if(p.intent==='entwicklung'){
  if(!p.topic)return {...base,text:'Welches Thema meinen Sie? Nennen Sie einen Begriff, zum Beispiel „Wie entwickelt sich Wärmeplanung?“.'};
  const q=new URLSearchParams({q:p.topic,window:'90'});const r=p.place?.regions?.[0];if(r){q.set('area',r.ags);q.set('scope','with');}
  let t;try{t=await trends(db,catalog,q,now);}catch(e){if(e.status&&e.status<500)return {...base,text:'Für „'+p.topic+'“ kann ich keine Entwicklung berechnen: '+e.message,links:[{text:'Trends öffnen',link:'/analytics/trends?thema='+enc(p.topic)}]};throw e;}
  const {recent,prev}=t.totals,diff=recent-prev;
  const text=!recent&&!prev?'Zu „'+p.topic+'“'+where+' gibt es in den letzten 180 Tagen keine Vorgänge.':'„'+p.topic+'“'+where+': '+n(recent,'Vorgang','Vorgänge')+' in den letzten 90 Tagen, davor '+prev+'. '+(diff>0?'Das sind '+diff+' mehr':diff<0?'Das sind '+(-diff)+' weniger':'Das ist unverändert')+(t.totals.regions?', aus '+n(t.totals.regions,'Gebiet','Gebieten'):'')+'.';
  return {...base,text,links:[{text:'Trends öffnen',link:'/analytics/trends?thema='+enc(p.topic)},{text:'Ausbreitung öffnen',link:'/analytics/diffusion?thema='+enc(p.topic)}]};
 }
 /* Suche und Stand: die bestehende Suche, Treffer mit Fundstelle */
 /* Stand: der relevanteste Treffer (Begriff im Titel) statt des neuesten */
 let res;try{res=await search(db,catalog,p,{sort:p.intent==='stand'&&p.topic?'relevance':'desc'});}catch(e){if(e instanceof SearchError)return {...base,text:'Diese Frage kann ich so nicht suchen: '+e.message};throw e;}
 const hits=res.articles||[],total=res.total??hits.length;
 if(!hits.length){
  const alt=p.place?' Vielleicht ist der Ort anders geschrieben oder das Gebiet noch nicht dabei.':'';
  return {...base,text:'Zu „'+(p.topic||p.question)+'“'+where+(p.time?' im Zeitraum '+fmt(p.time.from)+' bis '+fmt(p.time.to):'')+' habe ich keine Vorgänge gefunden.'+alt+' Wenn Sie die Suche speichern, sage ich Bescheid, sobald etwas dazu erscheint.',links:[next(p,'Suche öffnen'),{text:'Datenabdeckung',link:'/datenabdeckung'}]};
 }
 if(p.intent==='stand'){
  const best=p.status?hits.find(a=>a.status===p.status)||hits[0]:hits[0];
  const steps=(best.steps||[]).map(s=>fmt(s.d)+' '+(STATUS_NAMES[s.s]||s.s)+(s.c?' ('+s.c+')':'')).join(', ');
  const several=hits.length>1?' Es gibt '+n(total,'weiteren Vorgang','Vorgänge')+' dazu; die Liste zeigt alle.':'';
  const text='„'+best.title+'“ ('+best.gemeinde+', '+fmt(best.date)+'): Stand '+(STATUS_NAMES[best.status]||'offen')+'.'+(steps?' Verlauf: '+steps+'.':'')+(p.status&&best.status!==p.status?' Einen Vorgang mit Stand „'+STATUS_NAMES[p.status]+'“ habe ich dazu nicht gefunden.':'')+several;
  return {...base,text,sources:hits.slice(0,5).map(source),links:[next(p,'Alle Treffer anzeigen')]};
 }
 const label=p.labels.length===1?' Thema: '+labelName(p.labels[0])+'.':'';
 return {...base,text:'Zu „'+(p.topic||placeName(p.place))+'“'+where+(p.time?' seit '+fmt(p.time.from):'')+': '+n(total,'Vorgang','Vorgänge')+'. Die neuesten:'+label,sources:hits.slice(0,5).map(source),links:[next(p,'Alle anzeigen'),{text:'Als Alarm speichern',link:searchLink(p)}]};
}
