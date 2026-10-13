import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {documentType,documentTypeFromText,primaryPdf} from '../../shared/document-type.mjs';

const sha256=text=>crypto.createHash('sha256').update(text,'utf8').digest('hex');
const words=text=>(text.match(/\S+/g)||[]).length;
const normalized=text=>String(text||'').normalize('NFC').replace(/\s+/g,' ').trim();
const titleKey=text=>normalized(text).toLocaleLowerCase('de-DE').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const pdfDocument=d=>d?.kind==='application/pdf'||/^application\/pdf\b/i.test(d?.mimeType||'')||/\.pdf(?:[?#]|$)/i.test(d?.url||'');
const joined=pages=>pages.map(p=>p.text).join('\f');
const validDate=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))?value:null;
const fetchDate=topic=>validDate(topic.metadata?.lastFetchedAt)||validDate(topic.sourceData?.fetchedAt);

function meaningful(text,minimum=12){
 const value=normalized(text);
 return value.length>=80&&words(value)>=minimum&&/\p{L}{3}/u.test(value);
}

function substantiveSavedText(topic){
 const text=typeof topic.sourceText==='string'?topic.sourceText:'';
 const metadata=new Set([topic.officialTitle,topic.title,...(topic.events||[]).flatMap(e=>[
  e.description,[e.date,e.description].filter(Boolean).join(' '),[e.date,e.committee,e.description].filter(Boolean).join(' '),
 ])].filter(Boolean).map(normalized));
 // Import adapters often store only the title and one dated line per event.
 const body=text.split(/\r?\n/).filter(line=>{
  const value=normalized(line);
  return value&&!metadata.has(value)&&!/^\d{4}-\d{2}-\d{2}(?:\s|$)/.test(value)&&!/^Drucksache\s+\S+(?:\s+der\s+.*)?$/i.test(value);
 }).join('\n');
 return meaningful(body,15)&&/[.!?](?:\s|$)|(?:Sachverhalt|Begr\u00fcndung|Beschlussvorschlag)\s*:/i.test(body)?body:null;
}

function sessionSource(doc,pages){
 const byTitle=documentType(doc.title),byText=documentTypeFromText(joined(pages));
 return ['minutes','invitation'].includes(byTitle)||['minutes','invitation'].includes(byText)||doc.role==='minutes'||doc.role==='bundle';
}

function sourceRole(doc,session){
 if(session)return /sammel|sitzungsmappe/i.test(doc.title||'')?'bundle':'minutes';
 return doc.kind==='page'?'item':'paper';
}

function relatedSection(topic,pages){
 const text=joined(pages),title=titleKey(topic.officialTitle||topic.title);
 if(title.length<12)return null;
 const headings=[],pattern=/(?:^|[\n\r\f])[ \t]*(?:[Oo\u00d6\u00f6]\s*)?(?:TOP|Tagesordnungspunkt)\s*[:.]?\s*\d+(?:[.,]\d+)*\s*[.):\-]?\s*([^\n\r\f]*)/gim;
 let match;
 while((match=pattern.exec(text))){
  const after=text.slice(pattern.lastIndex).split(/[\n\r\f]/).filter(line=>line.trim()).slice(0,2).join(' ');
  const heading=titleKey(match[1]),wrapped=titleKey(match[1]+' '+after);
  headings.push({start:match.index,title:heading,wrapped});
 }
 const matches=headings.map((heading,index)=>({heading,index})).filter(({heading})=>
  heading.title===title||heading.title.startsWith(title+' ')||heading.wrapped.startsWith(title+' '));
 // Repeated titles usually identify the agenda and the actual minutes; never guess between them.
 if(matches.length!==1)return null;
 const {heading,index}=matches[0],end=headings[index+1]?.start??text.length;
 const section=[];let offset=0;
 for(const page of pages){
  const from=Math.max(heading.start-offset,0),to=Math.min(end-offset,page.text.length);
  if(to>from)section.push({number:page.number,text:page.text.slice(from,to)});
  offset+=page.text.length+1;
 }
 return meaningful(joined(section))?section:null;
}

function safeTextPath(directory,sha){
 if(typeof sha!=='string'||!/^[a-f0-9]{64}$/.test(sha))return null;
 const file=path.join(directory,'files',sha.slice(0,2),sha+'.txt');
 try{
  const base=fs.realpathSync(directory),actual=fs.realpathSync(file),relative=path.relative(base,actual);
  return relative&&!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative)?actual:null;
 }catch{return null;}
}

