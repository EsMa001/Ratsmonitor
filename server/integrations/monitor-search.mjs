import {LABELS} from '../../shared/labels.mjs';
import {knownWords,candidateCards,precomputedTotal,precomputedFacets} from './search-words.mjs';

/** Höchste abrufbare Ergebnisseite (20 Treffer je Seite) */
export const MAX_PAGE=250;
export class SearchError extends Error { constructor(message,status=400){super(message);this.status=status;} }
/* Typische Formalien einer Sitzung (Muster für LIKE auf den kleingeschriebenen Titel) */
const FORMAL=['%niederschrift%','%mitteilungen%','%anfragen%','verschiedenes%','%einwohnerfragestunde%','%fragestunde%','eröffnung%','%feststellung der%','%genehmigung der tagesordnung%','%tagesordnung%','%sitzungsprotokoll%','%protokoll der%','%bekanntgaben%','%bekanntgabe von%','berichte der verwaltung%','%verpflichtung%','%anträge der fraktionen%'];
const norm=s=>s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replaceAll('ß','ss');
const FILLER=new Set(['und','oder','der','die','das','den','dem','des','ein','eine','einer','in','im','am','an','zu','zum','zur','von','vom','fur','mit','bei','auf','aus','nach']);
export function parseMonitorSearch(params){
 const q=params.get('q')||'',area=params.get('area')||'',label=params.get('label')||'',month=params.get('month')||'',status=params.get('status')||'',level=params.get('level')||'city',sort=params.get('sort')||'desc',from=params.get('from')||'',to=params.get('to')||'',scope=params.get('scope')==='only'?'only':'with';
 const statuses=['announced','consulting','recommended','approved','rejected','postponed','info','unknown'];
 if(q.length>200||!/^\d{0,8}$/.test(area)||(area&&!['2','5','8'].includes(String(area.length)))||(label&&!LABELS.some(l=>l.name===label))||(month&&!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))||(from&&!/^\d{4}-\d{2}-\d{2}$/.test(from))||(to&&!/^\d{4}-\d{2}-\d{2}$/.test(to))||(status&&!statuses.includes(status))||!['city','district'].includes(level)||!['asc','desc','relevance'].includes(sort))throw new SearchError('Ungültiger Suchfilter.');
 const raw=params.get('page')||'1';if(!/^\d+$/.test(raw)||Number(raw)<1)throw new SearchError('Ungültige Seite.');
 /* Tiefe Seiten sind teuer (OFFSET) und für Menschen nutzlos: ab hier Suche eingrenzen */
 if(Number(raw)>MAX_PAGE)throw new SearchError('Bitte grenze die Suche ein, um weitere Treffer zu sehen.');
 /* Treffer je Seite: 20 (Standard) oder 15 (Handy) */
 const sizeRaw=params.get('size');if(sizeRaw!==null&&!['15','20'].includes(sizeRaw))throw new SearchError('Ungültige Seitengröße.');
 /* Umkreis: Schlüssel der Gebiete darin (within) oder, wenn das die kürzere Liste ist, der Gebiete außerhalb (without).
    Kreis 5, Gemeinde 8, Gemeindeverband 9 Stellen */
 const keys=name=>params.has(name)?params.get(name).split(',').filter(Boolean):null;
 const within=keys('within'),without=keys('without');
 if([within,without].some(list=>list&&(list.length>2000||list.some(a=>!/^\d{5}(\d{3,4})?$/.test(a)))))throw new SearchError('Ungültiger Umkreis.');
 /* part: nur die Ergebnisseite (mit gedeckelter Zählung) oder nur die Zähler; ohne Angabe beides wie bisher */
 const part=params.get('part')||'';if(!['','page','facets','stream'].includes(part))throw new SearchError('Ungültiger Antwortteil.');
 const revision=params.get('revision');if(revision!==null&&!/^\d+$/.test(revision))throw new SearchError('Ungültiger Datenstand.');
 /* Weitere Orte aus der Suche: "AGS:only|with" kommagetrennt, zusätzlich zu area (ODER-Verknüpfung) */
 const more=(params.get('more')||'').split(',').filter(Boolean).map(x=>{const [ags,sc]=x.split(':');return {ags,scope:sc==='with'?'with':'only'};});
 if(more.length>8||more.some(m=>!/^(\d{2}|\d{5}|\d{8})$/.test(m.ags)))throw new SearchError('Ungültige Ortsauswahl.');
 /* Komma, Semikolon, | und "oder" trennen Alternativen; Füllwörter tragen nichts zur Suche bei */
 const groups=q.split(/[,;|]|\s+oder\s+/i).map(g=>norm(g).split(/\s+/).filter(w=>w&&!FILLER.has(w))).filter(g=>g.length).slice(0,8).map(g=>g.slice(0,12));
 /* Jeder Begriff bindet zwei Parameter; D1 erlaubt höchstens 100 je Abfrage */
 if(groups.flat().length>30)throw new SearchError('Bitte höchstens 30 Suchwörter verwenden.');
 return {q,terms:groups.flat(),groups,area,scope,more,label,month,from,to,status,level,sort,page:Number(raw),size:Number(sizeRaw||20),part,within,without,revision,noformal:params.get('noformal')==='1'};
}

