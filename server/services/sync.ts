import {compactSummaryAttempt} from '../integrations/compact-summary.mjs';
import {invalidateReads} from './read-cache.mjs';
import {importHealth} from '../integrations/import-health.mjs';
import {mergeImport} from '../integrations/merge-import.mjs';
import 'server-only';
import {preserveAnalysis} from '@/shared/analysis-state.mjs';
import { env } from 'cloudflare:workers';
import { ensureData } from '@/server/repositories/seed';
import { qualityCheck } from '@/server/integrations/oparl.mjs';
import { collectRegion } from '@/server/integrations/collect-region.mjs';
import { enrichDocument } from '@/server/integrations/documents.mjs';
import { summarize } from '@/server/integrations/ai-summary.mjs';
import { dispatchDecisionPush } from '@/server/services/push';
import type { StoredTopic as Topic, ImportData as FeedData } from '@/server/types';
export async function runSync(mode: 'metadata' | 'summaries',region='muenster', trigger: 'manual' | 'scheduled' = 'manual') { if(mode==='summaries'&&trigger!=='manual')return {status:403,data:{error:'Textverarbeitung startet ausschließlich manuell im Adminbereich.'}}; if (!env.DB)
    return { status: 503, data: { error: 'Datenbank fehlt' } }; await ensureData();
    const coverageRow = await env.DB.prepare('SELECT payload FROM source_coverage WHERE region_id=?').bind(region).first<{payload:string}>();
    const previousCoverage = coverageRow ? JSON.parse(coverageRow.payload) : {};
    if(mode==='metadata' && trigger==='scheduled' && Date.parse(previousCoverage.nextRetryAt || '')>Date.now())
        return {status:200,data:{skipped:true,reason:'cooldown',nextRetryAt:previousCoverage.nextRetryAt,coverage:previousCoverage}};
    const id = crypto.randomUUID(), started = new Date().toISOString(); const lock = await env.DB.prepare("INSERT INTO system_state(key,value) VALUES('import-lock',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value WHERE CAST(system_state.value AS INTEGER) < ? RETURNING value").bind(String(Date.now() + 600000), Date.now()).first<{
    value: string;
}>(); if (!lock)
    return { status: 409, data: { error: 'Import läuft bereits', retryAfter: 60 } }; try {
    await env.DB.prepare('INSERT INTO import_runs(id,started_at,status,details) VALUES(?,?,?,?)').bind(id, started, 'running', JSON.stringify({mode,region,trigger})).run();
    return { status: 200, data: await (mode === 'summaries' ? refreshSummaries(id, started,region) : refreshMetadata(id, started,region,previousCoverage)) };
}
catch (e) {
    await env.DB.prepare('UPDATE import_runs SET finished_at=?,status=?,details=json_patch(details,?) WHERE id=?').bind(new Date().toISOString(), 'failed', JSON.stringify({ mode,region,trigger,error: e instanceof Error ? e.message : 'Importfehler' }), id).run();
    if(mode==='metadata'){
        const coverage={...previousCoverage,regionId:region,...importHealth(previousCoverage,{at:started,failed:true}),complete:false,issues:[...new Set([...(previousCoverage.issues||[]),'Abruf fehlgeschlagen; letzter übernommener Bestand bleibt erhalten.'])]};
        await env.DB.prepare('INSERT INTO source_coverage(region_id,payload) VALUES(?,?) ON CONFLICT(region_id) DO UPDATE SET payload=excluded.payload').bind(region,JSON.stringify(coverage)).run();
    }
    return { status: 502, data: { error: 'Import fehlgeschlagen; der angezeigte Bestand kann teilweise aktualisiert sein' } };
}
finally {
    invalidateReads();
    await env.DB.prepare("DELETE FROM system_state WHERE key='import-lock' AND value=?").bind(lock.value).run();
} }
async function refreshSummaries(id: string, started: string,region:string) { if (!env.DB)
    throw Error('Datenbank fehlt'); const rows = await env.DB.prepare("SELECT id,payload FROM topics WHERE region_id=? AND json_extract(payload,'$.identity.mergedInto') IS NULL ORDER BY updated_at DESC").bind(region).all<{
    id: string;
    payload: string;
}>(); let processed = 0; for (const row of rows.results) {
    const old = JSON.parse(row.payload);
    if (!old.documents.some((d: {
        kind: string;
    }) => d.kind === 'application/pdf') || old.summaryAttemptedAt || old.generatedBy.startsWith('KI-Zusammenfassung'))
        continue;
    if (!env.OPENAI_API_KEY && (old.documentText || old.hasDocumentText))
        continue;
    let t = {...old};
    try {
        if (!(t.documentText || t.hasDocumentText))
            t = await enrichDocument(t);
        t = await summarize(t, { apiKey: env.OPENAI_API_KEY, model: env.OPENAI_MODEL });
    }
    catch {
        t.documentIssue = 'Dokument konnte noch nicht gelesen werden.';
    }
    if (env.OPENAI_API_KEY)
        t.summaryAttemptedAt = started;
    if (region==='muenster' && t.generatedBy !== 'KI-Zusammenfassung')
        t.quality = await qualityCheck(t);
    const compact=await compactSummaryAttempt(old,t,started);
    await env.DB.batch([
      env.DB.prepare('INSERT INTO article_versions(id,topic_id,captured_at,payload) VALUES(?,?,?,?)').bind(crypto.randomUUID(),old.id,started,JSON.stringify(old)),
      env.DB.prepare('INSERT INTO article_analyses(id,topic_id,kind,method,input_hash,created_at,payload) VALUES(?,?,?,?,?,?,?)').bind(compact.analysis.id,old.id,'summary',compact.analysis.method,compact.analysis.inputHash,started,JSON.stringify(compact.analysis)),
      env.DB.prepare('UPDATE topics SET payload=? WHERE id=?').bind(JSON.stringify(compact.topic),old.id)
    ]);
    processed++;
    if (processed >= 8)
        break;
} await env.DB.prepare('UPDATE import_runs SET finished_at=?,status=?,details=json_patch(details,?) WHERE id=?').bind(new Date().toISOString(), 'completed', JSON.stringify({ mode: "summaries", region, processed, aiConfigured: !!env.OPENAI_API_KEY }), id).run(); return { processed, more: processed === 8, aiConfigured: !!env.OPENAI_API_KEY }; }
async function refreshMetadata(id: string, started: string,region:string,previousCoverage:any) {
    if (!env.DB)
        throw Error('Datenbank fehlt');
    const fresh = await collectRegion(region,{maxDurationMs:120000}) as FeedData;
    const previous = await env.DB.prepare('SELECT id,payload FROM topics WHERE region_id=?').bind(region).all<{
        id: string;
        payload: string;
    }>();
    const old = new Map(previous.results.map(r => [r.id, JSON.parse(r.payload) as Topic]));
    const decisions: Topic[] = [];
    const groups=new Map<string,any[]>();
    const combined=mergeImport({topics:[...old.values()],coverage:previousCoverage},fresh);
    for(const incoming of fresh.topics.length?combined.topics:[]){
        const p=old.get(incoming.id);let t:Topic=preserveAnalysis(incoming,p);
        const unchanged=p&&JSON.stringify(p.sourceData?.records)===JSON.stringify(t.sourceData?.records)&&p.status===t.status&&p.officialTitle===t.officialTitle&&p.sourceUrl===t.sourceUrl&&JSON.stringify(p.events)===JSON.stringify(t.events)&&JSON.stringify(p.documents)===JSON.stringify(t.documents)&&JSON.stringify(p.identity)===JSON.stringify(t.identity)&&JSON.stringify(p.identityLinks)===JSON.stringify(t.identityLinks)&&JSON.stringify(p.identityRecords)===JSON.stringify(t.identityRecords);
        if(unchanged)t={...p,regionId:region,metadata:t.metadata};
        if(old.size>0&&!t.identity?.mergedInto&&!unchanged&&['approved','rejected'].includes(t.status)&&p?.status!==t.status)decisions.push(t);
        if(unchanged){if(t.metadata)await env.DB.prepare("UPDATE topics SET payload=json_set(payload,'$.metadata',json(?)) WHERE id=?").bind(JSON.stringify(t.metadata),t.id).run();continue;}
        const statements=[];
        if(p)statements.push(env.DB.prepare('INSERT INTO article_versions(id,topic_id,captured_at,payload) VALUES(?,?,?,?)').bind(crypto.randomUUID(),p.id,started,JSON.stringify(p)));
        statements.push(env.DB.prepare('INSERT INTO topics(id,region_id,source,event_date,updated_at,status,payload) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET event_date=excluded.event_date,updated_at=excluded.updated_at,status=excluded.status,payload=excluded.payload').bind(t.id,region,t.source,t.eventDate,t.updatedAt,t.status,JSON.stringify(t)));
        const group=t.identity?.mergedInto||t.id;groups.set(group,[...(groups.get(group)||[]),...statements]);
    }
    for(const statements of groups.values())await env.DB.batch(statements);
    const health=importHealth(previousCoverage,{at:started,count:fresh.topics.length,complete:fresh.coverage.complete});
    const coverage={...combined.coverage,regionId:region,...health,importedAt:health.lastSuccessAt};
    // Missing items remain in the archive. A partial scan never deletes an article.
    await env.DB.prepare('INSERT INTO source_coverage(region_id,payload) VALUES(?,?) ON CONFLICT(region_id) DO UPDATE SET payload=excluded.payload').bind(region,JSON.stringify(coverage)).run();
    if (decisions.length && region==='muenster') {
        const t = decisions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
        await env.DB.prepare("INSERT INTO system_state(key,value) VALUES('latest-decision',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(JSON.stringify({ id: t.id, title: t.title, shortSummary: t.shortSummary, detectedAt: started, count: decisions.length })).run();
        await dispatchDecisionPush();
    }
    await env.DB.prepare('UPDATE import_runs SET finished_at=?,status=?,details=json_patch(details,?) WHERE id=?').bind(new Date().toISOString(), fresh.coverage.complete ? 'completed' : 'partial', JSON.stringify({ mode:'metadata',region, count: fresh.topics.length, decisions: decisions.length, issues: fresh.coverage.issues }), id).run();
    return { topics: fresh.topics.length, decisions: decisions.length, coverage };
}
