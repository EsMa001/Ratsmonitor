import {analysisSignature,RECORD_VERSION} from '../../shared/article-record.mjs';
const hash=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))).map(v=>v.toString(16).padStart(2,'0')).join('');
// Extraction is transient. A new result stores small evidence and text digests,
// never the downloaded full text or automatic multi-paragraph source excerpts. Exception (approved): `ruleSummary` keeps the
// few original sentences the rule-based summary selected (about 40 and 65 words), with their score.
/** Bericht mit KI-Zusammenfassung (Entscheidung 12.10.2026): nur die Regel-Zusammenfassung dazu, kurz und lang in ruleSummary, oder
    den Versuch merken (ruleSummaryTried = tried); KI-Text, Angaben, contentAnalysis und article_analyses bleiben, wie sie sind.
    compactSummaryAttempt würde summaryMethod, summaryIssue und summaryAttemptedAt setzen. Import (refreshSummaries) und
    scripts/pdf-store/summaries.mjs. */
export function withRuleSummary(old,processed,tried){
 const next={...old};
 if(processed.ruleSummary){next.ruleSummary=processed.ruleSummary;delete next.ruleSummaryTried;}else next.ruleSummaryTried=tried;
 return next;
}
export async function compactSummaryAttempt(old,processed,at){
 const inputHash=await hash(processed.sourceText||old.officialTitle||''),completed=processed.generatedBy==='KI-Zusammenfassung'&&processed.summaryGeneratedAt!==old.summaryGeneratedAt;
 const url=processed.documentSource||old.sourceUrl;
 const evidence=completed?(processed.summaryEvidence||[]).map(quote=>({url,quote,location:'Ausgewerteter Dokumenttext'})):[];
 const analysis={id:crypto.randomUUID(),status:completed?'completed':processed.documentIssue?'insufficient_source':'failed',method:'api-summary-v1',generatedAt:at,inputHash,sourceSignature:analysisSignature(old),basis:'Manuell gestartete PDF-Auswertung mit KI-Gegenprüfung; kein unabhängiges menschliches Urteil.',reason:completed?undefined:processed.summaryIssue||processed.documentIssue||'Keine auswertbare Dokumentgrundlage.',evidence,sourceDocuments:processed.documentSource?[{url,hash:await hash(processed.sourceText||''),fetchedAt:at}]:[],checks:completed?(processed.quality?.checks||[]).map(c=>({name:c.name,passed:c.passed})):[{name:'Inhaltsgrundlage und KI-Ausgabe',passed:false}],reviewStatus:'not_independently_reviewed'};
 const next={...old,...(completed?{title:processed.title,shortSummary:processed.shortSummary,longSummary:processed.longSummary,generatedBy:processed.generatedBy,summaryModel:processed.summaryModel,summaryGeneratedAt:processed.summaryGeneratedAt,quality:processed.quality}:{}),summaryMethod:analysis.method,summaryAttemptedAt:at,...(processed.ruleSummary?{ruleSummary:processed.ruleSummary}:{}),contentAnalysis:completed||!old.contentAnalysis?analysis:old.contentAnalysis,metadata:{version:RECORD_VERSION,firstImportedAt:null,sourceModifiedAt:null,lastFetchedAt:null,...old.metadata,...(processed.documentSource?{lastFetchedAt:at}:{}),lastProcessedAt:at},summaryIssue:completed?undefined:analysis.reason};
 return {topic:next,analysis:{...analysis,...(completed?{shortSummary:processed.shortSummary,longSummary:processed.longSummary}:{})}};
}
