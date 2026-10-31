/**
 * Dokumentsuche (Pro, Seite /dokumente, Route app/api/dokumente/route.ts; Konzept requirements/dokumentsuche-konzept.md): sucht
 * im Dokumentindex (server/node/doc-index.mjs, eine Zeile je Seite der Hauptdokumente) und liefert Dokumente mit bis zu drei
 * Fundstellen (Seite und Auszug). Ohne Node-Module: Index und Textfassungen reicht der Aufrufer als reader herein (openDocReader;
 * im Node-Server env.DOC_INDEX oder der plenara.X-Worker), die Hauptdatenbank als D1-artiges db (Titel, Gremium, Unterlage).
 *
 * Ablauf: Suchtext → FTS5-Ausdruck (toMatch, nie Rohtext an MATCH) → Seiten mit Rang, gefiltert nach Gebiet, Zeitraum und
 * Dokumentart, höchstens CAND_MAX Seiten (sehr häufige Wörter: die besten, capped) → je Datei gruppiert → Seite der Liste
 * (20 Dokumente) mit Titel aus topics und Fundstellen aus den .txt-Dateien. Die Kandidaten sind je Stand des Index und Filter
 * zwischengespeichert; Blättern liest nur noch Titel und Fundstellen.
 * Gefiltert wird vor dem Rang (nicht wie im Konzept erst nach den besten 20.000 Seiten): sonst fände „Antrag“ in einer kleinen
 * Gemeinde nichts, weil ihre Seiten nicht unter den besten des ganzen Landes sind.
 */
import {norm} from './x-terms.mjs';
import {placeScope,regionCondition} from './monitor-search.mjs';

export class DocSearchError extends Error{constructor(message,status=400){super(message);this.status=status;}}
/** Höchstens so viele Seiten mit Treffer je Suche; darüber gilt die Trefferzahl als gedeckelt (capped) */
export const CAND_MAX=20000;
/** Höchste Seite der Liste, Fundstellen je Dokument, Zeichen je Auszug, Begriffe je Suche */
export const PAGE_MAX=50,SNIPPETS=3,SNIPPET_CHARS=160,MAX_TERMS=12;
/** Dokumentarten des Filters (Parameter art) → Arten der Ablage (shared/document-type.mjs, pdfs.model_type bzw. doc_type) */
export const DOC_ARTS=Object.freeze({
 vorlage:{label:'Vorlage oder Antrag',types:['paper']},
 beschluss:{label:'Beschluss',types:['decision']},
 niederschrift:{label:'Niederschrift',types:['minutes']},
 einladung:{label:'Einladung',types:['invitation']},
 anlage:{label:'Anlage',types:['attachment']},
 sonstige:{label:'Sonstiges',types:['other']},
});
const ART_OF=new Map(Object.entries(DOC_ARTS).flatMap(([k,a])=>a.types.map(t=>[t,k])));
/** Filter-Schlüssel zur Art der Ablage */
export const artOf=type=>ART_OF.get(type||'other')||'sonstige';
/* Füllwörter wie in der Suche (monitor-search.mjs); nur einzelne Wörter, nie in Phrasen */
const FILLER=new Set(['und','oder','der','die','das','den','dem','des','ein','eine','einer','in','im','am','an','zu','zum','zur','von','vom','fur','mit','bei','auf','aus','nach']);
const WORD=/[\p{L}\p{N}]+/gu;

/**
 * Suchtext → FTS5-MATCH. Wörter (UND, auf einer Seite), „oder“ (ODER), "Phrase", -wort (Dokumente ohne das Wort, eigener Ausdruck
 * exclude), wort* (Präfix ab 3 Zeichen), a NAHE b (höchstens
 * 10 Wörter Abstand). Wörter mit Bindestrich oder Schrägstrich werden zur Phrase („Kita-Gebühren“, „V/0486/2026“). Jedes Wort
 * kommt gefaltet (norm: klein, ohne Akzente, ß → ss) in doppelten Anführungszeichen; andere Zeichen fallen weg. Mit Umlaut gilt
 * auch die Schreibweise mit ae/oe/ue („Wärmeplanung“ findet „Waermeplanung“), außer in NAHE.
 * @returns {{match:string,exclude:string,terms:{words:string[],prefix:boolean}[],count:number}} terms: Begriffe für die Fundstellen
 */
