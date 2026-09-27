import type { TopicCard, TopicEvent } from './types';
export const PROCESS_STEPS = ['Tagesordnung', 'Beratung', 'Empfehlung', 'Entscheidung'] as const;
// A proposal or a past meeting date alone does not prove that a debate took place.
export function processStage(topic: TopicCard & {
    events?: TopicEvent[];
}): number {
    if (typeof topic.processStage === 'number')
        return topic.processStage;
    if (topic.status === 'unknown')
        return -1;
    if (topic.status === 'approved' || topic.status === 'rejected')
        return 3;
    if (topic.status === 'recommended')
        return 2;
    const evidence = (topic.events || []).filter(e => e.result?.trim());
    if (evidence.some(e => e.status === 'recommended'))
        return 2;
    if (topic.status === 'info' || evidence.some(e => e.status !== 'postponed' && e.status !== 'announced'))
        return 1;
    return topic.status === 'announced' || topic.events?.length ? 0 : -1;
}
