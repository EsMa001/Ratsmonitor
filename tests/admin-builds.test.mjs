import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {sqliteAdapter} from '../scripts/ai-job.mjs';
import {adminKeywords,keywordChunk} from '../server/integrations/admin-keywords.mjs';
import {startBuild,stepBuild,readBuild,cancelBuild,buildStatus} from '../server/integrations/admin-builds.mjs';
import {readStored,storedMeta} from '../server/integrations/admin-stored.mjs';
import {refreshStep} from '../server/integrations/admin-refresh.mjs';

// Keywords built in chunks of areas (admin-builds.mjs) give what the former count over all reports gave.
const root=path.resolve(import.meta.dirname,'..');
const now=new Date('2026-10-08T12:00:00Z');
function stock(){
 const sql=new DatabaseSync(':memory:');for(const f of fs.readdirSync(path.join(root,'drizzle')).filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync(path.join(root,'drizzle',f),'utf8'));
 let seed=3;const rand=()=>{seed=(seed*1103515245+12345)%2147483648;return seed/2147483648;},pick=l=>l[Math.floor(rand()*l.length)];
 const areas=['a-1','a-2','a-3','a-4','a-5','a-6','a-7'];
 const spell=['Schul','schul','Schule','Ganztag','Bebauungsplan','bebauungsplan','Radweg'];
 for(let i=0;i<160;i++){
  const area=pick(areas),label=pick(['bildung','bauen','sitzung','allgemein','unklar','mobilitaet']);
  const reason=label==='sitzung'?'Formaler Sitzungspunkt':label==='unklar'?pick(['Mehrere mögliche Sachgebiete; offen.','Kein Sachthema.']):label==='allgemein'?'Allgemein':'Erkannte Sachbegriffe: '+[pick(spell),pick(spell)].join(', ');
  const terms=rand()<0.8?[pick(['schul','ganzt','bebau','radwe']),pick(['schul','haush','strass']),...(rand()<0.1?[null]:[])]:undefined;
  const ai=rand()<0.6?{weightedKeywords:{status:pick(['completed','completed','stale']),inputBasis:pick(['content','title']),items:[{term:pick(['Schule','schule ',' Haushalt','Radweg']),weight:pick([10,20,30])},{term:pick(['Kita','Bauen']),weight:pick([5,15])}]}}:{};
  const payload={id:'t'+i,title:'T'+i,classification:{primary:label,reason},...(terms?{analysisFeatures:{terms,subjects:rand()<0.3?['Schulen']:[]}}:{}),...ai,...(rand()<0.08?{identity:{mergedInto:'t0'}}:{identity:{}})};
  sql.prepare('INSERT INTO topics(id,region_id,source,event_date,updated_at,status,payload) VALUES(?,?,?,?,?,?,?)').run('t'+i,area,'city','2026-09-01','2026-10-01T00:00:00Z','unknown',JSON.stringify(payload));
 }
 return {sql,db:sqliteAdapter(sql)};
}
/** Rule words compared without their spelling: the build takes the spelling with the most reports over all areas. */
const comparable=k=>({...k,asOf:0,rule:{...k.rule,words:k.rule.words.map(w=>({...w,term:w.term.toLocaleLowerCase('de-DE')})).sort((a,b)=>a.label<b.label?-1:a.label>b.label?1:a.term<b.term?-1:a.term>b.term?1:0)}});
async function drive(db,target,options){let r,steps=0;do{r=await stepBuild(db,target,options);steps++;}while(r.state==='running');return {r,steps};}

test('keywords built chunk by chunk equal the count over all reports',async()=>{
 const {sql,db}=stock();
 const expected=await adminKeywords(db,{now});
 await startBuild(db,'keywords',{now});
 const {r,steps}=await drive(db,'keywords',{budgetMs:0,chunkRows:30,now});
 assert.equal(r.state,'done');assert.ok(steps>2,'several steps: '+steps);
 const stored=await readStored(db,'keywords');
 assert.deepEqual(comparable(JSON.parse(stored.text)),comparable(expected));
 assert.deepEqual(JSON.parse(stored.text).ai,expected.ai,'AI keywords exactly equal');
 assert.equal(sql.prepare('SELECT count(*) n FROM admin_agg').get().n,0,'partial sums removed');
 assert.equal(await readBuild(db,'keywords'),null);
 assert.equal(typeof (await storedMeta(db,'keywords')).stockSum,'number');
});

test('a build stopped midway continues where it stopped and gives the same result',async()=>{
 const {db}=stock();const expected=comparable(await adminKeywords(db,{now}));
 await startBuild(db,'keywords',{now});
 await stepBuild(db,'keywords',{budgetMs:0,chunkRows:20,now});
 const paused=await buildStatus(db,'keywords',{now:new Date(Date.now()+120000)});
 assert.equal(paused.state,'paused');assert.ok(paused.done>0&&paused.done<paused.total);
 /* Starting again without restart continues the same build */
 const again=await startBuild(db,'keywords',{now});assert.equal(again.done,paused.done);
 await drive(db,'keywords',{budgetMs:0,chunkRows:20,now});
 assert.deepEqual(comparable(JSON.parse((await readStored(db,'keywords')).text)),expected);
 /* Restart and cancel remove the partial sums */
 await startBuild(db,'keywords',{now});await stepBuild(db,'keywords',{budgetMs:0,chunkRows:20,now});
 const restarted=await startBuild(db,'keywords',{restart:true,now});assert.equal(restarted.done,0);
 await stepBuild(db,'keywords',{budgetMs:0,chunkRows:20,now});await cancelBuild(db,'keywords');
 assert.equal(await readBuild(db,'keywords'),null);
});

