-- Ereignisse für die Benachrichtigungen (requirements/benachrichtigungen-konzept.md): Der Import (server/services/sync.ts)
-- schreibt je neuem Bericht ('new') und je neuem Status oder neuer Sitzung eines vorhandenen ('change') eine Zeile. Der Job
-- notify (scripts/accounts/notify.mjs) liest sie nur und prüft damit die gespeicherten Suchen und gefolgten Artikel.
-- Der Import löscht Zeilen nach 14 Tagen (NOTIFY_KEEP_MS in server/integrations/notify-events.mjs).
CREATE TABLE `notify_events` (
	`seq` integer PRIMARY KEY AUTOINCREMENT,
	`at` text NOT NULL,
	`topic_id` text NOT NULL,
	`region_id` text NOT NULL,
	`kind` text NOT NULL,
	`date` text,
	`status` text,
	`prev_status` text,
	`detail` text
);
--> statement-breakpoint
CREATE INDEX `idx_notify_events_at` ON `notify_events` (`at`);
