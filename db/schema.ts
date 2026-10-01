import {sql} from 'drizzle-orm';
import {sqliteTable,text,integer,index,primaryKey} from 'drizzle-orm/sqlite-core';
export const topics=sqliteTable('topics',{id:text('id').primaryKey(),regionId:text('region_id').notNull().default('muenster'),source:text('source').notNull(),eventDate:text('event_date').notNull(),updatedAt:text('updated_at').notNull(),status:text('status').notNull(),payload:text('payload').notNull()},t=>[index('idx_topics_event_date').on(t.eventDate),index('idx_topics_region_updated').on(t.regionId,t.updatedAt),index('idx_topics_canonical_region_status').on(t.regionId,t.status).where(sql`json_extract(${t.payload},'$.identity.mergedInto') IS NULL`)]);
export const systemState=sqliteTable('system_state',{key:text('key').primaryKey(),value:text('value').notNull()});
export const dataRevisions=sqliteTable('data_revisions',{id:text('id').primaryKey(),revision:integer('revision').notNull()});
export const pushSubscriptions=sqliteTable('push_subscriptions',{id:text('id').primaryKey(),endpoint:text('endpoint').notNull(),auth:text('auth'),p256dh:text('p256dh'),createdAt:text('created_at').notNull(),lastSentAt:text('last_sent_at')});
export const importRuns=sqliteTable('import_runs',{id:text('id').primaryKey(),startedAt:text('started_at').notNull(),finishedAt:text('finished_at'),status:text('status').notNull(),details:text('details').notNull()});

export const articleVersions=sqliteTable('article_versions',{id:text('id').primaryKey(),topicId:text('topic_id').notNull(),capturedAt:text('captured_at').notNull(),payload:text('payload').notNull()},t=>[index('idx_versions_topic').on(t.topicId,t.capturedAt)]);
export const sourceCoverage=sqliteTable('source_coverage',{regionId:text('region_id').primaryKey(),payload:text('payload').notNull()});
// Immutable result versions; source refreshes never overwrite analysis history.
export const articleAnalyses=sqliteTable('article_analyses',{id:text('id').primaryKey(),topicId:text('topic_id').notNull(),kind:text('kind').notNull(),method:text('method').notNull(),inputHash:text('input_hash').notNull(),createdAt:text('created_at').notNull(),payload:text('payload').notNull()},t=>[index('idx_article_analyses_topic_kind').on(t.topicId,t.kind,t.createdAt)]);
// Frozen active job inputs are stored per article, keeping the manifest small.
export const aiJobArticles=sqliteTable('ai_job_articles',{jobId:text('job_id').notNull(),topicId:text('topic_id').notNull(),position:integer('position').notNull(),payload:text('payload').notNull(),applied:integer('applied').notNull().default(0)},t=>[primaryKey({columns:[t.jobId,t.topicId]}),index('idx_ai_job_articles_position').on(t.jobId,t.position)]);
// Export is distinct from successful analysis; cancellation does not erase its place in the queue.
export const aiDispatches=sqliteTable('ai_dispatches',{topicId:text('topic_id').notNull(),kind:text('kind').notNull(),exportedAt:integer('exported_at').notNull()},t=>[primaryKey({columns:[t.topicId,t.kind]})]);
