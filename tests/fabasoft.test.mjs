// Öffentliche Ordner der Fabasoft Cloud (server/integrations/fabasoft.mjs), Bad Homburg 2026
import test from 'node:test';
import assert from 'node:assert/strict';
import {collectFabasoft,fabasoftUrl,fabasoftEntries,fabasoftMeeting,fabasoftItem,FABASOFT_BASE} from '../server/integrations/fabasoft.mjs';
import {READERS} from '../server/integrations/readers.mjs';

const row=(key,name,kind)=>({'l$key':key,'l$dataLeader':{'l$dataEntry':[{_:name},{_:kind}]}});
const folder=(caption,rows)=>JSON.stringify({'p$caption':caption,'p$docBody':{'p$pageData':[{'l$list':[{'l$listBody':[{'l$listData':rows}]}]}]}});
const share='0m8xf4raixfz10i9qzgdxdt5ar',M1='COO.6505.1000.41.2398065',M2='COO.6505.1000.45.4109216',T1='COO.6505.1000.42.2880609',T2='COO.6505.1000.43.2880609',T3='COO.6505.1000.44.2880609',D1='COO.6505.1000.41.2880630',D2='COO.6505.1000.44.2880659',E1='COO.6505.1000.42.2880621';
const answers={
 [fabasoftUrl(share)]:folder('Stadtverordnetenversammlung 2026 (öffentlich)',[row(M1,'Stadtverordnetenversammlung  2026-09-10 18:30:00','Ordner'),row(M2,'Stadtverordnetenversammlung  2026-10-29 18:00:00','Ordner'),row('COO.6505.1000.1.1','Stadtverordnetenversammlung 2025-02-12 18:30:00','Ordner')]),
 [fabasoftUrl(share,[M1])]:folder('Stadtverordnetenversammlung  2026-09-10 18:30:00',[row(E1,'Stadtverordnetenversammlung  2026-09-10 18:30:00 E I N L A D U N G','PDF-Dokument (.pdf)'),row(T1,'TOP 04 - Tagesordnung I - SV 26/41-5 Radschnellweg Vordertaunus (FRM 5): Sachstand und weiteres Vorgehen','Ordner'),row(T2,'TOP 01 - Tagesordnung I - Mitteilungen des Magistrats','Ordner')]),
 [fabasoftUrl(share,[M1,T1])]:folder('TOP 04',[row(D1,'Stadtverordnetenversammlung  2026-09-10 18:30:00: SV 26/41-5','PDF-Dokument (.pdf)'),row(D2,'Mobilitätsausschuss 2026-06-10 18:30:00: SV 26/41-2','PDF-Dokument (.pdf)')]),
 [fabasoftUrl(share,[M2])]:folder('Stadtverordnetenversammlung  2026-10-29 18:00:00',[row(T3,'TOP 07 - Tagesordnung II - SV 26/41-6 Radschnellweg Vordertaunus (FRM 5): Baubeschluss','Ordner')]),
 [fabasoftUrl(share,[M2,T3])]:folder('TOP 07',[]),
};
const get=async url=>{if(!(url in answers))throw Error('Quelle antwortet mit HTTP 404');return answers[url];};
const source={id:'de-06434001',name:'Stadt Bad Homburg v.d.Höhe',kind:'city',method:'scraper',adapter:'fabasoft',base:FABASOFT_BASE,folders:[share]};

test('Fabasoft: Adressen nur für Freigaben und Objekte, Namen von Sitzung und Punkt',()=>{
 assert.equal(fabasoftUrl(share,[M1]),FABASOFT_BASE+share+'/'+M1+'/?xhr=1');
 assert.equal(fabasoftUrl(share,[M1,D1],{download:true}),FABASOFT_BASE+share+'/'+M1+'/'+D1+'/download');
 assert.throws(()=>fabasoftUrl('../x'),/Nicht freigegeben/);assert.throws(()=>fabasoftUrl(share,['login']),/Nicht freigegeben/);
 assert.deepEqual(fabasoftMeeting('Ortsbeirat Gonzenheim 2026-04-29 18:30:00'),{body:'Ortsbeirat Gonzenheim',date:'2026-04-29',time:'18:30'});
 assert.equal(fabasoftMeeting('Hauptausschuss  (Archiv)'),null);
 assert.deepEqual(fabasoftItem('TOP 04 - Tagesordnung I - SV 26/41-5 Radschnellweg Vordertaunus'),{number:'4',paper:'SV 26/41-5',matter:'SV 26/41',title:'Radschnellweg Vordertaunus'});
 assert.equal(fabasoftItem('TOP 26 - Tagesordnung II - SV 26/113-3 Bericht über die Entwicklung;').title,'Bericht über die Entwicklung');
 assert.equal(fabasoftEntries(answers[fabasoftUrl(share)]).entries.length,3);
});

test('Fabasoft: Sitzungen im Zeitraum, Punkte mit Vorlage als Vorgang über mehrere Sitzungen, Dateien verlinkt, Routine ausgelassen',async()=>{
 const d=await collectFabasoft(source,{now:new Date('2026-10-24T10:00:00Z'),get,window:'12m'});
 assert.deepEqual(d.coverage.issues,[]);
 assert.equal(d.topics.length,1,'Mitteilungen ausgelassen, SV 26/41 ein Vorgang');
 const [t]=d.topics;
 assert.equal(t.id,'de-06434001-fb-sv-26-41');assert.deepEqual(t.events.map(e=>[e.date,e.committee,e.status]),[['2026-09-10','Stadtverordnetenversammlung','unknown'],['2026-10-29','Stadtverordnetenversammlung','consulting']]);
 assert.ok(t.documents.some(x=>x.url===FABASOFT_BASE+share+'/'+M1+'/'+T1+'/'+D1+'/download'),JSON.stringify(t.documents));
 assert.ok(t.documents.some(x=>/E I N L A D U N G/.test(x.title)),'Einladung der Sitzung');
 assert.equal(t.title,'Radschnellweg Vordertaunus (FRM 5): Baubeschluss','Titel der letzten Beratung');
 // zweiter Lauf mit den Markierungen: nichts Neues
 const again=await collectFabasoft(source,{now:new Date('2026-10-24T11:00:00Z'),get,window:'12m',marks:{known:d.marks,stock:new Set(Object.keys(d.marks))}});
 assert.equal(again.topics.length,0,JSON.stringify([again.coverage,again.topics.map(x=>x.events.map(e=>e.date))]));assert.equal(again.coverage.unchangedMeetings,2);
});

test('Fabasoft: ein Ordner, der sich selbst nichtöffentlich nennt, wird nicht gelesen; Leser eingetragen',async()=>{
 const closed={...answers,[fabasoftUrl(share)]:folder('Stadtverordnetenversammlung 2026 (nichtöffentlich)',[row(M1,'Stadtverordnetenversammlung  2026-09-10 18:30:00','Ordner')])};
 const d=await collectFabasoft(source,{now:new Date('2026-10-24T10:00:00Z'),get:async u=>closed[u],window:'12m'});
 assert.equal(d.topics.length,0);assert.match(d.coverage.warnings[0],/als nichtöffentlich bezeichnet/);
 assert.equal(READERS.fabasoft.collect,collectFabasoft);
});
