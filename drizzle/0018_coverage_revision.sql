-- Paket 2 · Datenstand der Quellenstände getrennt (Code-Analyse 10.10.2026, A5/B3).
-- Jeder Importschritt schreibt source_coverage (Zeitpunkt des Abrufs, auch ohne Änderung). Die Trigger aus 0004 erhöhten
-- dabei den allgemeinen Datenstand 'content', an dem Zwischenspeicher hängen, die nur Vorgänge, Versionen und Analysen
-- lesen (Gebietszahlen, Übersicht, Verarbeitungsstand, Hochrechnung). Während eines Auftrags verfielen sie alle paar
-- Sekunden. Ab hier zählen die Quellenstände einen eigenen Stand 'coverage'. Wer Quellenstände zeigt (Quellenliste,
-- Gebietsliste der Administration, Export), liest content + coverage (revision-cache.mjs, SOURCES_REVISION_SQL); die Summe
-- steigt mit jeder Änderung wie bisher. 'coverage' beginnt bei 0, die Summe ist beim Einspielen also unverändert.
DROP TRIGGER IF EXISTS revision_source_coverage_insert;
--> statement-breakpoint
DROP TRIGGER IF EXISTS revision_source_coverage_update;
--> statement-breakpoint
DROP TRIGGER IF EXISTS revision_source_coverage_delete;
--> statement-breakpoint
CREATE TRIGGER revision_coverage_insert AFTER INSERT ON source_coverage BEGIN
 INSERT INTO data_revisions(id,revision) VALUES('coverage',1)
 ON CONFLICT(id) DO UPDATE SET revision=revision+1;
END;
--> statement-breakpoint
CREATE TRIGGER revision_coverage_update AFTER UPDATE ON source_coverage BEGIN
 INSERT INTO data_revisions(id,revision) VALUES('coverage',1)
 ON CONFLICT(id) DO UPDATE SET revision=revision+1;
END;
--> statement-breakpoint
CREATE TRIGGER revision_coverage_delete AFTER DELETE ON source_coverage BEGIN
 INSERT INTO data_revisions(id,revision) VALUES('coverage',1)
 ON CONFLICT(id) DO UPDATE SET revision=revision+1;
END;
