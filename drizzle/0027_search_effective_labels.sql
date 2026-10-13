-- Saved classification precedence matches shared/analysis-state.mjs: reviewed, current local AI, current title rules.
-- Rebuild only the topics-to-search-card insert/update triggers; retain the current short search text, dates, formal flags and FTS triggers.
CREATE VIEW topic_effective_labels AS
SELECT id,CASE
  WHEN json_extract(payload,'$.labelAssessments.review.primary') IN ('bildung','bauen','mobilitaet','umwelt','klima','soziales','gesundheit','wirtschaft','kultur','sport','sicherheit','finanzen','verwaltung','sitzung','allgemein','unklar')
    AND typeof(json_extract(payload,'$.labelAssessments.review.reviewer'))='text'
    AND trim(json_extract(payload,'$.labelAssessments.review.reviewer'))<>''
    AND typeof(json_extract(payload,'$.labelAssessments.review.reviewedAt'))='text'
    AND julianday(json_extract(payload,'$.labelAssessments.review.reviewedAt')) IS NOT NULL
    AND coalesce(json_extract(payload,'$.labelAssessments.review.status'),'')<>'stale'
    AND (coalesce(json_extract(payload,'$.labelAssessments.review.sourceSignature'),'')='' OR json_extract(payload,'$.labelAssessments.review.sourceSignature')=source_signature)
  THEN json_extract(payload,'$.labelAssessments.review.primary')
  WHEN json_extract(payload,'$.labelAssessments.ai.status')='completed'
    AND json_extract(payload,'$.labelAssessments.ai.method')='ai-local-content-v2'
    AND json_extract(payload,'$.labelAssessments.ai.version')='labels-v2'
    AND json_extract(payload,'$.labelAssessments.ai.primary') IN ('bildung','bauen','mobilitaet','umwelt','klima','soziales','gesundheit','wirtschaft','kultur','sport','sicherheit','finanzen','verwaltung','sitzung','allgemein','unklar')
    AND json_extract(payload,'$.labelAssessments.ai.sourceSignature')=source_signature
  THEN json_extract(payload,'$.labelAssessments.ai.primary')
  WHEN json_extract(payload,'$.classification.version')='labels-v2'
    AND json_extract(payload,'$.classification.method') LIKE 'title-rules-v%'
    AND json_extract(payload,'$.classification.evidence')=coalesce(nullif(json_extract(payload,'$.officialTitle'),''),json_extract(payload,'$.title'),'')
    AND json_extract(payload,'$.classification.primary') IN ('bildung','bauen','mobilitaet','umwelt','klima','soziales','gesundheit','wirtschaft','kultur','sport','sicherheit','finanzen','verwaltung','sitzung','allgemein','unklar')
  THEN json_extract(payload,'$.classification.primary')
  ELSE 'unklar' END AS label
FROM (SELECT t.id,t.payload,CASE WHEN json_type(t.payload,'$.labelAssessments.ai')='object' OR json_type(t.payload,'$.labelAssessments.review.sourceSignature')='text'
    THEN json_remove(json_object('title',coalesce(nullif(json_extract(t.payload,'$.officialTitle'),''),json_extract(t.payload,'$.title'),''),'status',json_extract(t.payload,'$.status'),
      'events',json((SELECT json_group_array(json(json_remove(json_object('date',json_extract(e.value,'$.date'),'committee',json_extract(e.value,'$.committee'),'status',json_extract(e.value,'$.status'),'result',CASE WHEN json_extract(e.value,'$.result') IS NULL OR json_extract(e.value,'$.result') IN ('',0) THEN '' ELSE json_extract(e.value,'$.result') END),
        CASE WHEN json_type(e.value,'$.date') IS NULL THEN '$.date' ELSE '$.__absent' END,
        CASE WHEN json_type(e.value,'$.committee') IS NULL THEN '$.committee' ELSE '$.__absent' END,
        CASE WHEN json_type(e.value,'$.status') IS NULL THEN '$.status' ELSE '$.__absent' END))) FROM json_each(t.payload,'$.events') e)),
      'documents',json((SELECT json_group_array(url) FROM (SELECT json_extract(d.value,'$.url') AS url FROM json_each(t.payload,'$.documents') d ORDER BY url)))),
      CASE WHEN json_type(t.payload,'$.status') IS NULL THEN '$.status' ELSE '$.__absent' END) ELSE NULL END AS source_signature FROM topics t WHERE t.active=1);
