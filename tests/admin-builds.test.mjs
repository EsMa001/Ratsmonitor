import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {sqliteAdapter} from '../scripts/sqlite-adapter.mjs';
import {startBuild,stepBuild,readBuild,cancelBuild,buildStatus,isBuildTarget} from '../server/integrations/admin-builds.mjs';
import {QUALITY_BUILDS,runQualityCheck,storedQualityChecks} from '../server/integrations/quality-check.mjs';
import {refreshStep} from '../server/integrations/admin-refresh.mjs';

// The mechanics of a build in chunks of areas (admin-builds.mjs): resume, restart, cancel, the guard against counting a
// chunk twice, waiting for a finishing step or an import job. Target: "same address under several areas", the build
// that keeps partial sums in admin_agg (quality-check.mjs); its result equals the check over the whole stock.
const root=path.resolve(import.meta.dirname,'..');
const now=new Date('2026-10-08T12:00:00Z');
const ID='dupSharedSystem',TARGET='quality:'+ID,KEY='admin-build:'+TARGET;
function stock(){
 const sql=new DatabaseSync(':memory:');for(const f of fs.readdirSync(path.join(root,'drizzle')).filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync(path.join(root,'drizzle',f),'utf8'));
 let seed=3;const rand=()=>{seed=(seed*1103515245+12345)%2147483648;return seed/2147483648;},pick=l=>l[Math.floor(rand()*l.length)];
 const areas=['a-1','a-2','a-3','a-4','a-5','a-6','a-7'];
 // Two hosts with three addresses each and two titles: at most 12 groups, fewer than the 20 examples kept, so the
 // examples do not depend on the order of equal counts.
 for(let i=0;i<160;i++){
  const area=pick(areas),host=pick(['ris-1.example.org','ris-2.example.org']),title=pick(['Haushaltssatzung 2027','Radweg an der Schulstraße']);
  const payload={id:'t'+i,title,sourceUrl:rand()<0.9?`https://${host}/vo?${Math.floor(rand()*3)}`:'',identity:rand()<0.08?{mergedInto:'t0'}:{}};
  sql.prepare('INSERT INTO topics(id,region_id,source,event_date,updated_at,status,payload) VALUES(?,?,?,?,?,?,?)').run('t'+i,area,'city','2026-09-01','2026-10-01T00:00:00Z','unknown',JSON.stringify(payload));
 }
 return {sql,db:sqliteAdapter(sql)};
}
const bySample=s=>JSON.stringify([s.url,(s.ids||[]).slice().sort()]);
const normal=r=>({count:r.count,groups:r.groups,samples:(r.samples||[]).map(s=>({...s,ids:s.ids.slice().sort(),regions:s.regions.slice().sort()})).sort((a,b)=>bySample(a)<bySample(b)?-1:1)});
const stored=async db=>(await storedQualityChecks(db)).checks[ID];
const partialSums=(sql,build)=>Number(build?sql.prepare('SELECT count(*) n FROM admin_agg WHERE build=?').get(build).n:sql.prepare('SELECT count(*) n FROM admin_agg').get().n);
async function drive(db,target,options){let r,steps=0;do{r=await stepBuild(db,target,options);steps++;}while(r.state==='running');return {r,steps};}
async function refreshAll(db,target){let r;do{r=await refreshStep(db,{action:'step',target,budgetMs:1e9});}while(r.state==='running');return r;}

test('a build in chunks stores what the check over the whole stock gives and leaves nothing behind',async()=>{
 const {sql,db}=stock();
 const whole=normal(await runQualityCheck(db,ID));
 assert.ok(whole.groups>2,'the stock has groups: '+whole.groups);
 await startBuild(db,TARGET,{now});
 const {r,steps}=await drive(db,TARGET,{budgetMs:0,chunkRows:30,now});
 assert.equal(r.state,'done');assert.ok(steps>2,'several steps: '+steps);
 const got=await stored(db);
 assert.equal(got.checkedAt,now.toISOString(),'stored by the build');
 assert.deepEqual(normal(got),whole);
 assert.equal(typeof got.stockSum,'number');
 assert.equal(partialSums(sql),0,'partial sums removed');
 assert.equal(await readBuild(db,TARGET),null);
});

test('a build stopped midway continues where it stopped and gives the same result',async()=>{
 const {sql,db}=stock();const whole=normal(await runQualityCheck(db,ID));
 await startBuild(db,TARGET,{now});
 await stepBuild(db,TARGET,{budgetMs:0,chunkRows:20,now});
 const paused=await buildStatus(db,TARGET,{now:new Date(Date.now()+120000)});
 assert.equal(paused.state,'paused');assert.ok(paused.done>0&&paused.done<paused.total);
 /* Starting again without restart continues the same build */
 const again=await startBuild(db,TARGET,{now});assert.equal(again.done,paused.done);
 await drive(db,TARGET,{budgetMs:0,chunkRows:20,now});
 assert.deepEqual(normal(await stored(db)),whole);
 /* Restart and cancel remove the partial sums */
 await startBuild(db,TARGET,{now});await stepBuild(db,TARGET,{budgetMs:0,chunkRows:20,now});
 const before=await readBuild(db,TARGET);assert.ok(partialSums(sql,before.id)>0,'partial sums kept while the build runs');
 const restarted=await startBuild(db,TARGET,{restart:true,now});assert.equal(restarted.done,0);
 assert.equal(partialSums(sql,before.id),0,'restart removes the partial sums');
 await stepBuild(db,TARGET,{budgetMs:0,chunkRows:20,now});await cancelBuild(db,TARGET);
 assert.equal(await readBuild(db,TARGET),null);
 assert.equal(partialSums(sql),0,'cancel removes the partial sums');
});

