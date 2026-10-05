-- Prüfliste der Administration (server/integrations/admin-data.mjs, adminReview): die 25 zuletzt geänderten Vorgänge
-- mit einem Prüfgrund über alle Gebiete. Ohne Index auf dem Änderungsdatum las SQLite jeden Vorgang und sortierte
-- (13 s bei 900.000 Vorgängen); mit ihm liest es vom neuesten an und hört nach 25 Treffern auf.
CREATE INDEX IF NOT EXISTS `idx_topics_canonical_updated` ON `topics` (`updated_at`) WHERE json_extract("topics"."payload",'$.identity.mergedInto') IS NULL;
