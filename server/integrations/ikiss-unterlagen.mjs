import {collectSmall,day,plain,slug,FORMAL} from './small-common.mjs';
import {allowed} from './sessionnet.mjs';
// Öffentliche Sitzungsunterlagen auf einem IKISS-Webauftritt (advantic; Kreistag Hildburghausen, 24.10.2026). Kein
// Ratsinformationssystem: Eine Übersicht (und ihr Archiv) verlinkt je Sitzung eine Seite „Unterlagen der 20.
// Kreistagssitzung am 24. September 2026“; diese Seite listet die Beschlussvorlagen und Anlagen als PDF, jede mit einem
// Linktext aus Sitzungstag, TOP-Nummer, Vorlagennummer und Titel: „0.2026.09.24 - 09.1 BV 164-2026 Anpassung der …“.
// Gelesen werden nur die Übersichtsseiten des Katalogeintrags (source.pages) und die Sitzungsseiten (index.php?object=tx,…)
// derselben Adresse; die PDF-Dateien werden nur verlinkt. Die Seiten heißen „Öffentliche Sitzungsunterlagen“; einen
// nichtöffentlichen Teil zeigt die Website nicht.
const guard=(url,source)=>{
 allowed(url,source);const u=new URL(url);
 if((source.pages||[]).includes(url))return url;
 if(!/[?&]object=tx,\d+\.\d+\.\d+(?:&|$)/.test(u.search))throw Error('Nicht freigegebene Quelladresse');
 return url;
};
// „Bestätigung der Sitzungsniederschrift“ ist eine Formalie.
const MINUTES=/^(?:bestätigung|genehmigung)\s+der\s+(?:sitzungs)?niederschrift/i;
const MONTHS=['januar','februar','märz','april','mai','juni','juli','august','september','oktober','november','dezember'];
/** „1. August 2024“ oder „05.06.2025“ → JJJJ-MM-TT. */
export function germanDay(value){
 const s=plain(value).toLowerCase(),m=s.match(/(\d{1,2})\.\s*([a-zäöü]+)\s+(\d{4})/);
 if(m){const month=MONTHS.indexOf(m[2]);if(month>=0)return `${m[3]}-${String(month+1).padStart(2,'0')}-${m[1].padStart(2,'0')}`;}
 return day(s);
}
/** Sitzungen einer Übersichtsseite: [{url, date, body, title}]. */
export function parseIkissMeetings(html,base){
 const out=[];
 for(const a of String(html).matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)){
  const title=plain(a[2]),href=a[1].match(/href=["']([^"']+)["']/i)?.[1];
  const m=title.match(/^Unterlagen der\s+(?:\d+\.\s*)?(.+?)sitzung\s+(?:am|vom)\s+(.+)$/i);if(!m||!href)continue;
  const date=germanDay(m[2]);if(!date)continue;
  let url;try{url=new URL(href.replace(/&amp;/g,'&'),base).href;}catch{continue;}
  // „Kreistagssitzung“: das Fugen-s gehört nicht zum Gremium.
  const stem=m[1].trim().replace(/-$/,'').replace(/(tag|rat)s$/i,'$1');
  out.push({url,date,body:stem.charAt(0).toUpperCase()+stem.slice(1),title});
 }
 return out;
}
/** Tagesordnungspunkte einer Sitzungsseite aus den Linktexten ihrer Dateien; Anlagen gehören zu ihrer Vorlage. */
export function parseIkissItems(html,base,date){
 const groups=new Map();
 for(const a of String(html).matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)){
  const label=plain(a[2]),href=a[1].match(/href=["']([^"']+)["']/i)?.[1];
  const m=label.match(/^0\.(\d{4})\.(\d{2})\.(\d{2})\s*-\s*(\d+(?:\.\d+)*)\s+(.+)$/);if(!m||!href)continue;
  // TOP 0 ist die Einladung selbst, kein Punkt.
  if(!Number(m[4].split('.')[0]))continue;
  // Eine Datei einer anderen Sitzung (nachgereichte Unterlage mit anderem Tag) gehört nicht zu dieser.
  if(date&&`${m[1]}-${m[2]}-${m[3]}`!==date)continue;
  let url;try{url=new URL(href.replace(/&amp;/g,'&'),base).href;}catch{continue;}
  const number=String(Number(m[4].split('.')[0])),paper=m[5].match(/^((?:BV|IV)\s+\d+-\d{2,4})\b\s*(?:-\s*)?(.*)$/i),text=(paper?paper[2]:m[5]).trim();
  const annex=/^Anlage\b/i.test(text),key=paper?slug(paper[1]):'top-'+number;
  const g=groups.get(key)||{key,number,reference:paper?paper[1]:'',title:'',documents:[]};
  if(!annex&&!g.title)g.title=text;
  g.documents.push({title:label.replace(/^0\.\d{4}\.\d{2}\.\d{2}\s*-\s*/,''),url});
  groups.set(key,g);
 }
 // Eine Vorlage ohne Titel (nur „BV 116-2025“) sagt nichts über ihren Gegenstand und bleibt weg.
 return [...groups.values()].filter(g=>g.title).sort((a,b)=>Number(a.number)-Number(b.number));
}
export async function collectIkissUnterlagen(source,options){
 return collectSmall(source,{adapter:'ikiss-unterlagen',prefix:'ik',label:'(Sitzungsunterlagen der Website)',guard,
  async listMeetings(read){
   const found=new Map();
   for(const page of source.pages||[])for(const m of parseIkissMeetings(await read(page),page))if(!found.has(m.date+m.body))found.set(m.date+m.body,m);
   return [...found.values()];
  },
  async readMeeting(read,m){
   const items=parseIkissItems(await read(m.url),m.url,m.date).filter(i=>!FORMAL.test(i.title)&&!MINUTES.test(i.title)).map(i=>({...i,key:`${m.date}-${slug(m.body)}-${i.key}`}));
   return {date:m.date,body:m.body,items};
  }},options);
}
