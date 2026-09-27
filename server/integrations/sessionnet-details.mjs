import {text} from './sessionnet.mjs';
// Only the public attendance table, never names inferred from speeches or membership.
export function parseAttendance(html,sourceUrl,fetchedAt){
 const table=html.match(/<table\b[^>]*id=["']smc_page_to0045_contenttable1["'][^>]*>([\s\S]*?)<\/table>/i)?.[1];
 if(!table)return {status:'unavailable',sourceUrl,fetchedAt,people:[]};
 let group='',presence='unknown';const people=[];
 for(const match of table.matchAll(/<tr\b([^>]*)>([\s\S]*?)<\/tr>/gi)){
  const [_,attrs,row]=match;
  if(/smc-table-group/.test(attrs)){group=text(row);presence=/fehlen|abwesend/i.test(group)?'absent':'present';continue;}
  const cells=[...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(m=>text(m[1]));
  if(cells.length<3||!cells[0])continue;
  people.push({name:cells[0],role:[group,cells[2],cells[3]].filter(Boolean).join(' · '),presence,sourceUrl});
 }
 return {status:people.length?'available':'unavailable',sourceUrl,fetchedAt,people};
}
