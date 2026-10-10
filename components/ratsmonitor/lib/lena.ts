/* Lena: regelbasierte Assistentin (Konzept: docs/produkt/lena-konzept.md).
   Das Verstehen und die Antworten liegen im Backend (shared/lena/, server/integrations/lena.mjs, POST /api/lena).
   Hier nur die festen Texte des Dialogs und die Form der Antwort. */

export const LENA_INTRO =
  "Guten Tag, ich bin Lena. Ich suche Vorgänge und Beschlüsse für Sie, nenne den Stand, erkläre Begriffe und richte Alarme ein. Jede Antwort verweist auf die Originalquelle.";

export const LENA_EXAMPLES = [
  "Was gibt es zu Photovoltaik in Billerbeck?",
  "Wurde der Haushalt in Coesfeld beschlossen?",
  "Wie entwickelt sich Wärmeplanung?",
  "Was bedeutet Vertagung?",
  "Ist Wesel dabei?",
];

export interface LenaSource {
  id: string;
  title: string;
  date: string;
  /** Statuswort der App („Beschlossen“) */
  status: string;
  gemeinde?: string;
  gremium?: string;
  /** Seite des Vorgangs; dort sind die Originalunterlagen verlinkt */
  link: string;
}

export interface LenaAnswer {
  intent: string;
  text: string;
  sources: LenaSource[];
  links: { text: string; link: string }[];
  /** Rückfrage mit Auswahl; jede Option ist die vollständige Frage, die Lena dann beantwortet */
  ask?: { text: string; options: { text: string; question: string }[] };
  parsed: { intent: string; place: string; topic: string; status: string; time: { from: string; to: string } | null; labels: string[] };
}

/** Fragt das Backend; wirft bei Netz- oder Serverfehler mit verständlichem Text */
export async function askLena(q: string, signal: AbortSignal): Promise<LenaAnswer> {
  const r = await fetch("/api/lena", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ q }), signal });
  const d = (await r.json().catch(() => ({}))) as Partial<LenaAnswer> & { error?: string };
  if (!r.ok || typeof d.text !== "string") throw new Error(d.error || "Lena ist gerade nicht erreichbar.");
  return { intent: d.intent ?? "", text: d.text, sources: d.sources ?? [], links: d.links ?? [], ask: d.ask, parsed: d.parsed ?? { intent: "", place: "", topic: "", status: "", time: null, labels: [] } };
}

/** Datum „05.10.26“ aus einem ISO-Tag */
export const germanDate = (iso: string) => (/^\d{4}-\d{2}-\d{2}/.test(iso) ? iso.slice(8, 10) + "." + iso.slice(5, 7) + "." + iso.slice(2, 4) : "");
