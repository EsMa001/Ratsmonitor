-- Schritt 5 (requirements/regel-schritt-plan.md): die 10 Themen ersetzen die 16 Labels (labels-v3, shared/labels.mjs).
-- Rangfolge wie storedClassification in shared/analysis-state.mjs (tests/effective-labels prüfen die Gleichheit):
--   1. Prüfung von Hand, 2. KI-Label (ai-local-content-v2), beide aus labels-v2 übersetzt (LEGACY_LABELS) oder labels-v3,
--   3. Thema aus readReport (payload.theme, Fassung themes-v1, zum heutigen Titel; offen → unklar),
--   4. Titelregel (classification, labels-v2 übersetzt oder labels-v3).
-- Die Trigger aus 0027 bleiben: sie vergleichen das Label der Karte mit diesem View und ersetzen die Karte, wenn es abweicht.
-- Danach einmal alle Karten neu setzen; die Zahlen je Label der Wortliste verfallen (refresh-search-words.mjs --full).
DROP VIEW IF EXISTS topic_effective_labels;
--> statement-breakpoint
CREATE VIEW topic_effective_labels AS
SELECT id,CASE
  WHEN json_extract(payload,'$.labelAssessments.review.primary') IN ('bildung','bauen','mobilitaet','umwelt','klima','soziales','gesundheit','wirtschaft','kultur','sport','sicherheit','finanzen','verwaltung','sitzung','allgemein','unklar')
    AND typeof(json_extract(payload,'$.labelAssessments.review.reviewer'))='text'
    AND trim(json_extract(payload,'$.labelAssessments.review.reviewer'))<>''
    AND typeof(json_extract(payload,'$.labelAssessments.review.reviewedAt'))='text'
    AND julianday(json_extract(payload,'$.labelAssessments.review.reviewedAt')) IS NOT NULL
    AND coalesce(json_extract(payload,'$.labelAssessments.review.status'),'')<>'stale'
    AND (coalesce(json_extract(payload,'$.labelAssessments.review.sourceSignature'),'')='' OR json_extract(payload,'$.labelAssessments.review.sourceSignature')=source_signature)
  THEN CASE json_extract(payload,'$.labelAssessments.review.primary') WHEN 'klima' THEN 'umwelt' WHEN 'gesundheit' THEN 'soziales' WHEN 'sport' THEN 'kultur' WHEN 'sitzung' THEN 'unklar' WHEN 'allgemein' THEN 'unklar' ELSE json_extract(payload,'$.labelAssessments.review.primary') END
  WHEN json_extract(payload,'$.labelAssessments.ai.status')='completed'
    AND json_extract(payload,'$.labelAssessments.ai.method')='ai-local-content-v2'
    AND json_extract(payload,'$.labelAssessments.ai.version') IN ('labels-v2','labels-v3')
    AND json_extract(payload,'$.labelAssessments.ai.primary') IN ('bildung','bauen','mobilitaet','umwelt','klima','soziales','gesundheit','wirtschaft','kultur','sport','sicherheit','finanzen','verwaltung','sitzung','allgemein','unklar')
    AND json_extract(payload,'$.labelAssessments.ai.sourceSignature')=source_signature
  THEN CASE json_extract(payload,'$.labelAssessments.ai.primary') WHEN 'klima' THEN 'umwelt' WHEN 'gesundheit' THEN 'soziales' WHEN 'sport' THEN 'kultur' WHEN 'sitzung' THEN 'unklar' WHEN 'allgemein' THEN 'unklar' ELSE json_extract(payload,'$.labelAssessments.ai.primary') END
  WHEN json_extract(payload,'$.theme.version')='themes-v1'
    AND json_extract(payload,'$.theme.evidence')=coalesce(nullif(json_extract(payload,'$.officialTitle'),''),json_extract(payload,'$.title'),'')
    AND json_extract(payload,'$.theme.id') IN ('bauen','finanzen','mobilitaet','bildung','umwelt','soziales','kultur','sicherheit','verwaltung','wirtschaft','offen')
  THEN CASE json_extract(payload,'$.theme.id') WHEN 'offen' THEN 'unklar' ELSE json_extract(payload,'$.theme.id') END
  WHEN json_extract(payload,'$.classification.version') IN ('labels-v2','labels-v3')
    AND json_extract(payload,'$.classification.method') LIKE 'title-rules-v%'
    AND json_extract(payload,'$.classification.evidence')=coalesce(nullif(json_extract(payload,'$.officialTitle'),''),json_extract(payload,'$.title'),'')
    AND json_extract(payload,'$.classification.primary') IN ('bildung','bauen','mobilitaet','umwelt','klima','soziales','gesundheit','wirtschaft','kultur','sport','sicherheit','finanzen','verwaltung','sitzung','allgemein','unklar')
  THEN CASE json_extract(payload,'$.classification.primary') WHEN 'klima' THEN 'umwelt' WHEN 'gesundheit' THEN 'soziales' WHEN 'sport' THEN 'kultur' WHEN 'sitzung' THEN 'unklar' WHEN 'allgemein' THEN 'unklar' ELSE json_extract(payload,'$.classification.primary') END
  ELSE 'unklar' END AS label
FROM (SELECT t.id,t.payload,CASE WHEN json_type(t.payload,'$.labelAssessments.ai')='object' OR json_type(t.payload,'$.labelAssessments.review.sourceSignature')='text'
    THEN json_remove(json_object('title',coalesce(nullif(json_extract(t.payload,'$.officialTitle'),''),json_extract(t.payload,'$.title'),''),'status',json_extract(t.payload,'$.status'),
      'events',json((SELECT json_group_array(json(json_remove(json_object('date',json_extract(e.value,'$.date'),'committee',json_extract(e.value,'$.committee'),'status',json_extract(e.value,'$.status'),'result',CASE WHEN json_extract(e.value,'$.result') IS NULL OR json_extract(e.value,'$.result') IN ('',0) THEN '' ELSE json_extract(e.value,'$.result') END),
        CASE WHEN json_type(e.value,'$.date') IS NULL THEN '$.date' ELSE '$.__absent' END,
        CASE WHEN json_type(e.value,'$.committee') IS NULL THEN '$.committee' ELSE '$.__absent' END,
        CASE WHEN json_type(e.value,'$.status') IS NULL THEN '$.status' ELSE '$.__absent' END))) FROM json_each(t.payload,'$.events') e)),
      'documents',json((SELECT json_group_array(url) FROM (SELECT json_extract(d.value,'$.url') AS url FROM json_each(t.payload,'$.documents') d ORDER BY url)))),
      CASE WHEN json_type(t.payload,'$.status') IS NULL THEN '$.status' ELSE '$.__absent' END) ELSE NULL END AS source_signature FROM topics t WHERE t.active=1);;
--> statement-breakpoint
UPDATE search_cards SET label=coalesce((SELECT label FROM topic_effective_labels WHERE id=search_cards.id),'unklar')
  WHERE label IS NOT coalesce((SELECT label FROM topic_effective_labels WHERE id=search_cards.id),'unklar');
--> statement-breakpoint
DELETE FROM search_cards_gone;
--> statement-breakpoint
DELETE FROM system_state WHERE key='search-words';
--> statement-breakpoint
UPDATE data_revisions SET revision=revision+1 WHERE id IN ('search','content');