/* Spalten einer Ergebniszeile (mit den Stationen des Vorgangs), gemeinsam für Seite und Strom */
const ROW_SELECT=`SELECT id,region_id,date,status,title,teaser,gremium,label,(SELECT json_group_array(json_object('d',substr(json_extract(e.value,'$.date'),1,10),'s',json_extract(e.value,'$.status'),'c',json_extract(e.value,'$.committee'),'u',json_extract(e.value,'$.url'))) FROM topics t2,json_each(t2.payload,'$.events') e WHERE t2.id=search_cards.id) steps,(SELECT json_extract(t3.payload,'$.sourceUrl') FROM topics t3 WHERE t3.id=search_cards.id) src FROM search_cards`;
/* Strom: Karten in Stücken nach Datum durchsuchen (erstes Stück klein, dann wachsend) */
const STREAM_FIRST=2000,STREAM_MAX=150000;
const REVISION_SQL="SELECT coalesce((SELECT revision FROM data_revisions WHERE id='content'),0) revision";
/*
 * Gebiet als SQL-Bedingung. Eine lange Einschlussliste (ohne Ort: alle 5.030 Gemeinden) zwingt SQLite, über den
 * Gebietsindex jede Karte zu lesen und danach zu sortieren (erste Seite 730 ms bei 900.000 Karten). Umfasst die
 * Auswahl mehr als die Hälfte des Katalogs, schließt die Bedingung stattdessen die übrigen Gebiete aus; dann nutzt
 * die Ergebnisseite den Datumsindex und liest nur, bis 20 Treffer gefunden sind (4 bis 10 ms). Alle Gebiete in
 * search_cards stehen im Katalog; ein unbekanntes Gebiet würde bei einer großen Auswahl mitgezählt.
 */
function regionCondition(ids,catalog){
 if(ids.length*2<=catalog.length)return {sql:'region_id IN (SELECT value FROM json_each(?))',arg:JSON.stringify(ids)};
 const keep=new Set(ids);
 return {sql:'region_id NOT IN (SELECT value FROM json_each(?))',arg:JSON.stringify(catalog.filter(r=>!keep.has(r.id)).map(r=>r.id))};
}

