// Themenvorschläge für Social Media aus den Antworten des Modells (seit 22.10.2026, requirements/modell-konzept.md): statt
// Streitwörtern im Titel (social-topics.mjs, GROUPS) zählt das Unterthema des Modells. Je Unterthema eine gelernte Streitquote
// (shared/social-calibration-model.json, scripts/learn-social.mjs: Anteil abgelehnter, vertagter oder nur mehrheitlich
// beschlossener Vorgänge in 12 Monaten), Fraktionsantrag aus „Wer“, Bericht oder Antrag aus der Vorgangsart, Planungsvorgang und
// Routinesatzung aus Vorgangsart. Weiter wörtlich gelesen: Ergebnisse der Sitzungen (evidenceOf), Ortsteil-Gremium, Straße im
// Titel, Fachsprache, Parteinamen im Aufhänger. Eignung UNGEMESSEN: das Urteil der Bewerter (shared/social-ratings.json) und die
// Alltagsnähe hingen an Stichwörtern und fallen weg; die Prozentzahl ist eine Rangordnung.
import calibrationFile from '../../shared/social-calibration-model.json' with {type:'json'};
import {SUBTOPICS,THEMES} from '../../shared/themes.mjs';
import {SUBSUBS} from '../../shared/model/subsubs.mjs';
import {cleanTitle,loadEvidence,PARTIES,inPlace,hashtag,cap,STATUS_BOOST,clamp,JARGON,SMALL_BODY,STREET_WORD} from './social-topics.mjs';

const DAY=86400000;
const iso=t=>new Date(t).toISOString().slice(0,10);
const shift=(d,n)=>iso(Date.parse(d+'T00:00:00Z')+n*DAY);
const subName=id=>SUBTOPICS.find(s=>s.id===id)?.name||id;
const themeName=id=>THEMES.find(t=>t.id===id)?.name||id;
const arr=v=>{try{const a=JSON.parse(v||'[]');return Array.isArray(a)?a:[];}catch{return [];}};

/** Streitquote eines Unterthemas, zum Mittel hin gezogen (wenig Belege = nah am Mittel) */
export function subRate(sub,cal=calibrationFile){
 const base=cal.baseline?.contested??.3,t=cal.subs?.[sub];
 if(!t||!t.res)return {rate:base,n:0,base};
 const k=25;return {rate:(t.contested*t.res+base*k)/(t.res+k),n:t.res,base,raw:t.contested};
}

/** Bewertung einer Karte mit den Antworten des Modells ({subs,subsubs,process,applicants,kind}); null ohne Sachpunkt oder Unterthema */
export function scoreCard(card,cal=calibrationFile){
 if(card.kind!=='subject')return null;
 const subs=arr(card.subs);if(!subs.length||String(card.title||'').length<20)return null;
 const subsubs=arr(card.subsubs),applicants=arr(card.applicants);
 const hits=subs.map(id=>{const r=subRate(id,cal),ss=subsubs.find(x=>x.startsWith(id+'.'));
  return {sub:id,group:id.split('.')[0],groupName:themeName(id.split('.')[0]),term:ss?SUBSUBS[ss]||subName(id):subName(id),rate:r.rate,weight:2+6*r.rate};})
  .sort((a,b)=>b.weight-a.weight);
 let score=hits[0].weight+Math.min(hits.length-1,2)*.4;
 const party=card.process==='political'&&applicants.includes('fraction');
 if(party)score+=.5;
 score*=STATUS_BOOST[card.status]??.9;
 return {score:Math.round(score*100)/100,hits,party,residents:applicants.includes('residents')};
}

/**
 * Eignung in Prozent (Rangordnung, ungemessen). Teile: Themenwert 30 (Streitquote des Unterthemas), Streit im Vorgang 15,
 * Reichweite 10, Aktualität 10, Konkretheit 10, Verständlichkeit 10 (zusammen 85, auf 100 gestreckt); Abzüge wie früher:
 * Einzelstraße −5, Gremium eines Ortsteils −7, Planungsvorgang −5 (Vorgangsart Planung oder Genehmigung für Dritte),
 * Routinesatzung −15 (Vorgangsart Geld ohne Fraktionsantrag und ohne Streit).
 */
