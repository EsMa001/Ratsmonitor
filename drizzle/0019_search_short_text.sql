-- Suchkarten (Entscheidung 11.10.2026): Gesucht wird nur, was die Trefferliste zeigt, also Überschrift, Kurztext und Gremium.
-- Der Kurztext (teaser) folgt der Artikelseite (DetailPage.tsx): KI-Kurzfassung, sonst die kurze Regel-Zusammenfassung
-- (ruleSummary.short), sonst der automatische Quellenüberblick (shortSummary). Die lange Fassung (auch die der KI) und die
-- KI-Stichwörter (weightedKeywords) stehen nicht mehr im Suchtext; die Stichwörter entfallen ganz.
-- Ablauf: Trigger wie in 0017 mit diesen Änderungen; Stichwörter aus dem Payload entfernen; Kurztext und Suchtexte aller
-- Karten in einem Durchgang neu schreiben (ändert sich bei fast jeder Karte, deshalb nicht über die Trigger und das
-- Protokoll); Protokoll leeren und den Stand der Wortliste löschen, damit sie voll neu aufgebaut wird
-- (node scripts/refresh-search-words.mjs, ohne Stand baut es voll auf; bis dahin sucht die App ohne Wortliste); Datenstand
-- der Suche (und den allgemeinen) erhöhen, damit Zwischenspeicher und Blättern neu lesen. Der Delete-Trigger bleibt unverändert.
-- Zeilen der Art 'keywords' in article_analyses und alte Fassungen in article_versions bleiben unberührt.
DROP TRIGGER IF EXISTS `trg_search_cards_insert`;
--> statement-breakpoint
CREATE TRIGGER `trg_search_cards_insert` AFTER INSERT ON `topics` BEGIN
  INSERT INTO search_cards_gone (card_rowid,id,region_id,label,status,search) SELECT rowid,id,region_id,label,status,search FROM search_cards WHERE id=NEW.id;
  INSERT OR REPLACE INTO search_cards (id,region_id,date,status,label,title,teaser,gremium,search,search_exact)
  SELECT NEW.id, NEW.region_id, substr(NEW.event_date,1,10), NEW.status, CASE WHEN json_extract(NEW.payload,'$.classification.version')='labels-v2' AND json_extract(NEW.payload,'$.classification.method') LIKE 'title-rules-v%' AND json_extract(NEW.payload,'$.classification.evidence')=coalesce(nullif(json_extract(NEW.payload,'$.officialTitle'),''),json_extract(NEW.payload,'$.title'),'') THEN coalesce(json_extract(NEW.payload,'$.classification.primary'),'unklar') ELSE 'unklar' END, substr(coalesce(json_extract(NEW.payload,'$.title'),''),1,1000), substr(CASE WHEN NOT (coalesce(json_extract(NEW.payload,'$.generatedBy'),'') LIKE 'KI-Zusammenfassung%' OR coalesce(json_extract(NEW.payload,'$.contentAnalysis.status'),'')='completed') AND json_type(NEW.payload,'$.ruleSummary.short.sentences')='array' THEN coalesce((SELECT group_concat(s.value,' ') FROM json_each(NEW.payload,'$.ruleSummary.short.sentences') s),'') ELSE coalesce(json_extract(NEW.payload,'$.shortSummary'),'') END,1,1200), coalesce(json_extract(NEW.payload,'$.committee'),''), lower(replace(replace(replace(replace(replace(replace(replace(substr(coalesce(json_extract(NEW.payload,'$.title'),''),1,1000)||' '||substr(CASE WHEN NOT (coalesce(json_extract(NEW.payload,'$.generatedBy'),'') LIKE 'KI-Zusammenfassung%' OR coalesce(json_extract(NEW.payload,'$.contentAnalysis.status'),'')='completed') AND json_type(NEW.payload,'$.ruleSummary.short.sentences')='array' THEN coalesce((SELECT group_concat(s.value,' ') FROM json_each(NEW.payload,'$.ruleSummary.short.sentences') s),'') ELSE coalesce(json_extract(NEW.payload,'$.shortSummary'),'') END,1,1200)||' '||coalesce(json_extract(NEW.payload,'$.committee'),''),'Ä','a'),'Ö','o'),'Ü','u'),'ä','a'),'ö','o'),'ü','u'),'ß','ss')), lower(replace(replace(replace(substr(coalesce(json_extract(NEW.payload,'$.title'),''),1,1000)||' '||substr(CASE WHEN NOT (coalesce(json_extract(NEW.payload,'$.generatedBy'),'') LIKE 'KI-Zusammenfassung%' OR coalesce(json_extract(NEW.payload,'$.contentAnalysis.status'),'')='completed') AND json_type(NEW.payload,'$.ruleSummary.short.sentences')='array' THEN coalesce((SELECT group_concat(s.value,' ') FROM json_each(NEW.payload,'$.ruleSummary.short.sentences') s),'') ELSE coalesce(json_extract(NEW.payload,'$.shortSummary'),'') END,1,1200)||' '||coalesce(json_extract(NEW.payload,'$.committee'),''),'Ä','ä'),'Ö','ö'),'Ü','ü')) WHERE json_extract(NEW.payload,'$.identity.mergedInto') IS NULL;
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
    OR json_extract(OLD.payload,'$.generatedBy') IS NOT json_extract(NEW.payload,'$.generatedBy')
    OR json_extract(OLD.payload,'$.contentAnalysis.status') IS NOT json_extract(NEW.payload,'$.contentAnalysis.status')
    OR json_extract(OLD.payload,'$.ruleSummary.short.sentences') IS NOT json_extract(NEW.payload,'$.ruleSummary.short.sentences')
    OR json_extract(OLD.payload,'$.committee') IS NOT json_extract(NEW.payload,'$.committee')
    OR json_extract(OLD.payload,'$.officialTitle') IS NOT json_extract(NEW.payload,'$.officialTitle')
    OR json_extract(OLD.payload,'$.identity.mergedInto') IS NOT json_extract(NEW.payload,'$.identity.mergedInto')
    OR json_extract(OLD.payload,'$.classification.version') IS NOT json_extract(NEW.payload,'$.classification.version')
    OR json_extract(OLD.payload,'$.classification.method') IS NOT json_extract(NEW.payload,'$.classification.method')
    OR json_extract(OLD.payload,'$.classification.evidence') IS NOT json_extract(NEW.payload,'$.classification.evidence')
    OR json_extract(OLD.payload,'$.classification.primary') IS NOT json_extract(NEW.payload,'$.classification.primary')
