import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {detectParlis,parlisDocument,parlisList,parlisListRows,parseParlisDocument,parlisItems,parlisStatus,collectParlis} from '../server/integrations/parlis.mjs';
// Excerpts of pages of www.stvv.frankfurt.de as published on 07.10.2026.
const fixture=name=>fs.readFileSync(new URL('./fixtures/parlis/'+name,import.meta.url),'utf8');
const base='https://www.stvv.frankfurt.de/',source={id:'de-06412000',name:'Stadt Frankfurt am Main',kind:'city',method:'scraper',adapter:'parlis',base};
const now=new Date('2026-10-07T12:00:00Z');
const doc=name=>`${base}PARLISLINK/DDW?W=DOK_NAME=%27${name}%27`;
const rowsOf=(file,kind)=>{const parsed=parseParlisDocument(fixture(file));return parlisItems(parsed,{date:parsed.date,meeting:'',url:doc('X'),kind},source,now);};

test('PARLIS is recognised by its start page; the base is the root of the host',()=>{
 assert.deepEqual(detectParlis('https://www.stvv.frankfurt.de/parlis2/parlis.html','<title>PARLamentsInformationsSystem der Stadt Frankfurt am Main</title>'),{adapter:'parlis',base});
 assert.deepEqual(detectParlis(doc('N_H_4_29-09-2026'),fixture('niederschrift-ausschuss.html')),{adapter:'parlis',base});
 assert.equal(detectParlis('https://piwi.wiesbaden.de/','<title>PIWi - Politisches Informationssystem Wiesbaden</title>'),null);
});

test('PARLIS addresses: documents by their permanent name, list pages by the offset of their first row',()=>{
 assert.equal(parlisDocument('N_H_4_29-09-2026',source),doc('N_H_4_29-09-2026'));
 assert.equal(parlisList('NIED',source),base+'PARLISLINK/SDF?DOKUMENTTYP=NIED&FORMFL_OB=DATUM&FORM_SO=Absteigend&FORM_C=und');
 assert.equal(parlisList('NIED',source,26),base+'PARLISLINK/SDF?DOKUMENTTYP=NIED&FORMFL_OB=DATUM&FORM_SO=Absteigend&FORM_C=und&?26');
});

test('PARLIS lists give day, permanent name and meeting of each document, and the next page',()=>{
 const minutes=parlisListRows(fixture('liste-niederschriften.html'));
 assert.deepEqual(minutes.rows.map(r=>[r.date,r.name,r.meeting]),[
  ['2026-10-01','N_A_4_01-10-2026','4. Sitzung des Ä am 01.10.2026'],
  ['2026-09-29','N_H_4_29-09-2026','4. Sitzung des H am 29.09.2026'],
  ['2026-09-28','N_S_1_28-09-2026','1. Sitzung des S am 28.09.2026']]);
 assert.equal(minutes.next,26);assert.equal(minutes.total,9677);
 // The name of an agenda is that of its body; the meeting matches the one its minutes will name.
 const agendas=parlisListRows(fixture('liste-tagesordnungen.html'));
 assert.deepEqual(agendas.rows.map(r=>[r.date,r.name,r.meeting]),[['2026-10-20','TO-O-10','5. Sitzung des OBR 10 am 20.10.2026'],['2026-10-20','TO-O-6','5. Sitzung des OBR 6 am 20.10.2026']]);
 assert.deepEqual(parlisListRows('<html><body>PARLIS Meldung</body></html>'),{rows:[],next:null,total:0});
});

