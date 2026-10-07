-- Protokoll ersetzter und gelöschter Suchkarten. Die Wortliste der Suche (server/integrations/search-words.mjs) zieht beim
-- Nachführen die protokollierten Karten ab, statt die vorberechneten Zahlen (hits_city/_district, search_word_areas,
-- search_word_facets) bei jeder ersetzten Karte zu verwerfen; danach leert sie das Protokoll. card_rowid ist die rowid der
-- alten Fassung in search_cards: bis zur zuletzt gezählten rowid war sie gezählt, dahinter nie.
-- Die Trigger sind die aus 0014 (insert, update) und 0006 (delete), jeweils mit dem Protokolleintrag als erstem Schritt.
CREATE TABLE IF NOT EXISTS `search_cards_gone` (
	`card_rowid` integer NOT NULL,
	`id` text NOT NULL,
	`region_id` text NOT NULL,
	`label` text NOT NULL,
	`status` text NOT NULL,
	`search` text NOT NULL
);
--> statement-breakpoint
DROP TRIGGER IF EXISTS `trg_search_cards_insert`;
--> statement-breakpoint
CREATE TRIGGER `trg_search_cards_insert` AFTER INSERT ON `topics` BEGIN
  INSERT INTO search_cards_gone (card_rowid,id,region_id,label,status,search) SELECT rowid,id,region_id,label,status,search FROM search_cards WHERE id=NEW.id;
  INSERT OR REPLACE INTO search_cards (id,region_id,date,status,label,title,teaser,gremium,search,search_exact)
  SELECT NEW.id, NEW.region_id, substr(NEW.event_date,1,10), NEW.status, CASE WHEN json_extract(NEW.payload,'$.classification.version')='labels-v2' AND json_extract(NEW.payload,'$.classification.method')='title-rules-v2' AND json_extract(NEW.payload,'$.classification.evidence')=coalesce(nullif(json_extract(NEW.payload,'$.officialTitle'),''),json_extract(NEW.payload,'$.title'),'') THEN coalesce(json_extract(NEW.payload,'$.classification.primary'),'unklar') ELSE 'unklar' END, substr(coalesce(json_extract(NEW.payload,'$.title'),''),1,1000), substr(coalesce(json_extract(NEW.payload,'$.shortSummary'),''),1,1200), coalesce(json_extract(NEW.payload,'$.committee'),''), lower(replace(replace(replace(replace(replace(replace(replace(substr(coalesce(json_extract(NEW.payload,'$.title'),''),1,1000)||' '||substr(coalesce(json_extract(NEW.payload,'$.shortSummary'),''),1,1200)||' '||coalesce(json_extract(NEW.payload,'$.committee'),'')||' '||CASE WHEN json_extract(NEW.payload,'$.generatedBy') LIKE 'KI-Zusammenfassung%' THEN substr(coalesce((SELECT group_concat(l.value,' ') FROM json_each(NEW.payload,'$.longSummary') l),''),1,3000) ELSE '' END||' '||CASE WHEN json_extract(NEW.payload,'$.weightedKeywords.status')='completed' THEN coalesce((SELECT group_concat(json_extract(k.value,'$.term'),' ') FROM json_each(NEW.payload,'$.weightedKeywords.items') k),'') ELSE '' END,'Ä','a'),'Ö','o'),'Ü','u'),'ä','a'),'ö','o'),'ü','u'),'ß','ss')), lower(replace(replace(replace(substr(coalesce(json_extract(NEW.payload,'$.title'),''),1,1000)||' '||substr(coalesce(json_extract(NEW.payload,'$.shortSummary'),''),1,1200)||' '||coalesce(json_extract(NEW.payload,'$.committee'),'')||' '||CASE WHEN json_extract(NEW.payload,'$.generatedBy') LIKE 'KI-Zusammenfassung%' THEN substr(coalesce((SELECT group_concat(l.value,' ') FROM json_each(NEW.payload,'$.longSummary') l),''),1,3000) ELSE '' END||' '||CASE WHEN json_extract(NEW.payload,'$.weightedKeywords.status')='completed' THEN coalesce((SELECT group_concat(json_extract(k.value,'$.term'),' ') FROM json_each(NEW.payload,'$.weightedKeywords.items') k),'') ELSE '' END,'Ä','ä'),'Ö','ö'),'Ü','ü')) WHERE json_extract(NEW.payload,'$.identity.mergedInto') IS NULL;
