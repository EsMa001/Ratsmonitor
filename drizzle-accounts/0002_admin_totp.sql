-- Zweiter Faktor für die Administration über die öffentliche Adresse und „Ansehen als Stufe“ für Admins
-- (requirements/konten-konzept.md 6.4). Der Schlüssel liegt verschlüsselt (AES-GCM, Schlüssel aus ACCOUNTS_SECRET).
CREATE TABLE user_totp (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  secret TEXT NOT NULL,
  created_at TEXT NOT NULL, confirmed_at TEXT,
  last_step INTEGER NOT NULL DEFAULT 0
);
-- Zweiter Faktor in dieser Sitzung bestätigt (gilt 12 Stunden)
ALTER TABLE sessions ADD COLUMN admin_verified_at TEXT;
-- Admins: Seite mit den Rechten einer anderen Stufe ansehen (NULL = eigene Stufe)
ALTER TABLE sessions ADD COLUMN view_tier TEXT CHECK (view_tier IN ('guest','basic','pro','enterprise'));
