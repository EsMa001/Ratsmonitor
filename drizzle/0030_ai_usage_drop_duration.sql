-- Die Bearbeitungsdauer je Bericht wird weder gespeichert noch ausgewertet (Entscheidung 13.10.2026); 0029 hatte die
-- Spalte angelegt, gefüllt wurde sie nie.
ALTER TABLE `ai_usage` DROP COLUMN `duration_ms`;
