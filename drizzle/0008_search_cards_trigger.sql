-- Suchkarten nur neu schreiben, wenn sich suchrelevante Felder ändern (nicht bei reinen Metadaten-Updates)
DROP TRIGGER IF EXISTS `trg_search_cards_update`;
--> statement-breakpoint
CREATE TRIGGER `trg_search_cards_update` AFTER UPDATE ON `topics`
  WHEN OLD.region_id IS NOT NEW.region_id
    OR OLD.event_date IS NOT NEW.event_date
    OR OLD.status IS NOT NEW.status
    OR json_extract(OLD.payload,'$.title') IS NOT json_extract(NEW.payload,'$.title')
    OR json_extract(OLD.payload,'$.shortSummary') IS NOT json_extract(NEW.payload,'$.shortSummary')
    OR json_extract(OLD.payload,'$.committee') IS NOT json_extract(NEW.payload,'$.committee')
    OR json_extract(OLD.payload,'$.officialTitle') IS NOT json_extract(NEW.payload,'$.officialTitle')
    OR json_extract(OLD.payload,'$.identity.mergedInto') IS NOT json_extract(NEW.payload,'$.identity.mergedInto')
    OR json_extract(OLD.payload,'$.classification.version') IS NOT json_extract(NEW.payload,'$.classification.version')
    OR json_extract(OLD.payload,'$.classification.method') IS NOT json_extract(NEW.payload,'$.classification.method')
    OR json_extract(OLD.payload,'$.classification.evidence') IS NOT json_extract(NEW.payload,'$.classification.evidence')
    OR json_extract(OLD.payload,'$.classification.primary') IS NOT json_extract(NEW.payload,'$.classification.primary')
BEGIN
  DELETE FROM search_cards WHERE id=NEW.id OR id=OLD.id;
  INSERT OR REPLACE INTO search_cards (id,region_id,date,status,label,title,teaser,gremium,search)
  SELECT NEW.id, NEW.region_id, substr(NEW.event_date,1,10), NEW.status, CASE WHEN json_extract(NEW.payload,'$.classification.version')='labels-v2' AND json_extract(NEW.payload,'$.classification.method')='title-rules-v2' AND json_extract(NEW.payload,'$.classification.evidence')=coalesce(nullif(json_extract(NEW.payload,'$.officialTitle'),''),json_extract(NEW.payload,'$.title'),'') THEN coalesce(json_extract(NEW.payload,'$.classification.primary'),'unklar') ELSE 'unklar' END, substr(coalesce(json_extract(NEW.payload,'$.title'),''),1,1000), substr(coalesce(json_extract(NEW.payload,'$.shortSummary'),''),1,1200), coalesce(json_extract(NEW.payload,'$.committee'),''), lower(replace(replace(replace(replace(replace(replace(replace(substr(coalesce(json_extract(NEW.payload,'$.title'),''),1,1000)||' '||substr(coalesce(json_extract(NEW.payload,'$.shortSummary'),''),1,1200)||' '||coalesce(json_extract(NEW.payload,'$.committee'),''),'Ä','a'),'Ö','o'),'Ü','u'),'ä','a'),'ö','o'),'ü','u'),'ß','ss')) WHERE json_extract(NEW.payload,'$.identity.mergedInto') IS NULL;
END;