export function toMatch(q){
 const text=String(q||'').replace(/[„“”‟″]/g,'"').trim();
 if(text.length>200)throw new DocSearchError('Der Suchtext ist zu lang (höchstens 200 Zeichen).');
 /* Wörter, Phrasen und Bedienwörter; ein unvollständiges Anführungszeichen am Ende gilt bis zum Schluss */
 const parts=[...text.matchAll(/(-?)"([^"]*)"?|(\S+)/g)];
 const groups=[[]];let neg=false,near=false;
 for(const m of parts){
  const raw=m[3];
  if(raw!==undefined){
   if(/^oder$/i.test(raw)||raw==='OR'){if(groups.at(-1).length)groups.push([]);neg=false;near=false;continue;}
   if(raw==='UND'||raw==='AND')continue;
   if(raw==='NICHT'||raw==='NOT'){neg=true;continue;}
   if(raw==='NAHE'||raw==='NEAR'){near=true;continue;}
  }
  const minus=raw!==undefined?raw.startsWith('-')&&raw.length>1:m[1]==='-';
  const body=raw!==undefined?(minus?raw.slice(1):raw):m[2];
  const star=raw!==undefined&&body.endsWith('*');
  const words=[...norm(body).matchAll(WORD)].map(x=>x[0]);
  /* Umlaute auch als ae, oe, ue (ältere Systeme, Dateinamen, OCR) */
  const alt=/[äöüÄÖÜ]/.test(body)?[...norm(body.replace(/[äöüÄÖÜ]/g,c=>({ä:'ae',ö:'oe',ü:'ue',Ä:'Ae',Ö:'Oe',Ü:'Ue'})[c])).matchAll(WORD)].map(x=>x[0]):null;
  if(!words.length){near=false;continue;}
  const phrase=raw===undefined||words.length>1;
  const prefix=star&&words.at(-1).length>=3;
  const item={words,alt,prefix,neg:neg||minus,phrase,near:near&&groups.at(-1).length>0};
  /* Füllwörter nur als einzelnes Wort ohne Zusatz */
  if(!phrase&&!prefix&&!item.neg&&!item.near&&FILLER.has(words[0]))item.filler=true;
  groups.at(-1).push(item);neg=false;near=false;
 }
 /* Ausschlüsse gelten für das ganze Dokument und die ganze Suche („radweg -anlage“: Dokumente, in denen „Anlage“ nirgends steht;
    seitenweise fände eine andere Seite desselben Dokuments es doch). Gesucht wird seitenweise: alle Wörter auf einer Seite. */
 const negs=groups.flat().filter(i=>i.neg);
 const clean=groups.map(g=>{const pos=g.filter(i=>!i.neg),rest=pos.filter(i=>!i.filler);return rest.length?rest:pos;}).filter(g=>g.length);
 const count=clean.flat().length+negs.length;
 if(!clean.length)throw new DocSearchError(negs.length?'Bitte mindestens einen Begriff ohne Minus angeben.':'Bitte einen Suchbegriff eingeben.');
 if(count>MAX_TERMS)throw new DocSearchError(`Bitte höchstens ${MAX_TERMS} Suchbegriffe verwenden.`);
 const quoted=(words,prefix)=>`"${words.join(' ')}"${prefix?'*':''}`;
 const phraseOf=(i,{alt=true}={})=>alt&&i.alt?`(${quoted(i.words,i.prefix)} OR ${quoted(i.alt,i.prefix)})`:quoted(i.words,i.prefix);
 const exprs=clean.map(g=>{
  /* NAHE verbindet ein Glied mit dem vorigen */
  const pos=[];
  for(const i of g){
   if(i.near&&pos.length)pos.at(-1).near.push(i);
   else pos.push({first:i,near:[]});
  }
  const terms=pos.map(p=>p.near.length?`NEAR(${[p.first,...p.near].map(i=>phraseOf(i,{alt:false})).join(' ')}, 10)`:phraseOf(p.first));
  return terms.length>1?`(${terms.join(' AND ')})`:terms[0];
 });
 return {match:exprs.length>1?exprs.map(e=>`(${e})`).join(' OR '):exprs[0],exclude:negs.map(i=>phraseOf(i)).join(' OR '),
  terms:clean.flat().flatMap(i=>[{words:i.words,prefix:i.prefix},...(i.alt?[{words:i.alt,prefix:i.prefix}]:[])]),count};
}