test('the same chunk sent twice with the same expected cursor changes nothing the second time',async()=>{
 const {sql,db}=stock();const expected=comparable(await adminKeywords(db,{now}));
 const st=await startBuild(db,'keywords',{now});
 const key='admin-build:keywords',guard="EXISTS(SELECT 1 FROM system_state s WHERE s.key=? AND json_extract(s.value,'$.id')=? AND json_extract(s.value,'$.next')=?)";
 /* First run of the first chunk, as stepBuild does it */
 const ids=JSON.stringify(['a-1']),guardArgs=[key,st.id,''];
 const first=await keywordChunk(db,ids,{build:st.id,guard,guardArgs});
 const move=next=>db.prepare("UPDATE system_state SET value=? WHERE key=? AND json_extract(value,'$.id')=? AND json_extract(value,'$.next')=?").bind(JSON.stringify(next),key,st.id,'');
 const r1=await db.batch([...first.statements,move({...st,next:'a-1',done:1,partial:first.sums})]);
 assert.equal(r1.at(-1).meta.changes,1);
 const agg=sql.prepare('SELECT sum(n) n FROM admin_agg').get().n;
 /* The same chunk again (a step whose lease ran out): the guard fails, nothing is added */
 const second=await keywordChunk(db,ids,{build:st.id,guard,guardArgs});
 const r2=await db.batch([...second.statements,move({...st,next:'a-1',done:1,partial:second.sums})]);
 assert.equal(r2.at(-1).meta.changes,0);
 assert.equal(sql.prepare('SELECT sum(n) n FROM admin_agg').get().n,agg,'nothing counted twice');
 await drive(db,'keywords',{budgetMs:0,chunkRows:30,now});
 assert.deepEqual(comparable(JSON.parse((await readStored(db,'keywords')).text)),expected);
});

test('keywords are counted through the refresh steps: start, steps, done',async()=>{
 const {db}=stock();
 let r=await refreshStep(db,{action:'start',target:'keywords',budgetMs:1e9});
 assert.equal(r.state,'done');assert.equal(r.target,'keywords');
 assert.ok(await readStored(db,'keywords'));
 r=await refreshStep(db,{action:'step',target:'keywords'});assert.equal(r.state,'done','nothing running');
});

test('an old paused build is started anew, a finishing one makes others wait, a failed finish removes the build',async()=>{
 const {sql,db}=stock();
 await startBuild(db,'keywords',{now});await stepBuild(db,'keywords',{budgetMs:0,chunkRows:20,now});
 const old=await readBuild(db,'keywords');
 /* Paused for two hours: a new start begins anew instead of mixing old and new counts */
 sql.prepare("UPDATE system_state SET value=json_set(value,'$.updatedAt',?) WHERE key='admin-build:keywords'").run(new Date(Date.now()-7200000).toISOString());
 const fresh=await startBuild(db,'keywords',{now});
 assert.notEqual(fresh.id,old.id);assert.equal(fresh.done,0);
 assert.equal(sql.prepare('SELECT count(*) n FROM admin_agg WHERE build=?').get(old.id).n,0,'old partial sums removed');
 /* Another step is finishing: wait (busy) */
 sql.prepare("UPDATE system_state SET value=json_set(value,'$.next',char(0)||'finish','$.updatedAt',?) WHERE key='admin-build:keywords'").run(new Date().toISOString());
 assert.equal((await stepBuild(db,'keywords',{budgetMs:0,now})).state,'busy');
 /* It stopped and its partial sums are gone: the takeover refuses to store counts without words and removes the build */
 sql.prepare("UPDATE system_state SET value=json_set(value,'$.updatedAt',?,'$.partial.articles',5) WHERE key='admin-build:keywords'").run(new Date(Date.now()-60000).toISOString());
 sql.exec('DELETE FROM admin_agg');
 await assert.rejects(stepBuild(db,'keywords',{budgetMs:0,now}),/Teilsummen/);
 assert.equal(await readBuild(db,'keywords'),null);
 assert.equal(await readStored(db,'keywords'),null);
});

test('builds wait while an import job runs, and go on when it is over (the state is kept)',async()=>{
 const {sql,db}=stock();
 sql.prepare("INSERT INTO system_state(key,value) VALUES('admin-pipeline-job',?)").run(JSON.stringify({status:'running',updatedAt:new Date().toISOString(),items:[]}));
 const first=await refreshStep(db,{action:'start',target:'keywords',budgetMs:1e9});
 assert.equal(first.state,'busy');assert.equal(first.reason,'job');
 assert.ok(await readBuild(db,'keywords'),'the build is started and kept');
 assert.equal((await refreshStep(db,{action:'step',target:'keywords',budgetMs:1e9})).reason,'job');
 assert.equal(sql.prepare('SELECT count(*) n FROM admin_agg').get().n,0,'nothing was counted meanwhile');
 /* The job is over (nobody has written to it for five minutes) */
 sql.prepare("UPDATE system_state SET value=json_set(value,'$.updatedAt',?) WHERE key='admin-pipeline-job'").run(new Date(Date.now()-600000).toISOString());
 const done=await refreshStep(db,{action:'step',target:'keywords',budgetMs:1e9});
 assert.equal(done.state,'done');assert.ok(await readStored(db,'keywords'));
});