test('PARLIS committee minutes: items with paper, decision and vote; routine items left out; the non-public link ends the document',()=>{
 const parsed=parseParlisDocument(fixture('niederschrift-ausschuss.html'));
 assert.equal(parsed.committee,'Haupt- und Finanzausschuss sowie Personal');assert.equal(parsed.date,'2026-09-29');assert.equal(parsed.council,false);
 const rows=rowsOf('niederschrift-ausschuss.html','minutes');
 assert.deepEqual(rows.map(r=>[r.id,r.record.number,r.reference,r.status]),[
  ['de-06412000-vo-a-7-2026','6.1','A 7','info'],
  ['de-06412000-vo-oa-584-2025','6.2','OA 584','unknown'],
  ['de-06412000-top-20260929-521e676c','8','','unknown'],
  ['de-06412000-vo-nr-29-2026','9','NR 29','recommended']]);
 const [a7,,item8,nr29]=rows;
 // Without the label "Beschluss:" the statement after the paper is the decision.
 assert.match(a7.event.description,/^Beschluss: Es dient zur Kenntnis, dass der Magistrat zwischenzeitlich einen Bericht \(B 271\) vorgelegt hat\.$/);
 assert.equal(item8.title,'Antrag auf Zustimmung zur Freigabe von Planungsmitteln hier: Zentraldepot für die Frankfurter Museen');
 // "Bericht:" is the committee's recommendation to the council; the vote follows the decision.
 assert.match(nr29.event.description,/^Empfehlung: Die Stadtverordnetenversammlung wolle beschließen: Die Vorlage NR 29 wird abgelehnt\. Abstimmung: CDU, GRÜNE/);
 assert.deepEqual(nr29.identityLinks,[doc('NR_29_2026')]);
 assert.deepEqual(nr29.documents,[{title:'Vorlage NR 29',url:doc('NR_29_2026'),kind:'html'}]);
 assert.equal(nr29.event.publicEvidence,'Öffentliche Niederschrift, Tagesordnung I');
 assert.ok(!rows.some(r=>/Verabschiedung/.test(r.title)));
 // Nothing after the link to the non-public part is read, even a numbered item.
 const tail=fixture('niederschrift-ausschuss.html').replace('</div>\n</body>','<p class=MsoNormal style=\'text-indent:-28.45pt\'>50.&nbsp; Geheimer Punkt</p><p class=MsoNormal>Antrag vom 01.09.2026, <a href="/PARLISLINK/DDW?W=DOK_NAME=%27NR_99_2026\'">NR&nbsp;99</a></p></div>\n</body>');
 assert.ok(!parseParlisDocument(tail).items.some(i=>i.paper==='NR_99_2026'));
});

test('PARLIS council minutes: an item per paragraph (§), with paper or decision address; decisions in parts read by their approval',()=>{
 const parsed=parseParlisDocument(fixture('niederschrift-stvv.html'));
 assert.equal(parsed.committee,'Stadtverordnetenversammlung');assert.equal(parsed.council,true);
 const rows=rowsOf('niederschrift-stvv.html','minutes');
 assert.deepEqual(rows.map(r=>[r.id,r.record.number,r.reference,r.status]),[
  ['de-06412000-vo-nr-13-2026','5','NR 13','approved'],
  ['de-06412000-par-334-2026','11','','info']]);
 assert.equal(rows[0].title,'Vorzeitige Abberufung der hauptamtlichen Ersten Beigeordneten Dr. Nargess Eskandari-Grünberg gemäß § 76 Abs. 2 HGO (zweiter Abberufungsbeschluss)');
 assert.deepEqual(rows[0].identityLinks,[doc('NR_13_2026'),doc('PAR_323_2026')]);
 assert.deepEqual(rows[1].documents,[{title:'Beschluss § 334',url:doc('PAR_334_2026'),kind:'html'}]);
 // "Verabschiedung der Tagesordnung II" (§ 322) is routine and left out.
 assert.ok(!rows.some(r=>/Tagesordnung II/.test(r.title)));
});

test('PARLIS district minutes: numbered body text opens no item; composed umlauts',()=>{
 const rows=rowsOf('niederschrift-ortsbeirat.html','minutes');
 assert.deepEqual(rows.map(r=>[r.id,r.record.number,r.title,r.reference]),[['de-06412000-vo-of-47-12-2026','9','Wasserqualität des Kätcheslachweihers durch Belüftung verbessern','OF 47/12']]);
 assert.equal(rows[0].event.description,'Beschluss: 1. Die Vorlage OF 47/12 wurde zurückgezogen. 2. Die Vorlage OF 51/12 wurde zurückgezogen.');
});

test('PARLIS agenda of a coming meeting: papers in consultation, routine items left out',()=>{
 const rows=rowsOf('tagesordnung-ortsbeirat.html','agenda');
 assert.deepEqual(rows.map(r=>[r.id,r.record.number,r.reference,r.status,r.event.date]),[
  ['de-06412000-vo-om-4243-2023','5.1','OM 4243','consulting','2026-10-20'],
  ['de-06412000-vo-om-5547-2024','5.2','OM 5547','consulting','2026-10-20']]);
 assert.equal(rows[0].title,'Offenlage der U 2-Lärmmessungen im Bereich der großen U-Bahn-Kurve Bonames');
 assert.equal(rows[0].event.publicEvidence,'Öffentliche Tagesordnung, Tagesordnung I');
});

