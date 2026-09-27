import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {DatabaseSync} from 'node:sqlite';
import bundle from '../server/data/billerbeck-content-v1.json' with {type:'json'};
import {importPreparedAnalysis,validatePreparedArticle} from '../server/integrations/prepared-analysis.mjs';
import {mergeHistory,reconcileTopics} from '../shared/topic-identity.mjs';
import {analysisSignature,importedMetadata,validKeywords} from '../shared/article-record.mjs';
import {parseAttendance} from '../server/integrations/sessionnet-details.mjs';
import {validPreparedToken} from '../server/integrations/prepared-access.mjs';
import {compactSummaryAttempt} from '../server/integrations/compact-summary.mjs';
const sqlite=new DatabaseSync(':memory:');for(const f of fs.readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())sqlite.exec(fs.readFileSync(new URL('../drizzle/'+f,import.meta.url),'utf8'));
let breakBatch=false;
const db={prepare(sql){let args=[];return {bind(...v){args=v;return this;},async first(){return sqlite.prepare(sql).get(...args)||null;},async all(){return {results:sqlite.prepare(sql).all(...args)};},async run(){return {meta:{changes:Number(sqlite.prepare(sql).run(...args).changes)}};}};},async batch(qs){sqlite.exec('BEGIN');try{const results=[];for(const q of qs){results.push(await q.run());if(breakBatch)throw Error('database failure');}sqlite.exec('COMMIT');return results;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
const original=a=>{const input=JSON.parse(a.expectedSignature);return {id:a.articleId,regionId:'billerbeck',officialTitle:a.officialTitle,title:a.officialTitle,status:input.status,eventDate:a.events.at(-1).date,updatedAt:'2026-09-26T22:20:42.070Z',events:a.events.map((e,i)=>({url:e.url,description:'Metadaten',...input.events[i]})),documents:input.documents.map(url=>({url})),sourceUrl:a.contentAnalysis.sourceDocuments[0].url,sourceText:a.officialTitle,shortSummary:'Automatischer Überblick',longSummary:['Automatischer Überblick'],generatedBy:'Automatischer Quellenüberblick'};};
const put=t=>sqlite.prepare('INSERT INTO topics(id,region_id,source,event_date,updated_at,status,payload) VALUES(?,?,?,?,?,?,?)').run(t.id,t.regionId,'city',t.eventDate,t.updatedAt,t.status,JSON.stringify(t));
const get=id=>JSON.parse(sqlite.prepare('SELECT payload FROM topics WHERE id=?').get(id).payload);
const reset=()=>{breakBatch=false;for(const t of ['topics','article_versions','article_analyses','system_state','import_runs'])sqlite.exec('DELETE FROM '+t);};
test('all 402 prepared records are bounded, source-attributed, distinct and retain integer keyword totals',()=>{
 assert.equal(bundle.articles.length,402);assert.equal(new Set(bundle.articles.map(a=>a.articleId)).size,402);
 assert.equal(bundle.articles.filter(a=>a.contentAnalysis.status==='completed').length,310);
 assert.equal(bundle.articles.filter(a=>a.contentAnalysis.status==='insufficient_source').length,92);
 for(const a of bundle.articles){assert.equal(validatePreparedArticle(a),true);assert.equal(analysisSignature(original(a)),a.expectedSignature);assert.ok(validKeywords(a.weightedKeywords));assert.equal(a.contentAnalysis.reviewStatus,'not_independently_reviewed');for(const k of ['raw','sourceText','documentText'])assert.ok(!JSON.stringify(a).includes('"'+k+'":'));}
 assert.throws(()=>validatePreparedArticle({...bundle.articles[0],weightedKeywords:{items:[{term:'a',weight:99}]}}));
 assert.throws(()=>validatePreparedArticle({...bundle.articles[0],contentAnalysis:{...bundle.articles[0].contentAnalysis,evidence:[{url:'https://untrusted.example',quote:'wrong'}]}}));
});
test('explicit import saves summaries and separate results, skips replays, bounds continuation and refuses changed source records',async()=>{
 reset();const articles=bundle.articles.slice(0,4),part={...bundle,articles};for(const a of articles)put(original(a));
 const before=get(articles[0].articleId);const first=await importPreparedAnalysis(db,part,{limit:2});assert.equal(first.data.processed,2);assert.equal(first.data.remaining,2);
 assert.equal(get(before.id).shortSummary,articles[0].shortSummary);assert.equal(get(before.id).sourceText,before.sourceText);assert.equal(get(before.id).metadata.firstImportedAt,null);
 assert.ok(get(before.id).labelAssessments.ai);assert.ok(get(before.id).labelAssessments.rule);assert.equal(sqlite.prepare('SELECT count(*) n FROM article_analyses').get().n,8);
 const changed=get(articles[3].articleId);changed.officialTitle+=' geändert';sqlite.prepare('UPDATE topics SET payload=? WHERE id=?').run(JSON.stringify(changed),changed.id);
 const second=await importPreparedAnalysis(db,part);assert.equal(second.data.processed,1);assert.equal(second.data.skipped,2);assert.equal(second.data.conflicts,1);
 assert.equal(get(changed.id).shortSummary,'Automatischer Überblick');const versions=sqlite.prepare('SELECT count(*) n FROM article_versions').get().n;
 assert.equal((await importPreparedAnalysis(db,part)).data.processed,0);assert.equal(sqlite.prepare('SELECT count(*) n FROM article_versions').get().n,versions);
 assert.equal(sqlite.prepare("SELECT count(*) n FROM system_state WHERE key='import-lock'").get().n,0);
});
test('a failed atomic article batch keeps its old content and never leaves partial analysis history',async()=>{
 reset();const a=bundle.articles[0];put(original(a));breakBatch=true;
 await assert.rejects(importPreparedAnalysis(db,{...bundle,articles:[a]}));assert.equal(get(a.articleId).shortSummary,'Automatischer Überblick');assert.equal(sqlite.prepare('SELECT count(*) n FROM article_analyses').get().n,0);assert.equal(sqlite.prepare('SELECT count(*) n FROM article_versions').get().n,0);assert.equal(sqlite.prepare('SELECT status FROM import_runs').get().status,'failed');
});
test('metadata refresh preserves evidence-backed results; changed subject becomes stale without rerunning AI',()=>{
 const a=bundle.articles.find(a=>a.events.some(e=>e.decision)),raw=original(a);const saved={...raw,status:a.status,events:a.events,shortSummary:a.shortSummary,longSummary:a.longSummary,generatedBy:'KI-Zusammenfassung · Billerbeck-Test',summaryGeneratedAt:a.contentAnalysis.generatedAt,contentAnalysis:a.contentAnalysis,weightedKeywords:a.weightedKeywords,labelAssessments:{ai:a.aiLabel}};
 const same=mergeHistory(saved,{...raw,updatedAt:'2026-09-28T00:00:00Z'});assert.equal(same.shortSummary,a.shortSummary);assert.equal(same.status,a.status);assert.equal(same.contentAnalysis.status,a.contentAnalysis.status);assert.ok(same.events.some(e=>e.decision));
 const reconciled=reconcileTopics([saved],[{...raw,updatedAt:'2026-09-28T00:00:00Z'}])[0];assert.equal(reconciled.shortSummary,a.shortSummary);assert.equal(reconciled.contentAnalysis.status,a.contentAnalysis.status);assert.ok(reconciled.events.some(e=>e.decision));
 const changed=mergeHistory(saved,{...raw,officialTitle:'Neues Thema',updatedAt:'2026-09-28T00:00:00Z'});assert.equal(changed.contentAnalysis.status,'stale');assert.equal(changed.weightedKeywords.status,'stale');assert.equal(changed.labelAssessments.ai.status,'stale');assert.equal(changed.shortSummary,a.shortSummary);
 const legacy={...raw,generatedBy:'KI-Zusammenfassung',shortSummary:'KI-Text',longSummary:['KI lang'],hasDocumentText:true,sourceText:'alter Originalauszug',documentText:'alter Text'};
 const merged=mergeHistory(legacy,{...raw,updatedAt:'2026-09-28T00:00:00Z'});assert.equal(merged.shortSummary,'KI-Text');assert.equal(merged.sourceText,'alter Originalauszug');assert.equal(merged.hasDocumentText,true);
});
test('timestamps distinguish import, fetch, official change and internal processing',()=>{
 const first=importedMetadata({metadata:{sourceModifiedAt:'2026-08-01'}},null,'2026-09-01');assert.equal(first.firstImportedAt,'2026-09-01');assert.equal(first.lastProcessedAt,null);
 const next=importedMetadata({}, {metadata:{...first,lastProcessedAt:'2026-09-02'}},'2026-09-03');assert.equal(next.firstImportedAt,'2026-09-01');assert.equal(next.sourceModifiedAt,'2026-08-01');assert.equal(next.lastProcessedAt,'2026-09-02');assert.equal(next.lastFetchedAt,'2026-09-03');
});
test('attendance handles three and four columns, preserves explicit absence and is session-scoped',()=>{
 const html='<table id="smc_page_to0045_contenttable1"><tr class="smc-table-group"><td>Vorsitzender</td></tr><tr><td>Max &amp; Beispiel</td><td>Partei</td><td>Mitglied</td></tr><tr class="smc-table-group"><td>Entschuldigt fehlen</td></tr><tr><td>Erika</td><td>Partei</td><td>Mitglied</td><td>Vertretung</td></tr></table>';
 const a=parseAttendance(html,'https://ratsinfo.billerbeck.de/bi/to0045.asp?__ksinr=1','2026-09-27');assert.equal(a.people.length,2);assert.equal(a.people[0].presence,'present');assert.equal(a.people[1].presence,'absent');assert.ok(!JSON.stringify(a).includes('Partei'));assert.equal(parseAttendance('Keine Tabelle','x','y').status,'unavailable');
});
test('new PDF analysis persists compact results and evidence, not extracted full text, on success or failure',async()=>{
 const old=original(bundle.articles[0]),full='Temporärer Dokumentinhalt '.repeat(1000),at='2026-09-27T20:00:00Z';
 const failure=await compactSummaryAttempt(old,{...old,sourceText:full,documentSource:'https://example.org/document.pdf',longSummary:[full],documentIssue:'Keine brauchbare Grundlage'},at);assert.equal(failure.topic.sourceText,old.sourceText);assert.deepEqual(failure.topic.longSummary,old.longSummary);assert.equal(failure.analysis.status,'insufficient_source');assert.ok(!JSON.stringify(failure).includes(full));
 const success=await compactSummaryAttempt(old,{...old,sourceText:full,documentSource:'https://example.org/document.pdf',generatedBy:'KI-Zusammenfassung',summaryGeneratedAt:at,shortSummary:'Kurz',longSummary:['Inhalt'],summaryEvidence:['Temporärer Dokumentinhalt'],quality:{checks:[]}},at);assert.equal(success.analysis.status,'completed');assert.equal(success.topic.shortSummary,'Kurz');assert.equal(success.topic.sourceText,old.sourceText);assert.equal(success.analysis.evidence.length,1);
});
test('prepared-result service credential fails closed and accepts only the configured strong bearer',async()=>{
 const secret='fixture-only-'+'a'.repeat(40);for(const [header,key] of [[null,secret],['Bearer '+secret,undefined],['Bearer nope',secret],['Basic '+secret,secret]])assert.equal(await validPreparedToken(header,key),false);assert.equal(await validPreparedToken('Bearer '+secret,secret),true);
});
