-- Kontendatei (requirements/konten-konzept.md, Abschnitt 4). Auf dem Server eine eigene Datei (accounts.sqlite),
-- im Dev-Server dieselbe lokale D1-Datei wie die Inhalte. Buchführung: Tabelle accounts_migrations
-- (scripts/node-migrate.mjs --dir drizzle-accounts --table accounts_migrations).
-- Geheimnisse nur als SHA-256 (hex); Adressen nur dort im Klartext, wohin versendet wird; keine IP-Adressen.
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  email_verified_at TEXT NOT NULL,
  name TEXT,
  org TEXT,
  customer_type TEXT CHECK (customer_type IN ('consumer','business')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','blocked')),
  blocked_at TEXT, block_note TEXT,
  created_at TEXT NOT NULL, last_login_at TEXT, inactive_notice_at TEXT
);
CREATE TABLE user_roles (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin')),
  granted_at TEXT NOT NULL, granted_by TEXT,
  PRIMARY KEY (user_id, role)
);
CREATE TABLE plan_grants (
  id INTEGER PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tier TEXT NOT NULL CHECK (tier IN ('basic','pro','enterprise')),
  source TEXT NOT NULL CHECK (source IN ('manual','beta','stripe')),
  starts_at TEXT NOT NULL, ends_at TEXT, ref TEXT, note TEXT, created_by TEXT,
  end_notice_at TEXT
);
CREATE INDEX plan_grants_user ON plan_grants(user_id, ends_at);
CREATE TABLE consents (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  doc TEXT NOT NULL CHECK (doc IN ('agb','alter18')),
  version TEXT NOT NULL, given_at TEXT NOT NULL, withdrawn_at TEXT,
  privacy_version TEXT,
  PRIMARY KEY (user_id, doc, version)
);
CREATE TABLE invites (
  email TEXT PRIMARY KEY, tier TEXT CHECK (tier IN ('basic','pro','enterprise')), tier_until TEXT, note TEXT NOT NULL,
  invited_by TEXT, created_at TEXT NOT NULL, expires_at TEXT NOT NULL
);
CREATE TABLE login_requests (
  email_hmac TEXT NOT NULL, ip_hmac TEXT, at TEXT NOT NULL
);
CREATE INDEX login_requests_email ON login_requests(email_hmac, at);
CREATE TABLE login_flows (
  id TEXT PRIMARY KEY,
  email_hmac TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL, expires_at TEXT NOT NULL
);
CREATE INDEX login_flows_email ON login_flows(email_hmac, created_at);
CREATE TABLE login_tokens (
  id TEXT PRIMARY KEY,
  flow_hash TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  email TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('login','signup','delete','export')),
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  next TEXT,
  created_at TEXT NOT NULL, expires_at TEXT NOT NULL, used_at TEXT
);
CREATE INDEX login_tokens_email ON login_tokens(email, created_at);
CREATE INDEX login_tokens_flow ON login_tokens(flow_hash, code_hash);
CREATE INDEX login_tokens_exp ON login_tokens(expires_at);
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL, auth_at TEXT NOT NULL, last_seen_at TEXT NOT NULL,
  expires_at TEXT NOT NULL, absolute_expires_at TEXT NOT NULL,
  admin_host INTEGER NOT NULL DEFAULT 0,
  device TEXT
);
CREATE INDEX sessions_user ON sessions(user_id);
CREATE INDEX sessions_exp ON sessions(expires_at);
CREATE TABLE saved_searches (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  signature TEXT NOT NULL,
  name TEXT NOT NULL,
  ui_state TEXT NOT NULL,
  query TEXT, query_version INTEGER,
  position INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  notify_mail INTEGER NOT NULL DEFAULT 0, notify_freq TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  last_seen_at TEXT, last_notified_at TEXT,
  PRIMARY KEY (user_id, id),
  UNIQUE (user_id, signature)
) WITHOUT ROWID;
CREATE TABLE saved_articles (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic_id TEXT NOT NULL,
  follow INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1,
  snapshot TEXT,
  last_status TEXT, saved_at TEXT NOT NULL, last_seen_at TEXT,
  PRIMARY KEY (user_id, topic_id)
) WITHOUT ROWID;
CREATE INDEX saved_articles_topic ON saved_articles(topic_id);
CREATE TABLE user_settings (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  weekly INTEGER NOT NULL DEFAULT 0, weekly_day INTEGER,
  calendar TEXT NOT NULL DEFAULT '[]',
  calendar_ags TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL
);
CREATE TABLE calendar_feeds (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL, revoked_at TEXT
);
CREATE INDEX calendar_feeds_user ON calendar_feeds(user_id);
CREATE TABLE auth_events (
  id INTEGER PRIMARY KEY, at TEXT NOT NULL,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  detail TEXT
);
CREATE INDEX auth_events_at ON auth_events(at);
CREATE INDEX auth_events_user ON auth_events(user_id);
CREATE TABLE admin_audit (
  id INTEGER PRIMARY KEY, at TEXT NOT NULL, user_id TEXT NOT NULL,
  method TEXT NOT NULL, path TEXT NOT NULL, action TEXT, target TEXT,
  hour TEXT, count INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX admin_audit_steps ON admin_audit(user_id, path, action, hour) WHERE hour IS NOT NULL;
CREATE TABLE mail_outbox (
  id INTEGER PRIMARY KEY, created_at TEXT NOT NULL,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  "to" TEXT, template TEXT NOT NULL, data TEXT,
  status TEXT NOT NULL CHECK (status IN ('queued','sending','sent','failed','dropped')),
  attempts INTEGER NOT NULL DEFAULT 0, next_at TEXT, discard_after TEXT,
  provider_ref TEXT, quota TEXT NOT NULL CHECK (quota IN ('login','signup','account','operator'))
);
CREATE INDEX mail_outbox_due ON mail_outbox(status, next_at);
CREATE INDEX mail_outbox_at ON mail_outbox(created_at);
CREATE TABLE dev_mail (id INTEGER PRIMARY KEY, at TEXT, "to" TEXT, subject TEXT, text TEXT, html TEXT);
