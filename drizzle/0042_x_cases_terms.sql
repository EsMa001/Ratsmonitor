-- plenara.X: Begriffe je Vorgang in x_cases, beim Bau einmal aus dem Titel der Karte (server/integrations/x-terms.mjs), damit
-- Themennetz, Ortsvergleich und Trends nur noch zählen, statt je Aufruf alle Titel aus search_cards zu holen und zu zerlegen.
-- terms: „Schlüssel<TAB>Wort“ je Zeile; private_build: 1 bei privatem Bauantrag (zählt in Trends nicht).
ALTER TABLE `x_cases` ADD COLUMN `terms` text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE `x_cases` ADD COLUMN `private_build` integer NOT NULL DEFAULT 0;
