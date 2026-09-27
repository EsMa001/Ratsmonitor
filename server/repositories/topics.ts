import {activeTopics,resolveTopic} from '@/shared/topic-identity.mjs';
import 'server-only';
import { env } from 'cloudflare:workers';
import seed from '@/data/topics.json';
import regional from '@/data/regions.json';
import {nrwSnapshot as nrw,fallbackNrwTopics} from '../integrations/nrw-snapshot.mjs';
import {pendingCoverage} from '@/shared/regions';
import type { Coverage, FeedPage, SourceStats, TopicDetail } from '@/shared/types';
import { nextCursor, StalePage, PAGE_SIZE, matchesFilter, type PageRequest } from '@/shared/pagination';
import type { StoredTopic, ImportData } from '../types';
import { toCard, toDetail } from '../mappers/topics';
const initial = seed as unknown as ImportData;
const order = "substr(updated_at,1,10) DESC, (coalesce(json_extract(payload,'$.reference'),'') != '') DESC, updated_at DESC, id ASC";
const lightPayload = "json_remove(payload,'$.sourceText','$.documentText','$.longSummary','$.documents')";
async function sortedInitial(region: string): Promise<StoredTopic[]> {
    return activeTopics([...initial.topics,...regional.topics as unknown as StoredTopic[],...await fallbackNrwTopics(region)]).sort((a, b) => b.updatedAt.slice(0, 10).localeCompare(a.updatedAt.slice(0, 10)) || Number(!!b.reference) - Number(!!a.reference) || b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id));
}
function finish(topics: StoredTopic[], coverage: Coverage, total: number, storageAvailable: boolean, page: PageRequest): FeedPage {
    const revision = 'identity-v1:'+(storageAvailable ? 'db:' : 'seed:') + coverage.importedAt;
    if (page.revision && page.revision !== revision)
        throw new StalePage('Der Datenstand wurde aktualisiert. Bitte lade die Seite neu.');
    const end = page.offset + topics.length;
    return { topics: topics.map(toCard), coverage, total, storageAvailable, nextCursor: end < total ? nextCursor(end, revision,page.filter,page.region) : null };
}
export async function getFeedPage(page: PageRequest = { limit: PAGE_SIZE, offset: 0, revision: undefined,filter:'alle',region:'billerbeck' }): Promise<FeedPage> {
    try {

        if (!env.DB)
            throw Error('DB fehlt');
        const statusWhere=page.filter==='entschieden'?"WHERE status IN ('approved','rejected')":page.filter==='offen'?"WHERE status IN ('announced','consulting','recommended','postponed')":'';
        const where="WHERE region_id=? AND json_extract(payload,'$.identity.mergedInto') IS NULL"+(statusWhere?' AND '+statusWhere.replace('WHERE ',''):'');
        // D1 batch keeps list, count and coverage in one database transaction.
        const [rows, count, coverage] = await env.DB.batch<Record<string, unknown>>([
            env.DB.prepare(`SELECT ${lightPayload} AS payload FROM topics ${where} ORDER BY ${order} LIMIT ? OFFSET ?`).bind(page.region,page.limit, page.offset),
            env.DB.prepare(`SELECT count(*) AS total FROM topics ${where}`).bind(page.region),
            env.DB.prepare("SELECT payload AS value FROM source_coverage WHERE region_id=?").bind(page.region)
        ]);
        const c = coverage.results[0] as {
            value: string;
        } | undefined;
        return finish(rows.results.map(r => JSON.parse(r.payload as string)), c ? JSON.parse(c.value) : pendingCoverage(page.region), Number(count.results[0].total), true, page);
    }
    catch (e) {
        if (e instanceof StalePage)
            throw e;
        console.error('Datenbank nicht verfügbar; mitgelieferter Stand');
        const filtered=(await sortedInitial(page.region)).filter(t=>(t.regionId||'muenster')===page.region&&matchesFilter(t.status,page.filter));
        return finish(filtered.slice(page.offset,page.offset+page.limit),([...regional.coverage,...nrw.coverage] as Coverage[]).find((c:any)=>c.regionId===page.region)||(page.region==='muenster'?initial.coverage:pendingCoverage(page.region)),filtered.length,false,page);
    }
}
export async function getSourceStats(): Promise<SourceStats> {
    try {

        if (!env.DB)
            throw Error('DB fehlt');
        const [stats, coverage] = await env.DB.batch<Record<string, unknown>>([
            env.DB.prepare("SELECT count(*) AS total, coalesce(sum(json_extract(payload,'$.quality.passed')=1),0) AS qualityPassed, coalesce(sum(json_extract(payload,'$.generatedBy') LIKE 'KI-Zusammenfassung%'),0) AS aiSummaries FROM topics WHERE json_extract(payload,'$.identity.mergedInto') IS NULL"),
            env.DB.prepare("SELECT value FROM system_state WHERE key='coverage'")
        ]);
        const s = stats.results[0];
        const c = coverage.results[0] as {
            value: string;
        } | undefined;
        return { total: Number(s.total), qualityPassed: Number(s.qualityPassed), aiSummaries: Number(s.aiSummaries), coverage: c ? JSON.parse(c.value) : initial.coverage, storageAvailable: true };
    }
    catch {
        return { total: activeTopics([...initial.topics,...regional.topics as unknown as StoredTopic[]]).length+Object.values(nrw.counts).reduce((n,c)=>n+c,0), qualityPassed: activeTopics(initial.topics).filter(t => t.quality?.passed).length, aiSummaries: activeTopics(initial.topics).filter(t => t.generatedBy.startsWith('KI-Zusammenfassung')).length, coverage: initial.coverage, storageAvailable: false };
    }
}
export async function getTopic(id: string): Promise<TopicDetail | undefined> {
    if (!/^[a-z0-9-]{1,120}$/.test(id))
        return undefined;
    try {

        if (!env.DB)
            throw Error('DB fehlt');
        const r = await env.DB.prepare('SELECT payload FROM topics WHERE id=?').bind(id).first<{
            payload: string;
        }>();
        if(!r)return undefined;
        let topic=JSON.parse(r.payload);const seen=new Set([id]);
        while(topic.identity?.mergedInto){const next=topic.identity.mergedInto;if(seen.has(next))return undefined;seen.add(next);const row=await env.DB.prepare('SELECT payload FROM topics WHERE id=?').bind(next).first<{payload:string}>();if(!row)return undefined;topic=JSON.parse(row.payload);}
        return toDetail(topic);
    }
    catch {
        console.error('Thema aus mitgeliefertem Stand');
        const t = resolveTopic([...initial.topics,...regional.topics as unknown as StoredTopic[],...await fallbackNrwTopics(id.match(/^nrw-\d{8}/)?.[0]||'none')],id);
        return t ? toDetail(t) : undefined;
    }
}

