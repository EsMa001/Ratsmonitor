-- Fehlerspeicher (requirements/betriebsplan-konzept.md, Abschnitt 4; server/integrations/work-failures.mjs): ein Eintrag je
-- Schritt und Gegenstand, der in der Tagespipeline oder im Bestandsaufbau scheiterte. Die Klasse des Abbruchgrunds bestimmt,
-- wann der Job „nacharbeit“ ihn erneut versucht (next_try_at; NULL = endgültig, außer internal nach einem neuen Programmstand).
-- step: import (Gebiet), pdf (Adresse), text, ocr, ocr-fetch (Prüfsumme), rules (Bericht). origin: daily | backlog.
CREATE TABLE IF NOT EXISTS `work_failures` (
	`step` text NOT NULL,
	`key` text NOT NULL,
	`host` text,
	`class` text NOT NULL,
	`reason` text,
	`http` integer,
	`tries` integer NOT NULL DEFAULT 1,
	`first_at` text NOT NULL,
	`last_at` text NOT NULL,
	`next_try_at` text,
	`event_date` text,
	`origin` text NOT NULL DEFAULT 'daily',
	`release` text,
	PRIMARY KEY(`step`,`key`)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_work_failures_due` ON `work_failures` (`next_try_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_work_failures_host` ON `work_failures` (`host`);
--> statement-breakpoint
-- Stufe je Server (Host einer Adresse oder Servergruppe des Imports): ok, bremsen (vorübergehend, Wartezeit wächst), gesperrt
-- (Zugriff verweigert), pruefen (keine automatische Wiedervorlage mehr). level: Stufe der Wartezeit, fails: Fehler in Folge.
CREATE TABLE IF NOT EXISTS `source_hosts` (
	`host` text PRIMARY KEY NOT NULL,
	`state` text NOT NULL DEFAULT 'ok',
	`fails` integer NOT NULL DEFAULT 0,
	`level` integer NOT NULL DEFAULT 0,
	`next_try_at` text,
	`last_ok_at` text,
	`last_fail_at` text,
	`reason` text,
	`updated_at` text NOT NULL
);
