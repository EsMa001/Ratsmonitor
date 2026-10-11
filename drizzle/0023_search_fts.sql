-- Volltextindex über den Suchtext der Karten (FTS5, Trigram-Tokenizer): findet jede Teilzeichenkette ab 3 Zeichen, wie
-- instr(search,?) in monitor-search.mjs, aber über den Index statt über alle Karten. Der Index speichert keinen Text
-- (external content: search_cards); die Suche prüft die Treffer weiter mit instr, das Ergebnis bleibt gleich.
-- Messung (lokale Kopie, 941.027 Karten): Aufbau 30 s, 650 MB; Zählen eines Begriffs 350 bis 1.800 ms → 10 bis 110 ms.
-- Mitgeführt über Trigger auf search_cards. Die Karten werden über INSERT OR REPLACE geschrieben; das Ersetzen löst keinen
-- Delete-Trigger aus, deshalb entfernt der BEFORE-INSERT-Trigger eine vorhandene Karte gleicher id zuerst aus dem Index.
-- Reparatur bei Zweifeln: INSERT INTO search_fts(search_fts) VALUES('rebuild');
CREATE VIRTUAL TABLE IF NOT EXISTS `search_fts` USING fts5(search, content='search_cards', content_rowid='rowid', tokenize='trigram');
--> statement-breakpoint
CREATE TRIGGER `trg_search_fts_replace` BEFORE INSERT ON `search_cards` BEGIN
  INSERT INTO search_fts(search_fts,rowid,search) SELECT 'delete',rowid,search FROM search_cards WHERE id=NEW.id;
END;
--> statement-breakpoint
CREATE TRIGGER `trg_search_fts_insert` AFTER INSERT ON `search_cards` BEGIN
  INSERT INTO search_fts(rowid,search) VALUES(NEW.rowid,NEW.search);
END;
--> statement-breakpoint
CREATE TRIGGER `trg_search_fts_delete` AFTER DELETE ON `search_cards` BEGIN
  INSERT INTO search_fts(search_fts,rowid,search) VALUES('delete',OLD.rowid,OLD.search);
END;
--> statement-breakpoint
CREATE TRIGGER `trg_search_fts_update` AFTER UPDATE OF search ON `search_cards` BEGIN
  INSERT INTO search_fts(search_fts,rowid,search) VALUES('delete',OLD.rowid,OLD.search);
  INSERT INTO search_fts(rowid,search) VALUES(NEW.rowid,NEW.search);
END;
--> statement-breakpoint
INSERT INTO search_fts(search_fts) VALUES('rebuild');
