import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {sqliteAdapter} from '../scripts/ai-job.mjs';
import {QUALITY_CHECKS,QUALITY_BY_ID,QUALITY_GROUPS,qualitySummary} from '../shared/quality-checks.mjs';
import {storedQualityChecks,runQualityCheck} from '../server/integrations/quality-check.mjs';
const TITLE='Bebauungsplan Nr. 7 „Am Mühlenweg“, Satzungsbeschluss';
function sqlite(){
 const raw=new DatabaseSync(':memory:');for(const f of fs.readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())raw.exec(fs.readFileSync(new URL('../drizzle/'+f,import.meta.url),'utf8'));
 const put=raw.prepare('INSERT INTO topics(id,region_id,source,event_date,updated_at,status,payload) VALUES(?,?,?,?,?,?,?)');
 const insert=(id,extra={},{region='billerbeck',date='2026-09-17',column}={})=>{const t={id,regionId:region,source:'city',title:TITLE,officialTitle:TITLE,eventDate:date,events:[{date,committee:'Rat'}],documents:[{title:'Vorlage',url:'https://example.org/v.pdf',kind:'pdf'}],identity:{version:'official-records-v1'},...extra};put.run(id,region,'city',column??date,'2026-10-01T00:00:00Z','unknown',typeof extra.payload==='string'?extra.payload:JSON.stringify(t));};
 return {raw,db:sqliteAdapter(raw),insert};
}
test('every check of the list has a runner and a group, counts what it names and keeps examples; a clean stock counts nothing',async()=>{
 const {raw,db,insert}=sqlite();
 assert.ok(QUALITY_CHECKS.every(c=>QUALITY_GROUPS[c.group]));assert.equal(QUALITY_BY_ID.dupSharedSystem.group,'duplicates');assert.equal(QUALITY_BY_ID.dupSameMeeting.group,'hints');
 insert('clean-1');insert('clean-2',{},{date:'2026-09-18'});
 for(const c of QUALITY_CHECKS){const r=await runQualityCheck(db,c.id);assert.equal(r.count,0,c.id);assert.deepEqual(r.samples,[],c.id);assert.equal(typeof r.ms,'number');}
 const stored=await storedQualityChecks(db);assert.equal(Object.keys(stored.checks).length,QUALITY_CHECKS.length);assert.ok(Object.values(stored.checks).every(r=>r.stale===false));
 assert.deepEqual(qualitySummary(stored.checks),{duplicates:0,duplicateGroups:0,defects:0,orphans:0,hints:0,checked:QUALITY_CHECKS.length,pending:[]});
 await assert.rejects(runQualityCheck(db,'nope'),/Unbekannte Prüfung/);
 // Hint: the same title of one body on one day, only among canonical reports and only for non-generic titles; the surplus is counted.
 insert('dup-a');insert('dup-b');insert('dup-c',{officialTitle:TITLE.replace('Satzungsbeschluss','SATZUNGSBESCHLUSS')});// lower() of SQLite folds ASCII only: umlauts keep their caseinsert('dup-other-day',{},{date:'2026-09-24'});insert('dup-other-body',{events:[{date:'2026-09-17',committee:'Bauausschuss'}]});
 insert('alias',{identity:{version:'official-records-v1',mergedInto:'dup-a'}});
 insert('generic-1',{title:'Einwohnerfragestunde',officialTitle:'Einwohnerfragestunde'});insert('generic-2',{title:'Einwohnerfragestunde',officialTitle:'Einwohnerfragestunde'});
 insert('short-1',{title:'Bebauungsplan Nr. 7',officialTitle:'Bebauungsplan Nr. 7'});insert('short-2',{title:'Bebauungsplan Nr. 7',officialTitle:'Bebauungsplan Nr. 7'});
 let r=await runQualityCheck(db,'dupSameMeeting');assert.equal(r.groups,1);assert.equal(r.count,3);assert.deepEqual(r.samples[0].ids.sort(),['clean-1','dup-a','dup-b','dup-c']);assert.equal(r.samples[0].count,4);assert.equal(r.samples[0].committee,'Rat');
 // Duplicates: the same source address with the same title under two areas (a shared system); the same address within one area is no duplicate.
 insert('shared-a',{sourceUrl:'https://ris.example.org/vo?1'});insert('shared-b',{sourceUrl:'https://ris.example.org/vo?1'},{region:'coesfeld'});insert('shared-c',{sourceUrl:'https://ris.example.org/vo?1'},{region:'coesfeld'});
 insert('own-a',{sourceUrl:'https://ris.example.org/meeting?2',title:'Einwohnerfragestunde',officialTitle:'Einwohnerfragestunde'});insert('own-b',{sourceUrl:'https://ris.example.org/meeting?2',title:'Einwohnerfragestunde',officialTitle:'Einwohnerfragestunde'});
 r=await runQualityCheck(db,'dupSharedSystem');assert.equal(r.groups,1);assert.equal(r.count,2);assert.deepEqual(r.samples[0].regions.sort(),['billerbeck','coesfeld']);assert.deepEqual(r.samples[0].ids.sort(),['shared-a','shared-b','shared-c']);assert.equal(r.samples[0].url,'https://ris.example.org/vo?1');
 // Defects, one report each (the bad column dates also stand in their records, so only one column is stale).
 insert('untitled',{title:'',officialTitle:''});
 insert('truncated',{officialTitle:'Vollzug des Baugesetzbuches (BauGB);'});
 insert('no-events',{events:[]});
 insert('bad-date',{eventDate:'2026-13-40'},{column:'2026-13-40'});insert('old-date',{eventDate:'1888-01-01'},{column:'1888-01-01'});
 insert('stale-column',{},{column:'2026-09-01'});
 insert('doc-without-url',{documents:[{title:'Anlage',url:''}]});
 insert('elsewhere',{},{region:'nowhere-1'});insert('elsewhere-2',{},{region:'nowhere-1'});
 insert('conflict',{identity:{version:'official-records-v1',conflict:true}});
 // Orphans: a merged report whose target is missing, one whose target is merged itself, analyses and versions without a report.
 insert('dangling',{identity:{version:'official-records-v1',mergedInto:'gone'}});
 insert('chain-end',{identity:{version:'official-records-v1',mergedInto:'alias'}});
 raw.prepare("INSERT INTO article_analyses(id,topic_id,kind,method,input_hash,created_at,payload) VALUES('x1','gone','rule-label','m','h','2026-10-01T00:00:00Z','{}')").run();
 raw.prepare("INSERT INTO article_versions(id,topic_id,captured_at,payload) VALUES('v1','gone','2026-10-01T00:00:00Z','{}'),('v2','dup-a','2026-10-01T00:00:00Z','{}')").run();
 const expected={emptyTitle:1,truncatedTitle:1,noEvents:1,badEventDate:2,eventDateMismatch:1,documentsWithoutUrl:1,regionUnknown:2,conflicts:1,mergeTargetMissing:1,mergeChain:1,orphanAnalyses:1,orphanVersions:1};
 for(const [id,count] of Object.entries(expected)){r=await runQualityCheck(db,id);assert.equal(r.count,count,id);assert.ok(r.samples.length>=1,id);}
 assert.equal((await runQualityCheck(db,'regionUnknown')).groups,1);
 assert.equal((await runQualityCheck(db,'emptyTitle')).samples[0].id,'untitled');
 assert.equal((await runQualityCheck(db,'truncatedTitle')).samples[0].id,'truncated');
 assert.equal((await runQualityCheck(db,'orphanAnalyses')).samples[0].topicId,'gone');
 // The stored results name the revision they were made at: a changed stock marks them stale, a repeated check is fresh again.
 insert('late',{},{date:'2026-09-19'});const later=await storedQualityChecks(db);assert.equal(later.checks.emptyTitle.stale,true);
 await runQualityCheck(db,'emptyTitle');assert.equal((await storedQualityChecks(db)).checks.emptyTitle.stale,false);
 // A record that is no JSON cannot be stored at all: the partial indexes of topics read the payload on insert.
 assert.throws(()=>insert('broken',{payload:'{not json'}),/malformed JSON/);
 const sum=qualitySummary((await storedQualityChecks(db)).checks);assert.equal(sum.duplicates,2);assert.equal(sum.duplicateGroups,1);assert.equal(sum.hints,3);assert.equal(sum.defects,10);assert.equal(sum.orphans,4);assert.equal(sum.pending.length,0);
 raw.close();
});
