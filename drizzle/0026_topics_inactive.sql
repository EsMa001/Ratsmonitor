-- Teilindex für zusammengeführte Vorgänge (12.10.2026): Die Qualitätsprüfungen mergeTargetMissing und mergeChain
-- (server/integrations/quality-check.mjs) lesen nur active=0 (etwa 1 % der Zeilen), mussten aber die ganze Tabelle samt
-- payload durchgehen (lokal 950.825 Vorgänge, 12 GB, je Prüfung etwa 23 s). Mit dem Index nur die betroffenen Zeilen.
CREATE INDEX IF NOT EXISTS `idx_topics_inactive` ON `topics` (`id`) WHERE `active`=0;
