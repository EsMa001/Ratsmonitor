-- OAuth für den Kunden-MCP (docs/betrieb/claude-mcp-einbindung.md, server/accounts/oauth.mjs). Die Web-App ist der
-- Anmeldedienst: Clients registrieren sich selbst (RFC 7591, öffentliche Clients mit PKCE), Codes und Erneuerungstoken
-- stehen nur als SHA-256 da. Welche Gebiete ein Kunde sieht, steht nicht hier, sondern in der Kundendatei des Betreibers.
CREATE TABLE oauth_clients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  redirect_uris TEXT NOT NULL,
  auth_method TEXT NOT NULL DEFAULT 'none' CHECK (auth_method IN ('none','client_secret_post','client_secret_basic')),
  secret_hash TEXT,
  created_at TEXT NOT NULL,
  last_used_at TEXT
);
CREATE TABLE oauth_codes (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES oauth_clients(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  customer TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  code_challenge TEXT NOT NULL,
  resource TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT
);
CREATE INDEX oauth_codes_expires ON oauth_codes(expires_at);
-- Ein Erneuerungstoken je Zeile; family hält die Kette einer Anmeldung zusammen (Wiederverwendung → ganze Kette ungültig)
CREATE TABLE oauth_grants (
  id TEXT PRIMARY KEY,
  family TEXT NOT NULL,
  client_id TEXT NOT NULL REFERENCES oauth_clients(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  customer TEXT NOT NULL,
  resource TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  revoked_at TEXT
);
CREATE INDEX oauth_grants_user ON oauth_grants(user_id);
CREATE INDEX oauth_grants_family ON oauth_grants(family);
CREATE INDEX oauth_grants_expires ON oauth_grants(expires_at);
