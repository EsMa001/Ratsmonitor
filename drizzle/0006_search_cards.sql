-- Materialisierte Suchkarten: entlastet die Suche vom JSON-Parsen der Payloads.
-- Die Label-Versionen 'labels-v2'/'title-rules-v2' sind hier bewusst fest verdrahtet
-- (siehe shared/labels.mjs); bei einem Versionswechsel Trigger neu anlegen und Backfill wiederholen.
CREATE TABLE `search_cards` (
	`id` text PRIMARY KEY NOT NULL,
	`region_id` text NOT NULL,
	`date` text NOT NULL,
	`status` text NOT NULL,
	`label` text NOT NULL,
	`title` text NOT NULL,
	`teaser` text NOT NULL,
	`gremium` text NOT NULL,
	`search` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_search_cards_region` ON `search_cards` (`region_id`);
--> statement-breakpoint
CREATE INDEX `idx_search_cards_date` ON `search_cards` (`date`);
--> statement-breakpoint
CREATE INDEX `idx_search_cards_status` ON `search_cards` (`status`);
--> statement-breakpoint
CREATE INDEX `idx_search_cards_label` ON `search_cards` (`label`);
--> statement-breakpoint
CREATE TRIGGER `trg_search_cards_insert` AFTER INSERT ON `topics` BEGIN
  INSERT OR REPLACE INTO search_cards (id,region_id,date,status,label,title,teaser,gremium,search)
  SELECT NEW.id, NEW.region_id, substr(NEW.event_date,1,10), NEW.status, CASE WHEN json_extract(NEW.payload,'$.classification.version')='labels-v2' AND json_extract(NEW.payload,'$.classification.method')='title-rules-v2' AND json_extract(NEW.payload,'$.classification.evidence')=coalesce(nullif(json_extract(NEW.payload,'$.officialTitle'),''),json_extract(NEW.payload,'$.title'),'') THEN coalesce(json_extract(NEW.payload,'$.classification.primary'),'unklar') ELSE 'unklar' END, substr(coalesce(json_extract(NEW.payload,'$.title'),''),1,1000), substr(coalesce(json_extract(NEW.payload,'$.shortSummary'),''),1,1200), coalesce(json_extract(NEW.payload,'$.committee'),''), lower(replace(replace(replace(replace(replace(replace(replace(substr(coalesce(json_extract(NEW.payload,'$.title'),''),1,1000)||' '||substr(coalesce(json_extract(NEW.payload,'$.shortSummary'),''),1,1200)||' '||coalesce(json_extract(NEW.payload,'$.committee'),''),'Ä','a'),'Ö','o'),'Ü','u'),'ä','a'),'ö','o'),'ü','u'),'ß','ss')) WHERE json_extract(NEW.payload,'$.identity.mergedInto') IS NULL;
END;
--> statement-breakpoint
CREATE TRIGGER `trg_search_cards_update` AFTER UPDATE ON `topics` BEGIN
  DELETE FROM search_cards WHERE id=NEW.id OR id=OLD.id;
  INSERT OR REPLACE INTO search_cards (id,region_id,date,status,label,title,teaser,gremium,search)
  SELECT NEW.id, NEW.region_id, substr(NEW.event_date,1,10), NEW.status, CASE WHEN json_extract(NEW.payload,'$.classification.version')='labels-v2' AND json_extract(NEW.payload,'$.classification.method')='title-rules-v2' AND json_extract(NEW.payload,'$.classification.evidence')=coalesce(nullif(json_extract(NEW.payload,'$.officialTitle'),''),json_extract(NEW.payload,'$.title'),'') THEN coalesce(json_extract(NEW.payload,'$.classification.primary'),'unklar') ELSE 'unklar' END, substr(coalesce(json_extract(NEW.payload,'$.title'),''),1,1000), substr(coalesce(json_extract(NEW.payload,'$.shortSummary'),''),1,1200), coalesce(json_extract(NEW.payload,'$.committee'),''), lower(replace(replace(replace(replace(replace(replace(replace(substr(coalesce(json_extract(NEW.payload,'$.title'),''),1,1000)||' '||substr(coalesce(json_extract(NEW.payload,'$.shortSummary'),''),1,1200)||' '||coalesce(json_extract(NEW.payload,'$.committee'),''),'Ä','a'),'Ö','o'),'Ü','u'),'ä','a'),'ö','o'),'ü','u'),'ß','ss')) WHERE json_extract(NEW.payload,'$.identity.mergedInto') IS NULL;
END;
--> statement-breakpoint
CREATE TRIGGER `trg_search_cards_delete` AFTER DELETE ON `topics` BEGIN
  DELETE FROM search_cards WHERE id=OLD.id;
END;
--> statement-breakpoint
INSERT OR REPLACE INTO search_cards (id,region_id,date,status,label,title,teaser,gremium,search)
SELECT topics.id, topics.region_id, substr(topics.event_date,1,10), topics.status, CASE WHEN json_extract(topics.payload,'$.classification.version')='labels-v2' AND json_extract(topics.payload,'$.classification.method')='title-rules-v2' AND json_extract(topics.payload,'$.classification.evidence')=coalesce(nullif(json_extract(topics.payload,'$.officialTitle'),''),json_extract(topics.payload,'$.title'),'') THEN coalesce(json_extract(topics.payload,'$.classification.primary'),'unklar') ELSE 'unklar' END, substr(coalesce(json_extract(topics.payload,'$.title'),''),1,1000), substr(coalesce(json_extract(topics.payload,'$.shortSummary'),''),1,1200), coalesce(json_extract(topics.payload,'$.committee'),''), lower(replace(replace(replace(replace(replace(replace(replace(substr(coalesce(json_extract(topics.payload,'$.title'),''),1,1000)||' '||substr(coalesce(json_extract(topics.payload,'$.shortSummary'),''),1,1200)||' '||coalesce(json_extract(topics.payload,'$.committee'),''),'Ä','a'),'Ö','o'),'Ü','u'),'ä','a'),'ö','o'),'ü','u'),'ß','ss'))
FROM topics WHERE json_extract(topics.payload,'$.identity.mergedInto') IS NULL;