/** Parameter der Route prüfen (gleiche Regeln wie parseMonitorSearch, wo es dieselben gibt) */
export function parseDocSearch(params){
 const get=k=>params.get(k)||'';
 const q=get('q'),area=get('area'),scope=params.get('scope')==='only'?'only':'with',level=get('level'),from=get('from'),to=get('to'),sort=get('sort')||'relevance';
 if(!q.trim())throw new DocSearchError('Bitte einen Suchbegriff eingeben.');
 if(!/^\d{0,9}$/.test(area)||(area&&!['2','5','8','9'].includes(String(area.length)))||!['','city','district'].includes(level)||(from&&!/^\d{4}-\d{2}-\d{2}$/.test(from))||(to&&!/^\d{4}-\d{2}-\d{2}$/.test(to))||!['relevance','desc'].includes(sort))throw new DocSearchError('Ungültiger Suchfilter.');
 const arts=get('art').split(',').filter(Boolean);
 if(arts.some(a=>!DOC_ARTS[a]))throw new DocSearchError('Ungültige Dokumentart.');
 const keys=name=>params.has(name)?get(name).split(',').filter(Boolean):null;
 const within=keys('within'),without=keys('without');
 if([within,without].some(list=>list&&(list.length>2000||list.some(a=>!/^\d{5}(\d{3,4})?$/.test(a)))))throw new DocSearchError('Ungültiger Umkreis.');
 const more=get('more').split(',').filter(Boolean).map(x=>{const [ags,sc]=x.split(':');return {ags,scope:sc==='with'?'with':'only'};});
 if(more.length>8||more.some(m=>!/^(\d{2}|\d{5}|\d{8,9})$/.test(m.ags)))throw new DocSearchError('Ungültige Ortsauswahl.');
 const rawPage=get('page')||'1';if(!/^\d+$/.test(rawPage)||Number(rawPage)<1)throw new DocSearchError('Ungültige Seite.');
 if(Number(rawPage)>PAGE_MAX)throw new DocSearchError('Bitte grenzen Sie die Suche ein, um weitere Dokumente zu sehen.');
 const size=params.get('size');if(size!==null&&!['10','15','20'].includes(size))throw new DocSearchError('Ungültige Seitengröße.');
 const revision=params.get('revision');if(revision!==null&&!/^\d+$/.test(revision))throw new DocSearchError('Ungültiger Stand.');
 const {match,exclude,terms}=toMatch(q);
 return {q,match,exclude,terms,area,scope,more,within,without,level,from,to,sort,arts,types:arts.length?arts.flatMap(a=>DOC_ARTS[a].types):null,page:Number(rawPage),size:Number(size||20),revision};
}

/* Faltung je Zeichen wie norm, mit Rückweg in den Originaltext (Fundstellen zeigen das Original, gesucht wird gefaltet) */
const folds=new Map();
const foldChar=ch=>{const c=ch.charCodeAt(0);if(c<128)return c>=65&&c<=90?String.fromCharCode(c+32):ch;let f=folds.get(ch);if(f===undefined){f=norm(ch);folds.set(ch,f);}return f;};
function folded(text){
 let out='';const map=[];
 for(let i=0;i<text.length;){
  const ch=String.fromCodePoint(text.codePointAt(i)),f=foldChar(ch);
  for(let k=0;k<f.length;k++){out+=f[k];map.push(i);}
  i+=ch.length;
 }
 map.push(text.length);
 return {out,map};
}
const tidy=s=>s.replace(/\s+/g,' ');
/** Erste Stelle der Begriffe auf einer Seite als {before, hit, after} (Text, kein HTML), rund SNIPPET_CHARS Zeichen, an
    Wortgrenzen geschnitten; ohne Treffer der Anfang der Seite (hit leer) */
