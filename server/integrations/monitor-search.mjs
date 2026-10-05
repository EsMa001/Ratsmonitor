import {LABELS} from '../../shared/labels.mjs';

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
 /* Umkreis: Schlüssel der Gebiete darin (within) oder, wenn das die kürzere Liste ist, der Gebiete außerhalb (without).
    Kreis 5, Gemeinde 8, Gemeindeverband 9 Stellen */
 const keys=name=>params.has(name)?params.get(name).split(',').filter(Boolean):null;
 const within=keys('within'),without=keys('without');
 if([within,without].some(list=>list&&(list.length>2000||list.some(a=>!/^\d{5}(\d{3,4})?$/.test(a)))))throw new SearchError('Ungültiger Umkreis.');
 const revision=params.get('revision');if(revision!==null&&!/^\d+$/.test(revision))throw new SearchError('Ungültiger Datenstand.');
 /* Weitere Orte aus der Suche: "AGS:only|with" kommagetrennt, zusätzlich zu area (ODER-Verknüpfung) */
 const more=(params.get('more')||'').split(',').filter(Boolean).map(x=>{const [ags,sc]=x.split(':');return {ags,scope:sc==='with'?'with':'only'};});
 if(more.length>8||more.some(m=>!/^(\d{2}|\d{5}|\d{8})$/.test(m.ags)))throw new SearchError('Ungültige Ortsauswahl.');
 /* Komma, Semikolon, | und "oder" trennen Alternativen; Füllwörter tragen nichts zur Suche bei */
 const groups=q.split(/[,;|]|\s+oder\s+/i).map(g=>norm(g).split(/\s+/).filter(w=>w&&!FILLER.has(w))).filter(g=>g.length).slice(0,8).map(g=>g.slice(0,12));
 return {q,terms:groups.flat(),groups,area,scope,more,label,month,from,to,status,level,sort,page:Number(raw),within,without,revision,noformal:params.get('noformal')==='1'};
}

