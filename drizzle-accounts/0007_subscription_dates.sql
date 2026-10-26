-- Kontenübersicht der Administration (server/accounts/admin-accounts.mjs): Beginn des Abos, Zeitpunkt der Kündigung und
-- letzte bezahlte Rechnung, aus Stripe übernommen (server/accounts/billing.mjs). Bestehende Abos füllt der Abgleich.
ALTER TABLE subscriptions ADD COLUMN started_at TEXT;
ALTER TABLE subscriptions ADD COLUMN canceled_at TEXT;
ALTER TABLE subscriptions ADD COLUMN last_paid_at TEXT;
