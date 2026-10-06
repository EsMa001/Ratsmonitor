-- Alle Wörter (ab 3 Zeichen, kleingeschrieben, ohne Umlaute und reine Zahlen), die in search_cards.search vorkommen.
-- Nur zur Vorabprüfung der Suche: ein Wort aus dieser Tabelle hat sicher Treffer, ein Begriff ohne Wort darin hat keine
-- (sofern die Tabelle aktuell ist, Stand in system_state 'search-words'). Gepflegt von server/integrations/search-words.mjs.
CREATE TABLE IF NOT EXISTS `search_words` (`word` text PRIMARY KEY NOT NULL) WITHOUT ROWID;