// Liest ausschließlich aus search_cards (per Trigger gepflegt, drizzle/0006): flache Spalten,
// keine JSON-Payloads im Suchpfad. Gebietsfilter werden in JS zu Region-ID-Listen übersetzt,
// damit SQL nur indexierbare IN-Listen sieht statt eines json_each-Joins pro Zeile.
export async function searchMonitor(db,catalog,params){
 const f=parseMonitorSearch(params),limit=20;
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
 const allIds=JSON.stringify(regions.map(r=>r.id)),scopedIds=JSON.stringify(scoped.map(r=>r.id));
 /* Begriff trifft auch den Gemeindenamen: passende Regionen vorab in JS ermitteln */
 const nameHits=term=>JSON.stringify(regions.filter(r=>norm(r.name).includes(term)).map(r=>r.id));
 const conditions=skip=>{
  const where=['region_id IN (SELECT value FROM json_each(?))'],args=[skip==='area'?allIds:scopedIds];
  if(f.label&&skip!=='label'){where.push('label=?');args.push(LABELS.find(l=>l.name===f.label).id);}
  if(f.month&&skip!=='month'){where.push("substr(date,1,7)=?");args.push(f.month);}
  if(f.from&&skip!=='month'){where.push('date>=?');args.push(f.from);}
  if(f.to&&skip!=='month'){where.push('date<=?');args.push(f.to);}
  if(f.status&&skip!=='status'){where.push('status=?');args.push(f.status);}
  /* Formalien ausblenden: Niederschriften, Mitteilungen, Anfragen, Eröffnung usw. (Titelanfang bzw. Titel) */
  if(f.noformal){where.push('NOT ('+FORMAL.map(()=>'lower(title) LIKE ?').join(' OR ')+')');args.push(...FORMAL);}
  /* Mehrere Suchbegriffe: Komma trennt Alternativen (ODER), Wörter innerhalb eines Begriffs müssen alle vorkommen */
  const groups=(f.groups||[f.terms]).filter(g=>g.length);
  if(groups.length){where.push('('+groups.map(g=>'('+g.map(()=>'(instr(search,?)>0 OR region_id IN (SELECT value FROM json_each(?)))').join(' AND ')+')').join(' OR ')+')');for(const g of groups)for(const term of g)args.push(term,nameHits(term));}
  return {where:where.join(' AND '),args};
 };
 /* Relevanz: Treffer im Titel zählen dreifach, im übrigen Text einfach; bei Gleichstand das Neueste zuerst */
 const rterms=f.sort==='relevance'?[...new Set(f.terms||[])]:[];
 const order=rterms.length?{sql:`ORDER BY (${rterms.map(()=>'(instr(lower(title),?)>0)*3+(instr(search,?)>0)').join('+')}) DESC,date DESC,id ASC LIMIT ? OFFSET ?`,args:rterms.flatMap(t=>[t,t])}:{sql:`ORDER BY date ${f.sort==='asc'?'ASC':'DESC'},id ASC LIMIT ? OFFSET ?`,args:[]};
 const query=(select,skip,tail='',extra=[])=>{const {where,args}=conditions(skip);return db.prepare(`${select} FROM search_cards WHERE ${where} ${tail}`).bind(...args,...extra);};
 const [rev,total,rows,areas,labels,statuses,coverage,stand]=await db.batch([
  db.prepare("SELECT coalesce((SELECT revision FROM data_revisions WHERE id='content'),0) revision"),
  query('SELECT count(*) n'),
  query("SELECT id,region_id,date,status,title,teaser,gremium,label,(SELECT json_group_array(json_object('d',substr(json_extract(e.value,'$.date'),1,10),'s',json_extract(e.value,'$.status'),'c',json_extract(e.value,'$.committee'),'u',json_extract(e.value,'$.url'))) FROM topics t2,json_each(t2.payload,'$.events') e WHERE t2.id=search_cards.id) steps,(SELECT json_extract(t3.payload,'$.sourceUrl') FROM topics t3 WHERE t3.id=search_cards.id) src",undefined,order.sql,[...order.args,limit,(f.page-1)*limit]),
  query('SELECT region_id rid,count(*) n','area','GROUP BY region_id'),
  query('SELECT label,count(*) n','label','GROUP BY label'),
  query('SELECT status,count(*) n','status','GROUP BY status'),
  db.prepare("SELECT sc.region_id,count(*) n,coalesce(json_extract(c.payload,'$.complete'),0) complete FROM search_cards sc LEFT JOIN source_coverage c ON c.region_id=sc.region_id GROUP BY sc.region_id"),
  /* Datenstand: jüngster erfolgreicher Abruf über alle Quellen */
  db.prepare("SELECT max(json_extract(payload,'$.importedAt')) at FROM source_coverage")
 ]);
 const revision=String(rev.results[0].revision);
 if(f.revision!==null&&f.revision!==revision)throw new SearchError('Der Datenstand wurde geändert. Bitte die Suche neu laden.',409);
 const areaCounts={};
 for(const r of areas.results){const region=byId.get(r.rid);if(!region)continue;const ags=region.ags;for(const key of new Set([ags,ags.slice(0,5),ags.slice(0,2),'']))areaCounts[key]=(areaCounts[key]||0)+r.n;
  /* Die Karte kennt nur Gemeinden: jede Mitgliedsgemeinde zeigt die Berichte ihrer Samtgemeinde */
  for(const key of [...(region.members||[]).map(m=>m.ags),...(region.formerAgs||[])])areaCounts[key]=(areaCounts[key]||0)+r.n;}
 return {articles:rows.results.map(({label,region_id,steps,src,...r})=>({...r,ags:byId.get(region_id)?.ags??'',gemeinde:byId.get(region_id)?.name??'',steps:sameCommune(JSON.parse(steps||'[]'),src).filter(x=>x.d).map(({u,...x})=>x).sort((x,y)=>x.d<y.d?-1:1),regionId:region_id,thema:LABELS.find(l=>l.id===label)?.name||'Noch nicht eingeordnet'})),total:total.results[0].n,page:f.page,pageSize:limit,revision,areaCounts,themaCounts:Object.fromEntries(labels.results.map(r=>[LABELS.find(l=>l.id===r.label)?.name||'Noch nicht eingeordnet',r.n])),monatCounts:{},statusCounts:Object.fromEntries(statuses.results.map(r=>[r.status,r.n])),coverage:coverage.results.filter(r=>byId.has(r.region_id)).flatMap(r=>{const region=byId.get(r.region_id),entry={count:r.n,complete:!!r.complete};return region.members?region.members.map(m=>({ags:m.ags,name:m.name+' ('+region.name+')',...entry})):[{ags:region.ags,name:region.name,...entry},...(region.formerAgs||[]).map(ags=>({ags,name:region.name,...entry}))];}),storageAvailable:true,updatedAt:stand.results[0]?.at||null};
}

/** Nur Stationen aus derselben Kommune: gleiche Quelle (Host) wie der Vorgang */
export function sameHost(a,b){try{return new URL(a).host===new URL(b).host;}catch{return true;}}
function sameCommune(steps,src){return src?steps.filter(x=>!x.u||sameHost(x.u,src)):steps;}
