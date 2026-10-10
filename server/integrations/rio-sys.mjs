import {collectSmall,day,plain} from './small-common.mjs';
import {allowed} from './sessionnet.mjs';
// rio-sys (Ratsinformationssystem "rio-sys App", PHP, <name>.rio-sys.de; Bad Boll). Read are plain addresses only:
// - index.php?b=sitzungen&jahr=<year>: all meetings of the year with their public agenda ("Öffentlich" tab) in one page:
//   day, time, place and body, the items with number and title and the papers (PDF, shown as an overlay),
// - index.php?b=termine&jahr=<year>: the calendar (only used to know which years exist; not needed for the import).
// Papers are linked as file.php?id=<id> (not read). A "Nichtöffentlich" tab, if a site had one, is never read: only the
// container data-id="oeff" is parsed. The robots.txt is noted in the project, not followed (the pages carry noindex).
const guard=(url,source)=>{allowed(url,source);const u=new URL(url);if(!/^\/(?:index\.php)?$/.test(u.pathname.slice(new URL(source.base).pathname.length-1))||!/^\?b=sitzungen&jahr=\d{4}$/.test(u.search))throw Error('Nicht freigegebene Quelladresse');return url;};
export function detectRioSys(url,html=''){
 const u=new URL(url);if(!/\.rio-sys\.de$/i.test(u.hostname)||!/rio-sys App/i.test(html))return null;
 return {adapter:'rio-sys',base:'https://'+u.host+'/'};
}
/** Meetings of a year page: id, day, time, place, body and the public items {number,title,documents}. */
export function parseRioSysYear(html,base='https://example.invalid/'){
 const meetings=[];
 for(const block of String(html).split('<div class="sitzungen-box">').slice(1)){
  const head=block.match(/<span class="bold">([^<]*)<\/span><br\s*\/?>\s*([^<]*)</);
  const date=day(head?.[1]||''),time=(head?.[1]||'').match(/(\d{1,2}:\d{2})/)?.[1]||'',id=block.match(/<a id="sitzung(\d+)">/)?.[1];
  if(!date||!id)continue;
  const label=plain(head[2]),cut=label.lastIndexOf(' - '),place=cut>0?label.slice(0,cut):'',body=cut>0?label.slice(cut+3):label;
  const open=block.match(/<div class="sitzungen-container" data-id="oeff">([\s\S]*?)(?=<div class="sitzungen-container"|<a id="sitzung\d+">|$)/)?.[1]||'';
  const items=[];
  for(const b of open.split('<div class="sitzungen-block">').slice(1)){
   const row=b.match(/<td width="50">([^<]*)<\/td>\s*<td width="">([\s\S]*?)<\/td>/);if(!row)continue;
   const number=plain(row[1]).replace(/\.0$/,''),title=plain(row[2]);
   const documents=[...b.matchAll(/<td width="" style="font-size:0\.8rem;" class="open-pdf-overlay" data-id="(\d+)"\s*>([^<]*)<\/td>/g)].map(d=>({title:plain(d[2]),url:new URL('file.php?id='+d[1],base).href}));
   if(title)items.push({number,title,documents});
  }
  meetings.push({id,date,time,place,body,items});
 }
 return meetings.sort((a,b)=>b.date.localeCompare(a.date)||b.time.localeCompare(a.time));
}
const FORMAL=/^(?:Eröffnung|Begrüßung|Einwohner|Bürgerfrage|Bekanntgabe|Verschiedenes|Anfragen|Mitteilungen|Genehmigung (?:der )?(?:Niederschrift|Tagesordnung)|Protokoll|Niederschrift|Feststellung)/i;
export async function collectRioSys(source,options){
 const years=new Map();
 const page=async(read,year)=>{if(!years.has(year))years.set(year,read('index.php?b=sitzungen&jahr='+year).then(h=>parseRioSysYear(h,source.base)));return years.get(year);};
 return collectSmall(source,{adapter:'rio-sys',prefix:'rs',label:'rio-sys',guard,
  async listMeetings(read,{fromDay,today}){
   const rows=[];
   for(let y=Number(fromDay.slice(0,4));y<=Number(today.slice(0,4))+1;y++){
    try{rows.push(...await page(read,y));}catch(e){if(y<=Number(today.slice(0,4)))throw e;}
   }
   return rows.map(r=>({...r,url:source.base+'index.php?b=sitzungen&jahr='+r.date.slice(0,4)+'&id='+r.id}));
  },
  async readMeeting(read,m){
   const found=(await page(read,Number(m.date.slice(0,4)))).find(r=>r.id===m.id);
   if(!found)return {empty:true,items:[]};
   const items=found.items.filter(i=>i.documents.length||!FORMAL.test(i.title)).map(i=>({key:`s${m.id}-t${slugNumber(i.number)}`,number:i.number,title:i.title,documents:i.documents}));
   return {date:found.date,body:found.body,items};
  }},options);
}
const slugNumber=n=>String(n).replace(/[^0-9a-z]+/gi,'-');