test('PARLIS status: approval and rejection before acknowledgement; own decision or recommendation; the sentences of the item',()=>{
 assert.equal(parlisStatus('a) Es dient zur Kenntnis, dass … b) Die Stadtverordnetenversammlung stimmt der Vorlage NR 13 mit der Mehrheit von Dr. X zu.','Stadtverordnetenversammlung'),'approved');
 assert.equal(parlisStatus('Die Vorlage NR 29 wird abgelehnt.','Stadtverordnetenversammlung'),'rejected');
 // "Bericht:" is a recommendation to the council; "Beschluss:" of a committee or district council is its own decision.
 assert.equal(parlisStatus('Die Stadtverordnetenversammlung wolle beschließen: Die Vorlage NR 29 wird abgelehnt.','Haupt- und Finanzausschuss sowie Personal',{report:true}),'recommended');
 assert.equal(parlisStatus('Die Vorlage OF 12/1 wird angenommen.','Ortsbeirat 1'),'approved');
 assert.equal(parlisStatus('Der Ortsbeirat beschließt, den Antrag NR 5 abzulehnen.','Ortsbeirat 1'),'rejected');
 // A decision on two papers: the sentence that names the item's paper decides.
 const both='Der Vorlage M 12 wird mit Änderungen zugestimmt. Der Antrag NR 3 wird abgelehnt.';
 assert.equal(parlisStatus(both,'Stadtverordnetenversammlung',{reference:'M 12'}),'approved');
 assert.equal(parlisStatus(both,'Stadtverordnetenversammlung',{reference:'NR 3'}),'rejected');
 assert.equal(parlisStatus('Es dient zur Kenntnis, dass der Magistrat einen Bericht vorgelegt hat.','Ortsbeirat 1'),'info');
 assert.equal(parlisStatus('Der Magistrat wird aufgefordert, den Bericht vorzulegen.','Ortsbeirat 1'),null);
});

test('PARLIS public part: the link to the non-public part and any short heading that names it end the document',()=>{
 const minutes=fixture('niederschrift-ausschuss.html');
 const item=(n,ref)=>`<p class=MsoNormal style='text-indent:-28.45pt'>${n}.&nbsp; Punkt ${n}</p><p class=MsoNormal>Antrag vom 01.09.2026, <a href="/PARLISLINK/DDW?W=DOK_NAME=%27${ref}'">${ref.replace(/_\d{4}$/,'').replace('_',' ')}</a></p>`;
 const papers=html=>parseParlisDocument(html).items.map(i=>i.paper);
 for(const heading of ['<h2>Nicht öffentlicher Teil</h2>','<p class=MsoNormal>Tagesordnung II - nicht öffentlich</p>','<td><b>Vertrauliche Punkte</b></td>']){
  const html=minutes.replace(/<p class=MsoNormal\s+style='text-indent:-28.45pt'>9\./,heading+item(8.5,'NR_98_2026')+"<p class=MsoNormal style='text-indent:-28.45pt'>9.");
  assert.deepEqual(papers(html),['A_7_2026','OA_584_2025',undefined],heading);
 }
 // A long sentence that mentions the non-public part ends nothing.
 assert.deepEqual(papers(minutes),['A_7_2026','OA_584_2025',undefined,'NR_29_2026']);
 // Nothing after the link to the non-public part is read, even a numbered item.
 assert.ok(!papers(minutes.replace('</div>\n</body>',item(50,'NR_99_2026')+'</div>\n</body>')).includes('NR_99_2026'));
});

test('PARLIS: a paragraph named in a line "Vorg.:" opens no item and is no paper; committee minutes stay committee minutes',()=>{
 const vorg='<p class=MsoNormal>Vorg.: Beschl. d. Stv.-V. vom 25.06.2026, <a href="/PARLISLINK/DDW?W=DOK_NAME=%27PAR_222_2026\'">§&nbsp;222</a></p>';
 const committee=fixture('niederschrift-ausschuss.html').replace(/(OA&nbsp;584<\/a><\/p>)/,'$1'+vorg);
 const parsed=parseParlisDocument(committee);
 assert.equal(parsed.council,false);
 assert.deepEqual(parsed.items.map(i=>[i.number,i.paper]),[['6.1','A_7_2026'],['6.2','OA_584_2025'],['8',undefined],['9','NR_29_2026']]);
 // In the council's minutes such a line belongs to its item, which keeps its decision and vote.
 const council=fixture('niederschrift-stvv.html').replace(/(NR&nbsp;13<\/a>\s*<\/p>)/,'$1'+vorg);
 const nr13=rowsOf('niederschrift-stvv.html','minutes')[0],again=parlisItems(parseParlisDocument(council),{date:'2026-08-27',meeting:'',url:doc('X'),kind:'minutes'},source,now)[0];
 assert.equal(again.id,nr13.id);assert.equal(again.status,'approved');assert.equal(again.record.vote,nr13.record.vote);
});

