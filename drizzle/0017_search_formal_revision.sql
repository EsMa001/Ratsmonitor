-- Paket 1 der Code-Analyse vom 10.10.2026 (requirements/code-analyse-2026-10-10.md, Befunde B1, B3, B9).
--
-- B1 · Formalien als Spalte. Ohne Suchbegriff blendet die Startseite Formalien aus (noformal=1). Mit 25 LIKE-Vergleichen
-- auf dem Titel verlor die Zählabfrage den abdeckenden Index und las jede Karte (11 bis 32 s bei 1,3 Mio. Karten; der
-- Server rechnet synchron, alle Besucher warten). formal wird beim Einfügen einer Karte gesetzt: Karten werden nie
-- geändert, nur ersetzt (Trigger aus 0015). Der Teilindex deckt Zählung und Gruppierung ohne Formalien ab.
-- Die Muster sind dieselben wie FORMAL und NOT_FORMAL in server/integrations/monitor-search.mjs; tests/search-formal.test.mjs
-- vergleicht beide Listen. Wer die Muster ändert, ändert beide und schreibt eine neue Migration (Trigger neu anlegen,
-- formal für alle Karten neu setzen).
ALTER TABLE `search_cards` ADD COLUMN `formal` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
CREATE TRIGGER `trg_search_cards_formal` AFTER INSERT ON `search_cards`
  WHEN (lower(NEW.title) LIKE '%niederschrift%' OR lower(NEW.title) LIKE 'mitteilungen%' OR lower(NEW.title) LIKE 'anfragen%'
    OR lower(NEW.title) LIKE '% anfragen%' OR lower(NEW.title) LIKE 'verschiedenes%' OR lower(NEW.title) LIKE '%einwohnerfragestunde%'
    OR lower(NEW.title) LIKE '%fragestunde%' OR lower(NEW.title) LIKE 'eröffnung%' OR lower(NEW.title) LIKE '%feststellung der%'
    OR lower(NEW.title) LIKE '%genehmigung der tagesordnung%' OR lower(NEW.title) LIKE '%tagesordnung%' OR lower(NEW.title) LIKE '%sitzungsprotokoll%'
    OR lower(NEW.title) LIKE '%protokoll der%' OR lower(NEW.title) LIKE '%protokolls der%' OR lower(NEW.title) LIKE '%bekanntgaben%'
    OR lower(NEW.title) LIKE '%bekanntgabe von%' OR lower(NEW.title) LIKE 'berichte der verwaltung%' OR lower(NEW.title) LIKE 'bericht des vorsitzenden%'
    OR lower(NEW.title) LIKE 'bericht des oberbürgermeisters%' OR lower(NEW.title) LIKE 'bericht des bürgermeisters%' OR lower(NEW.title) LIKE '%verpflichtung%'
    OR lower(NEW.title) LIKE '%anträge der fraktionen%')
   AND NOT (lower(NEW.title) LIKE 'mitteilungen;%' OR lower(NEW.title) LIKE 'widerspruch%' OR lower(NEW.title) LIKE '%gegen den beschluss%')
BEGIN
  UPDATE search_cards SET formal=1 WHERE rowid=NEW.rowid;
END;
--> statement-breakpoint
UPDATE search_cards SET formal=1
  WHERE (lower(title) LIKE '%niederschrift%' OR lower(title) LIKE 'mitteilungen%' OR lower(title) LIKE 'anfragen%'
    OR lower(title) LIKE '% anfragen%' OR lower(title) LIKE 'verschiedenes%' OR lower(title) LIKE '%einwohnerfragestunde%'
    OR lower(title) LIKE '%fragestunde%' OR lower(title) LIKE 'eröffnung%' OR lower(title) LIKE '%feststellung der%'
    OR lower(title) LIKE '%genehmigung der tagesordnung%' OR lower(title) LIKE '%tagesordnung%' OR lower(title) LIKE '%sitzungsprotokoll%'
    OR lower(title) LIKE '%protokoll der%' OR lower(title) LIKE '%protokolls der%' OR lower(title) LIKE '%bekanntgaben%'
    OR lower(title) LIKE '%bekanntgabe von%' OR lower(title) LIKE 'berichte der verwaltung%' OR lower(title) LIKE 'bericht des vorsitzenden%'
    OR lower(title) LIKE 'bericht des oberbürgermeisters%' OR lower(title) LIKE 'bericht des bürgermeisters%' OR lower(title) LIKE '%verpflichtung%'
    OR lower(title) LIKE '%anträge der fraktionen%')
   AND NOT (lower(title) LIKE 'mitteilungen;%' OR lower(title) LIKE 'widerspruch%' OR lower(title) LIKE '%gegen den beschluss%');
--> statement-breakpoint
CREATE INDEX `idx_search_cards_noformal` ON `search_cards` (`region_id`,`label`,`status`,`date`) WHERE formal=0;
--> statement-breakpoint
-- B3 · Eigener Datenstand der Suche. Der Datenstand 'content' (0004) steigt mit jeder Zeile in topics, article_versions,
-- article_analyses und source_coverage; jeder Importschritt schreibt source_coverage, also verfielen alle Zwischenspeicher der
-- Suche alle paar Sekunden und Blätternde bekamen 409. 'search' steigt nur, wenn sich ein Vorgang ändert (eingefügt,
-- geändert, gelöscht): Das ist alles, was Karten, Stationen und Quelle der Suchtreffer verändern kann. Er beginnt über dem
-- bisherigen Stand, damit kein alter Wert (gemerkter Stand der Wortliste, Stand einer offenen Ergebnisliste) zufällig gleich ist.
INSERT INTO data_revisions(id,revision)
  SELECT 'search',coalesce((SELECT revision FROM data_revisions WHERE id='content'),0)+1
  WHERE NOT EXISTS (SELECT 1 FROM data_revisions WHERE id='search');
--> statement-breakpoint
CREATE TRIGGER `revision_search_topics_insert` AFTER INSERT ON `topics` BEGIN
 INSERT INTO data_revisions(id,revision) VALUES('search',1)
 ON CONFLICT(id) DO UPDATE SET revision=revision+1;
END;
--> statement-breakpoint
CREATE TRIGGER `revision_search_topics_update` AFTER UPDATE ON `topics` BEGIN
 INSERT INTO data_revisions(id,revision) VALUES('search',1)
 ON CONFLICT(id) DO UPDATE SET revision=revision+1;
END;
--> statement-breakpoint
CREATE TRIGGER `revision_search_topics_delete` AFTER DELETE ON `topics` BEGIN
 INSERT INTO data_revisions(id,revision) VALUES('search',1)
 ON CONFLICT(id) DO UPDATE SET revision=revision+1;
END;
--> statement-breakpoint
-- B9 · KI-Auftrag: Vorgänge mit KI-Analysen ohne die 1,2 Mio. Regel-Labels lesen (server/integrations/ai-jobs.mjs). Mit dem
-- Index nach Art liest die Vorschau nur die wenigen KI-Zeilen statt des ganzen Index (4,6 s auf dem Server).
CREATE INDEX `idx_article_analyses_kind_topic` ON `article_analyses` (`kind`,`topic_id`);
