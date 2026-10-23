import {versionPayload} from '@/shared/article-version.mjs';
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
import {refreshSearchWords} from '../integrations/search-words.mjs';
import {rollCardDates} from '../integrations/search-card-dates.mjs';
import {refreshRegionFacts} from '../integrations/region-facts.mjs';
import {notifyEvent,NOTIFY_INSERT_SQL,NOTIFY_PRUNE_SQL,NOTIFY_KEEP_MS} from '../integrations/notify-events.mjs';
import {REGIONS} from '@/shared/regions';
import { env } from 'cloudflare:workers';
import { ensureData } from '@/server/repositories/seed';
import { collectRegion } from '@/server/integrations/collect-region.mjs';
import type { StoredTopic as Topic, ImportData as FeedData } from '@/server/types';
const FAILURE_CAUSE = 'Fehlerursache: ';
/** Import runs (import_runs) are kept this long; the record of each area's last import stays in import-debug. */
export const RUNS_KEEP_DAYS = 30;
const FINISH_RUN_SQL = 'UPDATE import_runs SET finished_at=?,status=?,details=json_patch(details,?) WHERE id=?';
const SAVE_COVERAGE_SQL = 'INSERT INTO source_coverage(region_id,payload) VALUES(?,?) ON CONFLICT(region_id) DO UPDATE SET payload=excluded.payload';
const SAVE_STATE_SQL = 'INSERT INTO system_state(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value';
/** Nebenarbeit, an der der Import nicht hängt: Ein Fehler kommt ins Server-Log, der Import läuft weiter. */
async function bestEffort(what: string, work: () => Promise<unknown>) {
    try { await work(); } catch (error) { console.warn(`[import] ${what} übersprungen:`, error instanceof Error ? error.message : String(error)); }
}
/** options.window selects the look-back period for metadata imports ('1d' | '1w' | '1m' | '3m' | '12m' | '24m'; default twelve months). */
export async function runSync(mode: 'metadata',region='muenster', trigger: 'manual' | 'scheduled' = 'manual', options: {window?: string} = {}) {
    let lookback: string; try { lookback = historyWindow(options.window); } catch { return { status: 400, data: { error: 'Ungültiger Zeitraum für den Abruf.' } }; }
    if (!env.DB) return { status: 503, data: { error: 'Datenbank fehlt' } };
    await ensureData();
    const coverageRow = await env.DB.prepare('SELECT payload FROM source_coverage WHERE region_id=?').bind(region).first<{payload:string}>();
    const previousCoverage = coverageRow ? JSON.parse(coverageRow.payload) : {};
    if(trigger==='scheduled' && Date.parse(previousCoverage.nextRetryAt || '')>Date.now())
        return {status:200,data:{skipped:true,reason:'cooldown',nextRetryAt:previousCoverage.nextRetryAt,coverage:previousCoverage}};
    const id = crypto.randomUUID(), started = new Date().toISOString();
    // Imports of different areas run side by side.
    const lock = await acquireImport(env.DB, region, { shared: true });
    // busy: 'area' (this area is being imported elsewhere) or 'stock' (something else holds the whole stock); the job
    // sets the area back for a while or waits as a whole (pipeline-jobs.mjs).
    if (!lock.ok) return { status: 409, data: { error: 'Import läuft bereits', retryAfter: 60, busy: (lock as { reason?: string }).reason } };
    // Every import of official data is recorded for the debug view (import-trace.mjs).
    const trace = createTrace(region, { window: lookback });
    // Cached analysis results go when the reports may have changed: always, except after an import that wrote nothing.
    let wrote = true;
    try {
    await env.DB.prepare('INSERT INTO import_runs(id,started_at,status,details) VALUES(?,?,?,?)').bind(id, started, 'running', JSON.stringify({mode,region,trigger,window:lookback})).run();
    // Runs older than RUNS_KEEP_DAYS go, a few hundred per import, oldest first (index on started_at); the table stays bounded.
    const db = env.DB;
    await bestEffort('Aufräumen alter Läufe', () => db.prepare('DELETE FROM import_runs WHERE id IN (SELECT id FROM import_runs WHERE started_at<? ORDER BY started_at LIMIT 200)').bind(new Date(Date.now() - RUNS_KEEP_DAYS * 864e5).toISOString()).run());
    const data = await refreshMetadata(id, started,region,previousCoverage,lookback,trace,lock.renew);
    wrote = Boolean(data.stored);
    /* Wortliste der Suche nachführen, wenn dieser Import Vorgänge geschrieben hat (nur Neues; fehlt sie noch oder
       schlägt es fehl, sucht die Suche wie gewohnt). Änderungen ohne Import holt der nächste Import mit Änderungen
       oder das nächtliche Nachführen nach. */
    if (data.stored) await bestEffort('Wortliste nachführen', () => refreshSearchWords(db, { onlyIfBuilt: true, maxCards: 20000, kinds: new Map(REGIONS.map((r) => [r.id, r.kind])), names: new Map(REGIONS.map((r) => [r.id, r.name])) }));
    /* Suchkarten, deren nächste Sitzung erreicht ist, auf diese Sitzung nachrücken (drizzle/0024; meist nichts zu tun) */
    await bestEffort('Suchkarten nachrücken', () => rollCardDates(db));
    /* Werte je Gebiet der Administration für dieses Gebiet nachrechnen (region-facts.mjs), nach dem letzten Teilabruf,
       höchstens eine Sekunde: Die Rechnung hält den Prozess an, auch die anderen Importe. Reicht die Zeit nicht oder
       schlägt es fehl, holt der nächste Rechenschritt der Administration es nach. */
    if (!data.resume) await bestEffort('Werte je Gebiet', () => refreshRegionFacts(db, { regions: [region], budgetMs: 1000 }));
    return { status: 200, data };
}
catch (e) {
    // The cause is stored with the source status; otherwise only older notes of the stock would be visible.
    const cause = (e instanceof Error ? e.message : 'Importfehler').slice(0, 300);
    // The source refused a request (collect-region.mjs, refusalGate): the job pauses its server and asks again later.
    const refused = (e as { refused?: { retryAfterMs: number | null } })?.refused;
    const record = trace.finish({ runId: id, status: 'failed', error: cause });
    await env.DB.prepare(FINISH_RUN_SQL).bind(new Date().toISOString(), 'failed', JSON.stringify({ mode,region,trigger,error: cause, ...(record ? { debug: brief(record) } : {}) }), id).run();
    // The record must never hide the failure it describes.
    const db = env.DB;
    if (record) await bestEffort('Aufzeichnung speichern', () => saveDebug(db, record));
    const coverage={...previousCoverage,regionId:region,...importHealth(previousCoverage,{at:started,failed:true}),complete:false,issues:[...new Set([...(previousCoverage.issues||[]).filter((i:string)=>!String(i).startsWith(FAILURE_CAUSE)),'Abruf fehlgeschlagen; letzter übernommener Bestand bleibt erhalten.',FAILURE_CAUSE+cause])]};
    // After a failure the OParl probe is sent again (it may be the reason: "OParl vorhanden").
    delete coverage.oparlProbeAt;
    await db.prepare(SAVE_COVERAGE_SQL).bind(region,JSON.stringify(coverage)).run();
    return { status: 502, data: { error: 'Import fehlgeschlagen; der angezeigte Bestand kann teilweise aktualisiert sein', cause, ...(refused ? { refused } : {}) } };
}
finally {
    if (wrote) invalidateReads();
    await lock.release();
} }
// What of a record goes into the details of the run.
const brief = (record: {summary: {requests: number; failed: number; networkMs: number}; durationMs: number}) => ({ requests: record.summary.requests, failed: record.summary.failed, networkMs: record.summary.networkMs, durationMs: record.durationMs });
async function refreshMetadata(id: string, started: string,region:string,previousCoverage:Record<string, unknown>,lookback:string,trace:ReturnType<typeof createTrace>,renew:()=>Promise<void>) {
    if (!env.DB)
        throw Error('Datenbank fehlt');
    const previous = await env.DB.prepare('SELECT id,payload FROM topics WHERE region_id=?').bind(region).all<{
        id: string;
        payload: string;
    }>();
    const old = new Map(previous.results.map(r => [r.id, JSON.parse(r.payload) as Topic]));
    // The raw text is no longer needed once parsed; a large area (Dortmund: 88 MB) would otherwise stay in memory twice.
    previous.results.length = 0;
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
    const fresh = await collectRegion(region,{maxDurationMs:120000,window:lookback,marks:{known,stock,list:keptList},trace,oparlProbeAt:previousCoverage.oparlProbeAt}) as FeedData & {refused?:{retryAfterMs:number|null}};
    // Storing a large area takes a while; the lock is held for it anew (import-lock.mjs).
    await bestEffort('Sperre verlängern (gilt ohnehin noch einige Minuten)', renew);
    const collectMs = Date.now() - collectStarted, written = { created: 0, changed: 0, unchanged: 0 };
    const unchanged = Number(fresh.coverage.unchangedMeetings || 0), warnings = fresh.coverage.warnings || [];
    const decisions: Topic[] = [];
    const events: unknown[][] = [];
    const groups=new Map<string,D1PreparedStatement[]>(),touch:D1PreparedStatement[]=[];
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
        if(p)statements.push(env.DB.prepare('INSERT INTO article_versions(id,topic_id,captured_at,payload) VALUES(?,?,?,?)').bind(crypto.randomUUID(),p.id,started,versionPayload(p,t)));
        statements.push(env.DB.prepare('INSERT INTO topics(id,region_id,source,event_date,updated_at,status,payload) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET event_date=excluded.event_date,updated_at=excluded.updated_at,status=excluded.status,payload=excluded.payload').bind(t.id,region,t.source,t.eventDate,t.updatedAt,t.status,JSON.stringify(t)));
        const group=t.identity?.mergedInto||t.id;groups.set(group,[...(groups.get(group)||[]),...statements]);
        const event=notifyEvent(p,t,{at:started,hadStock:old.size>0,region});
        if(event)events.push(event);
    }
    // Gebündelt schreiben: Identitätsgruppen bleiben zusammen in einem Batch (atomar), mehrere Gruppen teilen sich einen.
    for(const batch of batches([...groups.values(),...touch.map(s=>[s])]))await env.DB.batch(batch);
    // Ereignisse für die Benachrichtigungen (notify-events.mjs), erst nach den Berichten: Der Job notify findet dann ihre
    // Suchkarten. Ohne Tabelle (drizzle/0046 fehlt) oder bei einem Fehler bleibt der Import, wie er ist.
    const db = env.DB;
    if(events.length)await bestEffort('Ereignisse für Benachrichtigungen', async()=>{
        for(const batch of batches(events.map(e=>[db.prepare(NOTIFY_INSERT_SQL).bind(...e)])))await db.batch(batch);
        await db.prepare(NOTIFY_PRUNE_SQL).bind(new Date(Date.parse(started)-NOTIFY_KEEP_MS).toISOString()).run();
    });
    // A short window without meetings is a successful attempt; the stored stock and its status stay as they are.
    const quiet=Boolean(combined.quiet);
    const health=importHealth(previousCoverage,{at:started,count:fresh.topics.length+unchanged,complete:fresh.coverage.complete,quiet});
    const coverage:Record<string, unknown>={...combined.coverage,regionId:region,...health,importedAt:health.lastSuccessAt};
    // The negative OParl probe this import relied on (collect-region.mjs); without one the next import asks again.
    if(fresh.coverage.oparlProbeAt)coverage.oparlProbeAt=fresh.coverage.oparlProbeAt;else delete coverage.oparlProbeAt;
    // Missing items remain in the archive. A partial scan never deletes an article.
    await env.DB.prepare(SAVE_COVERAGE_SQL).bind(region,JSON.stringify(coverage)).run();
    // Only now, with the reports stored, do the marks of this import count. Unchanged marks and lists are not written again.
    if (fresh.marks) { const marks = writeMarks({...known,...fresh.marks}, new Date()); if (marks !== marksRow?.value) await env.DB.prepare(SAVE_STATE_SQL).bind(marksKey(region), marks).run(); }
    if (fresh.list) { const list = JSON.stringify(fresh.list); if (list !== listRow?.value) await env.DB.prepare(SAVE_STATE_SQL).bind(listKey(region), list).run(); }
    const status = fresh.coverage.complete || quiet ? 'completed' : 'partial';
    const record = trace.finish({ runId: id, status, adapter: fresh.coverage.method || null, meetings: fresh.coverage.meetings, unchangedMeetings: unchanged, readMeetings: fresh.readMeetings ?? null, reports: fresh.topics.length, stockBefore: old.size, written, marksKnown: Object.keys(known).length, collectMs, storeMs: Date.now() - collectStarted - collectMs, issues: fresh.coverage.issues, warnings });
    await env.DB.prepare(FINISH_RUN_SQL).bind(new Date().toISOString(), status, JSON.stringify({ mode:'metadata',region, window: lookback, quiet, count: fresh.topics.length, unchangedMeetings: unchanged, decisions: decisions.length, issues: fresh.coverage.issues, warnings, debug: brief(record) }), id).run();
    // A record that cannot be stored does not undo a stored import.
    await bestEffort('Aufzeichnung speichern', () => saveDebug(db, record));
    // A step that only got further in the meeting list has made progress too: the next one continues behind it.
    const listAdvanced = Boolean(fresh.list) && (fresh.list as {readAt?: number}).readAt !== keptList?.readAt;
    // attemptComplete describes this attempt; coverage.complete describes the stored period.
    // resume: the time limit ended this attempt after it had read further meetings; the next attempt continues behind them.
    // stored: reports written (new, changed, or with changed metadata). refused: the source refused a request; the job
    // pauses its server and continues the area later (pipeline-jobs.mjs). requests: requests sent to the source and failed
    // (all failed and nothing read: the provider was not reached, unreached() in pipeline-jobs.mjs).
    return { topics: fresh.topics.length, decisions: decisions.length, coverage, window: lookback, quiet, attemptComplete: Boolean(fresh.coverage.complete) || quiet, unchanged, warnings, resume: Boolean(fresh.coverage.resumable) && (Number(fresh.readMeetings || 0) > 0 || listAdvanced), stored: written.created + written.changed + touch.length, requests: { sent: record.summary.requests, failed: record.summary.failed }, ...(fresh.refused ? { refused: fresh.refused } : {}) };
}