// Liest ausschließlich aus search_cards (per Trigger gepflegt, drizzle/0006): flache Spalten,
// keine JSON-Payloads im Suchpfad. Gebietsfilter werden in JS zu Region-ID-Listen übersetzt.
// Zwei Abfragen statt sieben: die Ergebnisseite und eine Gruppierung nach Gebiet, Thema und Status über den Grundfilter
// (Zeitraum, Formalien, Begriffe), aus der Gesamtzahl und alle Zähler in JS entstehen. Der Index
// idx_search_cards_facets (drizzle/0010) deckt sie ab: rund 150 ms statt vier Läufen über alle Karten.
// Die Abdeckung (Gebiete mit Berichten, Stand des letzten Abrufs) hängt an keinem Filter: searchCoverage.
export async function searchMonitor(db,catalog,params){
 const f=parseMonitorSearch(params),limit=f.size;
 /* Mit Gebiet: Kreis- und Gemeindeebene gemeinsam, der Umfang (nur/inklusive) entscheidet */
 const places=[...(f.area?[{ags:f.area,scope:f.scope}]:[]),...f.more];
 /* Mit Gebiet (auch Bundesland) zählen Gemeinde- und Kreisebene gemeinsam; ohne Gebiet entscheidet die Ebene */
 const regions=places.length?catalog:catalog.filter(r=>r.kind===f.level);
 const byId=new Map(regions.map(r=>[r.id,r]));
 /* Regionen eines Orts je nach Umfang: nur das Gebiet oder inklusive Kreis bzw. Gemeinden.
    Eine niedersächsische Mitgliedsgemeinde liegt in ihrer Samtgemeinde: deren Rat und System führen ihre Vorgänge. */
 const isPlace=(r,ags)=>r.ags===ags||!!r.members?.some(m=>m.ags===ags)||!!r.formerAgs?.includes(ags);
 const inPlace=(r,{ags,scope})=>ags.length===2?r.ags.startsWith(ags):scope==='only'?isPlace(r,ags):ags.length===5?r.ags.startsWith(ags):isPlace(r,ags)||r.ags===ags.slice(0,5);
 let scoped=places.length?regions.filter(r=>places.some(p=>inPlace(r,p))):regions;
 const listed=list=>{const w=new Set(list);return r=>w.has(r.ags)||!!r.members?.some(m=>w.has(m.ags))||!!r.formerAgs?.some(a=>w.has(a));};
 if(f.within)scoped=scoped.filter(listed(f.within));
 if(f.without){const outside=listed(f.without);scoped=scoped.filter(r=>!outside(r));}
 const scopedIds=new Set(scoped.map(r=>r.id));
 /* Begriff trifft auch den Gemeindenamen: passende Regionen vorab in JS ermitteln (je Begriff einmal) */
 const names=regions.map(r=>[r.id,norm(r.name)]),hits=new Map();
 const nameHits=term=>{if(!hits.has(term))hits.set(term,JSON.stringify(names.filter(([,n])=>n.includes(term)).map(([id])=>id)));return hits.get(term);};
 /* Grundfilter: alles außer Gebiet, Thema und Status (die zählen die Facetten jeweils ohne sich selbst) */
 const base=()=>{
  const where=[],args=[];
  if(f.month){where.push("substr(date,1,7)=?");args.push(f.month);}
  if(f.from){where.push('date>=?');args.push(f.from);}
  if(f.to){where.push('date<=?');args.push(f.to);}
  /* Formalien ausblenden: Niederschriften, Mitteilungen, Anfragen, Eröffnung usw. (Titelanfang bzw. Titel) */
  if(f.noformal){where.push('NOT ('+FORMAL.map(()=>'lower(title) LIKE ?').join(' OR ')+')');args.push(...FORMAL);}
  /* Mehrere Suchbegriffe: Komma trennt Alternativen (ODER), Wörter innerhalb eines Begriffs müssen alle vorkommen */
  const groups=(f.groups||[f.terms]).filter(g=>g.length);
  if(groups.length){where.push('('+groups.map(g=>'('+g.map(()=>'(instr(search,?)>0 OR region_id IN (SELECT value FROM json_each(?)))').join(' AND ')+')').join(' OR ')+')');for(const g of groups)for(const term of g)args.push(term,nameHits(term));}
  return {where,args};
 };
 /* Seltene Wörter: die Wortliste nennt die Karten, in denen sie vorkommen. Dann werden Seite, Zähler und Strom nur über diese Karten
    gefragt (mit denselben Bedingungen wie sonst, das Ergebnis bleibt gleich), statt über alle. null: wie gewohnt über alle. */
 const nameHit=t=>catalog.some(r=>norm(r.name).includes(t));
 const nameIds=t=>catalog.filter(r=>norm(r.name).includes(t)).map(r=>r.id);
 const cand=f.part==='stream'||f.part==='page'||f.part==='facets'||f.part===''?await candidateCards(db,f.groups,{nameHit}):null;
 const candidates=cand?{sql:'id IN (SELECT value FROM json_each(?))',arg:JSON.stringify(cand)}:null;
 const labelId=f.label?LABELS.find(l=>l.name===f.label).id:null;
 /* Ergebnisseite: Gebiet, Thema und Status als Bedingung */
 const page=(()=>{const b=base(),region=regionCondition([...scopedIds],catalog),where=[region.sql,...b.where],args=[region.arg,...b.args];
  if(candidates){where.unshift(candidates.sql);args.unshift(candidates.arg);}
  if(labelId){where.push('label=?');args.push(labelId);}
  if(f.status){where.push('status=?');args.push(f.status);}
  return {where:where.join(' AND '),args};})();
 /* Relevanz: Treffer im Titel zählen dreifach, im übrigen Text einfach; bei Gleichstand das Neueste zuerst */
 const rterms=f.sort==='relevance'?[...new Set(f.terms||[])]:[];
 const order=rterms.length?{sql:`ORDER BY (${rterms.map(()=>'(instr(lower(title),?)>0)*3+(instr(search,?)>0)').join('+')}) DESC,date DESC,id ASC LIMIT ? OFFSET ?`,args:rterms.flatMap(t=>[t,t])}:{sql:`ORDER BY date ${f.sort==='asc'?'ASC':'DESC'},id ASC LIMIT ? OFFSET ?`,args:[]};
 /* Facetten: alle Gebiete der Ebene (mit Ort der ganze Katalog, dann ohne Gebietsbedingung) */
 const facet=(()=>{const b=base(),where=[...b.where],args=[...b.args];
  if(regions.length<catalog.length){where.unshift('region_id IN (SELECT value FROM json_each(?))');args.unshift(JSON.stringify(regions.map(r=>r.id)));}
  if(candidates){where.unshift(candidates.sql);args.unshift(candidates.arg);}
  return {where:where.length?'WHERE '+where.join(' AND '):'',args};})();
 /* Strom: erste Seite (neueste zuerst) in Etappen. Jede Etappe sucht ein Datumsfenster ab und liefert ihre Treffer sofort;
    es endet, sobald die Seite voll ist und ein weiterer Treffer zeigt, dass es weitergeht (oder alles gelesen ist). */
 if(f.part==='stream'){
  if(f.sort!=='desc'||f.page!==1)throw new SearchError('Der Strom liefert nur die erste Seite, neueste zuerst.');
  const mapStream=list=>list.map(({label,region_id,steps,src,...r})=>({...r,ags:byId.get(region_id)?.ags??'',gemeinde:byId.get(region_id)?.name??'',steps:sameCommune(JSON.parse(steps||'[]'),src).filter(x=>x.d).map(({u,...x})=>x).sort((x,y)=>x.d<y.d?-1:1),regionId:region_id,thema:LABELS.find(l=>l.id===label)?.name||'Noch nicht eingeordnet'}));
  return {stream:(async function*(){
   const revision=String((await db.prepare(REVISION_SQL).first())?.revision??0);
   /* Seltenes Wort: alle Treffer stehen in der Kandidatenliste, eine einzige Abfrage genügt */
   if(candidates){
    const res=await db.prepare(`${ROW_SELECT} WHERE ${page.where} ORDER BY date DESC,id ASC LIMIT ?`).bind(...page.args,limit+1).all();
    yield {known:res.results.length?'yes':'no'};
    if(res.results.length)yield {articles:mapStream(res.results.slice(0,limit))};
    yield {end:true,hasMore:res.results.length>limit,revision,pageSize:limit};
    return;
   }
   /* Vorab: kann der Begriff Treffer haben? „nein“ beendet die Suche sofort, „ja“ erlaubt der Oberfläche, ohne Warten loszulegen */
   const plain=!f.area&&!f.label&&!f.status&&!f.month&&!f.from&&!f.more.length&&!f.within&&!f.without&&!f.noformal;
   const known=await knownWords(db,f.groups,{plain,nameHit});
   /* Häufiges Wort ohne Filter: die Trefferzahl steht vorberechnet in der Wortliste und geht gleich mit */
   const single=plain&&f.groups.length===1&&f.groups[0].length===1?f.groups[0][0]:null;
   const total=single?await precomputedTotal(db,single,{level:f.level,to:f.to,levelIds:regions.map(r=>r.id),nameIds}):null;
   yield total===null?{known}:{known,total};
   if(known==='no'){yield {end:true,hasMore:false,revision,pageSize:limit};return;}
   let found=0,upper='9999-12-31~',size=STREAM_FIRST,more=false;
   while(true){
    const edge=await db.prepare('SELECT date FROM search_cards WHERE date<? ORDER BY date DESC LIMIT 1 OFFSET ?').bind(upper,size).first();
    const lower=edge?.date??'';
    const res=await db.prepare(`${ROW_SELECT} WHERE date>=? AND date<? AND ${page.where} ORDER BY date DESC,id ASC LIMIT ?`).bind(lower,upper,...page.args,limit+1-found).all();
    const rows=res.results.slice(0,limit-found);
    if(rows.length)yield {articles:mapStream(rows)};
    found+=res.results.length;
    if(found>limit){more=true;break;}
    if(!edge)break;
    upper=lower;size=Math.min(size*2,STREAM_MAX);
   }
   yield {end:true,hasMore:more,revision,pageSize:limit};
  })()};
 }
 /* Veralteter Datenstand beim Blättern: vor der Arbeit melden, nicht danach */
 if(f.revision!==null){const now=String((await db.prepare(REVISION_SQL).first())?.revision??0);if(now!==f.revision)throw new SearchError('Der Datenstand wurde geändert. Bitte die Suche neu laden.',409);}
 const pageSql=db.prepare(`${ROW_SELECT} WHERE ${page.where} ${order.sql}`).bind(...page.args,...order.args,limit+(f.part==='page'?1:0),(f.page-1)*limit);
 const facetSql=db.prepare(`SELECT region_id rid,label,status,count(*) n FROM search_cards ${facet.where} GROUP BY region_id,label,status`).bind(...facet.args);
 /* Häufiges Wort ohne Filter: die Zahlen je Gebiet, Thema und Status stehen vorberechnet in der Wortliste, dann entfällt die
    Gruppierung über alle Einträge. null: wie gewohnt gruppieren. */
 const plainSearch=!f.area&&!f.label&&!f.status&&!f.month&&!f.from&&!f.more.length&&!f.within&&!f.without&&!f.noformal;
 const pre=(f.part==='facets'||f.part==='')&&plainSearch&&f.groups.length===1&&f.groups[0].length===1&&!cand
  ?await precomputedFacets(db,f.groups[0][0],{level:f.level,to:f.to,levelIds:regions.map(r=>r.id),nameIds}):null;
 /* Reihenfolge der Antwort: Datenstand, dann je nach part die Seite und/oder die Zähler (Gruppierung) */
 const statements=[db.prepare(REVISION_SQL),...(f.part==='facets'?[]:[pageSql]),...(f.part==='page'||pre?[]:[facetSql])];
 const answers=await db.batch(statements);
 const rev=answers[0],rows=f.part==='facets'?{results:[]}:answers[1],groups=pre?{results:[]}:answers[answers.length-1];
 const revision=String(rev.results[0].revision);
 const mapRows=list=>list.map(({label,region_id,steps,src,...r})=>({...r,ags:byId.get(region_id)?.ags??'',gemeinde:byId.get(region_id)?.name??'',steps:sameCommune(JSON.parse(steps||'[]'),src).filter(x=>x.d).map(({u,...x})=>x).sort((x,y)=>x.d<y.d?-1:1),regionId:region_id,thema:LABELS.find(l=>l.id===label)?.name||'Noch nicht eingeordnet'}));
 if(f.revision!==null&&f.revision!==revision)throw new SearchError('Der Datenstand wurde geändert. Bitte die Suche neu laden.',409);
 /* Ergebnisseite ohne Gesamtzahl: einen Treffer mehr gelesen als angezeigt, daran erkennt „Weiter“, ob es weitergeht */
 if(f.part==='page')return {articles:mapRows(rows.results.slice(0,limit)),hasMore:rows.results.length>limit,page:f.page,pageSize:limit,revision,storageAvailable:true};
 /* Jede Facette zählt mit allen Filtern außer ihrem eigenen, wie zuvor die getrennten Abfragen */
 let total=0;const areaCounts={},labelCounts={},statusCounts={};
 const addArea=(region,n)=>{const ags=region.ags;for(const key of new Set([ags,ags.slice(0,5),ags.slice(0,2),'']))areaCounts[key]=(areaCounts[key]||0)+n;
  /* Die Karte kennt nur Gemeinden: jede Mitgliedsgemeinde zeigt die Berichte ihrer Samtgemeinde */
  for(const key of [...(region.members||[]).map(m=>m.ags),...(region.formerAgs||[])])areaCounts[key]=(areaCounts[key]||0)+n;};
 const perRegion=new Map();
 if(pre){
  /* Vorberechnet: ohne Filter liegt jedes Gebiet der Ebene im Umfang, Thema und Status sind die Summen der Wortliste */
  for(const [rid,n] of pre.regions){if(!byId.has(rid))continue;perRegion.set(rid,n);total+=n;}
  for(const r of pre.facets){
   const name=LABELS.find(l=>l.id===r.label)?.name||'Noch nicht eingeordnet';
   labelCounts[name]=(labelCounts[name]||0)+r.n;statusCounts[r.status]=(statusCounts[r.status]||0)+r.n;
  }
 }
 for(const r of groups.results){
  const region=byId.get(r.rid);if(!region)continue;
  const inScope=scopedIds.has(r.rid),labelOk=!labelId||r.label===labelId,statusOk=!f.status||r.status===f.status;
  if(inScope&&labelOk&&statusOk)total+=r.n;
  if(labelOk&&statusOk)perRegion.set(r.rid,(perRegion.get(r.rid)||0)+r.n);
  if(inScope&&statusOk){const name=LABELS.find(l=>l.id===r.label)?.name||'Noch nicht eingeordnet';labelCounts[name]=(labelCounts[name]||0)+r.n;}
  if(inScope&&labelOk)statusCounts[r.status]=(statusCounts[r.status]||0)+r.n;
 }
 for(const [rid,n] of perRegion)addArea(byId.get(rid),n);
 /* Abzeichen der Karte: jede Karte genau einmal, damit die Zahlen auf der Karte zusammen die Trefferzahl ergeben (areaCounts
    zählt einen Bericht einer Samtgemeinde bei jeder Mitgliedsgemeinde, das färbt die Karte, summiert aber zu viel). Der
    Bericht steht bei einer Mitgliedsgemeinde, bevorzugt bei einer, die zur Auswahl gehört. Nur Gebiete der Auswahl. */
 const chosen=ags=>f.within?f.within.includes(ags):places.length?places.some(p=>p.ags.length===8?ags===p.ags||(p.scope==='with'&&ags===p.ags.slice(0,5)):ags.startsWith(p.ags)):true;
 const badgeCounts={};
 for(const [rid,n] of perRegion){if(!scopedIds.has(rid))continue;const region=byId.get(rid),keys=region.members?region.members.map(m=>m.ags):[region.ags,...(region.formerAgs||[])],key=keys.find(chosen)??keys[0];badgeCounts[key]=(badgeCounts[key]||0)+n;}
 return {articles:mapRows(rows.results),total,page:f.page,pageSize:limit,revision,areaCounts,badgeCounts,themaCounts:labelCounts,monatCounts:{},statusCounts,storageAvailable:true};
}

