import type { TopicDetail, Coverage } from '../shared/types';
export interface StoredTopic extends TopicDetail {
    public?: boolean;
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
    coverage: Coverage;
}
