-- plenara.X: schlanker Index für die Gliederungen des Atlas (Thema, Monat, Ort, ungelesen) im Zeitraum. Die Zählung liest
-- nur noch ihn statt der breiten Zeilen von x_cases (groupsAtOnce in plenara-x-query.mjs). Ändert keine Ergebnisse.
CREATE INDEX IF NOT EXISTS `idx_x_cases_atlas` ON `x_cases` (`date`,`label`,`month`,`region_id`,`unread`);
