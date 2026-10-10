import {collectSmall,day,plain} from './small-common.mjs';
import {allowed,decode} from './sessionnet.mjs';
import {parallel} from './oparl.mjs';
// hhdocuments ("Sitzungsplanung" / "Dokumentenwesen", TYPO3 extension of hhmedia, on the website of the municipality;
// Schwentinental). The site has no agenda text: it publishes the papers (Vorlagen, PDF) and relates each to the meetings that
// deal with it. Read are plain addresses of the public site only:
// - <base>dokumentenwesen: the list of all documents, newest first, 10 per page; the links of the next pages come from the page,
// - the detail page of a paper (tx_hhdocuments_documents[…], address from the list): its title, the bodies and the
//   "Zugehörige Sitzungen" (day, time, body, address of the meeting),
// Reports are the papers (Vorlagen) per meeting; the meeting is the day and body named by the paper's page. Minutes and
// invitations (PDF) are not read. The filters of the pages need a checksum of the site (cHash) and are not used.
const PAGES=/^(?:dokumentenwesen|sitzungsplanung)$/;
const KEYS=/^(?:currentPage|date_gt|date_lt|q|sorting|cHash|tx_hhdocuments_(?:documents|events)\[(?:action|controller|id|lookingfor)\])$/;
const guard=(url,source)=>{allowed(url,source);const u=new URL(url),rest=u.pathname.slice(new URL(source.base).pathname.length);
 if(!PAGES.test(rest)||![...u.searchParams.keys()].every(k=>KEYS.test(k)))throw Error('Nicht freigegebene Quelladresse');return url;};
