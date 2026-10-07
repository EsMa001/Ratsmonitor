import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {sqliteAdapter} from '../scripts/ai-job.mjs';
import {decisions,readResult} from '../server/integrations/analytics-decisions.mjs';

const catalog=[{id:'a',kind:'city',name:'Alt',ags:'05558008'},{id:'b',kind:'city',name:'Bett',ags:'03155012'}];
test('result text is read for vote and amendment',()=>{
 assert.deepEqual(readResult('einstimmig beschlossen'),{vote:'unanimous',change:null});
 assert.deepEqual(readResult('Mehrheitlich abgelehnt'),{vote:'majority',change:null});
 assert.deepEqual(readResult('ungeändert beschlossen'),{vote:null,change:'unchanged'});
 assert.deepEqual(readResult('geändert beschlossen'),{vote:null,change:'changed'});
 assert.deepEqual(readResult('vertagt'),{vote:null,change:null});
});
test('decisions count status and outcome exactly and read votes, amendments and duration from the stations',async()=>{
 const sql=new DatabaseSync(':memory:');
 for(const file of fs.readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8').replaceAll('--> statement-breakpoint',''));
 const db=sqliteAdapter(sql);let n=0;
 const put=(region,status,committee,label,events)=>{n++;const t={title:'Vorlage '+n,officialTitle:'Vorlage '+n,shortSummary:'x',committee,classification:{method:'title-rules-v2',version:'labels-v2',primary:label,evidence:'x'},events};sql.prepare('INSERT INTO topics VALUES(?,?,?,?,?,?,?)').run('t'+n,'city','2026-09-20','2026-09-20',status,JSON.stringify(t),region);};
 const ev=(date,status,result)=>({date,committee:'x',status,result});
 for(let i=0;i<4;i++)put('a','approved','Rat der Stadt','bildung',[ev('2026-09-01','consulting',''),ev('2026-09-11','approved','einstimmig beschlossen')]);
 for(let i=0;i<2;i++)put('a','approved','Ausschuss für Bau','bildung',[ev('2026-09-20','approved','mehrheitlich beschlossen')]);
 put('a','approved','Ortsbeirat Nord','bauen',[ev('2026-09-20','approved','geändert beschlossen')]);
 put('b','rejected','Rat der Stadt','bildung',[ev('2026-09-20','rejected','mehrheitlich abgelehnt')]);
 put('b','postponed','Rat der Stadt','bauen',[ev('2026-09-20','postponed','vertagt')]);
 put('b','consulting','Rat der Stadt','bauen',[ev('2026-09-20','consulting','')]);
 put('b','unknown','Rat der Stadt','bauen',[]);
 try{
  const d=await decisions(db,catalog,new URLSearchParams('to=2999-01-01'));
  assert.equal(d.totals.all,11);assert.equal(d.totals.known,10);assert.equal(d.totals.decided,9);
  assert.equal(d.status.find(s=>s.id==='approved').n,7);
  assert.equal(d.rates.approval,77.8);assert.equal(d.rates.rejection,11.1);assert.equal(d.rates.open,1);
  assert.deepEqual(d.months.map(m=>[m.m,m.approved,m.rejected,m.postponed]),[['2026-09',7,1,1]]);
  assert.equal(d.kinds.find(k=>k.id==='rat').decided,6);assert.equal(d.kinds.find(k=>k.id==='ausschuss').approved,2);assert.equal(d.kinds.find(k=>k.id==='ortsebene').decided,1);
  assert.equal(d.lands.length,0,'lands below the minimum are left out');
  assert.equal(d.votes.sampled,9);
  /* Abstimmung bekannt: 4 einstimmig, 2 mehrheitlich beschlossen, 1 mehrheitlich abgelehnt */
  assert.equal(d.votes.all.vote,7);assert.equal(d.votes.all.unanimous,57.1);
  assert.equal(d.votes.all.changeN,1);assert.equal(d.votes.all.changed,100);
  /* Durchlaufzeit: vier Vorgänge mit zwei Stationen, 10 Tage */
  assert.equal(d.duration.n,4);assert.equal(d.duration.median,10);
  const one=await decisions(db,catalog,new URLSearchParams('area=03155012&scope=only&to=2999-01-01'));
  assert.equal(one.totals.all,4);
 }finally{sql.close();}
});
