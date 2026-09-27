export type TopicStatus = 'announced' | 'consulting' | 'recommended' | 'approved' | 'rejected' | 'postponed' | 'info' | 'unknown';
export type SourceId = 'city' | 'district';
export interface SourceDocument {
    title: string;
    url: string;
    kind: string;
}
export interface TopicEvent {
    date: string;
    committee: string;
    status: TopicStatus;
    description: string;
    url: string;
    result?: string;
    created?: string;
    modified?: string;
    attendance?: {status:'available'|'not_collected'|'unavailable';sourceUrl?:string;fetchedAt?:string;people:{name:string;role:string;presence:'present'|'absent'|'unknown';sourceUrl:string}[]};
    decision?: {kind:'decision'|'recommendation'|'information'|'postponed'|'unknown';text:string;date:string;sourceUrl:string;votes?:{yes:number|null;no:number|null;abstentions:number|null;description?:string};implementationStatus:'unknown'|'reported_complete'};
}
export interface ContentEvidence {url:string;quote:string;location?:string}
export interface ContentAnalysis {id:string;status:'completed'|'insufficient_source'|'failed'|'stale';method:string;generatedAt:string;inputHash:string;sourceSignature:string;basis:string;reason?:string;evidence:ContentEvidence[];sourceDocuments:{url:string;hash:string;fetchedAt:string}[];checks:{name:string;passed:boolean}[];reviewStatus:'not_independently_reviewed'|'reviewed'}
export interface WeightedKeywords {inputBasis?:'title'|'content';status:'completed'|'stale';method:string;generatedAt:string;inputHash:string;basis:string;items:{term:string;weight:number;evidence?:ContentEvidence}[]}
export interface ArticleMetadata {version:string;firstImportedAt:string|null;sourceModifiedAt:string|null;lastFetchedAt:string|null;lastProcessedAt:string|null}
export interface QualityResult {
    passed: boolean;
    checks: {
        name: string;
        passed: boolean;
        detail: string;
    }[];
    checkedAt: string;
    sourceHash: string;
}
export interface Classification {primary:string;secondary:string[];version:string;method:string;evidence:string;reason:string;sourceUrl:string;classifiedAt:string|null;status?:'completed'|'stale';inputHash?:string;basis?:string}
export interface TopicCard {
    classification?:Classification;
    regionId?: string;
    id: string;
    source: SourceId;
    title: string;
    shortSummary: string;
    status: TopicStatus;
    category: string;
    updatedAt: string;
    generatedBy: string;
    processStage?: number;
    image?: {
        src: string;
        alt: string;
        sourceUrl: string;
    };
}
export interface TopicDetail extends TopicCard {
    metadata?:ArticleMetadata;
    contentAnalysis?:ContentAnalysis;
    weightedKeywords?:WeightedKeywords;
    labelAssessments?:{rule?:Classification;ai?:Classification;review?:{primary:string;reviewer:string;reviewedAt:string;reason:string}};
    analysisFeatures?: {subjects:string[];terms:string[];version:string;evidence:string;analysedAt:string};
    identityState?: 'paper'|'unlinked'|'conflict';
    officialTitle: string;
    longSummary: string[];
    committee: string;
    eventDate: string;
    reference: string;
    referenceStatus?:'not_available_in_source';
    documents: SourceDocument[];
    events: TopicEvent[];
    relevanceReason: string;
    quality: QualityResult;
    sourceUrl: string;
}
export interface Coverage {
    lastAttemptAt?: string;
    lastSuccessAt?: string | null;
    lastCompleteAt?: string | null;
    attemptStatus?: 'failed' | 'completed' | 'partial' | 'empty';
    failureCount?: number;
    nextRetryAt?: string | null;
    from: string | null;
    to: string | null;
    importedAt: string | null;
    meetings: number;
    sourceCount: number;
    complete: boolean;
    issues: string[];
}
export interface FeedPage {
    topics: TopicCard[];
    coverage: Coverage;
    storageAvailable: boolean;
    total: number;
    nextCursor: string | null;
}
export interface SourceStats {
    coverage: Coverage;
    storageAvailable: boolean;
    total: number;
    qualityPassed: number;
    aiSummaries: number;
}
export const STATUS: Record<TopicStatus, {
    label: string;
    description: string;
}> = {
    announced: { label: 'Angekündigt', description: 'Die Tagesordnung ist veröffentlicht. Ein Ergebnis liegt in den verwendeten Quellen noch nicht vor.' }, consulting: { label: 'In Beratung', description: 'Eine Vorlage liegt zur Beratung vor. Ein endgültiger Beschluss ist noch nicht belegt.' }, recommended: { label: 'Empfehlung', description: 'Ein Gremium hat eine Empfehlung abgegeben. Die endgültige Entscheidung kann noch ausstehen.' }, approved: { label: 'Beschlossen', description: 'Ein Beschluss ist in der öffentlichen Quelle dokumentiert. Das belegt noch keine Umsetzung.' }, rejected: { label: 'Abgelehnt', description: 'Die öffentliche Quelle dokumentiert eine Ablehnung.' }, postponed: { label: 'Vertagt', description: 'Die Behandlung wurde laut öffentlicher Quelle vertagt.' }, info: { label: 'Zur Kenntnis', description: 'Der Vorgang dient der Information. Eine Sachentscheidung ist damit nicht verbunden.' }, unknown: { label: 'Stand offen', description: 'Der aktuelle Verfahrensstand lässt sich aus den vorliegenden Informationen nicht sicher ableiten.' }
};
export function formatDate(s: string | null | undefined) { if(!s)return "noch kein Datenstand"; return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Europe/Berlin' }).format(new Date(s.length === 10 ? s + 'T12:00:00Z' : s)); }
export interface UpcomingSession {id:string;title:string;date:string;committee:string}