export async function getUpcomingSessions(region="billerbeck"):Promise<import('@/shared/types').UpcomingSession[]> {
 const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin'}).format(new Date());
 let rows:Pick<StoredTopic,'id'|'title'|'events'>[]=[];
 try{if(!env.DB)throw Error('DB fehlt');{const result=await env.DB.prepare("WITH dated AS (SELECT topics.id,json_extract(payload,'$.title') AS title,json_extract(e.value,'$.date') AS date,json_extract(e.value,'$.committee') AS committee,ROW_NUMBER() OVER (PARTITION BY json_extract(e.value,'$.date'),json_extract(e.value,'$.committee') ORDER BY topics.id) AS position FROM topics JOIN json_each(json_extract(payload,'$.events')) e WHERE region_id=? AND json_extract(payload,'$.identity.mergedInto') IS NULL AND substr(json_extract(e.value,'$.date'),1,10)>=? AND json_extract(e.value,'$.status') IN ('announced','consulting')) SELECT id,title,date,committee FROM dated WHERE position=1 ORDER BY date,id LIMIT 2").bind(region,today).all<{id:string;title:string;date:string;committee:string}>();return result.results;}}catch{rows=[...initial.topics,...regional.topics as unknown as StoredTopic[],...await fallbackNrwTopics(region)].filter(t=>!t.identity?.mergedInto&&(t.regionId||'muenster')===region);}
 const seen=new Set<string>();
 return rows.flatMap(t=>t.events.filter(e=>e.date.slice(0,10)>=today&&['announced','consulting'].includes(e.status)).map(e=>({id:t.id,title:t.title,date:e.date,committee:e.committee}))).sort((a,b)=>a.date.localeCompare(b.date)).filter(e=>{const key=e.date+e.committee;if(seen.has(key))return false;seen.add(key);return true}).slice(0,2);
}