END;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `trg_search_cards_update`;
--> statement-breakpoint
CREATE TRIGGER `trg_search_cards_update` AFTER UPDATE ON `topics`
  WHEN OLD.region_id IS NOT NEW.region_id
    OR OLD.event_date IS NOT NEW.event_date
    OR OLD.status IS NOT NEW.status
    OR json_extract(OLD.payload,'$.title') IS NOT json_extract(NEW.payload,'$.title')
    OR json_extract(OLD.payload,'$.shortSummary') IS NOT json_extract(NEW.payload,'$.shortSummary')
    OR json_extract(OLD.payload,'$.longSummary') IS NOT json_extract(NEW.payload,'$.longSummary')
    OR json_extract(OLD.payload,'$.generatedBy') IS NOT json_extract(NEW.payload,'$.generatedBy')
    OR json_extract(OLD.payload,'$.committee') IS NOT json_extract(NEW.payload,'$.committee')
    OR json_extract(OLD.payload,'$.officialTitle') IS NOT json_extract(NEW.payload,'$.officialTitle')
    OR json_extract(OLD.payload,'$.identity.mergedInto') IS NOT json_extract(NEW.payload,'$.identity.mergedInto')
    OR json_extract(OLD.payload,'$.classification.version') IS NOT json_extract(NEW.payload,'$.classification.version')
    OR json_extract(OLD.payload,'$.classification.method') IS NOT json_extract(NEW.payload,'$.classification.method')
    OR json_extract(OLD.payload,'$.classification.evidence') IS NOT json_extract(NEW.payload,'$.classification.evidence')
    OR json_extract(OLD.payload,'$.classification.primary') IS NOT json_extract(NEW.payload,'$.classification.primary')
    OR json_extract(OLD.payload,'$.weightedKeywords.status') IS NOT json_extract(NEW.payload,'$.weightedKeywords.status')
    OR json_extract(OLD.payload,'$.weightedKeywords.items') IS NOT json_extract(NEW.payload,'$.weightedKeywords.items')
BEGIN
  INSERT INTO search_cards_gone (card_rowid,id,region_id,label,status,search) SELECT rowid,id,region_id,label,status,search FROM search_cards WHERE id=NEW.id OR id=OLD.id;
  DELETE FROM search_cards WHERE id=NEW.id OR id=OLD.id;
  INSERT OR REPLACE INTO search_cards (id,region_id,date,status,label,title,teaser,gremium,search,search_exact)
  SELECT NEW.id, NEW.region_id, substr(NEW.event_date,1,10), NEW.status, CASE WHEN json_extract(NEW.payload,'$.classification.version')='labels-v2' AND json_extract(NEW.payload,'$.classification.method')='title-rules-v2' AND json_extract(NEW.payload,'$.classification.evidence')=coalesce(nullif(json_extract(NEW.payload,'$.officialTitle'),''),json_extract(NEW.payload,'$.title'),'') THEN coalesce(json_extract(NEW.payload,'$.classification.primary'),'unklar') ELSE 'unklar' END, substr(coalesce(json_extract(NEW.payload,'$.title'),''),1,1000), substr(coalesce(json_extract(NEW.payload,'$.shortSummary'),''),1,1200), coalesce(json_extract(NEW.payload,'$.committee'),''), lower(replace(replace(replace(replace(replace(replace(replace(substr(coalesce(json_extract(NEW.payload,'$.title'),''),1,1000)||' '||substr(coalesce(json_extract(NEW.payload,'$.shortSummary'),''),1,1200)||' '||coalesce(json_extract(NEW.payload,'$.committee'),'')||' '||CASE WHEN json_extract(NEW.payload,'$.generatedBy') LIKE 'KI-Zusammenfassung%' THEN substr(coalesce((SELECT group_concat(l.value,' ') FROM json_each(NEW.payload,'$.longSummary') l),''),1,3000) ELSE '' END||' '||CASE WHEN json_extract(NEW.payload,'$.weightedKeywords.status')='completed' THEN coalesce((SELECT group_concat(json_extract(k.value,'$.term'),' ') FROM json_each(NEW.payload,'$.weightedKeywords.items') k),'') ELSE '' END,'Ä','a'),'Ö','o'),'Ü','u'),'ä','a'),'ö','o'),'ü','u'),'ß','ss')), lower(replace(replace(replace(substr(coalesce(json_extract(NEW.payload,'$.title'),''),1,1000)||' '||substr(coalesce(json_extract(NEW.payload,'$.shortSummary'),''),1,1200)||' '||coalesce(json_extract(NEW.payload,'$.committee'),'')||' '||CASE WHEN json_extract(NEW.payload,'$.generatedBy') LIKE 'KI-Zusammenfassung%' THEN substr(coalesce((SELECT group_concat(l.value,' ') FROM json_each(NEW.payload,'$.longSummary') l),''),1,3000) ELSE '' END||' '||CASE WHEN json_extract(NEW.payload,'$.weightedKeywords.status')='completed' THEN coalesce((SELECT group_concat(json_extract(k.value,'$.term'),' ') FROM json_each(NEW.payload,'$.weightedKeywords.items') k),'') ELSE '' END,'Ä','ä'),'Ö','ö'),'Ü','ü')) WHERE json_extract(NEW.payload,'$.identity.mergedInto') IS NULL;
END;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `trg_search_cards_delete`;
--> statement-breakpoint
CREATE TRIGGER `trg_search_cards_delete` AFTER DELETE ON `topics` BEGIN
  INSERT INTO search_cards_gone (card_rowid,id,region_id,label,status,search) SELECT rowid,id,region_id,label,status,search FROM search_cards WHERE id=OLD.id;
  DELETE FROM search_cards WHERE id=OLD.id;
END;
