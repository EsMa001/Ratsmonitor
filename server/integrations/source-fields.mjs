// Compact public metadata only. Full HTML/PDF bodies are deliberately not archived.
const fields=['id','type','created','modified','deleted','name','shortName','reference','paperType','date','start','end','meetingState','cancelled','participant','location','license','keyword','number','order','public','result','role','authoritative','meeting','organization','invitation','resultsProtocol','verbatimProtocol','mainFile','auxiliaryFile','resolutionFile','web','agendaItem','consultation'];
export function compactOparl(record,kind){
 if(!record||typeof record!=='object')return null;
 const data={};for(const key of fields)if(record[key]!==undefined){
  if(['agendaItem','consultation'].includes(key))continue;
  const value=record[key];data[key]=Array.isArray(value)?value.map(v=>typeof v==='object'?v?.id||null:v).filter(v=>v!==null):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).filter(([k,v])=>['id','name','description','address','streetAddress','postalCode','locality','accessUrl','downloadUrl','mimeType','fileName','size','sha1Checksum','sha256Checksum'].includes(k)&&['string','number','boolean'].includes(typeof v))):value;
 }
 return {kind,fields:data};
}
export function sourceDecision(event){return {kind:{approved:'decision',rejected:'decision',recommended:'recommendation',info:'information',postponed:'postponed'}[event.status]||'unknown',text:event.result||'',date:event.date,sourceUrl:event.url,implementationStatus:'unknown'};}
export async function publicParticipants(meeting,resolve,fetchedAt){
 if(!Array.isArray(meeting.participant))return {status:'not_collected',sourceUrl:meeting.id,fetchedAt,people:[]};
 const people=[];let failed=false;
 for(const p of meeting.participant){try{const person=typeof p==='string'?await resolve(p):p;if(!person||person.deleted)continue;const name=person.name||[person.givenName,person.familyName].filter(Boolean).join(' ');if(name)people.push({name,role:'Teilnehmende laut öffentlichem Sitzungsdatensatz',presence:'present',sourceUrl:meeting.id});}catch{failed=true;}}
 return {status:failed?'not_collected':people.length?'available':'unavailable',sourceUrl:meeting.id,fetchedAt,people};
}
