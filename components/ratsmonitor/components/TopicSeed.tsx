'use client';
import type { TopicDetail } from "@/shared/types";
import { seedTopic } from "../lib/topicCache";

/** Legt den vom Server gelesenen Vorgang vor der Detailseite in den Zwischenspeicher (beim Rendern, auf Server und im Browser),
 *  damit DetailPage ihn schon im ersten Rendern zeigt. null: den Vorgang gibt es nicht. */
export function TopicSeed({ id, topic }: { id: string; topic: TopicDetail | null }) {
  seedTopic(id, topic);
  return null;
}
