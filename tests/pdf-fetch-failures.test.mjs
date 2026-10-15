// fetch.mjs mit Fehlerspeicher (Migration 0040): Fehler vermerkt, wartende Server ausgelassen, Stichprobe, --urls, --since-updated
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';

const fixture=fileURLToPath(new URL('./fixtures/pdf-fetch-failures.mjs',import.meta.url));
const MIG=new URL('../drizzle/',import.meta.url);
function setup(topics){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rm-fetch-'));
 const sql=new DatabaseSync(path.join(dir,'main.sqlite'));
 for(const f of fs.readdirSync(MIG).filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync(new URL(f,MIG),'utf8'));
 const ins=sql.prepare('INSERT INTO topics(id,region_id,source,event_date,updated_at,status,payload) VALUES(?,?,?,?,?,?,?)');
 for(const t of topics)ins.run(t.id,'billerbeck','test',t.date,t.updated||'2026-10-14T01:00:00Z','consulting',JSON.stringify({id:t.id,title:'Vorlage '+t.id,officialTitle:'Vorlage '+t.id,
  documents:[{kind:'application/pdf',url:t.url,title:'Vorlage'}],events:[],longSummary:[],sourceText:''}));
 sql.close();
 return dir;
}
function run(dir,args,plan={}){
 const r=spawnSync(process.execPath,['--experimental-test-module-mocks','--no-warnings',fixture,JSON.stringify({dir,args,plan})],{encoding:'utf8',timeout:30000});
 assert.equal(r.status,0,r.stderr||r.stdout);
 return JSON.parse(r.stdout.trim().split('\n').at(-1));
}
const db=dir=>new DatabaseSync(path.join(dir,'main.sqlite'));
const recent=new Date(Date.now()-2*864e5).toISOString().slice(0,10);

test('failures are recorded with class, a failing server waits, its documents are skipped next time',()=>{
 const dir=setup([
  {id:'a1',url:'https://a.de/1.pdf',date:recent},{id:'a2',url:'https://a.de/2.pdf',date:recent},{id:'a3',url:'https://a.de/3.pdf',date:recent},
  {id:'b1',url:'https://b.de/1.pdf',date:recent},{id:'b2',url:'https://b.de/2.pdf',date:recent},{id:'b3',url:'https://b.de/3.pdf',date:'2020-01-01'}]);
 const plan={'https://a.de/1.pdf':500,'https://a.de/2.pdf':500,'https://a.de/3.pdf':500,'https://b.de/2.pdf':404,'https://b.de/3.pdf':'nopdf'};
 run(dir,['--concurrency','1','--per-host','1','--gap-ms','0'],plan);
 const s=db(dir);
 const rows=Object.fromEntries(s.prepare('SELECT key,class,origin,next_try_at FROM work_failures').all().map(r=>[r.key,r]));
 assert.equal(rows['https://a.de/1.pdf'].class,'transient');
 assert.equal(rows['https://b.de/2.pdf'].class,'gone');assert.equal(rows['https://b.de/2.pdf'].next_try_at,null);
 assert.equal(rows['https://b.de/3.pdf'].class,'gone');assert.equal(rows['https://b.de/3.pdf'].origin,'backlog');
 assert.equal(rows['https://a.de/1.pdf'].origin,'daily');
 assert.equal(s.prepare("SELECT state FROM source_hosts WHERE host='a.de'").get().state,'bremsen');
 s.close();
 // second run: a.de waits, failed addresses are not fetched again, nothing new to do
 const second=run(dir,[],{});
 assert.deepEqual(second.calls,[]);
});

test('a due server gets a sample of three; one success releases the rest and clears its entries',()=>{
 const topics=Array.from({length:6},(_,i)=>({id:'c'+i,url:`https://c.de/${i}.pdf`,date:recent}));
 const dir=setup(topics);
 const plan=Object.fromEntries(topics.map(t=>[t.url,503]));
 run(dir,['--concurrency','1','--per-host','1','--gap-ms','0','--limit','1'],plan);
 const s=db(dir);
 assert.equal(s.prepare("SELECT state FROM source_hosts WHERE host='c.de'").get().state,'bremsen');
 s.prepare("UPDATE source_hosts SET next_try_at='2000-01-01T00:00:00Z'").run();s.close();
 // sample with 500: only SAMPLE addresses are tried, the server goes one level up (429/503 would stop at the first)
 const failing=run(dir,['--concurrency','1','--per-host','1','--gap-ms','0'],Object.fromEntries(topics.map(t=>[t.url,500])));
 assert.equal(failing.calls.length,3);
 let t=db(dir);assert.equal(t.prepare("SELECT level FROM source_hosts WHERE host='c.de'").get().level,2);
 t.prepare("UPDATE source_hosts SET next_try_at='2000-01-01T00:00:00Z'").run();t.close();
 // nacharbeit-style run with --urls (the four addresses with an entry): sample succeeds, the rest follows
 const failed=t=>t.prepare('SELECT key FROM work_failures').all().map(r=>r.key);
 t=db(dir);const keys=failed(t);t.close();assert.equal(keys.length,4);
 fs.writeFileSync(path.join(dir,'urls.txt'),keys.join('\n'));
 const ok=run(dir,['--concurrency','1','--per-host','1','--gap-ms','0','--urls',path.join(dir,'urls.txt')],{});
 assert.equal(ok.calls.length,4);
 // the two never tried addresses come with the next normal run, the server is ok again
 assert.equal(run(dir,['--gap-ms','0'],{}).calls.length,2);
 t=db(dir);
 assert.equal(t.prepare("SELECT state FROM source_hosts WHERE host='c.de'").get().state,'ok');
 assert.equal(t.prepare("SELECT count(*) n FROM work_failures").get().n,0);
 t.close();
});

test('--since-updated takes reports written since then; --event-from adds the whole daily range',()=>{
 const dir=setup([{id:'n1',url:'https://d.de/new.pdf',date:recent,updated:'2026-10-15T02:00:00Z'},{id:'o1',url:'https://d.de/old.pdf',date:recent,updated:'2026-10-01T02:00:00Z'},{id:'a1',url:'https://d.de/alt.pdf',date:'2025-01-01',updated:'2026-10-01T02:00:00Z'}]);
 const r=run(dir,['--since-updated','2026-10-15T00:00:00Z','--gap-ms','0']);
 assert.deepEqual(r.calls,['https://d.de/new.pdf']);
 const r2=run(dir,['--since-updated','2026-10-15T00:00:00Z','--event-from',recent,'--gap-ms','0']);
 assert.deepEqual(r2.calls.sort(),['https://d.de/old.pdf'],'new ist schon geladen; old hat eine Sitzung im Tagesbereich; alt nicht');
});