BEGIN
  INSERT INTO search_cards_gone (card_rowid,id,region_id,label,status,search) SELECT rowid,id,region_id,label,status,search FROM search_cards WHERE id=NEW.id OR id=OLD.id;
  DELETE FROM search_cards WHERE id=NEW.id OR id=OLD.id;
  INSERT OR REPLACE INTO search_cards (id,region_id,date,status,label,title,teaser,gremium,search,search_exact)
  SELECT NEW.id, NEW.region_id, substr(NEW.event_date,1,10), NEW.status, CASE WHEN json_extract(NEW.payload,'$.classification.version')='labels-v2' AND json_extract(NEW.payload,'$.classification.method') LIKE 'title-rules-v%' AND json_extract(NEW.payload,'$.classification.evidence')=coalesce(nullif(json_extract(NEW.payload,'$.officialTitle'),''),json_extract(NEW.payload,'$.title'),'') THEN coalesce(json_extract(NEW.payload,'$.classification.primary'),'unklar') ELSE 'unklar' END, substr(coalesce(json_extract(NEW.payload,'$.title'),''),1,1000), substr(CASE WHEN NOT (coalesce(json_extract(NEW.payload,'$.generatedBy'),'') LIKE 'KI-Zusammenfassung%' OR coalesce(json_extract(NEW.payload,'$.contentAnalysis.status'),'')='completed') AND json_type(NEW.payload,'$.ruleSummary.short.sentences')='array' THEN coalesce((SELECT group_concat(s.value,' ') FROM json_each(NEW.payload,'$.ruleSummary.short.sentences') s),'') ELSE coalesce(json_extract(NEW.payload,'$.shortSummary'),'') END,1,1200), coalesce(json_extract(NEW.payload,'$.committee'),''), lower(replace(replace(replace(replace(replace(replace(replace(substr(coalesce(json_extract(NEW.payload,'$.title'),''),1,1000)||' '||substr(CASE WHEN NOT (coalesce(json_extract(NEW.payload,'$.generatedBy'),'') LIKE 'KI-Zusammenfassung%' OR coalesce(json_extract(NEW.payload,'$.contentAnalysis.status'),'')='completed') AND json_type(NEW.payload,'$.ruleSummary.short.sentences')='array' THEN coalesce((SELECT group_concat(s.value,' ') FROM json_each(NEW.payload,'$.ruleSummary.short.sentences') s),'') ELSE coalesce(json_extract(NEW.payload,'$.shortSummary'),'') END,1,1200)||' '||coalesce(json_extract(NEW.payload,'$.committee'),''),'Ä','a'),'Ö','o'),'Ü','u'),'ä','a'),'ö','o'),'ü','u'),'ß','ss')), lower(replace(replace(replace(substr(coalesce(json_extract(NEW.payload,'$.title'),''),1,1000)||' '||substr(CASE WHEN NOT (coalesce(json_extract(NEW.payload,'$.generatedBy'),'') LIKE 'KI-Zusammenfassung%' OR coalesce(json_extract(NEW.payload,'$.contentAnalysis.status'),'')='completed') AND json_type(NEW.payload,'$.ruleSummary.short.sentences')='array' THEN coalesce((SELECT group_concat(s.value,' ') FROM json_each(NEW.payload,'$.ruleSummary.short.sentences') s),'') ELSE coalesce(json_extract(NEW.payload,'$.shortSummary'),'') END,1,1200)||' '||coalesce(json_extract(NEW.payload,'$.committee'),''),'Ä','ä'),'Ö','ö'),'Ü','ü')) WHERE json_extract(NEW.payload,'$.identity.mergedInto') IS NULL;
