import {identityState} from '../../shared/topic-identity.mjs';
import type { TopicCard, TopicDetail } from '../../shared/types';
import type { StoredTopic } from '../types';
import {labelName} from '../../shared/labels.mjs';
import {storedClassification} from '../../shared/analysis-state.mjs';
import { processStage } from '../../shared/process';
// Explicit allowlists: source text and importer metadata never enter API responses.
export function toCard(t: StoredTopic): TopicCard {
    const { regionId, id, source, title, shortSummary, status, category, updatedAt, generatedBy, image } = t;
    const classification=storedClassification(t);
    return { classification,regionId: regionId || "muenster", id, source, title, shortSummary, status, category:classification.method==='pending'?'Analyse ausstehend':labelName(classification.primary), updatedAt, generatedBy, image, processStage: processStage(t) };
}
import {CATALOG} from '../../shared/catalog.mjs';
/* Gebietsname mit dem Vorgang: die Detailseite lud dafür sonst den ganzen Katalog (528 KB JS, Messung 17.10.2026) */
const regionName=(id?:string)=>(CATALOG as {id:string;name:string}[]).find(r=>r.id===id)?.name??null;
export function toDetail(t: StoredTopic): TopicDetail {
    const { officialTitle, longSummary, committee, eventDate, reference, documents, events, relevanceReason, quality, sourceUrl } = t;
    return { ...toCard(t), regionName:regionName(t.regionId), metadata:t.metadata,contentAnalysis:t.contentAnalysis,labelAssessments:t.labelAssessments,ruleSummary:t.ruleSummary,analysisFeatures:t.analysisFeatures, identityState:identityState(t), officialTitle, longSummary, committee, eventDate, reference, documents, events, relevanceReason, quality, sourceUrl };
}
