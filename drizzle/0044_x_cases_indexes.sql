-- plenara.X: Indizes für die Auswahl in x_cases (Zeitraum, Thema), damit source() nicht alle Vorgänge lesen muss,
-- wenn eine Seite nach Zeitraum („bis heute“, Newsradar, Trends) oder Thema einschränkt. Ändert keine Ergebnisse.
CREATE INDEX IF NOT EXISTS `idx_x_cases_date` ON `x_cases` (`date`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_x_cases_label` ON `x_cases` (`label`);