export function snippetOf(page,terms,chars=SNIPPET_CHARS){
 const text=String(page||'').replace(/(\p{L})-[ \t]*\r?\n[ \t]*(\p{Ll})/gu,'$1$2');
 const {out,map}=folded(text);
 const tokens=[...out.matchAll(WORD)].map(m=>({w:m[0],s:m.index,e:m.index+m[0].length}));
 let best=null;
 for(const t of terms){
  const n=t.words.length;
  for(let k=0;k+n<=tokens.length&&(!best||k<best[0]);k++){
   if(t.words.every((w,j)=>j===n-1&&t.prefix?tokens[k+j].w.startsWith(w):tokens[k+j].w===w)){best=[k,k+n-1];break;}
  }
 }
 const isSpace=c=>/\s/.test(c);
 if(!best){
  let end=Math.min(text.length,chars);
  if(end<text.length){const sp=text.lastIndexOf(' ',end);if(sp>chars/2)end=sp;}
  return {before:tidy(text.slice(0,end)).trim()+(end<text.length?' …':''),hit:'',after:''};
 }
 const s=map[tokens[best[0]].s],e=map[tokens[best[1]].e];
 const room=Math.max(40,chars-(e-s));
 let b=Math.max(0,s-Math.round(room*0.4));
 if(b>0){let i=b;while(i<s&&!isSpace(text[i]))i++;b=i<s?i+1:b;}
 let a=Math.min(text.length,e+(room-(s-b)));
 if(a<text.length){let i=a;while(i>e&&!isSpace(text[i]))i--;a=i>e?i:a;}
 const before=tidy(text.slice(b,s)).trimStart(),after=tidy(text.slice(e,a)).trimEnd();
 return {before:(b>0?'… ':'')+before,hit:tidy(text.slice(s,e)),after:after+(a<text.length?' …':'')};
}

/* Kandidaten je Stand des Index und Filter (ohne Seite), je reader höchstens KEEP Einträge, älteste zuerst verdrängt */
const kept=new WeakMap(),KEEP=40;
const byCatalog=new WeakMap();
const regionsById=catalog=>{let m=byCatalog.get(catalog);if(!m){m=new Map(catalog.map(r=>[r.id,r]));byCatalog.set(catalog,m);}return m;};

/** Seiten mit Treffer, gefiltert und je Datei gruppiert: {docs:[{fid,pages:[Seite…]}], capped, found} */
function candidates(reader,catalog,f){
 const where=[],args=[];
 const placed=f.area||f.more.length||f.within||f.without||f.level;
 if(placed){const c=regionCondition(placeScope(catalog,f).scoped.map(r=>r.id),catalog,'d.region_id');where.push(c.sql);args.push(c.arg);}
 if(f.from){where.push('d.event_date>=?');args.push(f.from);}
 if(f.to){where.push("d.event_date<=? AND d.event_date<>''");args.push(f.to);}
 if(f.types){where.push("COALESCE(d.doc_type,'other') IN (SELECT value FROM json_each(?))");args.push(JSON.stringify(f.types));}
 /* -wort: Dateien, in denen es auf irgendeiner Seite steht, fallen ganz weg */
 if(f.exclude){where.push('p.file_id NOT IN (SELECT file_id FROM doc_pages WHERE id IN (SELECT rowid FROM doc_fts WHERE doc_fts MATCH ?))');args.push(f.exclude);}
 const relevance=f.sort==='relevance';
 let rows;
 try{
  rows=!where.length&&relevance
   /* Ohne Filter: erst die besten Seiten im Index, dann nur diese mit Datei verbinden */
   ?reader.all(`WITH hits AS MATERIALIZED (SELECT rowid AS id,rank FROM doc_fts WHERE doc_fts MATCH ? ORDER BY rank LIMIT ${CAND_MAX+1})
     SELECT p.file_id AS fid,p.page FROM hits h JOIN doc_pages p ON p.id=h.id ORDER BY h.rank`,f.match)
   /* Mit Filter oder nach Datum: Filter vor dem Rang, damit kleine Gebiete auch bei häufigen Wörtern ihre Treffer bekommen */
   :reader.all(`SELECT p.file_id AS fid,p.page FROM doc_fts JOIN doc_pages p ON p.id=doc_fts.rowid JOIN doc_files d ON d.id=p.file_id
     WHERE doc_fts MATCH ?${where.map(w=>' AND '+w).join('')} ORDER BY ${relevance?'doc_fts.rank':'d.event_date DESC,d.id DESC,p.page'} LIMIT ${CAND_MAX+1}`,f.match,...args);
 }catch(e){
  if(e?.status===503)throw new DocSearchError('Die Dokumentsuche ist hier nicht eingerichtet.',503);
  throw new DocSearchError('Die Suche ließ sich so nicht ausführen. Bitte den Suchtext vereinfachen.');
 }
 const capped=rows.length>CAND_MAX;if(capped)rows.length=CAND_MAX;
 /* Reihenfolge des ersten Auftretens: nach Rang bzw. Datum; Seiten je Datei in derselben Reihenfolge */
 const docs=new Map();
 for(const r of rows){const d=docs.get(r.fid);if(d)d.pages.push(r.page);else docs.set(r.fid,{fid:r.fid,pages:[r.page]});}
 return {docs:[...docs.values()],capped,found:rows.length};
}