test('PARLIS list: a row without its PDF link is skipped and not joined with the next one',()=>{
 const list=fixture('liste-niederschriften.html').replace(/<A HREF="\/download\/N_A_4_01-10-2026\.pdf"[^>]*>/,'');
 assert.deepEqual(parlisListRows(list).rows.map(r=>[r.date,r.name]),[['2026-09-29','N_H_4_29-09-2026'],['2026-09-28','N_S_1_28-09-2026']]);
});

test('PARLIS import: an empty page before the end of a list is a gap; a redirect into the non-public part is never followed',async()=>{
 const asked=[];
 const html=body=>new Response(body,{status:200,headers:{'content-type':'text/html; charset=utf-8'}});
 const request=async url=>{asked.push(url);
  if(/DOKUMENTTYP=NIED/.test(url))return html(/&\?26$/.test(url)?'<html><body>PARLIS Meldung</body></html>':fixture('liste-niederschriften.html'));
  if(/DOKUMENTTYP=TAGO/.test(url))return html('<html><body>PARLIS Meldung</body></html>');
  return new Response(null,{status:302,headers:{location:'/PARLIS2S/DDW?W=DOK_NAME=%27NV_H_4_29-09-2026%27'}});};
 const result=await collectParlis(source,{now,request,window:'3m'});
 assert.ok(asked.every(u=>!/PARLIS2S/i.test(u)),asked.join('\n'));
 assert.equal(result.topics.length,0);assert.equal(result.coverage.complete,false);
 assert.ok(result.coverage.issues.some(i=>/Seite 2 der Niederschriften ohne Einträge/.test(i)));
 assert.ok(result.coverage.issues.some(i=>/Nichtöffentlicher Teil von PARLIS/.test(i)));
 // No current agendas is no gap.
 assert.ok(!result.coverage.issues.some(i=>/Tagesordnungen/.test(i)));
});

test('PARLIS import: minutes inside the period, agendas of meetings without minutes; the non-public part is never asked',async()=>{
 const asked=[];
 const pages={'N_A_4_01-10-2026':'niederschrift-stvv.html','N_H_4_29-09-2026':'niederschrift-ausschuss.html','N_S_1_28-09-2026':'niederschrift-ortsbeirat.html','TO-O-10':'tagesordnung-ortsbeirat.html','TO-O-6':'tagesordnung-ortsbeirat.html'};
 // The second page of minutes reaches back before the period; the second page of agendas repeats a known meeting.
 const older=fixture('liste-niederschriften.html').replace(/\.(?:10|09)\.2026/g,'.06.2026').replace(/_(\d{2})-(?:10|09)-2026/g,'_$1-06-2026');
 const get=async url=>{asked.push(url);
  if(/DOKUMENTTYP=NIED/.test(url))return /&\?26$/.test(url)?older:fixture('liste-niederschriften.html');
  if(/DOKUMENTTYP=TAGO/.test(url))return /&\?26$/.test(url)?fixture('liste-tagesordnungen.html').replace(/&\?26 "/,'&?1 "'):fixture('liste-tagesordnungen.html');
  const name=decodeURIComponent(url.match(/DOK_NAME=%27([^%]+)%27/)?.[1]||'');if(pages[name])return fixture(pages[name]);
  throw Error('Quelle antwortet mit HTTP 404');};
 const result=await collectParlis(source,{now,get,window:'3m'});
 assert.equal(result.coverage.complete,true,JSON.stringify(result.coverage.issues));
 assert.equal(result.coverage.meetings,5);assert.equal(result.readMeetings,5);
 // Two list pages of minutes and of agendas (the second points back to the first: the end), five documents.
 assert.equal(asked.length,9);assert.ok(asked.every(u=>u.includes('/PARLISLINK/')&&!/PARLIS2S/i.test(u)));
 // An agenda's address carries the day: the name is reused for the next meeting of the body.
 assert.ok(asked.includes(doc('TO-O-10')));assert.ok(Object.keys(result.marks).includes(doc('TO-O-10')+'#2026-10-20'));
 const nr29=result.topics.find(t=>t.id==='de-06412000-vo-nr-29-2026');
 assert.equal(nr29.status,'recommended');assert.equal(nr29.eventDate,'2026-09-29');assert.equal(nr29.regionId,source.id);
 // The same paper on the agendas of two bodies is one report with two events.
 const om=result.topics.find(t=>t.id==='de-06412000-vo-om-4243-2023');assert.equal(om.events.length,2);assert.equal(om.status,'consulting');
});

