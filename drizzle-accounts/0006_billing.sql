-- Bezahlung mit Stripe, zunächst im Testmodus (requirements/konten-konzept.md 9.1, requirements/zahlungsdienste-recherche-2026-10-26.md,
-- server/accounts/billing.mjs). Freigeschaltet wird nur über plan_grants: eine Zeile je Abo (source='stripe', ref = Abo-ID),
-- die jede bezahlte Abrechnung bis Periodenende plus Kulanz verlängert. Karten- und Kontodaten liegen nur bei Stripe.

-- Stripe-Kunde je Konto (cus_…); mit dem Konto gelöscht
CREATE TABLE billing_customers (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  customer_id TEXT NOT NULL UNIQUE,
  livemode INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

-- Letzter bekannter Stand je Abo (sub_…), aus Stripe neu abgerufen; user_id wird beim Löschen des Kontos leer
CREATE TABLE subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  customer_id TEXT NOT NULL,
  status TEXT NOT NULL,
  price_id TEXT,
  period_end TEXT,
  -- Kündigung vorgemerkt: wann das Abo endet (Stripe cancel_at, sonst Periodenende bei cancel_at_period_end); NULL = läuft weiter
  cancel_at TEXT,
  ended_at TEXT,
  livemode INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);
CREATE INDEX subscriptions_user ON subscriptions(user_id);
CREATE INDEX subscriptions_customer ON subscriptions(customer_id);

-- Empfangene Meldungen (evt_…), nur ID und Art, kein Inhalt: jede wird einmal verarbeitet; Pflegejob löscht nach 90 Tagen
CREATE TABLE billing_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  received_at TEXT NOT NULL,
  done_at TEXT,
  error TEXT
);

-- Eine Zeile in plan_grants je Stripe-Abo
CREATE UNIQUE INDEX plan_grants_stripe ON plan_grants(ref) WHERE source='stripe';
