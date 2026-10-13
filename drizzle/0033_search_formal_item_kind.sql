-- Schritt 4 (requirements/regel-schritt-plan.md): „Ohne Formalien“ folgt der Art des Punkts aus readReport
-- (payload.itemKind, shared/item-kind.mjs: formal, collection und routine sind Formalien, subject nicht). Gemessen an
-- tests/fixtures/item-test.json: alte Muster 99 % Genauigkeit bei 69 % Abdeckung, itemKind 100 % bei 96 %.
-- Fehlt itemKind (Bericht seit dem Import noch nicht gelesen), gelten die alten Muster aus 0017 (FORMAL und NOT_FORMAL in
-- server/integrations/monitor-search.mjs; tests/search-formal.test.mjs prüft, dass sie gleich sind).
-- Ändert read-reports.mjs nur itemKind, wird die Karte nicht ersetzt (trg_search_cards_update sieht itemKind nicht); dann
-- setzt trg_search_cards_item_kind die Spalte formal der vorhandenen Karte. Kein Nachfüllen hier: itemKind entsteht erst mit
-- read-reports.mjs (einmal --all nach dem Einspielen).
DROP TRIGGER IF EXISTS `trg_search_cards_formal`;
--> statement-breakpoint
CREATE TRIGGER `trg_search_cards_formal` AFTER INSERT ON `search_cards`
  WHEN coalesce((SELECT json_extract(payload,'$.itemKind') IN ('formal','collection','routine') FROM topics WHERE id=NEW.id AND json_extract(payload,'$.itemKind') IS NOT NULL),
   (lower(NEW.title) LIKE '%niederschrift%' OR lower(NEW.title) LIKE 'mitteilungen%' OR lower(NEW.title) LIKE 'anfragen%'
    OR lower(NEW.title) LIKE '% anfragen%' OR lower(NEW.title) LIKE 'verschiedenes%' OR lower(NEW.title) LIKE '%einwohnerfragestunde%'
    OR lower(NEW.title) LIKE '%fragestunde%' OR lower(NEW.title) LIKE 'eröffnung%' OR lower(NEW.title) LIKE '%feststellung der%'
    OR lower(NEW.title) LIKE '%genehmigung der tagesordnung%' OR lower(NEW.title) LIKE '%tagesordnung%' OR lower(NEW.title) LIKE '%sitzungsprotokoll%'
    OR lower(NEW.title) LIKE '%protokoll der%' OR lower(NEW.title) LIKE '%protokolls der%' OR lower(NEW.title) LIKE '%bekanntgaben%'
    OR lower(NEW.title) LIKE '%bekanntgabe von%' OR lower(NEW.title) LIKE 'berichte der verwaltung%' OR lower(NEW.title) LIKE 'bericht des vorsitzenden%'
    OR lower(NEW.title) LIKE 'bericht des oberbürgermeisters%' OR lower(NEW.title) LIKE 'bericht des bürgermeisters%' OR lower(NEW.title) LIKE '%verpflichtung%'
    OR lower(NEW.title) LIKE '%anträge der fraktionen%')
   AND NOT (lower(NEW.title) LIKE 'mitteilungen;%' OR lower(NEW.title) LIKE 'widerspruch%' OR lower(NEW.title) LIKE '%gegen den beschluss%'))
BEGIN
  UPDATE search_cards SET formal=1 WHERE rowid=NEW.rowid;
END;
--> statement-breakpoint
CREATE TRIGGER `trg_search_cards_item_kind` AFTER UPDATE OF `payload` ON `topics`
  WHEN json_extract(NEW.payload,'$.itemKind') IS NOT NULL
   AND json_extract(OLD.payload,'$.itemKind') IS NOT json_extract(NEW.payload,'$.itemKind')
BEGIN
  UPDATE search_cards SET formal=(json_extract(NEW.payload,'$.itemKind') IN ('formal','collection','routine'))
   WHERE id=NEW.id AND formal IS NOT (json_extract(NEW.payload,'$.itemKind') IN ('formal','collection','routine'));
END;
