import {compactSummaryAttempt} from '../integrations/compact-summary.mjs';
import {invalidateReads} from './read-cache.mjs';
import {importHealth} from '../integrations/import-health.mjs';
import {mergeImport} from '../integrations/merge-import.mjs';
import {historyWindow} from '@/shared/history-window.mjs';
import {acquireImport} from '../integrations/import-lock.mjs';
import {readMarks,writeMarks,marksKey,readList,listKey} from '../integrations/meeting-marks.mjs';
import {createTrace,saveDebug} from '../integrations/import-trace.mjs';
import 'server-only';
import {preserveAnalysis} from '@/shared/analysis-state.mjs';
import {metadataChanged,stableJson} from '@/shared/article-record.mjs';
import {batches} from '../integrations/batches.mjs';
import { env } from 'cloudflare:workers';
import { ensureData } from '@/server/repositories/seed';
import { qualityCheck } from '@/server/integrations/oparl.mjs';
import { collectRegion } from '@/server/integrations/collect-region.mjs';
import { enrichDocument } from '@/server/integrations/documents.mjs';
import { summarize } from '@/server/integrations/ai-summary.mjs';
import { insertUsage } from '@/shared/ai-usage.mjs';
import { dispatchDecisionPush } from '@/server/services/push';
import type { StoredTopic as Topic, ImportData as FeedData } from '@/server/types';
const FAILURE_CAUSE = 'Fehlerursache: ';
/** options.window selects the look-back period for metadata imports ('1w' | '1m' | '3m' | '12m' | '24m'; default twelve months). */
export async function runSync(mode: 'metadata' | 'summaries',region='muenster', trigger: 'manual' | 'scheduled' = 'manual', options: {window?: string} = {}) { if(mode==='summaries'&&trigger!=='manual')return {status:403,data:{error:'Textverarbeitung startet ausschließlich manuell im Adminbereich.'}};
    let lookback: string; try { lookback = historyWindow(options.window); } catch { return { status: 400, data: { error: 'Ungültiger Zeitraum für den Abruf.' } }; }
    if (!env.DB)
    return { status: 503, data: { error: 'Datenbank fehlt' } }; await ensureData();
    const coverageRow = await env.DB.prepare('SELECT payload FROM source_coverage WHERE region_id=?').bind(region).first<{payload:string}>();
    const previousCoverage = coverageRow ? JSON.parse(coverageRow.payload) : {};
    if(mode==='metadata' && trigger==='scheduled' && Date.parse(previousCoverage.nextRetryAt || '')>Date.now())
        return {status:200,data:{skipped:true,reason:'cooldown',nextRetryAt:previousCoverage.nextRetryAt,coverage:previousCoverage}};
    const id = crypto.randomUUID(), started = new Date().toISOString();
    // Imports of different areas run side by side; reading documents for summaries changes the stock and runs alone.
    const lock = await acquireImport(env.DB, region, { shared: mode === 'metadata' }); if (!lock.ok)
    return { status: 409, data: { error: 'Import läuft bereits', retryAfter: 60 } };
    // Every import of official data is recorded for the debug view (import-trace.mjs).
    const trace = mode === 'metadata' ? createTrace(region, { window: lookback }) : null;
    try {
    await env.DB.prepare('INSERT INTO import_runs(id,started_at,status,details) VALUES(?,?,?,?)').bind(id, started, 'running', JSON.stringify(mode==='metadata'?{mode,region,trigger,window:lookback}:{mode,region,trigger})).run();
    return { status: 200, data: await (mode === 'summaries' ? refreshSummaries(id, started,region) : refreshMetadata(id, started,region,previousCoverage,lookback,trace)) };
}
catch (e) {
    // The cause is stored with the source status; otherwise only older notes of the stock would be visible.
    const cause = (e instanceof Error ? e.message : 'Importfehler').slice(0, 300);
    const record = trace ? trace.finish({ runId: id, status: 'failed', error: cause }) : null;
    await env.DB.prepare('UPDATE import_runs SET finished_at=?,status=?,details=json_patch(details,?) WHERE id=?').bind(new Date().toISOString(), 'failed', JSON.stringify({ mode,region,trigger,error: cause, ...(record ? { debug: brief(record) } : {}) }), id).run();
    // The record must never hide the failure it describes.
    if (record) try { await saveDebug(env.DB, record); } catch {}
    if(mode==='metadata'){
        const coverage={...previousCoverage,regionId:region,...importHealth(previousCoverage,{at:started,failed:true}),complete:false,issues:[...new Set([...(previousCoverage.issues||[]).filter((i:string)=>!String(i).startsWith(FAILURE_CAUSE)),'Abruf fehlgeschlagen; letzter übernommener Bestand bleibt erhalten.',FAILURE_CAUSE+cause])]};
        await env.DB.prepare('INSERT INTO source_coverage(region_id,payload) VALUES(?,?) ON CONFLICT(region_id) DO UPDATE SET payload=excluded.payload').bind(region,JSON.stringify(coverage)).run();
    }
    return { status: 502, data: { error: 'Import fehlgeschlagen; der angezeigte Bestand kann teilweise aktualisiert sein', cause } };
}
finally {
    invalidateReads();
    await lock.release();
} }
// What of a record goes into the details of the run.
const brief = (record: any) => ({ requests: record.summary.requests, failed: record.summary.failed, networkMs: record.summary.networkMs, durationMs: record.durationMs });
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
    const u=(t as any).aiUsage;
    const compact=await compactSummaryAttempt(old,t,started);
    await env.DB.batch([
      env.DB.prepare('INSERT INTO article_versions(id,topic_id,captured_at,payload) VALUES(?,?,?,?)').bind(crypto.randomUUID(),old.id,started,JSON.stringify(old)),
      env.DB.prepare('INSERT INTO article_analyses(id,topic_id,kind,method,input_hash,created_at,payload) VALUES(?,?,?,?,?,?,?)').bind(compact.analysis.id,old.id,'summary',compact.analysis.method,compact.analysis.inputHash,started,JSON.stringify(compact.analysis)),
      env.DB.prepare('UPDATE topics SET payload=? WHERE id=?').bind(JSON.stringify(compact.topic),old.id),
      ...(u?[insertUsage(env.DB,{...u,topicId:old.id,regionId:region})]:[])
    ]);
    processed++;
    if (processed >= 8)
        break;
} await env.DB.prepare('UPDATE import_runs SET finished_at=?,status=?,details=json_patch(details,?) WHERE id=?').bind(new Date().toISOString(), 'completed', JSON.stringify({ mode: "summaries", region, processed, aiConfigured: !!env.OPENAI_API_KEY }), id).run(); return { processed, more: processed === 8, aiConfigured: !!env.OPENAI_API_KEY }; }
async function refreshMetadata(id: string, started: string,region:string,previousCoverage:any,lookback:string,trace:any) {
    if (!env.DB)
        throw Error('Datenbank fehlt');
    const previous = await env.DB.prepare('SELECT id,payload FROM topics WHERE region_id=?').bind(region).all<{
        id: string;
        payload: string;
    }>();
    const old = new Map(previous.results.map(r => [r.id, JSON.parse(r.payload) as Topic]));
    // Meetings whose agenda is unchanged since their papers were last read are not read again (meeting-marks.mjs).
    // A mark only counts while the reports of its meeting are still stored.
    const stock = new Set<string>();
    for (const t of old.values()) for (const e of (t.events || []) as {url?: string}[]) if (e.url) stock.add(e.url);
    const marksRow = await env.DB.prepare('SELECT value FROM system_state WHERE key=?').bind(marksKey(region)).first<{value: string}>();
    const known = readMarks(marksRow?.value);
    // The meeting list a step read a short while ago; the step that continues the import does not ask for it again.
    const listRow = await env.DB.prepare('SELECT value FROM system_state WHERE key=?').bind(listKey(region)).first<{value: string}>();
    const keptList = readList(listRow?.value);
    const collectStarted = Date.now();
    const fresh = await collectRegion(region,{maxDurationMs:120000,window:lookback,marks:{known,stock,list:keptList},trace}) as FeedData;
    const collectMs = Date.now() - collectStarted, written = { created: 0, changed: 0, unchanged: 0 };
    const unchanged = Number(fresh.coverage.unchangedMeetings || 0), warnings = fresh.coverage.warnings || [];
    const decisions: Topic[] = [];
    const groups=new Map<string,any[]>(),touch:any[]=[];
    const combined=mergeImport({topics:[...old.values()],coverage:previousCoverage},fresh);
    for(const incoming of fresh.topics.length?combined.topics:[]){
        const p=old.get(incoming.id);let t:Topic=preserveAnalysis(incoming,p);
        // Abrufzeitpunkte (attendance.fetchedAt …) zählen nicht als Änderung, siehe stableJson.
        const unchanged=p&&stableJson(p.sourceData?.records)===stableJson(t.sourceData?.records)&&p.status===t.status&&p.officialTitle===t.officialTitle&&p.sourceUrl===t.sourceUrl&&stableJson(p.events)===stableJson(t.events)&&stableJson(p.documents)===stableJson(t.documents)&&stableJson(p.identity)===stableJson(t.identity)&&stableJson(p.identityLinks)===stableJson(t.identityLinks)&&stableJson(p.identityRecords)===stableJson(t.identityRecords);
        if(unchanged)t={...p,regionId:region,metadata:t.metadata};
        if(old.size>0&&!t.identity?.mergedInto&&!unchanged&&['approved','rejected'].includes(t.status)&&p?.status!==t.status)decisions.push(t);
        if(unchanged)written.unchanged++;else if(p)written.changed++;else written.created++;
        // Unveränderte Vorgänge nur schreiben, wenn sich an den Metadaten mehr als der Abrufzeitpunkt geändert hat.
        // Der Abrufzeitpunkt steht für das ganze Gebiet in source_coverage; so bleiben Revision und Suchkarten ruhig.
        if(unchanged){if(t.metadata&&metadataChanged(p?.metadata,t.metadata))touch.push(env.DB.prepare("UPDATE topics SET payload=json_set(payload,'$.metadata',json(?)) WHERE id=?").bind(JSON.stringify(t.metadata),t.id));continue;}
        const statements=[];
        if(p)statements.push(env.DB.prepare('INSERT INTO article_versions(id,topic_id,captured_at,payload) VALUES(?,?,?,?)').bind(crypto.randomUUID(),p.id,started,JSON.stringify(p)));
        statements.push(env.DB.prepare('INSERT INTO topics(id,region_id,source,event_date,updated_at,status,payload) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET event_date=excluded.event_date,updated_at=excluded.updated_at,status=excluded.status,payload=excluded.payload').bind(t.id,region,t.source,t.eventDate,t.updatedAt,t.status,JSON.stringify(t)));
        const group=t.identity?.mergedInto||t.id;groups.set(group,[...(groups.get(group)||[]),...statements]);
    }
    // Gebündelt schreiben: Identitätsgruppen bleiben zusammen in einem Batch (atomar), mehrere Gruppen teilen sich einen.
    for(const batch of batches([...groups.values(),...touch.map(s=>[s])]))await env.DB.batch(batch);
    // A short window without meetings is a successful attempt; the stored stock and its status stay as they are.
    const quiet=Boolean(combined.quiet);
    const health=importHealth(previousCoverage,{at:started,count:fresh.topics.length+unchanged,complete:fresh.coverage.complete,quiet});
    const coverage={...combined.coverage,regionId:region,...health,importedAt:health.lastSuccessAt};
    // Missing items remain in the archive. A partial scan never deletes an article.
    await env.DB.prepare('INSERT INTO source_coverage(region_id,payload) VALUES(?,?) ON CONFLICT(region_id) DO UPDATE SET payload=excluded.payload').bind(region,JSON.stringify(coverage)).run();
    // Only now, with the reports stored, do the marks of this import count.
    if (fresh.marks) await env.DB.prepare('INSERT INTO system_state(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(marksKey(region), writeMarks({...known,...fresh.marks}, new Date())).run();
    if (fresh.list) await env.DB.prepare('INSERT INTO system_state(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(listKey(region), JSON.stringify(fresh.list)).run();
    if (decisions.length && region==='muenster') {
        const t = decisions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
        await env.DB.prepare("INSERT INTO system_state(key,value) VALUES('latest-decision',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(JSON.stringify({ id: t.id, title: t.title, shortSummary: t.shortSummary, detectedAt: started, count: decisions.length })).run();
        await dispatchDecisionPush();
    }
    const status = fresh.coverage.complete || quiet ? 'completed' : 'partial';
    const record = trace.finish({ runId: id, status, adapter: fresh.coverage.method || null, meetings: fresh.coverage.meetings, unchangedMeetings: unchanged, readMeetings: fresh.readMeetings ?? null, reports: fresh.topics.length, stockBefore: old.size, written, marksKnown: Object.keys(known).length, collectMs, storeMs: Date.now() - collectStarted - collectMs, issues: fresh.coverage.issues, warnings });
    await env.DB.prepare('UPDATE import_runs SET finished_at=?,status=?,details=json_patch(details,?) WHERE id=?').bind(new Date().toISOString(), status, JSON.stringify({ mode:'metadata',region, window: lookback, quiet, count: fresh.topics.length, unchangedMeetings: unchanged, decisions: decisions.length, issues: fresh.coverage.issues, warnings, debug: brief(record) }), id).run();
    // A record that cannot be stored does not undo a stored import.
    try { await saveDebug(env.DB, record); } catch {}
    // A step that only got further in the meeting list has made progress too: the next one continues behind it.
    const listAdvanced = Boolean(fresh.list) && (fresh.list as {readAt?: number}).readAt !== keptList?.readAt;
    // attemptComplete describes this attempt; coverage.complete describes the stored period.
    // resume: the time limit ended this attempt after it had read further meetings; the next attempt continues behind them.
    return { topics: fresh.topics.length, decisions: decisions.length, coverage, window: lookback, quiet, attemptComplete: Boolean(fresh.coverage.complete) || quiet, unchanged, warnings, resume: Boolean(fresh.coverage.resumable) && (Number(fresh.readMeetings || 0) > 0 || listAdvanced) };
}
