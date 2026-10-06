-- Wortliste der Suche. search_words: jedes Wort (ab 3 Zeichen, kleingeschrieben, ohne Umlaute und reine Zahlen), das in
-- search_cards.search vorkommt, mit der Zahl seiner Karten; ab 201 bedeutet „zu häufig“ (keine Karten-IDs). search_postings:
-- zu jedem Wort mit höchstens 200 Karten deren IDs. Gepflegt von server/integrations/search-words.mjs, Stand in
-- system_state 'search-words'. Die Suche nutzt sie für Vorabprüfung und für schnelle Treffer seltener Wörter.
CREATE TABLE IF NOT EXISTS `search_words` (`word` text PRIMARY KEY NOT NULL, `cards` integer NOT NULL DEFAULT 0) WITHOUT ROWID;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `search_postings` (`word` text NOT NULL, `card_id` text NOT NULL, PRIMARY KEY (`word`,`card_id`)) WITHOUT ROWID;
