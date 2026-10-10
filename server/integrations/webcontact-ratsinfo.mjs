import {collectSmall,plain,FORMAL} from './small-common.mjs';
import {allowed} from './sessionnet.mjs';
// Ratsinfo of the municipal website system of webcontact (Nuxt site, "Nk" templates; Stadt Burgbernheim). The page
// /ratsinfo/sitzungen/ builds its list in the browser from the public JSON interface of the site itself:
//   /api/cms/ratsinfosystem_sitzungen?taggingpfad=/ratsinfo/sitzungen/&seite=<n>&pro_seite=10&order[]=`datum` DESC
// Every entry is a meeting (day, title, place, address of its page) with the public agenda: the "Sitzungsbericht"
// (table of numbered items) or, in older entries, the "öffentliche Einladung" (numbered list, the title in bold, the
// result below). The login for council members (…/intern) is never requested; documents are not linked by the interface.
const API='api/cms/ratsinfosystem_sitzungen',DEFAULT_PATH='/ratsinfo/sitzungen/',PER_PAGE=10,MAX_PAGES=30;
const guard=(url,source)=>{
 allowed(url,source);const u=new URL(url),keys=[...u.searchParams.keys()];
 if(u.pathname!=='/'+API||keys.some(k=>!['taggingpfad','seite','pro_seite','order[]'].includes(k))||!/^\/[a-z0-9\-/]+\/$/.test(u.searchParams.get('taggingpfad')||'')||u.searchParams.get('order[]')!=='`datum` DESC')throw Error('Nicht freigegebene Quelladresse');
 return url;
};
export function detectWebcontactRatsinfo(url,html=''){
 let u;try{u=new URL(url);}catch{return null;}
 const page=String(html);
 if(u.protocol!=='https:'||!/TemplateRatsinfosystemUebersicht/.test(page)||!/\/api\/cms\/|\/_nuxt\//.test(page))return null;
 const path=page.match(/"taggingpfad":"(\/[a-z0-9\-/]+\/)"/)?.[1];
 return {adapter:'webcontact-ratsinfo',base:`https://${u.host}/`,...(path&&path!==DEFAULT_PATH?{path}:{})};
}
/** Day of the meeting in Germany (the interface gives UTC). */
export const meetingDay=iso=>{const d=new Date(iso);return Number.isNaN(d.getTime())?null:new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);};
const clean=html=>plain(String(html||'')).replace(/­/g,'').trim();
/** Items {number,title,result} of an agenda: table of the Sitzungsbericht or numbered list of the Einladung. */
export function parseAgendaHtml(html){
 const text=String(html||'').replace(/\r/g,'');
 const rows=[...text.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(r=>[...r[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(c=>clean(c[1]))).filter(c=>c.length>=2);
 if(rows.length)return rows.map(c=>({number:c[0].replace(/\.$/,''),title:c[1],result:c.slice(2).join(' ')})).filter(i=>i.number&&/\p{L}{2}/u.test(i.title));
 const items=[];
 for(const li of text.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)){
  const title=clean(li[1].match(/<strong\b[^>]*>([\s\S]*?)<\/strong>/i)?.[1]),result=clean(li[1].replace(/<strong\b[^>]*>[\s\S]*?<\/strong>/i,''));
  if(/\p{L}{2}/u.test(title))items.push({number:String(items.length+1),title,result});
 }
 return items;
}
/** Body from the title: "5. Sitzung des Stadtrates" -> "Stadtrat". */
export const bodyOf=title=>{const m=String(title).replace(/^\d+\.\s*/,'').replace(/^(?:öffentliche\s+)?Sitzung\s+(?:des|der)\s+/i,'').trim();return m?m.replace(/(rat)es$/i,'$1'):'Stadtrat';};
export async function collectWebcontactRatsinfo(source,options){
 const path=source.path||DEFAULT_PATH,pages=[],entries=new Map();
 const query=n=>{const q=new URLSearchParams({taggingpfad:path,seite:String(n),pro_seite:String(PER_PAGE)});q.append('order[]','`datum` DESC');return q.toString();};
 const load=async(read,n)=>{
  if(pages[n])return pages[n];
  return pages[n]=read(`${API}?${query(n)}`).then(text=>{
   let json;try{json=JSON.parse(text);}catch{throw Error('Unbekanntes Format der Sitzungsliste');}
   if(!Array.isArray(json.data))throw Error('Unbekanntes Format der Sitzungsliste');
   for(const e of json.data)entries.set(String(e.id),e);
   return json;
  });
 };
 return collectSmall(source,{adapter:'webcontact-ratsinfo',prefix:'wc',label:'Ratsinfo der Stadt-Website',guard,
  async listMeetings(read,{fromDay}){
   const rows=[];
   for(let n=1;n<=MAX_PAGES;n++){
    const json=await load(read,n);
    for(const e of json.data){const date=meetingDay(e.datum);if(date)rows.push({id:String(e.id),date,body:bodyOf(e.titel),url:new URL(e.detailURL,source.base).href});}
    const last=json.data.at(-1);if(!last||(meetingDay(last.datum)||'')<fromDay||n>=Number(json.seiten||1))break;
   }
   return rows;
  },
  async readMeeting(read,m){
   const e=entries.get(m.id);if(!e)return {empty:true,items:[]};
   const agenda=parseAgendaHtml(e.bericht?.sitzungsbericht_text||e.einladung?.einladung_oeffentlich||'');
   const items=agenda.filter(i=>!FORMAL.test(i.title)).map(i=>({key:`s${m.id}-t${i.number.replace(/[^0-9a-z]+/gi,'-')}`,number:i.number,title:i.title,documents:[],result:i.result}));
   return {date:m.date,body:m.body,items};
  }},options);
}