/**
 * Gebiete einer Ebene mit Berichten (Anzahl, letzter Abruf vollständig) und der jüngste erfolgreiche Abruf. Ändert sich
 * nur mit Importen und hängt an keinem Suchfilter; früher Teil jeder Suchantwort (rund 400 KB je Anfrage).
 */
export async function searchCoverage(db,catalog,level){
 if(!['city','district'].includes(level))throw new SearchError('Ungültige Ebene.');
 const byId=new Map(catalog.filter(r=>r.kind===level).map(r=>[r.id,r]));
 const [coverage,stand]=await db.batch([
  db.prepare("SELECT sc.region_id,count(*) n,coalesce(json_extract(c.payload,'$.complete'),0) complete FROM search_cards sc LEFT JOIN source_coverage c ON c.region_id=sc.region_id GROUP BY sc.region_id"),
  /* Datenstand: jüngster erfolgreicher Abruf über alle Quellen */
  db.prepare("SELECT max(json_extract(payload,'$.importedAt')) at FROM source_coverage"),
 ]);
 return {level,coverage:coverage.results.filter(r=>byId.has(r.region_id)).flatMap(r=>{const region=byId.get(r.region_id),entry={count:r.n,complete:!!r.complete};return region.members?region.members.map(m=>({ags:m.ags,name:m.name+' ('+region.name+')',...entry})):[{ags:region.ags,name:region.name,...entry},...(region.formerAgs||[]).map(ags=>({ags,name:region.name,...entry}))];}),updatedAt:stand.results[0]?.at||null};
}