test('the same chunk sent twice with the same expected cursor changes nothing the second time',async()=>{
 const {sql,db}=stock();const whole=normal(await runQualityCheck(db,ID));
 const st=await startBuild(db,TARGET,{now});
 const guard="EXISTS(SELECT 1 FROM system_state s WHERE s.key=? AND json_extract(s.value,'$.id')=? AND json_extract(s.value,'$.next')=?)";
 /* First run of the first chunk, as stepBuild does it */
 const unit={kind:'r',ids:['a-1']},guardArgs=[KEY,st.id,''];
 const first=await QUALITY_BUILDS[TARGET].chunk(db,unit,{build:st.id,guard,guardArgs,state:st});
 const move=next=>db.prepare("UPDATE system_state SET value=? WHERE key=? AND json_extract(value,'$.id')=? AND json_extract(value,'$.next')=?").bind(JSON.stringify(next),KEY,st.id,'');
 const r1=await db.batch([...first.statements,move({...st,next:'r|a-1',done:1,partial:first.partial})]);
 assert.equal(r1.at(-1).meta.changes,1);
 const agg=sql.prepare('SELECT sum(n) n FROM admin_agg').get().n;assert.ok(agg>0);
 /* The same chunk again (a step whose lease ran out): the guard fails, nothing is added */
 const second=await QUALITY_BUILDS[TARGET].chunk(db,unit,{build:st.id,guard,guardArgs,state:st});
 const r2=await db.batch([...second.statements,move({...st,next:'r|a-1',done:1,partial:second.partial})]);
 assert.equal(r2.at(-1).meta.changes,0);
 assert.equal(sql.prepare('SELECT sum(n) n FROM admin_agg').get().n,agg,'nothing counted twice');
 await drive(db,TARGET,{budgetMs:0,chunkRows:30,now});
 assert.deepEqual(normal(await stored(db)),whole);
});

test('a build runs through the refresh steps: start, steps, done; the former keyword count is no target any more',async()=>{
 const {db}=stock();
 let r=await refreshStep(db,{action:'start',target:TARGET,budgetMs:1e9});
 assert.equal(r.target,TARGET);
 if(r.state==='running')r=await refreshAll(db,TARGET);
 assert.equal(r.state,'done');assert.ok(await stored(db));
 r=await refreshStep(db,{action:'step',target:TARGET});assert.equal(r.state,'done','nothing running');
 assert.equal(isBuildTarget('keywords'),false);
 await assert.rejects(refreshStep(db,{action:'start',target:'keywords'}),/Unbekanntes Rechenziel/);
});

test('an old paused build is started anew, a finishing one makes others wait, a failed finish removes the build',async()=>{
 const {sql,db}=stock();
 await startBuild(db,TARGET,{now});await stepBuild(db,TARGET,{budgetMs:0,chunkRows:20,now});
 const old=await readBuild(db,TARGET);
 /* Paused for two hours: a new start begins anew instead of mixing old and new counts */
 sql.prepare("UPDATE system_state SET value=json_set(value,'$.updatedAt',?) WHERE key=?").run(new Date(Date.now()-7200000).toISOString(),KEY);
 const fresh=await startBuild(db,TARGET,{now});
 assert.notEqual(fresh.id,old.id);assert.equal(fresh.done,0);
 assert.equal(partialSums(sql,old.id),0,'old partial sums removed');
 await stepBuild(db,TARGET,{budgetMs:0,chunkRows:20,now});assert.ok(partialSums(sql,fresh.id)>0);
 /* Another step is finishing: wait (busy) */
 sql.prepare("UPDATE system_state SET value=json_set(value,'$.next',char(0)||'finish','$.updatedAt',?) WHERE key=?").run(new Date().toISOString(),KEY);
 assert.equal((await stepBuild(db,TARGET,{budgetMs:0,now})).state,'busy');
 /* It stopped, and storing the result fails: the takeover removes the build with its partial sums and reports the error */
 sql.exec("CREATE TRIGGER fail_store BEFORE INSERT ON system_state WHEN NEW.key='admin-quality-check' BEGIN SELECT RAISE(ABORT,'Speichern gescheitert'); END");
 sql.prepare("UPDATE system_state SET value=json_set(value,'$.updatedAt',?) WHERE key=?").run(new Date(Date.now()-60000).toISOString(),KEY);
 await assert.rejects(stepBuild(db,TARGET,{budgetMs:0,now}),/Speichern gescheitert/);
 assert.equal(await readBuild(db,TARGET),null);
 assert.equal(partialSums(sql,fresh.id),0);
 assert.equal(await stored(db),undefined);
});

test('builds wait while an import job runs, and go on when it is over (the state is kept)',async()=>{
 const {sql,db}=stock();
 sql.prepare("INSERT INTO system_state(key,value) VALUES('admin-pipeline-job',?)").run(JSON.stringify({status:'running',updatedAt:new Date().toISOString(),items:[]}));
 const first=await refreshStep(db,{action:'start',target:TARGET,budgetMs:1e9});
 assert.equal(first.state,'busy');assert.equal(first.reason,'job');
 assert.ok(await readBuild(db,TARGET),'the build is started and kept');
 assert.equal((await refreshStep(db,{action:'step',target:TARGET,budgetMs:1e9})).reason,'job');
 assert.equal(partialSums(sql),0,'nothing was counted meanwhile');assert.equal((await readBuild(db,TARGET)).done,0);
 /* The job is over (nobody has written to it for five minutes) */
 sql.prepare("UPDATE system_state SET value=json_set(value,'$.updatedAt',?) WHERE key='admin-pipeline-job'").run(new Date(Date.now()-600000).toISOString());
 const done=await refreshAll(db,TARGET);
 assert.equal(done.state,'done');assert.ok(await stored(db));
});
