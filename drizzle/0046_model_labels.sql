-- Antworten des Modells je Bericht (requirements/modell-konzept.md, neun Fragen im Begriffsbuch requirements/begriffsbuch-kern.md).
-- Geschrieben vom Schritt „Modell anwenden“ (scripts/model/apply.mjs) im Job „Themen & Texte“, gelesen von readReport (Haupt-
-- dokument, Art, Thema, Unterthemen, Vorgangsart statt der Regeln), der Suche (wirksamer Status) und plenara.X. model: Fassung
-- Encoder+Köpfe (shared/model-manifest.json), key: Prüfsumme der Eingaben; gleiche Fassung und gleicher Schlüssel heißt: nichts neu.
-- *_p: Wahrscheinlichkeit der Antwort (ab 0,7 sicher). Listen als JSON. Ohne Zeile gilt der Bericht als noch nicht eingeordnet.
CREATE TABLE IF NOT EXISTS `model_labels` (
  `topic_id` text PRIMARY KEY NOT NULL,
  `model` text NOT NULL,
  `key` text NOT NULL,
  `kind` text NOT NULL,
  `kind_p` real NOT NULL,
  `status` text NOT NULL,
  `status_p` real NOT NULL,
  `themes` text NOT NULL DEFAULT '[]',
  `theme_p` real NOT NULL DEFAULT 0,
  `subs` text NOT NULL DEFAULT '[]',
  `subsubs` text NOT NULL DEFAULT '[]',
  `process` text,
  `process_p` real NOT NULL DEFAULT 0,
  `project` integer,
  `step` text,
  `service` text,
  `applicants` text NOT NULL DEFAULT '[]',
  `main_url` text,
  `result_url` text,
  `doctypes` text NOT NULL DEFAULT '[]',
  `at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_model_labels_model` ON `model_labels` (`model`);
