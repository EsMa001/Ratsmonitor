// Step 5 of the measured estimate: condense the measurements into the two files the administration reads.
//   shared/estimate-samples.json      the random sample outside NRW: every drawn unit with the outcome of the source
//                                     search and, where a source could be read, the figures of its year
//   shared/document-size-sample.json  the measured size of documents (only when tmp/size/measured.json exists)
// Input: tmp/sample/sources.json, tmp/sample/year/*.json, tmp/size/measured.json. Works offline.
// Run: node scripts/estimate/build-samples.mjs      (TO=2026-10-02 fixes the end of the period)
import fs from 'node:fs';
import {rangeStart} from '../../shared/timeline.mjs';
import {profile} from '../../shared/estimate.mjs';
import {summarizeSize} from '../../shared/estimate-size.mjs';
const read=file=>JSON.parse(fs.readFileSync(file,'utf8')),dir='tmp/sample/';
const to=process.env.TO||new Date().toISOString().slice(0,10),from=rangeStart('12m',to,new Map());
const isPdf=d=>d.kind==='application/pdf'||d.kind==='pdf';
const units=read(dir+'sources.json').map(u=>{
 const row={id:u.id,name:u.name,level:u.level,state:u.state,population:u.population,class:u.class,members:u.members||null,outcome:u.outcome,system:u.system||null};
 const file=dir+'year/'+u.id+'.json';if(!u.source||!fs.existsSync(file))return row;
 const year=read(file);if(!year.ok)return {...row,error:year.error};
 // A report counts on the day it first stood on an agenda; only that day decides whether it belongs to the period.
 const reports=year.reports.filter(r=>r.days[0]>=from&&r.days[0]<=to),days=new Map();
 for(const r of reports)days.set(r.days[0],(days.get(r.days[0])||0)+1);
 const sorted=[...days.keys()].sort(),links=new Set(),unreadable=Object.entries(year.issues).filter(([kind])=>/Keine lesbare öffentliche Tagesordnung/.test(kind)).reduce((n,[,count])=>n+count,0);
 let withDocuments=0,linkCount=0;
 for(const r of reports){const pdfs=r.documents.filter(isPdf);if(pdfs.length)withDocuments++;linkCount+=pdfs.length;for(const d of pdfs)links.add(d.url);}
 return {...row,method:year.method,bodies:year.bodies||1,meetings:year.meetings,unreadableMeetings:unreadable,reports:reports.length,meetingDays:sorted.length,months:new Set(sorted.map(d=>d.slice(0,7))).size,firstDay:sorted[0]||null,lastDay:sorted.at(-1)||null,
  withDocuments,links:linkCount,documents:links.size,followUps:reports.filter(r=>r.days.length>1).length,consultations:reports.reduce((n,r)=>n+r.days.length,0),
  notes:Object.entries(year.issues).sort((a,b)=>b[1]-a[1]).slice(0,4).map(([kind,count])=>`${count}× ${kind}`),...profile([...days],from)};
});
fs.writeFileSync('shared/estimate-samples.json',JSON.stringify({builtAt:new Date().toISOString().slice(0,10),from,to,
 design:'Zufallsstichprobe je Bundesland und Größenklasse in Bayern, Rheinland-Pfalz, Schleswig-Holstein, Niedersachsen und Sachsen sowie alle Bezirke von Berlin und Hamburg; gezogene Mitgliedsgemeinden stehen für ihren Gemeindeverband.',units})+'\n');
const counted=units.filter(u=>u.reports!==undefined);
console.log(units.length,'Einheiten,',units.filter(u=>u.outcome==='connected').length,'mit lesbarer Quelle,',counted.length,'gezählt,',counted.reduce((n,u)=>n+u.reports,0),'Berichte im Zeitraum',from,'bis',to);
if(fs.existsSync('tmp/size/measured.json')){
 const size=summarizeSize(read('tmp/size/measured.json'));
 fs.writeFileSync('shared/document-size-sample.json',JSON.stringify(size)+'\n');
 console.log('Umfang:',size.areas.length,'Gebiete,',size.reports.length,'Berichte,',Math.round(size.documents.read),'verschiedene Dokumente gelesen');
}
