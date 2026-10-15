-- plenara.X: Fraktionen je Vorgang in x_cases, beim Bau einmal aus den Fakten aller Karten des Vorgangs (topic_facts über
-- report_rules.case_key), damit das Fraktionsprofil nur noch zählt. factions: „Fraktion<TAB>antrag|anfrage“ je Zeile;
-- faction_advice: 1, wenn eine Karte des Vorgangs empfiehlt, dem Antrag nicht zu folgen.
ALTER TABLE `x_cases` ADD COLUMN `factions` text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE `x_cases` ADD COLUMN `faction_advice` integer NOT NULL DEFAULT 0;