/** Read only already stored text. Missing PDFs never cause a download, extraction or store initialization. */
export function createLocalSourceReader({directory=process.env.RM_PDF_STORE||'tmp/pdf-store'}={}){
 return async function loadSources(topic){
  const sources=[],gaps=[],byHash=new Map();
  const coverage={total:0,available:0,missing:0,partial:0,complete:false};
  const addGap=(doc,reason)=>{gaps.push({url:doc.url,title:doc.title||'',reason});coverage.missing++;};
  const addSource=(doc,pages,{method,fetchedAt,partial=false,rawHash}={})=>{
   const text=joined(pages),hash=sha256(text),alias={url:doc.url,title:doc.title||''};
   coverage.available++;if(partial)coverage.partial++;
   const prior=byHash.get(hash);
   if(prior){
    if(!prior.aliases.some(x=>x.url===doc.url))prior.aliases.push(alias);
    if(partial)prior.partial=true;
    return;
   }
   const source={id:'source-'+sha256(doc.url+'\n'+hash).slice(0,24),url:doc.url,title:doc.title||'',kind:doc.kind==='page'?'page':'attachment',
    role:sourceRole(doc,sessionSource(doc,pages)),hash,fetchedAt:fetchedAt||null,method:method||'saved-text',pages,words:words(text),partial,aliases:[alias],
    ...(rawHash&&rawHash!==hash?{rawHash}:{}),
   };
   sources.push(source);byHash.set(hash,source);
  };
  const unique=new Map();
  for(const doc of topic.documents||[])if(pdfDocument(doc)&&typeof doc.url==='string'&&doc.url)unique.set(doc.url,doc);
  const documents=[...unique.values()],primary=primaryPdf(documents);
  documents.sort((a,b)=>Number(b.url===primary?.url)-Number(a.url===primary?.url));
  let db,query,storeError;
  if(documents.length){
   try{
    db=new DatabaseSync(path.join(directory,'index.sqlite'),{readOnly:true});
    query=db.prepare(`SELECT p.sha256,p.status AS pdf_status,p.fetched_at,t.status AS text_status,t.method,t.ocr_needed,t.pages
     FROM pdfs p LEFT JOIN texts t ON t.sha256=p.sha256 WHERE p.url=?`);
   }catch{storeError='Die lokale Textablage ist nicht verfuegbar.';}
  }
  try{
   for(const doc of documents){
    coverage.total++;
    if(storeError){addGap(doc,storeError);continue;}
    const row=query.get(doc.url);
    if(!row||!['ok','text-only'].includes(row.pdf_status)||row.text_status!=='ok'){
     addGap(doc,'Keine gespeicherte Textfassung vorhanden.');continue;
    }
    const file=safeTextPath(directory,row.sha256);
    if(!file){addGap(doc,'Die gespeicherte Textdatei fehlt oder hat einen ungueltigen Pfad.');continue;}
    let text;
    try{text=fs.readFileSync(file,'utf8');}catch{addGap(doc,'Die gespeicherte Textdatei ist nicht lesbar.');continue;}
    let pages=text.split('\f').map((text,index)=>({number:index+1,text}));
    if(!meaningful(text)){addGap(doc,'Der gespeicherte Text enthaelt keinen ausreichenden Sachinhalt.');continue;}
    if(sessionSource(doc,pages)){
     const section=relatedSection(topic,pages);
     if(!section){addGap(doc,'Die Sitzungsunterlage hat keinen eindeutig zugeordneten Abschnitt fuer diesen Bericht.');continue;}
     pages=section;
    }
    const partial=Number(row.ocr_needed)>0||Number(row.pages)>text.split('\f').length;
    if(partial)gaps.push({url:doc.url,title:doc.title||'',reason:'Die Textfassung ist unvollstaendig; Seiten fehlen oder warten auf OCR.'});
    addSource(doc,pages,{method:row.method,fetchedAt:validDate(row.fetched_at),partial,rawHash:sha256(text)});
   }
  }finally{db?.close();}
  const saved=[['documentText',typeof topic.documentText==='string'&&meaningful(topic.documentText)?topic.documentText:null],
   ['sourceText',substantiveSavedText(topic)]];
  for(const [field,text] of saved){
   if(!text)continue;
   const comparable=normalized(text);
   if(sources.some(source=>normalized(joined(source.pages)).includes(comparable)))continue;
   const fallback='urn:ratsmonitor:article:'+encodeURIComponent(topic.id||'unknown')+':'+field;
   const url=field==='documentText'?(topic.documentSource||fallback):(topic.sourceUrl||fallback);
   const linked=unique.get(url),doc={url,title:linked?.title||topic.officialTitle||topic.title||'',kind:'page'};
   let pages=text.split('\f').map((text,index)=>({number:index+1,text}));
   coverage.total++;
   // A report title can mention minutes without naming the stored document; only its own header identifies unlinked meeting text.
   if(sessionSource(linked||{...doc,title:''},pages)){
    const section=relatedSection(topic,pages);
    if(!section){addGap(doc,'Der gespeicherte Sitzungstext hat keinen eindeutig zugeordneten Abschnitt fuer diesen Bericht.');continue;}
    pages=section;
   }
   addSource(doc,pages,{method:'database-'+field,fetchedAt:fetchDate(topic)});
  }
  coverage.complete=coverage.available>0&&coverage.missing===0&&coverage.partial===0;
  return {sources,gaps,coverage,ready:sources.length>0};
 };
}
