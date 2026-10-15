-- plenara.X: Verlauf je Vorgang in x_cases, beim Bau einmal aus dem Zeitstrahl der Karte (topics.payload events) ausgepackt,
-- damit Ausbreitung, Beschlüsse, Ortsvergleich und Beratungswege vollständig rechnen, ohne je Aufruf alle Payloads zu lesen.
-- first_date: erste Sitzung; steps: Stationen „Datum<TAB>Status<TAB>Gremium“ je Zeile, nach Datum (ohne Zeitstrahl die Sitzung der Karte); days: Tage von der ersten
-- Station bis zur Entscheidung (NULL ohne zwei datierte Stationen); vote: unanimous|majority|''; changed: changed|unchanged|''.
-- Gebaut von server/integrations/x-cases.mjs (Schritt 3 des Jobs rule-texts).
ALTER TABLE `x_cases` ADD COLUMN `first_date` text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE `x_cases` ADD COLUMN `steps` text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE `x_cases` ADD COLUMN `days` integer;
--> statement-breakpoint
ALTER TABLE `x_cases` ADD COLUMN `vote` text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE `x_cases` ADD COLUMN `changed` text NOT NULL DEFAULT '';
