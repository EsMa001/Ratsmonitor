-- Benachrichtigungen per E-Mail (requirements/benachrichtigungen-konzept.md, server/accounts/notify.mjs).
-- Ab wann gemeldet wird: beim Einschalten gesetzt, beim Ausschalten gelöscht. Vorher gesetzte Vormerkungen (Thema 1)
-- melden ab dem Einspielen dieser Migration, nicht rückwirkend.
ALTER TABLE saved_searches ADD COLUMN notify_since TEXT;
ALTER TABLE saved_articles ADD COLUMN follow_since TEXT;
ALTER TABLE user_settings ADD COLUMN weekly_since TEXT;
ALTER TABLE user_settings ADD COLUMN calendar_mail INTEGER NOT NULL DEFAULT 0;
ALTER TABLE user_settings ADD COLUMN calendar_freq TEXT;
ALTER TABLE user_settings ADD COLUMN calendar_since TEXT;
UPDATE saved_searches SET notify_since=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE notify_mail=1;
UPDATE saved_articles SET follow_since=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE follow=1;
UPDATE user_settings SET weekly_since=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE weekly=1;

-- Postausgang: eigenes Kontingent 'notify' (QUOTA_PER_HOUR in server/accounts/mail.mjs). SQLite ändert keine CHECK-Bedingung,
-- deshalb neu anlegen und umkopieren (niemand verweist per Fremdschlüssel auf mail_outbox).
CREATE TABLE mail_outbox_new (
  id INTEGER PRIMARY KEY, created_at TEXT NOT NULL,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  "to" TEXT, template TEXT NOT NULL, data TEXT,
  status TEXT NOT NULL CHECK (status IN ('queued','sending','sent','failed','dropped')),
  attempts INTEGER NOT NULL DEFAULT 0, next_at TEXT, discard_after TEXT,
  provider_ref TEXT, quota TEXT NOT NULL CHECK (quota IN ('login','signup','account','operator','notify'))
);
INSERT INTO mail_outbox_new SELECT id,created_at,user_id,"to",template,data,status,attempts,next_at,discard_after,provider_ref,quota FROM mail_outbox;
DROP TABLE mail_outbox;
ALTER TABLE mail_outbox_new RENAME TO mail_outbox;
CREATE INDEX mail_outbox_due ON mail_outbox(status, next_at);
CREATE INDEX mail_outbox_at ON mail_outbox(created_at);

-- Treffer, einmal je Konto, Bezug und Bericht bzw. Ereignis. ref: 's:<Such-ID>' (Suche, mit Glocke oder über den
-- Wochenbericht), 'a:<Vorgang>' (Artikel mit Glocke), 'c' (Kalender). card: Titel, Ort, Gremium, Tag, Status (öffentlich).
-- mail_id: in diese Mail des Postausgangs übernommen; dropped: verfallen (Glocke aus, Stufe ohne Benachrichtigungen).
CREATE TABLE notify_items (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ref TEXT NOT NULL,
  key TEXT NOT NULL,
  event_seq INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  due_at TEXT NOT NULL,
  card TEXT NOT NULL,
  mail_id INTEGER,
  dropped INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, ref, key)
) WITHOUT ROWID;
CREATE INDEX notify_items_due ON notify_items(due_at) WHERE mail_id IS NULL AND dropped=0;
CREATE INDEX notify_items_created ON notify_items(created_at);

-- Abbestellen ohne Anmeldung (RFC 8058): Token nur als SHA-256; ref wie oben oder '*' (alles)
CREATE TABLE notify_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ref TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX notify_tokens_created ON notify_tokens(created_at);
CREATE INDEX notify_tokens_user ON notify_tokens(user_id);
