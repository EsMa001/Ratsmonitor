-- plenara.X Signale (GET /api/x/signale, server/integrations/plenara-x-signals.mjs): Kategorie, Filterwert („Art“) und Stand je
-- Vorgang vorberechnet, damit die Seite nicht je Aufruf die Fakten (topic_facts × report_rules) bis zu 15-mal durchsucht.
-- Gebaut zusammen mit x_cases (server/integrations/x-cases.mjs, Schritt 3 des Jobs rule-texts). Eine Zeile je Vorgang, Signal und
-- Art ('' = ohne Art); phase '' = ohne Stand.
CREATE TABLE IF NOT EXISTS `x_signals` (
	`case_key` text NOT NULL,
	`signal` text NOT NULL,
	`art` text NOT NULL,
	`phase` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_x_signals_signal` ON `x_signals` (`signal`,`case_key`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_x_signals_case` ON `x_signals` (`case_key`);
