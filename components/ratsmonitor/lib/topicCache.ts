import type { TopicDetail } from "@/shared/types";

/** Vorgänge der Detailseite, eine Minute im Browser gehalten: Überfahren oder Antippen einer Trefferzeile lädt vor
 *  (prefetchDetail), der Klick findet den Vorgang dann schon vor, und die Rückkehr zur selben Seite lädt nicht neu.
 *  Fehlgeschlagene Abrufe werden nicht gehalten. */
const TTL_MS = 60000, MAX = 40;
const kept = new Map<string, { at: number; job: Promise<TopicDetail> }>();
export class TopicError extends Error {}
export function loadTopic(id: string): Promise<TopicDetail> {
  const hit = kept.get(id);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.job;
  const job = fetch("/api/topics/" + encodeURIComponent(id)).then(async (r) => {
    if (!r.ok) throw new TopicError(r.status === 404 ? "Dieser Vorgang wurde nicht gefunden." : "Der Vorgang konnte nicht geladen werden.");
    return r.json() as Promise<TopicDetail>;
  });
  job.catch(() => { if (kept.get(id)?.job === job) kept.delete(id); });
  kept.set(id, { at: Date.now(), job });
  while (kept.size > MAX) kept.delete(kept.keys().next().value as string);
  return job;
}
/** Vorladen für die Detailseite: der Vorgang und das Modul der Seite (sie wird erst bei Bedarf geladen, App.tsx). */
export function prefetchDetail(id: string) {
  void loadTopic(id).catch(() => {});
  void import("../pages/DetailPage").catch(() => {});
}
