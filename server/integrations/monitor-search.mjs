import {LABELS,LABEL_VERSION,CLASSIFIER_VERSION} from '../../shared/labels.mjs';

export class SearchError extends Error { constructor(message,status=400){super(message);this.status=status;} }
const norm=s=>s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replaceAll('ß','ss');
export function parseMonitorSearch(params){
 const q=params.get('q')||'',area=params.get('area')||'',label=params.get('label')||'',month=params.get('month')||'',status=params.get('status')||'',level=params.get('level')||'city',sort=params.get('sort')||'desc',from=params.get('from')||'',to=params.get('to')||'',scope=params.get('scope')==='only'?'only':'with';
 const statuses=['announced','consulting','recommended','approved','rejected','postponed','info','unknown'];
 if(q.length>200||!/^\d{0,8}$/.test(area)||(area&&!['2','5','8'].includes(String(area.length)))||(label&&!LABELS.some(l=>l.name===label))||(month&&!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))||(from&&!/^\d{4}-\d{2}-\d{2}$/.test(from))||(to&&!/^\d{4}-\d{2}-\d{2}$/.test(to))||(status&&!statuses.includes(status))||!['city','district'].includes(level)||!['asc','desc'].includes(sort))throw new SearchError('Ungültiger Suchfilter.');
 const raw=params.get('page')||'1';if(!/^\d+$/.test(raw)||Number(raw)<1||Number(raw)>100000)throw new SearchError('Ungültige Seite.');
 const within=params.has('within')?params.get('within').split(',').filter(Boolean):null;
 if(within&&(within.length>500||within.some(a=>!/^\d{5}(\d{3})?$/.test(a))))throw new SearchError('Ungültiger Umkreis.');
 const revision=params.get('revision');if(revision!==null&&!/^\d+$/.test(revision))throw new SearchError('Ungültiger Datenstand.');
 const groups=q.split(/[,;|]/).map(g=>norm(g).split(/\s+/).filter(Boolean)).filter(g=>g.length).slice(0,8).map(g=>g.slice(0,12));
 return {q,terms:groups.flat(),groups,area,scope,label,month,from,to,status,level,sort,page:Number(raw),within,revision};
}

