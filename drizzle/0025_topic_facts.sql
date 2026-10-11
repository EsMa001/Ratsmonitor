-- Fakten je Bericht für plenara.X (11.10.2026, shared/topic-facts.mjs): kind 'faction' (value Parteifamilie, detail
-- antrag/anfrage) für das Fraktionsprofil, kind 'funding' (value Förderprogramm, detail granted/applied/mentioned) für das
-- Förderradar. Gelesen von server/integrations/analytics-factions.mjs und analytics-funding.mjs über search_cards (dieselben
-- Filter wie die Suche). Gefüllt von scripts/pdf-store/facts.mjs und im Import (refreshSummaries), method nennt die Quelle
-- (title, text) und die Fassung der Regeln. Fällt ein Bericht weg, gehen seine Fakten mit.
CREATE TABLE IF NOT EXISTS `topic_facts` (
  `topic_id` text NOT NULL,
  `kind` text NOT NULL,
  `value` text NOT NULL,
  `detail` text,
  `method` text NOT NULL,
  PRIMARY KEY (`topic_id`,`kind`,`value`)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_topic_facts_kind` ON `topic_facts` (`kind`,`value`);
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_topic_facts_delete` AFTER DELETE ON `topics` BEGIN
  DELETE FROM topic_facts WHERE topic_id=OLD.id;
END;