/*
 * Fertige Suchergebnisse je Anfrage, solange sich der Datenstand nicht ändert: Die Startabfrage ist für alle Besucher
 * eines Tages gleich, Zurückblättern und Filter zurücksetzen fragen dasselbe erneut. Gehalten im Speicher des laufenden
 * Workers (höchstens 200 Anfragen, älteste zuerst verdrängt), nur fertige Ergebnisse, nie eine laufende Abfrage.
 * Ein Treffer kostet eine Abfrage (der Datenstand) statt drei.
 */
const results=new WeakMap();
export async function cachedSearch(db,catalog,params,{max=200}={}){
 if(new URLSearchParams(params).get('part')==='stream')return searchMonitor(db,catalog,params);
 const query=new URLSearchParams(params);query.sort();const key=query.toString();
 let entries=results.get(db);if(!entries){entries=new Map();results.set(db,entries);}
 const hit=entries.get(key);
 if(hit){const now=String((await db.prepare(REVISION_SQL).first())?.revision??0);if(now===hit.value.revision){entries.delete(key);entries.set(key,hit);return hit.value;}}
 const value=await searchMonitor(db,catalog,params);
 entries.delete(key);entries.set(key,{value});
 while(entries.size>max)entries.delete(entries.keys().next().value);
 return value;
}
const coverages=new WeakMap();
/** searchCoverage, gehalten solange sich der Datenstand nicht ändert (je Ebene). */
export async function cachedCoverage(db,catalog,level){
 const now=String((await db.prepare(REVISION_SQL).first())?.revision??0);
 let entries=coverages.get(db);if(!entries){entries=new Map();coverages.set(db,entries);}
 const hit=entries.get(level);if(hit&&hit.revision===now)return hit.value;
 const value=await searchCoverage(db,catalog,level);entries.set(level,{revision:now,value});
 return value;
}

/** Nur Stationen aus derselben Kommune: gleiche Quelle (Host) wie der Vorgang */
export function sameHost(a,b){try{return new URL(a).host===new URL(b).host;}catch{return true;}}
function sameCommune(steps,src){return src?steps.filter(x=>!x.u||sameHost(x.u,src)):steps;}
