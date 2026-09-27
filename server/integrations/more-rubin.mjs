import {historyStart,HISTORY_MONTHS} from './history-window.mjs';
import {budgeted} from './request-budget.mjs';
import {fetchText,allowed,text} from './sessionnet.mjs';
import {category,hash,sourceSummary} from './oparl.mjs';
export function mapRubinMeeting(m,source,now=new Date()){
 if(m.is_draft||String(m.fraktionssitzung)==='1')return [];
 const committee=(m.committees||[]).map(c=>c.name).join(', ')||m.titel;
 return (m.agenda_items||[]).filter(a=>Number(a.status)===1&&!a.is_draft&&a.title).map(a=>{
  const documents=(a.documents||[]).filter(d=>Number(d.documentPublicStatusId)===1&&!d.is_draft&&d.documentUrl).map(d=>({title:d.documentName||d.name||'Originalunterlage',url:allowed(d.documentUrl,source),kind:d.documentExtension==='pdf'?'application/pdf':'document'}));
  const result=text(a.abstimmungstext||'');let status=m.datum>now.toISOString().slice(0,10)?'consulting':'unknown';
  if(/kenntnis|information/i.test(a.counselling_status?.name||''))status=m.datum>now.toISOString().slice(0,10)?'announced':'info';
  if(m.datum>now.toISOString().slice(0,10)){}
  else if(/vertagt|zurückgestellt/i.test(result))status='postponed';
  else if(/angenommen|beschlossen|zugestimmt|abgelehnt/i.test(result))status=/^(?:Rat|Stadtrat|Gemeinderat|Stadtverordnetenversammlung|Kreistag)(?:\s|$)/i.test(committee)?(/abgelehnt/i.test(result)?'rejected':'approved'):'recommended';
  const id=/^\d+$/.test(a.vorlagennummer)?source.id+'-vo-'+a.vorlagennummer:source.id+'-top-'+a.ai_id;
  const url=allowed(m.full_url,source);return {id,regionId:source.id,source:source.kind,public:true,title:text(a.title),officialTitle:text(a.title),status,category:category(a.title),committee,eventDate:m.datum,updatedAt:now.toISOString(),reference:(a.documents||[]).find(d=>d.alias)?.alias||'',documents:[...documents,{title:'Öffentliche Sitzung',url,kind:'html'}],events:[{date:m.datum,committee,status,description:result||'Öffentlicher Tagesordnungspunkt; ein Beschlussergebnis ist im erfassten Text nicht belegt.',result,url}],sourceUrl:url,identityRecords:[{authority:new URL(source.base).origin,kind:'agenda',id:String(a.ai_id)},...(/^\d+$/.test(a.vorlagennummer)?[{authority:new URL(source.base).origin,kind:'paper',id:String(a.vorlagennummer)}]:[])],relevanceReason:'Öffentlicher Vorgang: '+source.name,sourceText:text(a.title)+'\n'+result};
 });
}
export async function collectRubin(source,{now=new Date(),get=fetchText,maxDurationMs=300000,onProgress=()=>{}}={}){
 get=budgeted(get,maxDurationMs,2);
 const from=historyStart(now);const end=new Date(now);end.setUTCMonth(end.getUTCMonth()+1);const issues=[],grouped=new Map();let count=0;
 const api=async params=>JSON.parse(await get(source.base+'api.php?'+new URLSearchParams({json:'true',...params}),source));
 const calendar=await api({id:'calendar',action:'get',from:from.toISOString().slice(0,7),to:end.toISOString().slice(0,7),view:'list',body_id:''});
 if(!Array.isArray(calendar.meetings))throw Error('Unbekanntes Kalenderformat der öffentlichen Schnittstelle');
 const meetings=calendar.meetings.filter(m=>m.datum>=from.toISOString().slice(0,10)&&!m.is_draft&&String(m.fraktionssitzung)!=='1');
 for(const meeting of meetings){try{const m=await api({id:'meetings',action:'get',meeting_id:meeting.nummer,with_agenda_item_documents:'true'});if(!Array.isArray(m.agenda_items))throw Error('Keine öffentliche Tagesordnung verfügbar');for(const t of mapRubinMeeting(m,source,now)){const old=grouped.get(t.id);if(old){old.events.push(...t.events);old.documents.push(...t.documents);old.identityRecords.push(...t.identityRecords);if(t.updatedAt>old.updatedAt)Object.assign(old,{updatedAt:t.updatedAt,status:t.status,eventDate:t.eventDate,committee:t.committee});}else grouped.set(t.id,t);}}catch(e){issues.push(meeting.full_url+': '+e.message);}onProgress(source.id+': '+(++count)+'/'+meetings.length);}
 const topics=[];for(const t of grouped.values()){t.events.sort((a,b)=>a.date.localeCompare(b.date));const last=t.events.at(-1);Object.assign(t,{status:last.status,eventDate:last.date,committee:last.committee});t.documents=[...new Map(t.documents.map(d=>[d.url,d])).values()];Object.assign(t,sourceSummary(t));t.longSummary[0]=t.longSummary[0].replace('in Münster','in '+source.name.replace(/^(Stadt|Gemeinde) /,''));t.quality={passed:false,checks:[{name:'Öffentliche Schnittstelle',passed:true,detail:'Anonymer Lesezugriff; öffentliche Tagesordnungspunkte.'},{name:'Inhaltliche Prüfung',passed:false,detail:'Quellenüberblick ohne abgeschlossene Qualitätsevaluation.'}],checkedAt:now.toISOString(),sourceHash:await hash(t.sourceText+JSON.stringify(t.events))};topics.push(t);}
 return {topics,coverage:{regionId:source.id,method:'official-api',from:from.toISOString().slice(0,10),to:now.toISOString().slice(0,10),importedAt:now.toISOString(),meetings:meetings.length,sourceCount:1,complete:issues.length===0&&topics.length>0,issues,sourceUrl:source.base}};
}
