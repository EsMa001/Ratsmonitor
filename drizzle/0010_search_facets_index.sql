-- Suche (server/integrations/monitor-search.mjs): Gesamtzahl und Zähler nach Gebiet, Thema und Status entstehen aus einer
-- Gruppierung. Der Index deckt sie ab und folgt ihrer Reihenfolge; bei 900.000 Karten 150 ms statt vier Läufen über die
-- Tabelle (je 0,7 bis 1,2 s). Er beginnt mit region_id und ersetzt damit idx_search_cards_region.
CREATE INDEX IF NOT EXISTS `idx_search_cards_facets` ON `search_cards` (`region_id`,`label`,`status`,`date`);
--> statement-breakpoint
DROP INDEX IF EXISTS `idx_search_cards_region`;
--> statement-breakpoint
PRAGMA optimize;
