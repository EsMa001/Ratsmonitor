import {collectSmall,day,plain} from './small-common.mjs';
import {allowed,decode} from './sessionnet.mjs';
// "ris" (risng): the small Ratsinformationssystem of municipalities in Baden-Württemberg at ratsinformationssystem.<name>.de/ris
// (Beilstein, Leingarten, Neudenau; page title "Ratsinformationssystem <Name> - ris"). Read are plain addresses only:
// - /ris: one page with the meetings of all years, per year a month list (also reached as ?action=show_sitzungsliste),
// - /ris?action=show_sitzung&sitzung_id=<n>: body, day and the items (TOP) with their papers (links below /ris/) and the
//   published minutes of the item. The system shows the public part only; the papers themselves are only linked.
// The robots.txt is noted in the project, not followed (checked 10.10.2026: the pages carry meta robots "none").
const ACTION=/^\?action=show_sitzung(?:liste)?(?:&sitzung_id=\d+)?$/;
const guard=(url,source)=>{allowed(url,source);const u=new URL(url);if(u.pathname!==new URL(source.base).pathname||!(u.search===''||ACTION.test(u.search)))throw Error('Nicht freigegebene Quelladresse');return url;};
export function detectRisNg(url,html=''){
 const title=String(html).match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'';
 if(!/Ratsinformationssystem[^<]* - ris\s*$/i.test(title)||!/risng-table|show_sitzung/.test(html))return null;
 const u=new URL(url);return u.protocol==='https:'?{adapter:'ris-ng',base:'https://'+u.host+'/ris'}:null;
}
/** Meetings of the overview: id, day, time and body, newest first. */
export function risNgMeetings(html){
 const rows=[];let year=null;
 for(const m of String(html).matchAll(/<h2 class="risng">(\d{4})<\/h2>|<li\b[^>]*data-sitzung-id="(\d+)"[^>]*>([\s\S]*?)<\/li>/g)){
  if(m[1]){year=m[1];continue;}
  const t=plain(m[3]).match(/^(\d{1,2})\.(\d{1,2})\.\s*[-–]\s*(\d{1,2}:\d{2})\s*Uhr:\s*(.+)$/);
  if(!t||!year)continue;
  rows.push({id:m[2],date:`${year}-${t[2].padStart(2,'0')}-${t[1].padStart(2,'0')}`,time:t[3],body:t[4].trim()});
 }
 return rows.sort((a,b)=>b.date.localeCompare(a.date)||a.time.localeCompare(b.time));
}
/** A meeting page: body, day, time and the items {number, title, documents, protocol}. */
export function parseRisNgMeeting(html,base='https://example.invalid/ris'){
 const page=String(html),body=plain(page.match(/<h2 class="headline_2">([\s\S]*?)<\/h2>/)?.[1]||''),when=plain(page.match(/<p>(Sitzung am [^<]*)</)?.[1]||'');
 const items=[];
 for(const m of page.matchAll(/<li id="top_(\d+)">([\s\S]*?)(?=<li id="top_\d+">|<\/ul>)/g)){
  const inner=m[2],title=plain(inner.match(/<div class="ris_top_list_descr">([\s\S]*?)<\/div>/)?.[1]||'');
  const documents=[...inner.matchAll(/<div class="ris_top_list_file"><a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map(a=>({title:plain(a[2]),url:new URL(decode(a[1]),base).href}));
  const protocol=plain(inner.match(/<div class="ris_top_protokoll_text">([\s\S]*?)<\/div>\s*<\/div>\s*<\/li>/)?.[1]||inner.match(/<div class="ris_top_protokoll_text">([\s\S]*?)<\/div>/)?.[1]||'');
  if(title)items.push({number:m[1],title,documents,protocol});
 }
 return {body,date:day(when),time:when.match(/(\d{1,2}:\d{2}) Uhr/)?.[1]||'',items};
}
const FORMAL=/^(?:Einwohnerfragestunde|Fragestunde|Bekanntgaben?|Verschiedenes|Anfragen|Mitteilungen|Eröffnung|Genehmigung)/i;
export async function collectRisNg(source,options){
 return collectSmall(source,{adapter:'ris-ng',prefix:'rg',label:'ris',guard,
  async listMeetings(read){return risNgMeetings(await read('')).map(r=>({...r,url:source.base+'?action=show_sitzung&sitzung_id='+r.id}));},
  async readMeeting(read,m,s){
   const parsed=parseRisNgMeeting(await read('?action=show_sitzung&sitzung_id='+m.id),s.base);
   if(!parsed.body&&!parsed.items.length)return {empty:true,items:[]};
   const items=parsed.items.filter(i=>i.documents.length||i.protocol||!FORMAL.test(i.title)).map(i=>({key:`s${m.id}-t${i.number}`,number:i.number,title:i.title,documents:i.documents,result:i.protocol}));
   return {date:parsed.date,body:parsed.body||m.body,items};
  }},options);
}
