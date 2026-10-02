import type { TopicDetail, Coverage } from '../shared/types';
export interface StoredTopic extends TopicDetail {
    public?: boolean;
    sourceData?: {version:string;method:string;fetchedAt:string;records:unknown[];detailStatus?:string;issues?:string[]};
    identityLinks?: string[];
    identityRecords?: {authority:string;kind:string;id:string}[];
    identity?: {version:string;mergedInto?:string;conflict?:boolean};
    hasDocumentText?: boolean;
    documentText?: string;
    sourceText: string;
    documentSource?: string;
    documentIssue?: string;
    summaryIssue?: string;
    summaryMethod?: string;
    paperType?: string;
    summaryAttemptedAt?: string;
    summaryModel?: string;
    summaryEvidence?: string[];
    summaryGeneratedAt?: string;
}
export interface ImportData {
    topics: StoredTopic[];
    // unchangedMeetings: meetings skipped because their agenda is as it was; resumable: the time limit ended the attempt.
    // warnings: remarks that do not make the import incomplete, e.g. papers the source does not publish.
    coverage: Coverage & {unchangedMeetings?: number; resumable?: boolean; warnings?: string[]; method?: string};
    // Meetings read completely by this import, and how many of them were read now (see meeting-marks.mjs).
    marks?: Record<string, unknown>;
    readMeetings?: number;
    // The meeting list of this import, kept for the step that continues it (OParl; see meeting-marks.mjs).
    list?: unknown;
}
