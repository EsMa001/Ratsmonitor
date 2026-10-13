-- Schritt 6 (requirements/regel-schritt-plan.md): Grundlage für plenara.X. Je Bericht die Ergebnisse von readReport als
-- Spalten, damit Auswertungen zählen können, ohne den Bericht zu lesen: Vorgang (case_key = Gebiet + normalisierter Titel,
-- titleKey in shared/topic-facts.mjs; gleiche Titel je Gebiet sind ein Vorgang), Art des Punkts, Thema, Unterthemen
-- (durch Komma getrennt) und „Was geschieht“ (shared/stage.mjs). Gefüllt von scripts/pdf-store/read-reports.mjs; bis dahin NULL.
ALTER TABLE `report_rules` ADD COLUMN `case_key` text;
--> statement-breakpoint
ALTER TABLE `report_rules` ADD COLUMN `item_kind` text;
--> statement-breakpoint
ALTER TABLE `report_rules` ADD COLUMN `theme` text;
--> statement-breakpoint
ALTER TABLE `report_rules` ADD COLUMN `subs` text;
--> statement-breakpoint
ALTER TABLE `report_rules` ADD COLUMN `stage` text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_report_rules_theme` ON `report_rules` (`theme`,`stage`) WHERE `item_kind`='subject';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_report_rules_case` ON `report_rules` (`case_key`);
