-- Administration (server/integrations/admin-data.mjs): Kennzahlen je Gebiet werden gespeichert und nur für Gebiete neu
-- berechnet, deren Vorgänge sich geändert haben. Bisher las jede Übersicht alle Vorgänge (bei 900.000 Vorgängen 12 bis
-- 60 Sekunden); während eines Abrufs wirkte kein Zwischenspeicher, weil jede geschriebene Zeile den Datenstand weiterzählt.
-- region_revisions zählt Änderungen je Gebiet (Trigger), region_stats hält die Kennzahlen mit dem Zählerstand ihrer Berechnung.
CREATE TABLE IF NOT EXISTS `region_revisions` (
	`region_id` text PRIMARY KEY NOT NULL,
	`revision` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `region_stats` (
	`region_id` text PRIMARY KEY NOT NULL,
	`revision` integer NOT NULL,
	`computed_at` text NOT NULL,
	`stats` text NOT NULL
);
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS region_revision_topics_insert AFTER INSERT ON topics BEGIN
 INSERT INTO region_revisions(region_id,revision) VALUES(NEW.region_id,1)
 ON CONFLICT(region_id) DO UPDATE SET revision=revision+1;
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS region_revision_topics_update AFTER UPDATE ON topics BEGIN
 INSERT INTO region_revisions(region_id,revision) VALUES(NEW.region_id,1)
 ON CONFLICT(region_id) DO UPDATE SET revision=revision+1;
 INSERT INTO region_revisions(region_id,revision) SELECT OLD.region_id,1 WHERE OLD.region_id IS NOT NEW.region_id
 ON CONFLICT(region_id) DO UPDATE SET revision=revision+1;
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS region_revision_topics_delete AFTER DELETE ON topics BEGIN
 INSERT INTO region_revisions(region_id,revision) VALUES(OLD.region_id,1)
 ON CONFLICT(region_id) DO UPDATE SET revision=revision+1;
END;
--> statement-breakpoint
-- Bestehende Gebiete: Zählerstand 1, noch ohne Kennzahlen; die Administration berechnet sie beim ersten Aufruf schrittweise.
INSERT OR IGNORE INTO region_revisions(region_id,revision) SELECT region_id,1 FROM topics GROUP BY region_id;
--> statement-breakpoint
-- "In den letzten sieben Tagen geändert" wandert mit der Uhr und wird deshalb bei jedem Aufruf gezählt, über diesen Index
-- statt über die gespeicherten Vorgänge.
CREATE INDEX IF NOT EXISTS `idx_topics_canonical_region_updated` ON `topics` (`region_id`,`updated_at`) WHERE json_extract("topics"."payload",'$.identity.mergedInto') IS NULL;
--> statement-breakpoint
PRAGMA optimize;