export function detectHhDocuments(url,html=''){
 if(!/tx_hhdocuments_/.test(html))return null;
 const u=new URL(url),m=u.pathname.match(/^(.*\/)(?:sitzungsplanung|dokumentenwesen)$/);return u.protocol==='https:'&&m?{adapter:'hhdocuments',base:'https://'+u.host+m[1]}:null;
}
const unamp=v=>decode(v);
/** Rows of the document list: day, file name, category, bodies, address of the detail page; and the address of page n. */
export function parseHhList(html,base='https://example.invalid/x/'){
 const page=String(html),rows=[];
 for(const m of page.matchAll(/<tr>\s*<td class="date">([^<]*)<\/td>\s*<td class="name"><a[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a><\/td>\s*<td class="category">([^<]*)<\/td>\s*<td class="groups">([\s\S]*?)<\/td>\s*<td class="detail"><a href="([^"]*)"/g)){
  const date=day(m[1]);if(!date)continue;
  rows.push({date,file:plain(m[3]),fileUrl:unamp(m[2]),category:plain(m[4]),bodies:[...m[5].matchAll(/<span>([^<]*)<\/span>/g)].map(s=>plain(s[1])),detail:new URL(unamp(m[6]),base).href});
 }
 const next=n=>{const a=page.match(new RegExp(`href="([^"]*currentPage=${n}&amp;[^"]*)"`))?.[1];return a?new URL(unamp(a),base).href:null;};
 return {rows,next};
}
/** The detail page of a paper: title, day, category, bodies, file and the meetings {date,time,body,place,url}. */
export function parseHhDocument(html,base='https://example.invalid/x/'){
 const page=String(html),h1=plain(page.match(/<h1>([\s\S]*?)<\/h1>/)?.[1]||'');
 const label=name=>plain(page.match(new RegExp(`<label>${name}</label>\\s*<p[^>]*>([\\s\\S]*?)</p>`))?.[1]||'');
 const file=page.match(/<p class="name"><a[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/);
 const sessions=[...page.matchAll(/<tr>\s*<td class="date">([^<]*)<\/td>\s*<td class="date">([^<]*)<\/td>\s*<td class="title">([^<]*)<\/td>\s*<td class="location">([^<]*)<\/td>[\s\S]*?<td class="detail"><a href="([^"]*)"/g)]
  .map(s=>({date:day(s[1]),time:plain(s[2]),body:plain(s[3]),place:plain(s[4]),url:new URL(unamp(s[5]),base).href})).filter(s=>s.date);
 return {title:h1,date:day(label('Datum')),category:label('Kategorie'),file:file?{name:plain(file[2]),url:unamp(file[1])}:null,sessions};
}
/** Number of a paper from its file name: 2026_217_um23-ha23-st23_20260921_… → {year,number,version,reference,key}. */
export function hhPaper(file){
 const m=String(file).match(/^(\d{4})_(\d+)([-_]?[a-z])?_/i);if(!m)return null;
 return {reference:`${m[1]}/${m[2]}`,key:`${m[1]}-${m[2]}`,version:(m[3]||'').replace(/[-_]/,'').toLowerCase()};
}
const MAX_PAGES=90,LEAD_DAYS=30;
export async function collectHhDocuments(source,options){
 const meetingsByUrl=new Map();
 // The pages answer in 8 to 22 seconds each (measured 10.10.2026), hence the long timeout per page.
 return collectSmall(source,{adapter:'hhdocuments',prefix:'hh',label:'Sitzungsplanung',guard,timeoutMs:90000,
  async listMeetings(read,{fromDay}){
   const lead=new Date(fromDay+'T00:00:00Z');lead.setUTCDate(lead.getUTCDate()-LEAD_DAYS);const stop=lead.toISOString().slice(0,10);
   const papers=[],found=[];const out=[];out.issues=[];
   let url=source.base+'dokumentenwesen',n=1;
   while(url&&n<=MAX_PAGES){
    const {rows,next}=parseHhList(await read(url),source.base);
    for(const r of rows)if(r.category==='Vorlagen'&&r.date>=stop&&hhPaper(r.file))papers.push(r);
    url=rows.length&&rows.some(r=>r.date>=stop)?next(n+1):null;n++;
   }
   if(url)out.issues.push('Seitenlimit der Dokumentenliste erreicht; weiterer Import erforderlich.');
   let budget=false;
   await parallel(papers,async p=>{
    if(budget)return;
    try{found.push({p,doc:parseHhDocument(await read(p.detail),source.base)});}catch(e){if(/Zeitbudget/.test(e.message))budget=true;else out.issues.push('Vorlage '+p.file+': '+e.message);}
   },2);
   if(budget)out.issues.push('Zeitbudget der Quelle erreicht; nicht alle Vorlagen gelesen.');
   for(const {p,doc} of found){
    const paper=hhPaper(p.file);
    for(const s of doc.sessions){
     let m=meetingsByUrl.get(s.url);
     if(!m){m={...s,id:(s.url.match(/events%5D%5Bid%5D=([0-9a-f]+)|events\]\[id\]=([0-9a-f]+)/i)||[])[1]||s.url,items:new Map()};meetingsByUrl.set(s.url,m);}
     const item=m.items.get(paper.key)||{key:paper.key,number:'',reference:paper.reference,title:'',documents:[],version:''};
     // The latest version (letter) names the paper; every version is a document.
     if(!item.title||paper.version>=item.version){item.title=doc.title||p.file;item.version=paper.version;}
     item.documents.push({title:(doc.title||p.file)+(paper.version?` (Fassung ${paper.version})`:''),url:p.fileUrl});
     m.items.set(paper.key,item);
    }
   }
   out.push(...meetingsByUrl.values());
   return out;
  },
  async readMeeting(read,m){
   const found=meetingsByUrl.get(m.url);if(!found)return {empty:true,items:[]};
   return {date:found.date,body:found.body,items:[...found.items.values()].sort((a,b)=>a.key.localeCompare(b.key)).map(i=>({key:i.key,number:'',reference:i.reference,title:i.title,documents:[...new Map(i.documents.map(d=>[d.url,d])).values()]}))};
  }},options);
}