export function fitScore(c,{today,population={},evidence=null,calibration=calibrationFile}){
 const main=c.hits[0],tr=subRate(main.sub,calibration);
 const themenwert=Math.round(30*clamp((tr.rate-.12)/(.6-.12)));
 const res=evidence?.result||({rejected:'rej',postponed:'post'}[c.status])||null;
 let vorgang={rej:11,post:9,maj:8,unan:0,ok:2}[res]??3;
 if(c.party)vorgang+=4;
 if((evidence?.sessions||0)>=3)vorgang+=2;
 vorgang=Math.min(15,vorgang);
 const pop=population[c.region_id],reach=pop?Math.round(10*clamp((Math.log10(pop)-3.5)/2.2)):5;
 const days=Math.max(0,Math.round((Date.parse(today+'T00:00:00Z')-Date.parse(c.date+'T00:00:00Z'))/DAY));
 const fresh=days<=1?10:days<=3?9:days<=7?7:days<=14?4:2;
 const decisive=['rejected','postponed','approved','recommended'].includes(c.status)||['rej','post','maj'].includes(res);
 const concrete=(c.party?4:0)+(decisive?3:0)+(c.process==='political'||c.residents?2:0);
 let clear=10;
 if(JARGON.test(c.title))clear-=4;
 if(c.title.length>140)clear-=3;
 if(c.title.length<25)clear-=2;
 if((c.title.match(/;|\bhier\b|\bnach\b § /gi)||[]).length>=2)clear-=2;
 clear=Math.max(0,clear);
 let abzug=0;const why=[];
 if(STREET_WORD.test(c.title)&&!/straßen(namen|umbenennung)/i.test(c.title)){abzug-=5;why.push('Einzelstraße');}
 if(SMALL_BODY.test(c.gremium||'')){abzug-=7;why.push('Gremium eines Ortsteils');}
 if(c.process==='planning'||c.process==='permit'){abzug-=5;why.push('Planungsverfahren');}
 if(c.process==='money'&&!c.party&&!['rej','post','maj'].includes(res)&&!['rejected','postponed'].includes(c.status)){abzug-=15;why.push('Routinesatzung');}
 const parts=[
  {key:'thema',label:'Themenwert',points:themenwert,max:30},
  {key:'vorgang',label:'Streit im Vorgang',points:vorgang,max:15},
  {key:'reichweite',label:'Reichweite',points:reach,max:10},
  {key:'aktuell',label:'Aktualität',points:fresh,max:10},
  {key:'konkret',label:'Konkretheit',points:concrete,max:10},
  {key:'klar',label:'Verständlichkeit',points:clear,max:10},
 ];
 if(abzug)parts.push({key:'abzug',label:'Abzüge ('+why.join(', ')+')',points:abzug,max:0});
 const evidenceText=[];
 if(tr.n>=15)evidenceText.push(`Bei „${subName(main.sub)}“ endeten ${Math.round(100*(tr.raw??tr.rate))} % der Vorgänge streitig (Mittel aller Unterthemen ${Math.round(100*tr.base)} %, ${tr.n} Vorgänge mit Ergebnis)`);
 if(evidence?.result)evidenceText.push({rej:'Antrag abgelehnt',post:'vertagt oder verwiesen',maj:'mehrheitlich beschlossen, nicht einstimmig',unan:'einstimmig beschlossen',ok:'beschlossen'}[evidence.result]+(evidence.sessions>1?`, ${evidence.sessions} Sitzungen`:''));
 const sum=parts.reduce((n,x)=>n+x.points,0)*100/85;
 const percent=sum<=62?sum:62+(sum-62)*1.6;
 return {percent:Math.max(0,Math.min(100,Math.round(percent))),raw:Math.round(sum),parts,evidence:evidenceText,unmeasured:true};
}

