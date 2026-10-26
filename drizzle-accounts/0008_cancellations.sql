-- Kündigungsbutton nach § 312k BGB (server/accounts/cancel.mjs, Seite /kuendigen) und abbestellbare Zahlungsmails.

-- Eingegangene Kündigungen als Nachweis: wann, welche Art, welcher Zeitpunkt gewünscht, was daraus wurde. Ohne Adresse im
-- Klartext (HMAC wie beim Löschprotokoll); das Konto nur, wenn es eines zur Adresse gibt. Pflegejob löscht nach 3 Jahren.
CREATE TABLE cancellations (
  id INTEGER PRIMARY KEY,
  received_at TEXT NOT NULL,
  email_hmac TEXT NOT NULL,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK (kind IN ('ordinary','extraordinary')),
  reason TEXT,
  wanted TEXT NOT NULL,
  subscription_id TEXT,
  ends_at TEXT,
  result TEXT NOT NULL
);
CREATE INDEX cancellations_received ON cancellations(received_at);

-- Mails zu Zahlungen und zum Ende von Plus (plus_paid, plus_ending): an, bis das Konto sie abbestellt
ALTER TABLE user_settings ADD COLUMN billing_mails INTEGER NOT NULL DEFAULT 1;
