import {LABELS, LABEL_VERSION} from './labels.mjs';
import {hashText} from './database-transfer.mjs';
import {agentUsage} from './ai-usage.mjs';
import {analysisSignature} from './article-record.mjs';

export const AI_LOCAL_METHOD = 'ai-local-content-v2';
export const AI_LOCAL_CONTRACT = 'ratsmonitor-ai-local-v2';
export const AI_LOCAL_LIMITS = Object.freeze({shortWords:40, shortChars:500, paragraphs:24, paragraphChars:8000, longWords:1200, evidence:40, quoteChars:1600, readChars:24000});
const labels = new Set(LABELS.map(label => label.id));
/** Raised only with the fixed validation texts below, so callers may show them to the submitting agent. */
export class LocalResultError extends Error {}
const assert = (value, message) => { if (!value) throw new LocalResultError(message); };
const bounded = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
export const normalizeLocalText = text => String(text).normalize('NFC').replace(/\r\n?/g, '\n').trim();
const words = text => text.trim().split(/\s+/u).filter(Boolean).length;
export function stableLocalJson(value) {
  if (Array.isArray(value)) return '[' + value.map(stableLocalJson).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).filter(key => value[key] !== undefined).sort().map(key => JSON.stringify(key) + ':' + stableLocalJson(value[key])).join(',') + '}';
  return JSON.stringify(value);
}

export async function localInputHash(topic, loaded) {
  const sources = await Promise.all(loaded.sources.map(async source => ({
    id:source.id, url:source.url, title:source.title || '', kind:source.kind, role:source.role,
    hash:source.hash, actualHash:await hashText(source.pages.map(page => page.text).join('\f')),
    method:source.method || '', version:source.version ?? null,
    pages:source.pages.map(page => page.number), partial:source.partial === true,
    aliases:(source.aliases || []).map(({url,title}) => ({url,title:title || ''})).sort((a,b) => a.url < b.url ? -1 : a.url > b.url ? 1 : 0),
  })));
  sources.sort((a,b) => a.id.localeCompare(b.id));
  return hashText(stableLocalJson({method:AI_LOCAL_METHOD, contract:AI_LOCAL_CONTRACT,
    article:{id:topic.id, title:topic.officialTitle || topic.title || '', regionId:topic.regionId || '',
      eventDate:topic.eventDate || '', status:topic.status, reference:topic.reference || '',
      events:(topic.events || []).map(({date,committee,status,result,description,decision}) => ({date,committee,status,result,description,decision})),
      documents:(topic.documents || []).map(({url,title,kind}) => ({url,title:title || '',kind:kind || ''})).sort((a,b) => String(a.url) < String(b.url) ? -1 : String(a.url) > String(b.url) ? 1 : 0)},
    sources, coverage:loaded.coverage,
    gaps:(loaded.gaps || []).map(({url,title,reason}) => ({url,title,reason})).sort((a,b) => String(a.url).localeCompare(String(b.url))),
  }));
}