--> statement-breakpoint
DROP TRIGGER IF EXISTS `trg_search_cards_insert`;
--> statement-breakpoint
CREATE TRIGGER `trg_search_cards_insert` AFTER INSERT ON `topics` BEGIN
  INSERT INTO search_cards_gone (card_rowid,id,region_id,label,status,search) SELECT rowid,id,region_id,label,status,search FROM search_cards WHERE id=NEW.id;
  INSERT OR REPLACE INTO search_cards (id,region_id,date,status,label,title,teaser,gremium,search,search_exact)
  SELECT NEW.id, NEW.region_id, substr(NEW.event_date,1,10), NEW.status, coalesce((SELECT label FROM topic_effective_labels WHERE id=NEW.id),'unklar'), substr(coalesce(json_extract(NEW.payload,'$.title'),''),1,1000), substr(CASE WHEN NOT (coalesce(json_extract(NEW.payload,'$.generatedBy'),'') LIKE 'KI-Zusammenfassung%' OR coalesce(json_extract(NEW.payload,'$.contentAnalysis.status'),'')='completed') AND json_type(NEW.payload,'$.ruleSummary.short.sentences')='array' THEN coalesce((SELECT group_concat(s.value,' ') FROM json_each(NEW.payload,'$.ruleSummary.short.sentences') s),'') ELSE coalesce(json_extract(NEW.payload,'$.shortSummary'),'') END,1,1200), coalesce(json_extract(NEW.payload,'$.committee'),''), lower(replace(replace(replace(replace(replace(replace(replace(substr(coalesce(json_extract(NEW.payload,'$.title'),''),1,1000)||' '||substr(CASE WHEN NOT (coalesce(json_extract(NEW.payload,'$.generatedBy'),'') LIKE 'KI-Zusammenfassung%' OR coalesce(json_extract(NEW.payload,'$.contentAnalysis.status'),'')='completed') AND json_type(NEW.payload,'$.ruleSummary.short.sentences')='array' THEN coalesce((SELECT group_concat(s.value,' ') FROM json_each(NEW.payload,'$.ruleSummary.short.sentences') s),'') ELSE coalesce(json_extract(NEW.payload,'$.shortSummary'),'') END,1,1200)||' '||coalesce(json_extract(NEW.payload,'$.committee'),''),'Ä','a'),'Ö','o'),'Ü','u'),'ä','a'),'ö','o'),'ü','u'),'ß','ss')), lower(replace(replace(replace(substr(coalesce(json_extract(NEW.payload,'$.title'),''),1,1000)||' '||substr(CASE WHEN NOT (coalesce(json_extract(NEW.payload,'$.generatedBy'),'') LIKE 'KI-Zusammenfassung%' OR coalesce(json_extract(NEW.payload,'$.contentAnalysis.status'),'')='completed') AND json_type(NEW.payload,'$.ruleSummary.short.sentences')='array' THEN coalesce((SELECT group_concat(s.value,' ') FROM json_each(NEW.payload,'$.ruleSummary.short.sentences') s),'') ELSE coalesce(json_extract(NEW.payload,'$.shortSummary'),'') END,1,1200)||' '||coalesce(json_extract(NEW.payload,'$.committee'),''),'Ä','ä'),'Ö','ö'),'Ü','ü')) WHERE json_extract(NEW.payload,'$.identity.mergedInto') IS NULL;
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
    OR (SELECT label FROM search_cards WHERE id=OLD.id) IS NOT (SELECT label FROM topic_effective_labels WHERE id=NEW.id)
