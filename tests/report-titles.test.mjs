import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {parseAgenda,parseAgendaCards,collectSessionNet} from '../server/integrations/sessionnet.mjs';
import {mergeImport} from '../server/integrations/merge-import.mjs';
import {newMark,readMarks} from '../server/integrations/meeting-marks.mjs';
import {TITLE_CANDIDATE_SQL,isTitleCandidate} from '../server/integrations/title-candidates.mjs';
import {QUALITY_BY_ID,qualitySummary} from '../shared/quality-checks.mjs';
import {auditTitleRows,auditDatabase,titleEvidence} from '../scripts/audit-report-titles.mjs';

const source={id:'test-city',name:'Teststadt',kind:'city',base:'https://ris.example.org/bi/',extension:'asp'};
const meeting={date:'2026-09-07',committee:'Stadtrat',url:source.base+'si0056.asp?__ksinr=161'};
const now=new Date('2026-10-07T12:00:00Z');
// Synthetic variations of the card structure in fixtures/sessionnet-fixes/sulzberg-si0056.html.
// These reproduce a parser defect; they do NOT establish which of the 4,963 historical cases used that layout.
const card=(title,{number='Ö 1',paper=false}={})=>`<div class="card card-light"><div class="card-header"><span class="badge">${number}</span><div class="smc-card-text-title">${title}</div></div><div class="card-body">${paper?'<a href="vo0050.asp?__kvonr=17">BV/17</a>':''}<p class="smc_field_smcdv0_box2_beschluss"><strong>Beschluss:</strong> Einstimmig beschlossen</p><a href="getfile.asp?id=5">Vorlage</a></div></div>`;
const parse=html=>parseAgendaCards(html,meeting,source,now);

test('SessionNet keeps title continuations across breaks and source line wrapping, irrespective of punctuation',()=>{
 for(const [markup,expected] of [
  ['2. Lesung:<br>Haushalt 2027','2. Lesung: Haushalt 2027'],
  ['Baugesetzbuch;<BR />\r\n<span>Änderung des Bebauungsplans</span>','Baugesetzbuch; Änderung des Bebauungsplans'],
  ['Sachstände zu diversen<br class="wrap">Bauvorhaben','Sachstände zu diversen Bauvorhaben'],
  ['Straßenbau\r\nund Radwege','Straßenbau und Radwege'],
  ['Haushalt<br>und Finanzen<br/><br/>Investitionen','Haushalt und Finanzen Investitionen'],
  ['Anfragen:','Anfragen:'],['Mitteilungen;','Mitteilungen;'],
  ['Vorsitz: Bürgermeister','Vorsitz: Bürgermeister'],
 ]){
  const item=parse(card(markup))[0];assert.equal(item.title,expected);
  assert.equal(item.id,'test-city-top-161--1');assert.equal(item.event.url,meeting.url);
  assert.equal(item.event.result,'Einstimmig beschlossen');assert.equal(item.documents.length,1);
  // An equivalent table layout gives the same title and stable agenda identity.
  const table=parseAgenda(`<tr><td class="tofnum">Ö 1</td><td class="tobetr"><div class="smc-card-header-title">${markup}</div></td></tr>`,meeting,source,now)[0];
  assert.equal(item.id,table.id);assert.equal(item.title,table.title);
 }
 const withChair=parse(card('2. Lesung:<br>Haushalt 2027<br /> <br/><strong>Vorsitz:</strong> Bürgermeister',{paper:true}))[0];
 assert.equal(withChair.title,'2. Lesung: Haushalt 2027');assert.equal(withChair.id,'test-city-vo-17');
 assert.deepEqual(parse(card('Öffentlich')+card('Personal<br>Vertraulich',{number:'N 2'})).map(t=>t.title),['Öffentlich']);
});