/** Aufhänger: Bericht oder Antrag aus der Vorgangsart, Parteinamen und „Anfrage“ wörtlich aus dem Titel, Hashtag aus dem Unterthema */
export function draftText({title,status,region,term,process}){
 const low=title.toLowerCase();
 let parties=PARTIES.filter(([re])=>re.test(low)).map(x=>x[1]);
 if(parties.length>1&&/\b(zum|zu dem|gegen den|konkurrierend\w*|ersatz\w*)\b.{0,30}antrag/.test(low))parties=[];
 const isAnfrage=/\banfrage\b/.test(low)&&!/antrag/.test(low),isReport=!isAnfrage&&process==='information',isMotion=!isReport&&!isAnfrage&&process==='political';
 const place=inPlace(region),At=cap(place),quote=cleanTitle(title);
 if(quote.length<8||/(?<![\wäöüßÄÖÜ])(und|oder|der|des|zur|zum|von|für|mit)$/i.test(quote.replace(/ …$/,'')))return null;
 const q=`„${quote}“`;let text;
 if(parties.length&&parties.length<=2&&(isMotion||isAnfrage)){
  const nom=cap(parties.map(p=>p.nom).join(' und ')),gen=parties.map(p=>p.gen).join(' und '),plural=parties.length>1||parties[0].plural;
  if(isAnfrage)text=`${nom} ${plural?'fragen':'fragt'} ${place}: ${q}`;
  else text={rejected:`${At} wurde der Antrag ${gen} abgelehnt: ${q}`,postponed:`${At} wurde der Antrag ${gen} vertagt: ${q}`,approved:`${At} wurde der Antrag ${gen} angenommen: ${q}`,
   recommended:`${At} wurde der Antrag ${gen} zur Annahme empfohlen: ${q}`}[status]||`${nom} ${plural?'beantragen':'beantragt'} ${place}: ${q}`;
 }else if(isReport)text=`${At} gibt es einen Bericht: ${q}`;
 else text={rejected:`${At} abgelehnt: ${q}`,postponed:`${At} vertagt: ${q}`,approved:`${At} beschlossen: ${q}`,recommended:`${At} empfohlen: ${q}`}[status]||`${At} auf der Tagesordnung: ${q}`;
 return {text,question:`${term} ${place}: Was meinen Sie?`,hashtags:['#'+hashtag(term.split(/[,(]/)[0]),'#'+hashtag(region.replace(/^(Stadt|Gemeinde|Kreis|Landkreis) /,'')),'#Kommunalpolitik'],
  party:parties.length?parties.map(p=>p.nom.replace(/^(die|das) /,'')).join(' und '):null};
}

/**
 * @param {any} db @param {{id:string,name:string,shortName?:string,kind?:string}[]} regions
 * @param {{today?:string,days?:number,perDay?:number,minScore?:number,minFit?:number,population?:Record<string,number>,extraNames?:[string,string][]}} [o]
 */
export async function socialTopics(db,regions,{today=iso(Date.now()),days=30,perDay=3,minScore=2.8,minFit=40,population={},extraNames=[]}={}){
 const names=new Map([...extraNames,...regions.map(r=>[r.id,r.kind==='district'&&!/kreis/i.test(r.shortName||'')?'Kreis '+(r.shortName||r.name.replace(/^(Landkreis|Kreis) /,'')):(r.shortName||r.name)])]);
 const from=shift(today,-(days-1));
 const {results}=await db.prepare(`SELECT c.id,c.region_id,c.date,c.status,c.label,c.title,c.gremium,m.kind,m.subs,m.subsubs,m.process,m.applicants
  FROM search_cards c JOIN model_labels m ON m.topic_id=c.id WHERE c.date BETWEEN ? AND ? AND c.formal=0`).bind(from,today).all();
 const cards=results||[],scored=[],termRegions=new Map();
 for(const c of cards){const s=scoreCard(c);if(!s)continue;scored.push({...c,...s});
  for(const h of s.hits){let set=termRegions.get(h.sub);if(!set)termRegions.set(h.sub,set=new Set());set.add(c.region_id);}}
 // Derselbe Vorgang liegt oft mehrfach vor: je Ort, Unterthema und Woche nur der stärkste
 scored.sort((a,b)=>b.score-a.score||b.date.localeCompare(a.date)||a.id.localeCompare(b.id));
 const seen=new Set(),picked=[];
 for(const c of scored){
  if(c.score<minScore)break;
  const week=Math.floor(Date.parse(c.date+'T00:00:00Z')/(7*DAY)),k=w=>c.region_id+'|'+c.hits[0].sub+'|'+w;
  if(seen.has(k(week))||seen.has(k(week-1))||seen.has(k(week+1)))continue;
  seen.add(k(week));picked.push(c);
 }
 const dayList=[];for(let d=from;d<=today;d=shift(d,1))dayList.push(d);
 const evidence=await loadEvidence(db,picked.map(c=>c.id));
 for(const c of picked)c.fit=fitScore(c,{today,population,evidence:evidence.get(c.id)||null});
 picked.sort((a,b)=>b.fit.percent-a.fit.percent||b.score-a.score||a.id.localeCompare(b.id));
 const byDay=new Map(dayList.map(d=>[d,[]]));
 for(const c of picked){
  if(c.fit.percent<minFit||c.fit.parts.some(p=>/Routinesatzung/.test(p.label)))continue;
  const l=byDay.get(c.date);
  if(!l||l.length>=perDay||l.some(x=>x.region_id===c.region_id))continue;
  if(c.fit.percent<70&&l.some(x=>x.hits[0].sub===c.hits[0].sub))continue;
  l.push(c);
 }
 const chosen=[...byDay.values()].flat();
 const avgFit=chosen.length?Math.round(chosen.reduce((n,c)=>n+c.fit.percent,0)/chosen.length):null;
 return {
  from,to:today,perDay,scanned:cards.length,matched:scored.length,unmeasured:true,
  summary:{count:chosen.length,avgFit,strong:chosen.filter(c=>c.fit.percent>=70).length,daysWithTopic:[...byDay.values()].filter(l=>l.length).length,days:dayList.length,minFit},
  days:dayList.slice().reverse().map(d=>({date:d,topics:byDay.get(d).map(c=>topic(c,names,termRegions))})),
 };
}

function topic(c,names,termRegions){
 const main=c.hits[0],why=[subName(main.sub)];
 if(main.term!==subName(main.sub))why.push(main.term);
 if(c.party)why.push('Antrag einer Fraktion');
 if(c.residents)why.push('Antrag aus der Einwohnerschaft');
 if(c.status==='rejected')why.push('abgelehnt');
 if(c.status==='postponed')why.push('vertagt');
 const region=names.get(c.region_id)||c.region_id;
 return {
  draft:draftText({title:c.title,status:c.status,region,term:main.term,process:c.process}),
  fit:c.fit,id:c.id,title:c.title,date:c.date,status:c.status,region,regionId:c.region_id,
  gremium:c.gremium||'',group:main.groupName,term:main.term,score:c.score,why,
  otherPlaces:Math.max(0,(termRegions.get(main.sub)?.size||1)-1),
  link:'/beschluss/'+encodeURIComponent(c.id),search:'/suche?q='+encodeURIComponent(cleanTitle(c.title,60)),
 };
}
