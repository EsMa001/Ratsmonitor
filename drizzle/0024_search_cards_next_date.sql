-- Datum der Suchkarte „Stand heute“ (Entscheidung 11.10.2026): Ein Vorgang, der schon beraten wurde und erneut auf einer
-- künftigen Tagesordnung steht, trägt in der Suche das Datum seiner letzten Sitzung bis heute, nicht das der künftigen.
-- Ohne „Künftige Sitzungen zeigen“ (Grenze: heute) erscheint er damit wie zuletzt beraten; vorher fiel er ganz heraus.
-- next_date nennt die nächste anstehende Sitzung (sonst NULL). Vorgänge nur mit künftigen Sitzungen behalten ihr Datum.
-- Ist next_date vorbei, rückt das Datum nach: rollCardDates (server/integrations/search-card-dates.mjs) nach jedem
-- Metadaten-Import und in scripts/refresh-search-words.mjs (Dev-Start, nachts per Cron). Die Ausdrücke stehen dort ein
-- zweites Mal (PAST_SQL, NEXT_SQL); tests/search-card-dates.test.mjs prüft, dass sie gleich sind.
-- Der Suchtext ändert sich nicht: Wortliste, Volltextindex und vorberechnete Zahlen (über alle Daten) bleiben gültig.
ALTER TABLE `search_cards` ADD COLUMN `next_date` text;
--> statement-breakpoint
CREATE INDEX `idx_search_cards_next` ON `search_cards` (`next_date`) WHERE next_date IS NOT NULL;
--> statement-breakpoint
CREATE TRIGGER `trg_search_cards_dates` AFTER INSERT ON `search_cards` WHEN NEW.date>date('now') BEGIN
  UPDATE search_cards SET
    date=COALESCE((SELECT max(substr(json_extract(e.value,'$.date'),1,10)) FROM topics t,json_each(t.payload,'$.events') e WHERE t.id=NEW.id AND substr(json_extract(e.value,'$.date'),1,10)<=date('now')),NEW.date),
    next_date=COALESCE((SELECT min(substr(json_extract(e.value,'$.date'),1,10)) FROM topics t,json_each(t.payload,'$.events') e WHERE t.id=NEW.id AND substr(json_extract(e.value,'$.date'),1,10)>date('now')),NEW.date)
  WHERE rowid=NEW.rowid;
END;
--> statement-breakpoint
UPDATE search_cards SET
  next_date=COALESCE((SELECT min(substr(json_extract(e.value,'$.date'),1,10)) FROM topics t,json_each(t.payload,'$.events') e WHERE t.id=search_cards.id AND substr(json_extract(e.value,'$.date'),1,10)>date('now')),date),
  date=COALESCE((SELECT max(substr(json_extract(e.value,'$.date'),1,10)) FROM topics t,json_each(t.payload,'$.events') e WHERE t.id=search_cards.id AND substr(json_extract(e.value,'$.date'),1,10)<=date('now')),date)
WHERE date>date('now');
--> statement-breakpoint
UPDATE data_revisions SET revision=revision+1 WHERE id IN ('search','content');
