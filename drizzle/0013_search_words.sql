-- Wortliste der Suche. search_words: jedes Wort (ab 3 Zeichen, kleingeschrieben, ohne Umlaute und reine Zahlen), das in
-- search_cards.search vorkommt, mit der Zahl seiner Karten; ab 201 bedeutet „zu häufig“ (keine Karten-IDs). search_postings:
-- zu jedem Wort mit höchstens 200 Karten deren IDs. Gepflegt von server/integrations/search-words.mjs, Stand in
-- system_state 'search-words'. Die Suche nutzt sie für Vorabprüfung und für schnelle Treffer seltener Wörter.
CREATE TABLE IF NOT EXISTS `search_words` (`word` text PRIMARY KEY NOT NULL, `cards` integer NOT NULL DEFAULT 0) WITHOUT ROWID;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `search_postings` (`word` text NOT NULL, `card_id` text NOT NULL, PRIMARY KEY (`word`,`card_id`)) WITHOUT ROWID;
--> statement-breakpoint
-- Häufige Wörter (über 200 Einträge): die genauen Zahlen der Suche nach dem Wort ohne Filter. search_word_areas je Gebiet
-- (Karte, Zoom, Abzeichen), search_word_facets je Ebene, Thema und Status (Filterzähler). Dann braucht die Zählabfrage keine
-- Einträge mehr durchzuzählen. Gelten nur beim passenden Datenstand (system_state 'search-words').
CREATE TABLE IF NOT EXISTS `search_word_areas` (`word` text NOT NULL, `region_id` text NOT NULL, `n` integer NOT NULL, PRIMARY KEY (`word`,`region_id`)) WITHOUT ROWID;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `search_word_facets` (`word` text NOT NULL, `kind` text NOT NULL, `label` text NOT NULL, `status` text NOT NULL, `n` integer NOT NULL, PRIMARY KEY (`word`,`kind`,`label`,`status`)) WITHOUT ROWID;
