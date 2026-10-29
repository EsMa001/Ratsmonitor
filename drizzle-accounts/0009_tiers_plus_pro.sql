-- Stufen seit 29.10.2026 (shared/plans.mjs, docs/produkt/stufen.md): Gast, Konto (basic), Plus (plus, 2,99 €), Pro (pro, 19,99 €),
-- Enterprise bleibt verborgen darüber. Bis hier hieß Plus intern 'pro'. Alle Zeilen mit 'pro' werden 'plus' (Freischaltungen,
-- auch die Stripe-Abos, die alle zum Plus-Preis laufen; Einladungen; „ansehen als“), danach meint 'pro' die neue Stufe Pro.
-- SQLite ändert CHECK-Bedingungen nicht: plan_grants wird neu angelegt, die Spalten von invites und sessions neu angefügt.

CREATE TABLE plan_grants_next (
  id INTEGER PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tier TEXT NOT NULL CHECK (tier IN ('basic','plus','pro','enterprise')),
  source TEXT NOT NULL CHECK (source IN ('manual','beta','stripe')),
  starts_at TEXT NOT NULL, ends_at TEXT, ref TEXT, note TEXT, created_by TEXT,
  end_notice_at TEXT
);
INSERT INTO plan_grants_next(id,user_id,tier,source,starts_at,ends_at,ref,note,created_by,end_notice_at)
  SELECT id,user_id,CASE tier WHEN 'pro' THEN 'plus' ELSE tier END,source,starts_at,ends_at,ref,note,created_by,end_notice_at FROM plan_grants;
DROP TABLE plan_grants;
ALTER TABLE plan_grants_next RENAME TO plan_grants;
CREATE INDEX plan_grants_user ON plan_grants(user_id, ends_at);
CREATE UNIQUE INDEX plan_grants_stripe ON plan_grants(ref) WHERE source='stripe';

ALTER TABLE invites ADD COLUMN tier_next TEXT;
UPDATE invites SET tier_next=CASE tier WHEN 'pro' THEN 'plus' ELSE tier END;
ALTER TABLE invites DROP COLUMN tier;
ALTER TABLE invites ADD COLUMN tier TEXT CHECK (tier IN ('basic','plus','pro','enterprise'));
UPDATE invites SET tier=tier_next;
ALTER TABLE invites DROP COLUMN tier_next;

ALTER TABLE sessions ADD COLUMN view_tier_next TEXT;
UPDATE sessions SET view_tier_next=CASE view_tier WHEN 'pro' THEN 'plus' ELSE view_tier END;
ALTER TABLE sessions DROP COLUMN view_tier;
ALTER TABLE sessions ADD COLUMN view_tier TEXT CHECK (view_tier IN ('guest','basic','plus','pro','enterprise'));
UPDATE sessions SET view_tier=view_tier_next;
ALTER TABLE sessions DROP COLUMN view_tier_next;

-- Glocken „sofort“ gibt es nicht mehr (höchstens täglich); gespeichert bleibt der Wunsch, notify.mjs setzt ihn je Stufe um
UPDATE saved_searches SET notify_freq='daily' WHERE notify_freq='instant';
UPDATE user_settings SET calendar_freq='daily' WHERE calendar_freq='instant';