function oneSentence(text) {
  if (/\n/u.test(text) || !/[.!?][\s\u00bb\u201c\u201d\u2018\u2019"]*$/u.test(text)) return false;
  const segments = [...new Intl.Segmenter('de', {granularity:'sentence'}).segment(text)].filter(segment => segment.segment.trim());
  return segments.length === 1;
}

export async function prepareLocalResult(topic, loaded, result, inputHash, at) {
  assert(result && typeof result === 'object' && !Array.isArray(result), 'Ergebnisobjekt fehlt.');
  assert(bounded(result.agent,200) && bounded(result.model,200), 'Tatsaechlichen Agenten und Modell angeben; unbekannte Version als unknown.');
  const sourceMap = new Map(loaded.sources.map(source => [source.id, source]));
  assert(Array.isArray(result.coveredSourceIds) && result.coveredSourceIds.length === sourceMap.size &&
    new Set(result.coveredSourceIds).size === sourceMap.size && result.coveredSourceIds.every(id => sourceMap.has(id)),
  'coveredSourceIds muss alle bereitgestellten lokalen Textquellen genau einmal enthalten.');
  assert(bounded(result.shortSummary,AI_LOCAL_LIMITS.shortChars) && words(result.shortSummary) <= AI_LOCAL_LIMITS.shortWords && oneSentence(result.shortSummary.trim()),
    'Kurzfassung muss genau ein Satz mit hoechstens 40 Woertern sein.');
  assert(Array.isArray(result.longSummary) && result.longSummary.length > 0 && result.longSummary.length <= AI_LOCAL_LIMITS.paragraphs &&
    result.longSummary.every(paragraph => bounded(paragraph, AI_LOCAL_LIMITS.paragraphChars)) && words(result.longSummary.join(' ')) <= AI_LOCAL_LIMITS.longWords,
  'Langfassung muss 1 bis 24 Absaetze mit insgesamt hoechstens 1200 Woertern enthalten.');
  const evidence = items => {
    assert(Array.isArray(items) && items.length > 0 && items.length <= AI_LOCAL_LIMITS.evidence, 'Konkrete Originalbelege fehlen.');
    return items.map(entry => {
      const source = sourceMap.get(entry?.sourceId);
      assert(source && Number.isInteger(entry.page), 'Beleg benoetigt bekannte sourceId und Seitenzahl.');
      const page = source.pages.find(value => value.number === entry.page);
      assert(page && bounded(entry.quote,AI_LOCAL_LIMITS.quoteChars) && normalizeLocalText(page.text).includes(normalizeLocalText(entry.quote)),
        'Zitat ist nicht im gespeicherten Originaltext dieser Quelle und Seite enthalten.');
      assert(entry.paragraphIndex === undefined || Number.isInteger(entry.paragraphIndex) && entry.paragraphIndex >= 0 && entry.paragraphIndex < result.longSummary.length,
        'Absatzzuordnung des Belegs ist ungueltig.');
      if (entry.paragraphIndex !== undefined) assert(normalizeLocalText(result.longSummary[entry.paragraphIndex]).includes(normalizeLocalText(entry.quote)),
        'Ein zugeordnetes Originalzitat muss auch in diesem Absatz enthalten sein.');
      return {sourceId:source.id,url:source.url,quote:entry.quote,page:entry.page,location:(source.kind === 'attachment' ? 'Seite ' : 'Textabschnitt ') + entry.page,
        ...(entry.paragraphIndex === undefined ? {} : {paragraphIndex:entry.paragraphIndex})};
    });
  };
  const summaryEvidence = evidence(result.evidence);
  const label = result.aiLabel;
  assert(label && labels.has(label.primary) && Array.isArray(label.secondary) && label.secondary.length <= 2 &&
    label.secondary.every(id => labels.has(id)) && new Set([label.primary,...label.secondary]).size === label.secondary.length + 1 && bounded(label.reason,1200),
  'KI-Label benoetigt gueltiges Hauptlabel, bis zu zwei verschiedene Nebenlabels und Begruendung.');
  const labelEvidence = evidence(label.evidence ?? result.evidence);
  const checks = result.checks ?? [];
  assert(Array.isArray(checks) && ['source_read','process','numbers','neutrality'].every(name => checks.some(check => check?.name === name && check.passed === true)),
    'Die vier Eigenpruefungen source_read, process, numbers und neutrality fehlen.');
  const common = {status:'completed',method:AI_LOCAL_METHOD,agent:result.agent.trim(),model:result.model.trim(),generatedAt:at,inputHash,
    sourceSignature:analysisSignature(topic),basis:'Lokal gespeicherte Originaltexte',reviewStatus:'not_independently_reviewed',
    coverage:loaded.coverage,coveredSourceIds:[...result.coveredSourceIds],gaps:loaded.gaps || [],
    sourceDocuments:loaded.sources.map(({id,url,title,hash,fetchedAt,method,pages,kind,role,aliases,partial,rawHash}) =>
      ({id,url,title,hash,fetchedAt,method,kind,role,pages:pages.length,partial:partial === true,...(aliases ? {aliases} : {}),...(rawHash ? {rawHash} : {})})),
    checks:checks.filter(check => bounded(check?.name,100)).map(check => ({name:check.name,passed:check.passed === true})),contractVersion:AI_LOCAL_CONTRACT};
  const idFor = kind => hashText([topic.id,kind,inputHash,AI_LOCAL_METHOD,stableLocalJson(result)].join('\n'));
  const summaryId = await idFor('summary'), teaserId = await idFor('teaser'), labelId = await idFor('ai-label');
  const summary = {...common,id:summaryId,shortSummary:result.shortSummary.trim(),longSummary:result.longSummary.map(text => text.trim()),evidence:summaryEvidence};
  const teaser = {...common,id:teaserId,shortSummary:summary.shortSummary,evidence:summaryEvidence};
  const aiLabel = {...common,id:labelId,primary:label.primary,secondary:[...label.secondary],reason:label.reason.trim(),version:LABEL_VERSION,
    classifiedAt:at,sourceUrl:labelEvidence[0].url,basis:'source_content',evidence:labelEvidence};
  const {shortSummary:_short,longSummary:_long,...contentAnalysis} = summary;
  const attempts = {...topic.aiAttempts};delete attempts.summary;delete attempts.aiLabel;delete attempts.teaser;
  const {aiAttempts:_attempts,...prior} = topic;
  return {
    topic:{...prior,shortSummary:summary.shortSummary,longSummary:summary.longSummary,generatedBy:'KI-Zusammenfassung',summaryGeneratedAt:at,
      summaryMethod:AI_LOCAL_METHOD,summaryModel:result.model.trim(),contentAnalysis,labelAssessments:{...topic.labelAssessments,ai:aiLabel},
      ...(Object.keys(attempts).length ? {aiAttempts:attempts} : {}),metadata:{...topic.metadata,version:'article-record-v1',lastProcessedAt:at}},
    analyses:[{kind:'teaser',payload:teaser},{kind:'summary',payload:summary},{kind:'ai-label',payload:aiLabel}],
    usage:{...agentUsage(result.usage),method:AI_LOCAL_METHOD,agent:result.agent.trim(),model:result.model.trim(),kinds:'teaser,summary,aiLabel',
      sources:loaded.sources.length,attachments:loaded.sources.filter(source => source.kind === 'attachment').length,
      words:loaded.sources.reduce((total,source) => total + (source.words || 0),0),outcome:'completed'},
  };
}
