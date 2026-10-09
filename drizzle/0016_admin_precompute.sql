-- Werte je Gebiet für die Administration (server/integrations/region-facts.mjs): Tage nach Sitzungstag (mit den
-- Spalten der Hochrechnung) und nach Aufnahmetag, Zählung nach Status. Wie region_stats nur für Gebiete neu
-- gerechnet, deren region_revisions sich geändert hat; Seitenaufrufe lesen nur.
CREATE TABLE IF NOT EXISTS `region_series` (
	`region_id` text PRIMARY KEY NOT NULL,
	`revision` integer NOT NULL,
	`v` integer NOT NULL,
	`computed_at` text NOT NULL,
	`event_days` text NOT NULL,
	`import_days` text NOT NULL,
	`statuses` text NOT NULL
);
--> statement-breakpoint
-- Teilsummen laufender Bauaufträge (Stichwörter, server/integrations/admin-builds.mjs); nach Abschluss geleert.
-- list: 'terms' | 'subjects' | 'ai' | 'rule'; g: bei 'rule' das Label; a, b, c: Gewicht und Grundlagen bei 'ai'.
CREATE TABLE IF NOT EXISTS `admin_agg` (
	`build` text NOT NULL,
	`list` text NOT NULL,
	`g` text NOT NULL DEFAULT '',
	`k` text NOT NULL,
	`n` integer NOT NULL DEFAULT 0,
	`a` real NOT NULL DEFAULT 0,
	`b` integer NOT NULL DEFAULT 0,
	`c` real NOT NULL DEFAULT 0,
	PRIMARY KEY(`build`,`list`,`g`,`k`)
) WITHOUT ROWID;
--> statement-breakpoint
-- Letzte Läufe der Administration (ORDER BY started_at DESC LIMIT 30) und Protokoll je Gebiet (import-trace.mjs) ohne
-- Sortieren aller Läufe.
CREATE INDEX IF NOT EXISTS `idx_import_runs_started` ON `import_runs` (`started_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_import_runs_region` ON `import_runs` (json_extract(`details`,'$.region'),`started_at`);
