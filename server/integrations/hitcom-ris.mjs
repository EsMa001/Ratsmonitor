import {collectSmall,day,plain,slug} from './small-common.mjs';
import {allowed,decode} from './sessionnet.mjs';
// Rats-Info-System of hitcom (cEasy CMS, module cRis; Schiltach). Read are plain addresses of the public site only:
// - <page>/Ratsinformationssystem?filters[date]=<from>|<to>&doSearch=…: the meetings of a period (day, time, title, address),
// - <page>/Rats-Info-System/Sitzung?view=publish&item=meeting&id=<n>: body, day, time and the agenda (TOP, title and the
//   papers as links to ceasy/resource/<id>) and the minutes (PDF). The area for council members ("Login für Gemeinderäte")
//   is never requested; documents are only linked.
// The base is the page tree of the site (…/de/Rathaus/). The robots.txt is noted in the project, not followed.
const LIST=/\/Ratsinformationssystem$/,MEETING=/\/Rats-Info-System\/Sitzung$/;
const guard=(url,source)=>{allowed(url,source);const u=new URL(url);
 const ok=LIST.test(u.pathname)&&[...u.searchParams.keys()].every(k=>['filters[date]','doSearch'].includes(k))
  ||MEETING.test(u.pathname)&&u.searchParams.get('view')==='publish'&&u.searchParams.get('item')==='meeting'&&/^\d+$/.test(u.searchParams.get('id')||'')&&[...u.searchParams.keys()].length===3;
 if(!ok)throw Error('Nicht freigegebene Quelladresse');return url;};
export function detectHitcomRis(url,html=''){
 if(!/cRis_|Rats-Info-System\/Sitzung\?view=publish&(?:amp;)?item=meeting/.test(html)||!/hitcom|cEasy/i.test(html))return null;
 const u=new URL(url),m=u.pathname.match(/^(.*\/)[^/]+$/);return u.protocol==='https:'&&m?{adapter:'hitcom-ris',base:'https://'+u.host+m[1]}:null;
}
/** Meetings of a search result: id, day, time, title and the address, newest first. */
export function hitcomMeetings(html,base='https://example.invalid/'){
 const rows=[];
 for(const m of String(html).matchAll(/<div class="cCore_sectionHead">([^<]*)<\/div>\s*<div class="cCore_sectionBody">\s*<a href="([^"]*item=meeting&amp;id=(\d+))">([\s\S]*?)<\/a>/g)){
  const date=day(m[1]);if(!date)continue;
  rows.push({id:m[3],date,time:m[1].match(/(\d{1,2}:\d{2})/)?.[1]||'',title:plain(m[4]),url:new URL(decode(m[2]),base).href});
 }
 return rows.sort((a,b)=>b.date.localeCompare(a.date)||b.time.localeCompare(a.time));
}
/** A meeting page: title, body, day, time, place and the items {number,title,documents}, plus the minutes. */
export function parseHitcomMeeting(html){
 const page=String(html);
 const field=name=>plain(page.match(new RegExp(`<div[^>]*>${name}:</div>\\s*<div[^>]*>([\\s\\S]*?)</div>\\s*</div>`))?.[1]||'');
 const title=plain(page.match(/<h2 class="cCore_headline[^"]*">([\s\S]*?)<\/h2>/)?.[1]||'');
 const agenda=page.match(/<div class="cCore_block block_agendaPoints">([\s\S]*?)(?=<div class="cCore_bar |<\/article>|$)/)?.[1]||'';
 const items=[];
 for(const m of agenda.matchAll(/<div class="cCore_sectionHead">\s*TOP\s*([^<]*?)\s*<\/div>\s*<div class="cCore_sectionBody">([\s\S]*?)(?=<div class="cCore_section">|$)/g)){
  const body=m[2],head=body.split(/<ul\b/)[0];
  const documents=[...body.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map(a=>({title:plain(a[2]),url:decode(a[1])}));
  const t=plain(head);if(t)items.push({number:m[1].trim(),title:t,documents:[...new Map(documents.map(d=>[d.url,d])).values()]});
 }
 const minutes=[...(page.match(/<div class="cCore_block block_protocol">([\s\S]*?)<\/div>/)?.[1]||'').matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map(a=>({title:'Protokoll '+plain(a[2]),url:decode(a[1])}));
 return {title,body:plain(page.match(/<div[^>]*>Gremium:<\/div>\s*<div[^>]*>\s*(?:<a\b[^>]*>)?([\s\S]*?)(?:<\/a>)?\s*<\/div>/)?.[1]||''),date:day(field('Sitzungstermin')),time:field('Sitzungsbeginn').match(/(\d{1,2}:\d{2})/)?.[1]||'',items,minutes};
}
const FORMAL=/^(?:Fragestunde|Kurzbericht|Bekanntgaben?|Anfragen|Verschiedenes|Mitteilungen|Eröffnung|Genehmigung)/i;
export async function collectHitcomRis(source,options){
 return collectSmall(source,{adapter:'hitcom-ris',prefix:'hc',label:'Rats-Info-System',guard,
  async listMeetings(read,{fromDay,today}){
   const rows=[];
   for(let y=Number(fromDay.slice(0,4));y<=Number(today.slice(0,4))+1;y++){
    const q=new URLSearchParams({'filters[date]':`${y}-01-01|${y}-12-31`,doSearch:'Jetzt suchen'});
    try{rows.push(...hitcomMeetings(await read('Ratsinformationssystem?'+q),source.base));}catch(e){if(y<=Number(today.slice(0,4)))throw e;}
   }
   return rows.map(r=>({...r,body:r.title}));
  },
  async readMeeting(read,m){
   const p=parseHitcomMeeting(await read(`Rats-Info-System/Sitzung?view=publish&item=meeting&id=${m.id}`));
   if(!p.title&&!p.items.length)return {empty:true,items:[]};
   const items=p.items.filter(i=>i.documents.length||!FORMAL.test(i.title)).map(i=>({key:`m${m.id}-t${slug(i.number)}`,number:i.number,title:i.title,documents:i.documents}));
   // The minutes (PDF) belong to the meeting; they are attached to the items of its first report.
   if(items.length&&p.minutes.length)items[0].documents=[...items[0].documents,...p.minutes];
   return {date:p.date||m.date,body:p.body||m.title,items};
  }},options);
}
