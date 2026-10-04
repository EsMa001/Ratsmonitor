import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {detectPio,pioBodies,pioInvitations,parsePioAgenda,parsePioPaper,parsePioDecision,pioResult,collectPio} from '../server/integrations/pio.mjs';
// Excerpts of pages of pio.offenbach.de as published on 04.10.2026.
const fixture=name=>fs.readFileSync(new URL('./fixtures/piwi-pio/'+name,import.meta.url),'utf8');
const base='https://pio.offenbach.de/',source={id:'de-06413000',name:'Stadt Offenbach am Main',kind:'city',method:'scraper',adapter:'pio',base};
const now=new Date('2026-10-04T12:00:00Z');
const doc=(docid,year=2026)=>`${base}index.php?aktiv=doc&docid=${year}-000${docid}&year=${year}&av_dokument_id=${docid}&view=`;
const paperUrl=(number,docid)=>`${base}index.php?aktiv=doc&doctype=1&dsnummer=${encodeURIComponent('2026-31/DS-I(A)'+number).replace(/\(/g,'%28').replace(/\)/g,'%29')}&av_dokument_id=${docid}&year=2026`;
const stv={url:doc(22305),date:'2026-09-24',committee:'Stadtverordnetenversammlung'};
const page=body=>`<!DOCTYPE html><html><head><title>PIO: Politisches Informationssystem Offenbach</title></head><body><div class="pio-content"><div class="pio-doc-container" role="main"><div class="WordSection1">${body}</div></div><p class="box warning pio-warnung">Dieser Text wurde mit dem "Politischen Informationssystem Offenbach" erstellt.</p></div></body></html>`;
test('PIO is recognised by its pages; the base is the folder of index.php',()=>{
 assert.deepEqual(detectPio(base+'index.php?aktiv=tagesordnungen',fixture('pio-tagesordnungen.html')),{adapter:'pio',base});
 assert.deepEqual(detectPio('https://pio.example.test/ris/index.php','<html><body><a href="index.php?aktiv=tagesordnungen&amp;view=" class="x">T</a><div class="pio-content"></div></body></html>'),{adapter:'pio',base:'https://pio.example.test/ris/'});
 assert.equal(detectPio('https://piwi.wiesbaden.de/aktuelles','<title>PIWi - Politisches Informationssystem Wiesbaden</title>'),null);
});
test('PIO agenda overview names each body with its archive list; the list names the day of every invitation',()=>{
 assert.deepEqual(pioBodies(fixture('pio-tagesordnungen.html'),source),[{name:'Stadtverordnetenversammlung',url:base+'index.php?aktiv=tagesordnungenliste&ausschuss=0'},{name:'Ausschuss für Umwelt, Stadtplanung und Verkehr',url:base+'index.php?aktiv=tagesordnungenliste&ausschuss=3'}]);
 const list=pioInvitations(fixture('pio-liste-stv.html'),'Stadtverordnetenversammlung',source);
 assert.equal(list.length,16);assert.deepEqual(list[0],{...stv,label:'Einladung STV Sitzung am 24.09.2026'});assert.equal(list.at(-1).date,'2025-01-29');
 // A link that leaves the approved source is not taken.
 assert.deepEqual(pioInvitations('<a href="https://elsewhere.example/index.php?aktiv=doc&docid=1">Einladung STV Sitzung am 24.09.2026</a>','Rat',source),[]);
});
test('PIO invitation yields the public agenda items with their papers; a non-public part is never read',()=>{
 const items=parsePioAgenda(fixture('pio-einladung-stv.html'),stv,source,now);
 assert.deepEqual(items.map(i=>[i.agenda.number,i.title,i.reference]),[['1','Mitteilungen des Stadtverordnetenvorstehers',''],['2','Mitteilungen des Magistrats',''],['3','Fragestunde',''],['4','Wahl der XVIII. Verbandsversammlung des Landeswohlfahrtsverbandes Hessen 2026 in Wahlkreis I',''],['5','Bebauungsplan für Flurstück 223/12 im Mathildenviertel','2026-31/DS-I(A)0004'],['6','Grünanlage Tempelseeweiher – Neubau Überlaufleitung hier: Grundsatzbeschluss','2026-31/DS-I(A)0027'],['23','Einführung eines ‚First Responder‘ Systems in der Stadt Offenbach','2026-31/DS-I(A)0097']]);
 const paper=items[5];
 assert.equal(paper.id,'de-06413000-vo-2026-31-ds-i-a-0027');assert.equal(paper.sourceUrl,paperUrl('0027',21970));assert.equal(paper.agenda.note,'Antrag Magistratsvorlage Nr. 2026-131 (Dez. IV, Amt 60) vom 13.05.2026, 2026-31/DS-I(A)0027');
 assert.equal(items[6].agenda.note,'Antrag B´90/Die Grünen vom 07.09.2026, 2026-31/DS-I(A)0097','the signature below the last item is not part of it');
 assert.match(items[0].id,/^de-06413000-top-20260924-[0-9a-f]{8}$/);assert.equal(items[0].sourceUrl,stv.url);assert.match(items[0].event.publicEvidence,/Öffentlicher Teil/);
 assert.deepEqual([...new Set(items.map(i=>i.status))],['unknown']);
 // The same invitation for a meeting still ahead: announced, a paper is under consultation.
 assert.deepEqual(parsePioAgenda(fixture('pio-einladung-stv.html'),{...stv,date:'2026-11-05'},source,now).slice(4,5).map(i=>[i.status,i.event.description]),[['consulting','Öffentlich auf der Tagesordnung; die Sitzung steht noch aus.']]);
 // Everything below a heading of the non-public part is left out, however the converted Word file writes it.
 for(const heading of ['Nichtöffentlicher Teil','II. Nichtöffentlicher Teil','B) Nicht öffentliche Sitzung','Nicht öffentlich:','Nichtöffentliche Beratung','Vertraulicher Teil','Teil B – nicht öffentlich','NICHT-ÖFFENTLICHE TAGESORDNUNG']){
  const closed=fixture('pio-einladung-stv.html').replace('<b><u>TOP 23</u></b>',heading+'<br><b><u>TOP 23</u></b>');
  assert.deepEqual(parsePioAgenda(closed,stv,source,now).map(i=>i.agenda.number),['1','2','3','4','5','6'],heading);
 }
 // … also when the heading and the next item stand on one long line.
 const merged=parsePioAgenda(fixture('pio-einladung-stv.html').replace('<b><u>TOP 23</u></b><br>','II. Nicht öffentlicher Teil <b><u>TOP 23</u></b> '),stv,source,now);
 assert.deepEqual(merged.map(i=>i.agenda.number),['1','2','3','4','5','6']);assert.ok(!JSON.stringify(merged).includes('0097'),'no paper of the non-public part, not even as a document');
 assert.match(parsePioAgenda(fixture('pio-einladung-stv.html').replace('Öffentlicher Teil','I. Öffentlicher Teil'),stv,source,now)[0].event.publicEvidence,/Öffentlicher Teil/);
 // A document without agenda items is no agenda.
 assert.equal(parsePioAgenda(page('<p>Die Sitzung entfällt.</p>'),stv,source,now),null);assert.equal(parsePioAgenda('<html>Fehler</html>',stv,source,now),null);
});
test('PIO paper page yields header fields, attachments and decision extracts; the extract names body, day and decision',()=>{
 const paper=parsePioPaper(fixture('pio-vorlage.html'),source);
 assert.deepEqual(paper.fields,[{field:'Drucksache',value:'2026-31/DS-I(A)0027'},{field:'Ausgegeben',value:'15.05.2026'},{field:'Eingang',value:'13.05.2026'},{field:'Dokumentart',value:'Antrag'},{field:'Betreff',value:'Grünanlage Tempelseeweiher – Neubau Überlaufleitung hier: Grundsatzbeschluss'}]);
 assert.deepEqual(paper.documents.map(d=>[d.title,d.url]),[['Beschluss 2026-31/DS-I(A)0027',doc(22363)],['Anlage 1 - Lageplan - Grünanlage Tempelseeweiher – Neubau Überlaufleitung hier: Grundsatzbeschluss',doc(21971)],['Anlage 2 - KRP - Grünanlage Tempelseeweiher – Neubau Überlaufleitung hier: Grundsatzbeschluss',doc(21972)]]);
 assert.deepEqual(paper.decisions,[doc(22363)]);assert.equal(parsePioPaper('<html><body>Wartungsarbeiten</body></html>',source),null);
 const single=parsePioDecision(fixture('pio-beschluss.html'));
 assert.deepEqual(single,{body:'Stadtverordnetenversammlung',date:'2026-09-24',results:[{reference:'',result:'Die Stadtverordnetenversammlung beschließt einstimmig die Drucksache 2026-31/DS-I(A)0027 an den Magistrat zurückzuverweisen.'}]});
 assert.equal(pioResult(single,'2026-31/DS-I(A)0027'),single.results[0]);
 // One extract, two decisions: the amendment "…/1" and the paper itself. Each item takes the block of its own paper.
 const two=parsePioDecision(fixture('pio-beschluss-aenderung.html'));
 assert.deepEqual(two.results.map(r=>r.reference),['2026-31/DS-I(A)0080/1','2026-31/DS-I(A)0080']);
 assert.match(pioResult(two,'2026-31/DS-I(A)0080').result,/^Die Stadtverordnetenversammlung lehnt mit Stimmenmehrheit wie folgt ab : 1\. Der Magistrat wird beauftragt, eine Katzenschutzverordnung/);
 assert.ok(pioResult(two,'2026-31/DS-I(A)0080').result.length<=602);assert.equal(pioResult(two,'2026-31/DS-I(A)0081'),null);
 assert.equal(parsePioDecision(fixture('pio-einladung-stv.html')),null);
});
test('PIO collector reads overview, archive lists, invitations, papers and the decision of the same meeting',async()=>{
 const usvList=`<table class="pio-table"><tr><td><strong>2026</strong></td></tr><tr><td><a href="index.php?aktiv=doc&docid=2026-00022304&amp;year=2026&amp;av_dokument_id=22304&amp;view=">Einladung USV Sitzung am 17.09.2026</a></td></tr><tr><td><a href="index.php?aktiv=doc&docid=2026-00021000&amp;year=2026&amp;av_dokument_id=21000&amp;view=">Einladung USV Sitzung am 05.02.2026</a></td></tr><tr><td><a href="index.php?aktiv=doc&docid=2026-00022400&amp;year=2026&amp;av_dokument_id=22400&amp;view=">Einladung USV Sitzung am 05.11.2026</a></td></tr></table>`;
 const usv=page(`<p>zu einer Sitzung des Ausschusses für Umwelt, Stadtplanung und Verkehr am</p><p>Öffentlicher Teil</p><p><b><u>TOP 1</u></b></p><p><u>Mitteilungen</u></p><p><b><u>TOP 3</u></b><br><a href="/index.php?aktiv=doc&doctype=1&amp;dsnummer=2026-31%2FDS-I%28A%290027&amp;av_dokument_id=21970&amp;year=2026" target="_top">Grünanlage Tempelseeweiher – Neubau Überlaufleitung<br>hier: Grundsatzbeschluss</a><br>Antrag Magistratsvorlage Nr. 2026-131 (Dez. IV, Amt 60) vom 13.05.2026,<br>2026-31/DS-I(A)0027<br></p>`);
 const plainPaper=n=>page(`<p class="PIO-Kopfzeile"><span class="PIO-Kopfzeile-Links">2026-31/DS-I(A)${n}</span></p>`)+'<div class="Baum"><ul></ul></div>';
 const pages={
  [base+'index.php?aktiv=tagesordnungen']:fixture('pio-tagesordnungen.html'),
  [base+'index.php?aktiv=tagesordnungenliste&ausschuss=0']:fixture('pio-liste-stv.html'),
  [base+'index.php?aktiv=tagesordnungenliste&ausschuss=3']:usvList,
  [stv.url]:fixture('pio-einladung-stv.html'),[doc(22304)]:usv,[doc(22400)]:page('<p>Einladung folgt.</p>'),
  [paperUrl('0027',21970)]:fixture('pio-vorlage.html'),[paperUrl('0004',21908)]:plainPaper('0004'),[paperUrl('0097',22303)]:plainPaper('0097'),
  [doc(22363)]:fixture('pio-beschluss.html'),
 };
 const calls=[];const get=async url=>{calls.push(url);if(!(url in pages))throw Error('Quelle antwortet mit HTTP 404');return pages[url];};
 const d=await collectPio(source,{now,get,window:'1m'});
 // Only the meetings of the period are read: not the invitation of February, nor the STV meeting of August.
 assert.ok(!calls.includes(doc(21000))&&!calls.includes(doc(22228,2026)));
 assert.equal(calls.filter(u=>u===paperUrl('0027',21970)).length,1,'the paper page is read once');
 assert.equal(calls.filter(u=>u===doc(22363)).length,1,'the decision extract is read once');
 assert.ok(calls.every(u=>u.startsWith(base)&&!/aktiv=(?:login|mappe|suche|newsletter)/.test(u)));
 assert.equal(d.coverage.meetings,2);assert.equal(d.coverage.upcomingWithoutAgenda,1);assert.deepEqual(d.coverage.issues,[]);assert.equal(d.coverage.complete,true);assert.equal(d.coverage.method,'scraper');
 const t=d.topics.find(x=>x.id==='de-06413000-vo-2026-31-ds-i-a-0027');
 assert.deepEqual(t.events.map(e=>[e.date,e.committee,e.status]),[['2026-09-17','Ausschuss für Umwelt, Stadtplanung und Verkehr','unknown'],['2026-09-24','Stadtverordnetenversammlung','unknown']]);
 assert.equal(t.events[1].result,'Die Stadtverordnetenversammlung beschließt einstimmig die Drucksache 2026-31/DS-I(A)0027 an den Magistrat zurückzuverweisen.');
 // The decision text is kept as written; no status is read from free text.
 assert.equal(t.status,'unknown');assert.equal(t.reference,'2026-31/DS-I(A)0027');assert.equal(t.regionId,source.id);assert.equal(t.public,true);
 assert.ok(t.documents.some(x=>x.url===doc(21971))&&t.documents.some(x=>x.url===paperUrl('0027',21970)));
 assert.ok(t.sourceData.records.some(r=>r.kind==='decision'&&r.url===doc(22363)));
 assert.equal(d.topics.length,8);assert.ok(d.topics.every(x=>!('event' in x)&&!('agenda' in x)));assert.equal(Object.keys(d.marks).length,2);
 // A second import with the marks of the first reads the invitations again, but not the papers behind them.
 const later=new Date('2026-10-20T12:00:00Z'),again=[];
 const next=await collectPio(source,{now:later,window:'1m',marks:{known:d.marks,stock:new Set(Object.keys(d.marks))},get:async url=>{again.push(url);return get(url);}});
 assert.equal(next.coverage.unchangedMeetings,1);assert.ok(again.includes(stv.url));assert.ok(!again.includes(paperUrl('0027',21970)));
 // An unreadable overview is an error note, never a quiet period.
 const failed=await collectPio(source,{now,window:'1m',get:async()=>{throw Error('Quelle antwortet mit HTTP 403');}});
 assert.equal(failed.coverage.quiet,false);assert.equal(failed.coverage.complete,false);assert.ok(failed.coverage.issues.some(i=>/HTTP 403/.test(i)));
 // A past invitation without agenda items is a gap.
 const gap=await collectPio(source,{now,window:'1m',get:async url=>url===doc(22304)?page('<p>Einladung</p>'):get(url)});
 assert.ok(gap.coverage.issues.includes('Keine lesbare öffentliche Tagesordnung: '+doc(22304)));
 // A paper page that is not recognisable is a gap, never a paper without documents.
 const odd=await collectPio(source,{now,window:'1m',get:async url=>url===paperUrl('0004',21908)?'<html><body>Wartungsarbeiten</body></html>':get(url)});
 assert.ok(odd.coverage.issues.includes('Vorlagendetails: Unbekanntes Format der Drucksache: '+paperUrl('0004',21908)));assert.equal(odd.coverage.complete,false);
 // Two bodies on the same day: the extract of the Stadtverordnetenversammlung is not the committee's decision …
 const usvList24=usvList.replace('Sitzung am 17.09.2026','Sitzung am 24.09.2026');
 const both=await collectPio(source,{now,window:'1m',get:async url=>url===base+'index.php?aktiv=tagesordnungenliste&ausschuss=3'?usvList24:get(url)});
 assert.deepEqual(both.topics.find(x=>x.id==='de-06413000-vo-2026-31-ds-i-a-0027').events.map(e=>[e.date,e.committee,e.status,Boolean(e.result)]).sort(),[
  ['2026-09-24','Ausschuss für Umwelt, Stadtplanung und Verkehr','unknown',false],['2026-09-24','Stadtverordnetenversammlung','unknown',true]]);
 // … and the committee's own extract ("des Ausschusses für …") is matched to the committee, not to the council.
 const usvExtract=fixture('pio-beschluss.html').replace('der Stadtverordnetenversammlung am 24. September 2026','des Ausschusses für Umwelt, Stadtplanung und Verkehr am 24. September 2026').replace('Die Stadtverordnetenversammlung beschließt','Der Ausschuss beschließt');
 const own=await collectPio(source,{now,window:'1m',get:async url=>url===base+'index.php?aktiv=tagesordnungenliste&ausschuss=3'?usvList24:url===doc(22363)?usvExtract:get(url)});
 assert.deepEqual(own.topics.find(x=>x.id==='de-06413000-vo-2026-31-ds-i-a-0027').events.map(e=>[e.committee,e.status,Boolean(e.result)]).sort(),[
  ['Ausschuss für Umwelt, Stadtplanung und Verkehr','unknown',true],['Stadtverordnetenversammlung','unknown',false]]);
});
