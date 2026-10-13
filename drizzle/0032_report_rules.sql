-- Stand der regelbasierten Auswertung je Bericht (scripts/pdf-store/read-reports.mjs, readReport in
-- server/integrations/report-rules.mjs): key fasst alle Eingaben zusammen (Regelfassungen, Titel, Hauptdokument,
-- Sitzungsunterlage, Textstand); gleicher Schlüssel heißt, nichts neu zu rechnen. Ersetzt facts_keys der PDF-Ablage und
-- ruleSummaryTried im Bericht. summary_issue: warum es keine Regel-Zusammenfassung gibt (no-document, session-document,
-- no-text, too-long, unreadable, no-summary), sonst NULL.
CREATE TABLE IF NOT EXISTS `report_rules` (
  `topic_id` text PRIMARY KEY NOT NULL,
  `key` text NOT NULL,
  `version` text NOT NULL,
  `summary_issue` text,
  `read_at` text NOT NULL
);