/** Suche ausführen: {total, capped, pagesFound, page, pageSize, revision, documents:[…]} */
export async function searchDocuments(db,reader,catalog,params){
 const f=parseDocSearch(params);
 if(!reader?.ready())throw new DocSearchError('Die Dokumentsuche ist hier nicht eingerichtet.',503);
 const revision=reader.revision()||'0';
 if(f.revision&&f.revision!==revision)throw new DocSearchError('Der Dokumentindex wurde gerade aktualisiert. Bitte die Suche neu starten.',409);
 const key=[revision,f.match,f.exclude,f.area,f.scope,JSON.stringify(f.more),f.within?.join(',')??'',f.without?.join(',')??'',f.level,f.from,f.to,f.sort,(f.types||[]).join(',')].join('|');
 let entries=kept.get(reader);if(!entries){entries=new Map();kept.set(reader,entries);}
 let c=entries.get(key);
 if(c){entries.delete(key);entries.set(key,c);}
 else{c=candidates(reader,catalog,f);entries.set(key,c);while(entries.size>KEEP)entries.delete(entries.keys().next().value);}
 const slice=c.docs.slice((f.page-1)*f.size,f.page*f.size);
 const documents=slice.length?await describe(db,reader,catalog,slice,f):[];
 return {total:c.docs.length,capped:c.capped,pagesFound:c.found,page:f.page,pageSize:f.size,revision,documents};
}

/* Angaben je Dokument: Datei aus dem Index, Titel und Unterlage aus topics, Fundstellen aus der Textfassung */
async function describe(db,reader,catalog,slice,f){
 const files=new Map(reader.all('SELECT id,sha256,url,topic_id,region_id,event_date,doc_type,pages FROM doc_files WHERE id IN (SELECT value FROM json_each(?))',JSON.stringify(slice.map(d=>d.fid))).map(r=>[r.id,r]));
 const topicIds=[...new Set([...files.values()].map(r=>r.topic_id).filter(Boolean))];
 let topics=new Map();
 try{
  const {results}=await db.prepare(`SELECT t.id,json_extract(t.payload,'$.title') AS title,json_extract(t.payload,'$.committee') AS committee,
   (SELECT json_group_array(json_object('u',json_extract(d.value,'$.url'),'t',json_extract(d.value,'$.title'))) FROM json_each(t.payload,'$.documents') d) AS docs
   FROM topics t WHERE t.id IN (SELECT value FROM json_each(?))`).bind(JSON.stringify(topicIds)).all();
  topics=new Map(results.map(r=>[r.id,r]));
 }catch{/* ohne Hauptdatenbank: Dokumente ohne Titel */}
 const regions=regionsById(catalog);
 return slice.map(d=>{
  const file=files.get(d.fid);if(!file)return null;
  const topic=topics.get(file.topic_id);
  let docs=[];try{docs=JSON.parse(topic?.docs||'[]');}catch{/* kaputte Angabe */}
  const docIndex=docs.findIndex(x=>x.u===file.url);
  const region=regions.get(file.region_id);
  const text=reader.pages(file.sha256);
  /* Bis zu drei Seiten: die besten (bzw. ersten) mit Treffer, in Seitenfolge */
  const pages=d.pages.slice(0,SNIPPETS).sort((a,b)=>a-b);
  return {
   id:String(d.fid),sha256:file.sha256,topicId:file.topic_id,
   title:(docIndex>=0&&docs[docIndex].t)||topic?.title||'Dokument',topicTitle:topic?.title||'',
   regionId:file.region_id,gemeinde:region?.name||'',ags:region?.ags||'',gremium:topic?.committee||'',date:file.event_date||'',
   art:artOf(file.doc_type),url:file.url,docIndex,pages:file.pages,hits:d.pages.length,
   snippets:text?pages.map(page=>({page,...snippetOf(text[page-1]||'',f.terms)})):[],
  };
 }).filter(Boolean);
}
