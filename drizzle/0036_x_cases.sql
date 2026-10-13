-- plenara.X (GET /api/x, server/integrations/plenara-x-query.mjs): eine schmale Zeile je Vorgang statt über alle Karten zu zählen.
-- Über search_cards (mit Suchtexten) braucht jede Zählung lokal 1 bis 4 Minuten; über diese Tabelle Bruchteile einer Sekunde.
-- Gebaut von server/integrations/x-cases.mjs (scripts/plenara-x/build-x-cases.mjs, Schritt 3 des Jobs rule-texts), nie im Import.
-- Je Vorgang (report_rules.case_key; ungelesen: Gebiet + Titel) nur Sachpunkte bis zum Bautag, Werte der Karte mit der letzten
-- Sitzung: Gebiet, Datum und Monat, Thema (Label der Karte), „Was geschieht“ ('' = ungelesen), Unterthemen (durch Komma
-- getrennt), Status, Karte, Zahl der Karten, ungelesen ja/nein.
CREATE TABLE IF NOT EXISTS `x_cases` (
	`case_key` text PRIMARY KEY NOT NULL,
	`region_id` text NOT NULL,
	`date` text NOT NULL,
	`month` text NOT NULL,
	`label` text NOT NULL,
	`stage` text NOT NULL,
	`subs` text NOT NULL,
	`status` text NOT NULL,
	`card_id` text NOT NULL,
	`cards` integer NOT NULL,
	`unread` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_x_cases_region` ON `x_cases` (`region_id`,`date`);