test('collection keeps full titles and invalidates old reading marks; an import retains identity, meetings and analysis',async()=>{
 const html=card('2. Lesung:<br>Haushalt 2027',{paper:true});
 const marks=readMarks(JSON.stringify({v:1,marks:{[meeting.url]:newMark(meeting,'old-print',now,1)}}));
 assert.deepEqual(marks,{},'the old first-line parser cache must not suppress the new reading');
 const fresh=await collectSessionNet(source,{now,window:'3m',marks:{known:marks,stock:new Set([meeting.url])},get:async url=>{
  const u=new URL(url);
  if(u.pathname.endsWith('si0040.asp'))return '<meta name="sessionnet" content="V:050500">'+(u.searchParams.get('__cmonat')==='9'?'<a href="si0056.asp?__ksinr=161" title="Details anzeigen: Stadtrat 07.09.2026">Rat</a>':'');
  if(/si005[67]\.asp$/.test(u.pathname))return html;
  if(u.pathname.endsWith('vo0050.asp'))return '<tr><td>Betreff</td><td>2. Lesung:<br>Haushalt 2027</td></tr>';
  throw Error('Unexpected request: '+url);
 }});
 assert.equal(fresh.topics.length,1);
 const current=fresh.topics[0];assert.equal(current.officialTitle,'2. Lesung: Haushalt 2027');
 assert.equal(current.sourceData.records[0].fields.title,current.officialTitle);
 const prior={...structuredClone(current),officialTitle:'2. Lesung:',title:'Gespeicherte KI-Überschrift',generatedBy:'KI-Zusammenfassung',shortSummary:'Gespeicherte Analyse',longSummary:['Absatz eins','Absatz zwei'],
  contentAnalysis:{id:'keep-analysis',status:'available',sourceSignature:'old'},weightedKeywords:{items:[{term:'Haushalt',weight:100}]},
  events:[{...current.events[0],date:'2026-08-01'},...current.events]};
 const before=JSON.stringify(prior);
 const merged=mergeImport({topics:[prior],coverage:{}},fresh).topics.filter(t=>!t.identity?.mergedInto);
 assert.equal(merged.length,1);const result=merged[0];assert.equal(result.id,prior.id);
 assert.equal(result.officialTitle,current.officialTitle);assert.equal(result.title,prior.title);
 assert.equal(result.shortSummary,prior.shortSummary);assert.deepEqual(result.longSummary,prior.longSummary);
 assert.equal(result.contentAnalysis.id,'keep-analysis');assert.equal(result.contentAnalysis.status,'stale');
 assert.deepEqual(result.events.map(e=>e.date).sort(),['2026-08-01','2026-09-07']);
 assert.equal(JSON.stringify(prior),before);
});

const topic=(id,extra={})=>({id,regionId:source.id,sourceUrl:source.base+'oparl/paper/'+id,officialTitle:'2. Lesung:',title:'KI-Titel',events:[meeting],identity:{version:'official-records-v1'},...extra});
const withOriginal=(t,name='2. Lesung: Haushalt 2027')=>({...t,sourceData:{version:'public-source-fields-v1',method:'oparl',fetchedAt:now.toISOString(),records:[{kind:'paper',fields:{id:t.sourceUrl,name}}]}});
const row=t=>({id:t.id,region_id:t.regionId,payload:JSON.stringify(t)});

test('historical dry-run needs an unambiguous raw name for the exact record; punctuation alone never proposes changes',()=>{
 const t=withOriginal(topic('1')),before=JSON.stringify(t),evidence=titleEvidence(t);
 assert.equal(evidence.cause,'own_original_name_proves_continuation');
 assert.deepEqual(evidence.proposal,{field:'officialTitle',before:'2. Lesung:',after:'2. Lesung: Haushalt 2027'});
 assert.equal(evidence.evidence.url,t.sourceUrl);assert.match(evidence.evidence.recordSha256,/^[a-f\d]{64}$/);
 assert.equal(JSON.stringify(t),before);
 for(const legitimate of ['Anfragen:','Mitteilungen;']){
  const r=titleEvidence(withOriginal(topic('legitimate',{officialTitle:legitimate}),legitimate));
  assert.equal(r.cause,'punctuation_in_original_name');assert.equal(r.proposal,null);
 }
 for(const blocked of [
  topic('bare'),
  {...t,officialTitle:undefined},
  {...t,identity:{conflict:true}},
  {...t,identity:{mergedInto:'another'}},
  {...t,sourceData:{...t.sourceData,method:'sessionnet'}},
  {...t,sourceData:{...t.sourceData,version:'unknown'}},
  {...t,sourceData:{...t.sourceData,fetchedAt:'invalid'}},
  {...t,sourceUrl:source.base+'oparl/paper/other'},
  {...t,sourceData:{...t.sourceData,records:[...t.sourceData.records,{kind:'paper',fields:{id:t.sourceUrl,name:'2. Lesung: Anderer Haushalt'}}]}},
  {...t,sourceData:{...t.sourceData,records:[{kind:'agenda',fields:{id:t.sourceUrl,name:'2. Lesung: Haushalt',public:false}}]}},
  {...t,sourceData:{...t.sourceData,records:[{kind:'paper',fields:{id:t.sourceUrl,name:'2. Lesung: Haushalt',deleted:true}}]}},
  withOriginal(topic('unrelated'),'Anderer Vorgang: Haushalt 2027'),
  {...t,sourceData:{...t.sourceData,records:[{kind:'agenda',url:t.sourceUrl,fields:{title:'2. Lesung: Haushalt'}}]}},
 ])assert.equal(titleEvidence(blocked).proposal,null,JSON.stringify(blocked));
 // No proposal remains when the full title is already stored, even if that full title ends in punctuation too.
 assert.equal(titleEvidence(withOriginal(topic('already',{officialTitle:'2. Lesung: Haushalt 2027;'}),'2. Lesung: Haushalt 2027;')).proposal,null);
});

