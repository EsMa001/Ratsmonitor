-- Aktiver (nicht zusammengeführter) Vorgang als Spalte statt als JSON-Ausdruck an jeder Abfrage. Die Spalte ist generiert
-- (VIRTUAL): sie belegt keinen Platz und folgt identity.mergedInto im Payload von selbst. Abfragen schreiben active=1
-- (bzw. active=0 für zusammengeführte Vorgänge); die Teilindizes aus 0002, 0011 und 0012 behalten ihre Namen (admin-data.mjs
-- erzwingt einen per INDEXED BY) und hängen jetzt an active=1, deshalb müssen Abfragen genau active=1 schreiben.
ALTER TABLE `topics` ADD COLUMN `active` integer GENERATED ALWAYS AS (json_extract(`payload`,'$.identity.mergedInto') IS NULL) VIRTUAL;
--> statement-breakpoint
DROP INDEX IF EXISTS `idx_topics_canonical_region_status`;
--> statement-breakpoint
CREATE INDEX `idx_topics_canonical_region_status` ON `topics` (`region_id`,`status`) WHERE active=1;
--> statement-breakpoint
DROP INDEX IF EXISTS `idx_topics_canonical_updated`;
--> statement-breakpoint
CREATE INDEX `idx_topics_canonical_updated` ON `topics` (`updated_at`) WHERE active=1;
--> statement-breakpoint
DROP INDEX IF EXISTS `idx_topics_canonical_region_updated`;
--> statement-breakpoint
CREATE INDEX `idx_topics_canonical_region_updated` ON `topics` (`region_id`,`updated_at`) WHERE active=1;
