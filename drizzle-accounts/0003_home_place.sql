-- Favorit-Ort im Konto (plenara.X: „Neu in meinem Ort“), vorher nur im Browser gemerkt
ALTER TABLE user_settings ADD COLUMN home_ags TEXT;
ALTER TABLE user_settings ADD COLUMN home_name TEXT;