test('audit covers every candidate, groups stored adapter/source/region and is deterministic and idempotent',()=>{
 const topics=Array.from({length:25},(_,i)=>withOriginal(topic(String(i))));
 topics.push(topic('no-provenance'),withOriginal(topic('legitimate',{officialTitle:'Anfragen:'}),'Anfragen:'),topic('alias',{identity:{mergedInto:'0'}}));
 const rows=topics.map(row),before=JSON.stringify(rows);
 const first=auditTitleRows(rows,{expectedCount:4963}),second=auditTitleRows(rows,{expectedCount:4963});
 assert.deepEqual(first,second);assert.equal(first.candidateCount,27);assert.equal(first.findings.length,27);
 assert.deepEqual(first,auditTitleRows([...rows].reverse(),{expectedCount:4963}));
 assert.equal(first.proposalCount,25);assert.equal(first.countMatches,false);
 assert.equal(first.groups.reduce((n,g)=>n+g.count,0),27);assert.equal(first.groups.length,2);
 assert.equal(first.causes.missing_provenance,1);assert.equal(first.causes.punctuation_in_original_name,1);
 assert.equal(first.findings.find(f=>f.id==='no-provenance').adapter,'unknown');
 assert.equal(JSON.stringify(rows),before);
 const wrong=auditTitleRows([{...row(topics[0]),id:'other'}]);
 assert.equal(wrong.findings[0].cause,'column_identity_mismatch');assert.equal(wrong.proposalCount,0);
});

test('SQLite audit reads one snapshot, shares the quality selector, and leaves rows, versions, analyses and revisions untouched',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rm-title-audit-')),file=path.join(dir,'copy.sqlite');
 try{
  const db=new DatabaseSync(file);
  for(const f of fs.readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())db.exec(fs.readFileSync(new URL('../drizzle/'+f,import.meta.url),'utf8'));
  const put=db.prepare('INSERT INTO topics(id,region_id,source,event_date,updated_at,status,payload) VALUES(?,?,?,?,?,?,?)');
  const cases=[withOriginal(topic('1')),topic('legitimate',{officialTitle:'Anfragen:'}),topic('semicolon',{officialTitle:'Mitteilungen;'}),topic('plain',{officialTitle:'Haushalt'}),topic('spaces',{officialTitle:'   ',title:'Ersatz:'}),topic('tab',{officialTitle:'Anfragen:\t'}),topic('newline',{officialTitle:'Anfragen:\n'}),topic('alias',{identity:{mergedInto:'1'}})];
  for(const t of cases)put.run(t.id,t.regionId,'city',meeting.date,now.toISOString(),'unknown',JSON.stringify(t));
  db.prepare('INSERT INTO article_versions(id,topic_id,captured_at,payload) VALUES(?,?,?,?)').run('version-1','1',now.toISOString(),JSON.stringify(cases[0]));
  db.prepare('INSERT INTO article_analyses(id,topic_id,kind,method,input_hash,created_at,payload) VALUES(?,?,?,?,?,?,?)').run('analysis-1','1','summary','stored','hash',now.toISOString(),'{"text":"keep"}');
  const all=()=>JSON.stringify(['topics','article_versions','article_analyses','data_revisions','system_state','search_cards'].map(t=>db.prepare(`SELECT * FROM ${t}`).all()));
  const before=all(),bytes=fs.readFileSync(file),report=auditDatabase(file);
  assert.equal(report.candidateCount,4);assert.equal(report.totalTopics,cases.length);assert.equal(report.proposalCount,1);
  assert.equal(report.revision,db.prepare("SELECT revision FROM data_revisions WHERE id='content'").get().revision);
  assert.deepEqual(report,auditDatabase(file));assert.equal(all(),before);assert.deepEqual(fs.readFileSync(file),bytes);
  assert.deepEqual(db.prepare(`SELECT id FROM topics WHERE ${TITLE_CANDIDATE_SQL} ORDER BY id`).all().map(r=>r.id),cases.filter(isTitleCandidate).map(t=>t.id).sort());
  db.close();
  const cli=spawnSync(process.execPath,['scripts/audit-report-titles.mjs','--database',file,'--expected-count','4963'],{encoding:'utf8'});
  assert.equal(cli.status,2);assert.equal(JSON.parse(cli.stdout).candidateCount,4);
  const apply=spawnSync(process.execPath,['scripts/audit-report-titles.mjs','--database',file,'--apply'],{encoding:'utf8'});
  assert.equal(apply.status,1);assert.match(apply.stderr,/Unbekannte/);assert.deepEqual(fs.readFileSync(file),bytes);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('punctuation findings remain visible as hints and never count as proven defects, including old stored results',()=>{
 assert.equal(QUALITY_BY_ID.truncatedTitle.group,'hints');
 const summary=qualitySummary({truncatedTitle:{count:4963,samples:[{title:'Anfragen:'}]}});
 assert.equal(summary.hints,4963);assert.equal(summary.defects,0);
});