BEGIN
  INSERT INTO search_cards_gone (card_rowid,id,region_id,label,status,search) SELECT rowid,id,region_id,label,status,search FROM search_cards WHERE id=NEW.id OR id=OLD.id;
  DELETE FROM search_cards WHERE id=NEW.id OR id=OLD.id;
  INSERT OR REPLACE INTO search_cards (id,region_id,date,status,label,title,teaser,gremium,search,search_exact)
  SELECT NEW.id, NEW.region_id, substr(NEW.event_date,1,10), NEW.status, coalesce((SELECT label FROM topic_effective_labels WHERE id=NEW.id),'unklar'), substr(coalesce(json_extract(NEW.payload,'$.title'),''),1,1000), substr(CASE WHEN NOT (coalesce(json_extract(NEW.payload,'$.generatedBy'),'') LIKE 'KI-Zusammenfassung%' OR coalesce(json_extract(NEW.payload,'$.contentAnalysis.status'),'')='completed') AND json_type(NEW.payload,'$.ruleSummary.short.sentences')='array' THEN coalesce((SELECT group_concat(s.value,' ') FROM json_each(NEW.payload,'$.ruleSummary.short.sentences') s),'') ELSE coalesce(json_extract(NEW.payload,'$.shortSummary'),'') END,1,1200), coalesce(json_extract(NEW.payload,'$.committee'),''), lower(replace(replace(replace(replace(replace(replace(replace(substr(coalesce(json_extract(NEW.payload,'$.title'),''),1,1000)||' '||substr(CASE WHEN NOT (coalesce(json_extract(NEW.payload,'$.generatedBy'),'') LIKE 'KI-Zusammenfassung%' OR coalesce(json_extract(NEW.payload,'$.contentAnalysis.status'),'')='completed') AND json_type(NEW.payload,'$.ruleSummary.short.sentences')='array' THEN coalesce((SELECT group_concat(s.value,' ') FROM json_each(NEW.payload,'$.ruleSummary.short.sentences') s),'') ELSE coalesce(json_extract(NEW.payload,'$.shortSummary'),'') END,1,1200)||' '||coalesce(json_extract(NEW.payload,'$.committee'),''),'Ä','a'),'Ö','o'),'Ü','u'),'ä','a'),'ö','o'),'ü','u'),'ß','ss')), lower(replace(replace(replace(substr(coalesce(json_extract(NEW.payload,'$.title'),''),1,1000)||' '||substr(CASE WHEN NOT (coalesce(json_extract(NEW.payload,'$.generatedBy'),'') LIKE 'KI-Zusammenfassung%' OR coalesce(json_extract(NEW.payload,'$.contentAnalysis.status'),'')='completed') AND json_type(NEW.payload,'$.ruleSummary.short.sentences')='array' THEN coalesce((SELECT group_concat(s.value,' ') FROM json_each(NEW.payload,'$.ruleSummary.short.sentences') s),'') ELSE coalesce(json_extract(NEW.payload,'$.shortSummary'),'') END,1,1200)||' '||coalesce(json_extract(NEW.payload,'$.committee'),''),'Ä','ä'),'Ö','ö'),'Ü','ü')) WHERE json_extract(NEW.payload,'$.identity.mergedInto') IS NULL;
END;
--> statement-breakpoint
-- Reproject existing cards once. Word facets include labels, so their saved state must be rebuilt.
UPDATE search_cards SET label=coalesce((SELECT label FROM topic_effective_labels WHERE id=search_cards.id),'unklar')
  WHERE label IS NOT coalesce((SELECT label FROM topic_effective_labels WHERE id=search_cards.id),'unklar');
--> statement-breakpoint
DELETE FROM search_cards_gone;
--> statement-breakpoint
DELETE FROM system_state WHERE key='search-words';
--> statement-breakpoint
UPDATE data_revisions SET revision=revision+1 WHERE id IN ('search','content');