// Each query returns only public card fields or aggregates. Raw documents never leave D1.
export async function searchMonitor(db,catalog,params){
 const f=parseMonitorSearch(params),limit=20;
 /* Mit Gebiet: Kreis- und Gemeindeebene gemeinsam, der Umfang (nur/inklusive) entscheidet */
 const regions=f.area&&f.area.length>2?catalog:catalog.filter(r=>r.kind===f.level);
 const regionJSON=JSON.stringify(regions.map(r=>({id:r.id,ags:r.ags,name:r.name})));
 const labelSQL=`CASE WHEN json_extract(payload,'$.classification.version')='${LABEL_VERSION}' AND json_extract(payload,'$.classification.method')='${CLASSIFIER_VERSION}' AND json_extract(payload,'$.classification.evidence')=coalesce(nullif(json_extract(payload,'$.officialTitle'),''),json_extract(payload,'$.title'),'') THEN json_extract(payload,'$.classification.primary') ELSE 'unklar' END`;
 const cte=`WITH cards AS (SELECT topics.id,topics.region_id,coalesce(json_extract(r.value,'$.ags'),'') ags,json_extract(r.value,'$.name') gemeinde,substr(event_date,1,10) date,status,substr(coalesce(json_extract(payload,'$.title'),''),1,1000) title,substr(coalesce(json_extract(payload,'$.shortSummary'),''),1,1200) teaser,coalesce(json_extract(payload,'$.committee'),'') gremium,${labelSQL} label FROM topics JOIN json_each(?) r ON json_extract(r.value,'$.id')=topics.region_id WHERE json_extract(payload,'$.identity.mergedInto') IS NULL)`;
 const conditions=skip=>{
  const where=['1=1'],args=[];
  if(f.area&&skip!=='area'){
   if(f.area.length===2){where.push('ags LIKE ?');args.push(f.area+'%');}
   else if(f.scope==='only'){where.push('ags=?');args.push(f.area);}
   else if(f.area.length===5){where.push('ags LIKE ?');args.push(f.area+'%');}
   else{where.push('ags IN (?,?)');args.push(f.area,f.area.slice(0,5));}
  }
  if(f.within&&skip!=='area'){where.push('ags IN (SELECT value FROM json_each(?))');args.push(JSON.stringify(f.within));}
  if(f.label&&skip!=='label'){where.push('label=?');args.push(LABELS.find(l=>l.name===f.label).id);}
  if(f.month&&skip!=='month'){where.push('substr(date,1,7)=?');args.push(f.month);}
  if(f.from&&skip!=='month'){where.push('date>=?');args.push(f.from);}
  if(f.to&&skip!=='month'){where.push('date<=?');args.push(f.to);}
  if(f.status&&skip!=='status'){where.push('status=?');args.push(f.status);}
  let text="title||' '||teaser||' '||gremium||' '||gemeinde";
  for(const [from,to] of [['Ä','a'],['Ö','o'],['Ü','u'],['ä','a'],['ö','o'],['ü','u'],['ß','ss']])text=`replace(${text},'${from}','${to}')`;
  /* Mehrere Suchbegriffe: Komma trennt Alternativen (ODER), Wörter innerhalb eines Begriffs müssen alle vorkommen */
  const groups=(f.groups||[f.terms]).filter(g=>g.length);
  if(groups.length){where.push('('+groups.map(g=>'('+g.map(()=>`instr(lower(${text}),?)>0`).join(' AND ')+')').join(' OR ')+')');for(const g of groups)args.push(...g);}
  return {where:where.join(' AND '),args};
 };
 const query=(select,skip,tail='',extra=[])=>{const {where,args}=conditions(skip);return db.prepare(`${cte} ${select} FROM cards WHERE ${where} ${tail}`).bind(regionJSON,...args,...extra);};
 const [rev,total,rows,areas,labels,months,statuses,coverage]=await db.batch([
  db.prepare("SELECT coalesce((SELECT revision FROM data_revisions WHERE id='content'),0) revision"),
  query('SELECT count(*) n'),
  query("SELECT id,region_id,ags,gemeinde,date,status,title,teaser,gremium,label,(SELECT json_group_array(json_object('d',substr(json_extract(e.value,'$.date'),1,10),'s',json_extract(e.value,'$.status'),'c',json_extract(e.value,'$.committee'),'u',json_extract(e.value,'$.url'))) FROM topics t2,json_each(t2.payload,'$.events') e WHERE t2.id=cards.id) steps,(SELECT json_extract(t3.payload,'$.sourceUrl') FROM topics t3 WHERE t3.id=cards.id) src",undefined,`ORDER BY date ${f.sort==='asc'?'ASC':'DESC'},id ASC LIMIT ? OFFSET ?`,[limit,(f.page-1)*limit]),
  query('SELECT ags,count(*) n','area','GROUP BY ags'),
  query('SELECT label,count(*) n','label','GROUP BY label'),
  query("SELECT substr(date,1,7) month,count(*) n",'month','GROUP BY month'),
  query('SELECT status,count(*) n','status','GROUP BY status'),
  db.prepare("SELECT t.region_id,count(*) n,coalesce(json_extract(c.payload,'$.complete'),0) complete FROM topics t LEFT JOIN source_coverage c ON c.region_id=t.region_id WHERE json_extract(t.payload,'$.identity.mergedInto') IS NULL GROUP BY t.region_id")
 ]);
 const revision=String(rev.results[0].revision);
 if(f.revision!==null&&f.revision!==revision)throw new SearchError('Der Datenstand wurde geändert. Bitte die Suche neu laden.',409);
 const areaCounts={};for(const r of areas.results)for(const key of new Set([r.ags,r.ags.slice(0,5),r.ags.slice(0,2),'']))areaCounts[key]=(areaCounts[key]||0)+r.n;
 const byId=new Map(regions.map(r=>[r.id,r]));
 return {articles:rows.results.map(({label,region_id,steps,src,...r})=>({...r,steps:sameCommune(JSON.parse(steps||'[]'),src).filter(x=>x.d).map(({u,...x})=>x).sort((x,y)=>x.d<y.d?-1:1),regionId:region_id,thema:LABELS.find(l=>l.id===label)?.name||'Noch nicht eingeordnet'})),total:total.results[0].n,page:f.page,pageSize:limit,revision,areaCounts,themaCounts:Object.fromEntries(labels.results.map(r=>[LABELS.find(l=>l.id===r.label)?.name||'Noch nicht eingeordnet',r.n])),monatCounts:Object.fromEntries(months.results.filter(r=>/^\d{4}-\d{2}$/.test(r.month)).map(r=>[r.month,r.n])),statusCounts:Object.fromEntries(statuses.results.map(r=>[r.status,r.n])),coverage:coverage.results.filter(r=>byId.has(r.region_id)).map(r=>({ags:byId.get(r.region_id).ags,name:byId.get(r.region_id).name,count:r.n,complete:!!r.complete})),storageAvailable:true};
}

/** Nur Stationen aus derselben Kommune: gleiche Quelle (Host) wie der Vorgang */
export function sameHost(a,b){try{return new URL(a).host===new URL(b).host;}catch{return true;}}
function sameCommune(steps,src){return src?steps.filter(x=>!x.u||sameHost(x.u,src)):steps;}