END;
--> statement-breakpoint
UPDATE `topics` SET `payload`=json_remove(`payload`,'$.weightedKeywords','$.aiAttempts.keywords')
  WHERE json_type(`payload`,'$.weightedKeywords') IS NOT NULL OR json_type(`payload`,'$.aiAttempts.keywords') IS NOT NULL;
--> statement-breakpoint
UPDATE `search_cards` SET
  teaser=substr(CASE WHEN NOT (coalesce(json_extract(t.payload,'$.generatedBy'),'') LIKE 'KI-Zusammenfassung%' OR coalesce(json_extract(t.payload,'$.contentAnalysis.status'),'')='completed') AND json_type(t.payload,'$.ruleSummary.short.sentences')='array' THEN coalesce((SELECT group_concat(s.value,' ') FROM json_each(t.payload,'$.ruleSummary.short.sentences') s),'') ELSE coalesce(json_extract(t.payload,'$.shortSummary'),'') END,1,1200),
  search=lower(replace(replace(replace(replace(replace(replace(replace(substr(coalesce(json_extract(t.payload,'$.title'),''),1,1000)||' '||substr(CASE WHEN NOT (coalesce(json_extract(t.payload,'$.generatedBy'),'') LIKE 'KI-Zusammenfassung%' OR coalesce(json_extract(t.payload,'$.contentAnalysis.status'),'')='completed') AND json_type(t.payload,'$.ruleSummary.short.sentences')='array' THEN coalesce((SELECT group_concat(s.value,' ') FROM json_each(t.payload,'$.ruleSummary.short.sentences') s),'') ELSE coalesce(json_extract(t.payload,'$.shortSummary'),'') END,1,1200)||' '||coalesce(json_extract(t.payload,'$.committee'),''),'Ä','a'),'Ö','o'),'Ü','u'),'ä','a'),'ö','o'),'ü','u'),'ß','ss')),
  search_exact=lower(replace(replace(replace(substr(coalesce(json_extract(t.payload,'$.title'),''),1,1000)||' '||substr(CASE WHEN NOT (coalesce(json_extract(t.payload,'$.generatedBy'),'') LIKE 'KI-Zusammenfassung%' OR coalesce(json_extract(t.payload,'$.contentAnalysis.status'),'')='completed') AND json_type(t.payload,'$.ruleSummary.short.sentences')='array' THEN coalesce((SELECT group_concat(s.value,' ') FROM json_each(t.payload,'$.ruleSummary.short.sentences') s),'') ELSE coalesce(json_extract(t.payload,'$.shortSummary'),'') END,1,1200)||' '||coalesce(json_extract(t.payload,'$.committee'),''),'Ä','ä'),'Ö','ö'),'Ü','ü'))
  FROM `topics` t WHERE t.id=`search_cards`.id;
--> statement-breakpoint
DELETE FROM `search_cards_gone`;
--> statement-breakpoint
DELETE FROM `system_state` WHERE key='search-words';
--> statement-breakpoint
UPDATE data_revisions SET revision=revision+1 WHERE id IN ('search','content');
