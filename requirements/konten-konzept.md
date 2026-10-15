# Konzept Thema 1: Konten und Anmeldung

Stand: 13.10.2026. Ablage: `requirements/konten-konzept.md`. Pfade sind relativ zu `C:\Git\vor-ort-quellcode`.

Grundlage sind fünf Bestandsaufnahmen, drei Entwürfe mit Gutachten, eine Nachprüfung im Repo und eine Prüfung durch fünf Gutachter (Sicherheit, Datenschutz, Code, Betrieb, Nutzer). Die Leitlinie: Die geschlossene Testphase soll mit wenig Neuem erreicht werden, ohne Abstriche bei der Sicherheit. Vorhandene Muster werden weiterverwendet. Nico muss lokal nichts Neues lernen.

## Umsetzungsstand (13.10.2026, Branch `konten`, nicht ausgerollt)

**Umgesetzt:** AP1 bis AP6 und AP8, aus AP9 der technische Teil (Pflegejob, verschlüsselte Sicherung, Einheiten, Caddy-Fassungen,
`check-caddy.mjs`, Betriebsanleitung), AP10 mit 47 Kontotests und zwei Durchläufen gegen den Node-Build. Eine Sicherheitsprüfung
durch ein zweites Modell (Opus; Fable war am Limit) fand 25 Punkte; die Pflichtpunkte und die meisten übrigen sind behoben.

**Abweichungen vom Konzept:**
- Konto ohne freigeschaltete Stufe hat Gastrechte (Abschnitt 9.1), nicht `basic`.
- `accounts.env` liegt in `/etc/ratsmonitor/` (nicht im Kontenordner, den der Web-Benutzer besitzt).
- Grenzen beim Anfordern je Adresse und Absender (3 in 15 min, 10 am Tag; 30 je Adresse), jeder neue Link bekommt einen neuen Ablauf.
- Sicherung der Kontendatei mit eigenem Skript `deploy/node/accounts-backup.sh` statt `PREFIX` in `backup.sh`.
- Ohne `RM_ACCESS` startet der Server nur, wenn keine Kontendatei eingerichtet ist (dann offen wie bisher).
- Der alte Admin-Weg gilt automatisch, solange keine Kontendatei eingerichtet ist und `ADMIN_LEGACY_HEADER` fehlt.
- `features.json` entfällt; `deploy.sh` prüft stattdessen `/api/internal/health` samt Zugang.
- Admin-Protokoll zentral in der Middleware (je Admin, Pfad, Methode und Stunde), nicht je Route.

**Offen:** AP0 und AP11 auf dem Server (Schritte in `docs/betrieb/node-server.md`, „Konten“), AP7 (Domain, Mailanbieter,
`MAIL_TRANSPORT=http` an den gewählten Anbieter anpassen: `providerPayload` in `server/accounts/mail.mjs`), Rechtstexte
(Datenschutz, AGB, FAQ; `PRIVACY_VERSION` erhöhen), Prüfung durch Fable und vor der Öffnung durch eine Fachperson (11.1),
Gastgrenze über Filter (Gäste können mit Filtern weiterblättern), Push-Entscheidung, `weeklyDay` „täglich“.

## 1. Ziel und Abgrenzung

**Ziel:** eine geschlossene Testphase mit 10 bis 30 eingeladenen Personen.

- Echte Konten mit Anmeldung per E-Mail-Link oder 8-stelligem Code, ohne Passwort.
- Sitzungen liegen auf dem Server. Es gibt Abmelden, eine Geräteliste und „überall abmelden“.
- Die Stufe hängt am Konto, und der Server setzt die Grenzen durch. Registrierung und Einladung vergeben von selbst nie eine bezahlte Stufe.
- Gespeicherte Suchen, gemerkte Artikel, Kalendergebiete und Wochenbericht-Einstellungen liegen im Konto. Was heute im Browser liegt, wird einmal übernommen.
- Admin ist eine Rolle am Konto, für Max und Nico. Admin-Rechte gelten nur über den Tunnel. Die Kopfzeilen-Kennung aus Caddy und das gemeinsame Basic-Auth-Passwort entfallen auf dem Node-Server.
- Datenauskunft und Konto löschen gehen in Selbstbedienung.
- Mailversand für Anmeldung und Kontovorgänge, über einen Postausgang, der Neustarts übersteht.
- Der Unterbau trägt Benachrichtigungen (Thema 2) und Bezahlung (Thema 3).

**Nicht Teil von Thema 1:**

- Versand von Benachrichtigungen und weitere Empfänger (Thema 2). Die Schalter dafür sind in Thema 1 deaktiviert (Abschnitt 7).
- Zahlung und Rechnungen (Thema 3).
- Organisationen mit Plätzen, SSO für Kommunen, API-Schlüssel, Kunden-MCP über das Netz.
- Zweiter Faktor (TOTP oder Passkey). Er ist als Option vorgesehen, siehe Abschnitt 6.4.
- Adresse selbst ändern. In der Testphase erledigt das der Admin per CLI.
- Offene Selbstregistrierung. Sie ist nur vorbereitet.
- Konten im Cloudflare-Build. Dort bleibt der bisherige Admin-Weg bis D3 bestehen (Abschnitt 13).

## 2. Ausgangslage

**Identität und Admin**

- `app/chatgpt-auth.ts:20-43` liest `oai-authenticated-user-*`.
- `deploy/node/Caddyfile:26-28` setzt diese Kopfzeilen im gemeinsamen Snippet `(ratsmonitor_app)` für **jede** Anfrage. Beide Sites nutzen das Snippet: der Tunnel `localhost:8080`/`127.0.0.1:8080` (`:42-45`) und sslip.io. Der sslip-Block steht im Repo nur als Kommentar (`:47-57`), die wirksame Fassung liegt nur auf dem Server.
- Folge: Jeder mit dem Basic-Auth-Passwort ist Admin.
- `server/integrations/admin-access.mjs` kennt genau einen Besitzer (`system_state` `admin-owner-v1`). Gesetzt wird er über `scripts/bind-admin-owner.mjs`.
- `requireAdmin()` (`server/services/admin-auth.ts:6`) ist der Engpass für 26 der 27 Routendateien unter `app/api/admin`. Die Ausnahme ist `claim`. **Die Seite `app/admin/page.tsx` läuft nicht über `requireAdmin()`.** Sie ruft selbst `getChatGPTUser()` und `adminAccess(env.DB,user)` auf und enthält die Freischaltmaske (`:34-47`).
- `ADMIN_HEADERS` (`admin-auth.ts:5`) und `admin-http.ts:8` setzen schon `Vary: Cookie, oai-authenticated-user-id`.

**Nutzerseite**

- Es gibt keine echten Konten. `components/ratsmonitor/lib/testAuth.ts` arbeitet mit Passwort-Hashes in `localStorage`. `info/AccountPages.tsx` hat Registrierung mit Tarifwahl und Passwort (`:109-157`), „Passwort vergessen?“ (`:265`) und nennt das Testpasswort auch im Produktionsbuild (`:286-288`).
- `/registrieren` existiert als Seite (`app/(monitor)/registrieren/page.tsx`) und als Client-Route (`lib/routes.ts:8`). Elf Stellen verweisen darauf oder bieten „Pro wählen“ an (AccountMenu, Footer, PlanCards, TierNotice, GateDialog, PreisePage, MainMenu, KalenderPage, InfoPages, content.ts, pageTitle.ts).
- Stufen gibt es nur im Frontend (`lib/tier.ts:27-35`, `lib/entitlements.ts`). Jeder kann sich `enterprise` setzen.
- Suchen, Artikel, Kalender und Profil liegen im Browser, siehe Abschnitt 8. `SavedSearch.notify` enthält `email` und `recipients` (`types.ts:118-121`).
- Der Abgleich zwischen Tabs (`lib/otherTab.ts`) hängt an `storage`-Ereignissen genau dieser Schlüssel.

**Server**

- `/api/search`, `/api/calendar*`, 13 Routen unter `/api/analytics/*` und `/api/lena` prüfen keine Stufe. Lena begrenzt die Anfragen nach `cf-connecting-ip` und sonst nach der ganzen XFF-Kette (`app/api/lena/route.ts:17`).
- Web-Push (`server/services/push.ts`, `push_subscriptions` in der Inhaltsdatei) hat keinen Nutzerbezug, und die Oberfläche ist nicht eingebunden.
- Außer der Dokument-Route (`app/api/dokument/route.ts:30`) setzt nichts im Repo CSP, HSTS oder `X-Frame-Options`.

**Laufzeit**

- Node 24 mit `node:sqlite`, synchron (`server/node/d1-sqlite.mjs`). Eine lange Abfrage hält alle Besucher an.
- Busy-Timeout im Web 5 s. Der Import wartet bis 30 s auf Sperren (`IMPORT_BUSY_TIMEOUT_MS`).
- Der Env-Proxy (`server/node/cloudflare-workers.mjs:57-71`) liefert `DB` und `AI_LOCAL_SOURCES` und reicht alle anderen Schlüssel aus `process.env` durch. Die Verbindung wird über `globalThis` geteilt (`:20-21`).
- `serve.mjs` wärmt 30 s nach dem Start und danach alle 10 Minuten die Analytics-Routen ohne Cookie vor (`:76-84`). Beim Beenden schließt es nur die Inhaltsdatei und ruft `process.exit(0)`, offene Promises wartet es nicht ab (`:92-107`).
- Migrationen laufen über `scripts/node-migrate.mjs`. Verzeichnis `drizzle/` und Tabelle `d1_migrations` sind fest eingetragen. `deploy.sh` spielt keine Migrationen ein (`:7`, `:38`), liest nur `ratsmonitor.env` (`:28-29`) und verlangt nach dem Neustart HTTP 200 für `/` und `/api/search?level=city` (`:52-59`).
- `middleware.ts` greift nur auf `/admin` und `/api/admin`. Für jede Antwort dort setzt es `Cache-Control: private, no-store` und `X-Robots-Tag` (`:2-3`).
- vinext wartet die Middleware ab, überspringt sie aber bei einer gültigen `x-prerender-revalidate`-Kopfzeile (`node_modules/vinext/dist/server/app-rsc-handler.js:215`). `after()` aus `next/server` ist vorhanden und nutzt `waitUntil` (`shims/server.js:811-835`).
- `ratsmonitor.service` läuft mit `ProtectSystem=strict` und `ReadWritePaths=/srv/ratsmonitor/data` (`:25-30`). Alle Einheiten laufen als `User=ratsmonitor`.
- `SITE_URL` gibt es schon (`ratsmonitor.env.example:25`). Gelesen wird sie in `app/layout.tsx:5` (`metadataBase`) und in `scripts/run-imports.mjs`.

**Sicherung und Kopien**

- `deploy/node/backup.sh` hat `DATABASE_FILE`, `BACKUP_DIR` und `KEEP` als Parameter (`:12-14`). Fest ist nur das Präfix `ratsmonitor-` (`:18-38`). `KEEP=2`. Die Sicherung schreibt zuerst eine unverschlüsselte `.part`-Kopie.
- Entwicklerkopien kommen aus diesen Sicherungen (`docs/betrieb/node-server.md:125`).
- „Datenbank übertragen“ ersetzt die ganze Server-Datei (`:119`).
- Für journald ist im Repo keine Frist eingestellt, obwohl das Löschkonzept 7 Tage nennt (`docs/recht/loeschkonzept.md:16`).

## 3. Architekturentscheidung

### 3.1 Eigenbau in der App

Ohne Passwörter kann ein fremder Dienst wenig besser als die App selbst: Zufallstoken erzeugen, nur als Hash speichern, einmal einlösen, Ablauf, Cookie, Ratenbegrenzung. All das geht mit WebCrypto, `fetch` und der D1-Schnittstelle und läuft damit unter Node und Miniflare gleich. Der Umfang liegt bei etwa 1.000 Zeilen Servercode plus Tests.

Eigene Tabellen für Stufen, Daten, Benachrichtigungen und Stripe braucht es ohnehin. Diese Bausteine sind schon da:

- `requireSameOrigin` (`admin-access.mjs:17-20`)
- das Muster für Grenzen in `app/api/lena/route.ts:6-14`
- `cookies()` und `after()` aus vinext
- `node:test`

`safeRelativeReturnPath` (`app/chatgpt-auth.ts:62-75`) wird **nicht** übernommen. Die Funktion prüft `//` nur vor der Normalisierung. `/.//evil.com` ergibt deshalb `//evil.com`, eine offene Weiterleitung. `safeNext` wird neu geschrieben (Abschnitt 11).

**Verworfene Alternativen:**

| Alternative | Grund |
|---|---|
| Auth0, Clerk, Cognito, Firebase | US-Anbieter, Drittlandübermittlung, Kontodaten bei Dritten |
| Hanko (EU-Cloud) | fremder Dienst im Anmeldepfad, AVV, laufende Kosten, eigene Tabellen bleiben nötig |
| Keycloak, Zitadel, Ory Kratos (selbst betrieben) | zweiter Dienst, meist mit PostgreSQL, eigene Sicherung und Updates, lokal unter Windows mitzustarten; für 30 Personen zu groß |
| Authelia vor Caddy | keine Kundenkonten, Nutzer stehen in einer Datei oder in LDAP |
| Auth.js, Better Auth | Adapter für D1 und vinext 1.0.0-beta ungeprüft, viel Code für Passwort und OAuth, eigenes Schema |
| Passwörter | scrypt oder Argon2 brauchen `node:crypto` und brechen Miniflare; dazu Zurücksetzen und Credential Stuffing; widerspricht `docs/strategie/kommerzialisierungsstrategie.md:31` |
| Basic-Auth je Person in Caddy | keine Daten je Person, kein Abmelden, scheitert an Mail-Links und Kalender-Abos |
| Cloudflare Access | technisch auch vor dem VPS möglich, aber ein zweiter Identitätsweg neben den Konten |

**Neu bewerten,** wenn Kommunen die Anmeldung über ihren eigenen Identitätsdienst verlangen, wenn Organisationen mit Plätzen kommen oder wenn ein zweiter Faktor für alle Pflicht wird. Dann wird ein Dienst über eine Tabelle `user_identities` angebunden, und die Konto-ID bleibt dieselbe.

**Gegen das Risiko des Eigenbaus:**

- kleiner Umfang
- ein Test je Regel (Abschnitt 13)
- Abnahme gegen OWASP ASVS, Kapitel 2 und 3, und `/security-review` vor dem ersten Tester

### 3.2 Eigene Datei `accounts.sqlite`

Konten und alles mit Personenbezug liegen in `/srv/ratsmonitor/accounts/accounts.sqlite`. Der Ordner hat die Rechte 700, die Datei 600, Eigentümer ist `ratsmonitor`. Die App sieht die Datei als `env.ACCOUNTS` (D1-Schnittstelle). Konfiguriert wird sie über `ACCOUNTS_FILE`, und zwar nur in `/etc/ratsmonitor/accounts.env` (root:root 600), nicht in `ratsmonitor.env`.

Gründe:

1. Entwicklerkopien der Inhaltsdatei bleiben frei von Kontodaten.
2. „Datenbank übertragen“ zerstört keine Konten. Eine alte Inhaltssicherung bringt keine gelöschten Konten zurück.
3. Anmeldungen konkurrieren nicht mit Import, Wortliste und PDF-Kette um Schreibsperren.
4. `PRAGMA secure_delete=ON` ist bei einer kleinen Datei billig.
5. MCP und Datenexport öffnen die Kontendatei nicht. Der Kunden-MCP öffnet `databaseFile` aus seiner Betreiberkonfiguration (`server/node/mcp-runtime.mjs:61`). Ein Test stellt sicher, dass dort nie `ACCOUNTS_FILE` steht.

**Der Preis:**

- Kein SQL über beide Dateien hinweg, denn D1 kennt kein `ATTACH`.
- Verweise auf `topics.id` sind weich und werden im App-Code aufgelöst, auch `mergedInto` (`server/repositories/topics.ts:82`).

**Wer die Kontendatei öffnet:** der Webdienst, `manage.mjs`, `maintenance.mjs` und die Kontosicherung, alle als `ratsmonitor`. Nie öffnen sie Import, PDF-Jobs, Wortliste, Startseite oder MCP. Durchgesetzt wird das so:

- `ratsmonitor.service` und `ratsmonitor-accounts.service` bekommen `ReadWritePaths=/srv/ratsmonitor/data /srv/ratsmonitor/accounts` bzw. `ReadWritePaths=/srv/ratsmonitor/accounts` und laden `accounts.env` als zweites `EnvironmentFile`.
- Alle übrigen Einheiten (`ratsmonitor-import*`, `-pdf-job`, `-pdf-nightly`, `-search-words`, `-startseite-trends`, `-backup`) bekommen `InaccessiblePaths=/srv/ratsmonitor/accounts`. Gerade die PDF-Jobs verarbeiten fremde Inhalte. Eine Lücke in einem Parser darf deshalb keine Konten offenlegen.
- Ein Test (`accounts-separation.test.mjs`) prüft diese Zeilen in jeder Datei `deploy/node/ratsmonitor-*.service`.
- `manage.mjs` und `maintenance.mjs` brechen ab, wenn der aufrufende Benutzer nicht Eigentümer von `ACCOUNTS_FILE` ist. Root würde sonst `-wal`/`-shm` als root anlegen, und der Dienst könnte danach nicht mehr schreiben.

Ein eigener Benutzer für die Kontendatei ist vorerst verworfen. Der Webdienst muss sie lesen und läuft wie die Jobs als `ratsmonitor`. `InaccessiblePaths` erreicht die Trennung ohne zweiten Benutzer.

**Verbindung:** `openD1(file, {busyTimeoutMs: 2000, secureDelete: true})`. `openD1` bekommt dafür die Option `secureDelete`. Die Verbindung liegt wie `DB` unter einem eigenen `globalThis`-Schlüssel (`Symbol.for('ratsmonitor.node.accounts')`), damit die Pakete rsc, ssr und Middleware dieselbe Verbindung nutzen. `stop()` in `serve.mjs` schließt beide Verbindungen.

**Lokal ohne zweite Miniflare-Bindung:**

- Im Dev-Server (`import.meta.env.DEV`) liefert `accountsDb(env)` ohne weiteren Schalter `env.DB`. `.dev.vars` steht in `.gitignore` und lässt sich nicht verteilen, deshalb braucht es dort keinen Eintrag.
- In Builds liefert `accountsDb(env)` nur `env.ACCOUNTS`. Der Rückfall auf `env.DB` gilt im Build nur mit dem ausdrücklichen Schalter `ACCOUNTS_IN_MAIN_DB=1`, etwa für einen lokalen Node-Build. In Produktion gibt es keinen stillen Rückfall. Fehlt `env.ACCOUNTS`, antworten die Kontorouten mit 503.
- So bleibt unter `.wrangler/state/v3/d1/` genau eine Datei. Die 18 eingecheckten Skripte, die „die erste `.sqlite`“ nehmen, und `server/node/ai-local-runtime.mjs:9-11` laufen unverändert.
- Eine zweite Bindung ist verworfen, weil sie zuerst den Umbau dieser Skripte erzwänge. Der Helfer `contentDatabase()` kann später folgen.

**Nur unter Node verfügbare Fähigkeiten** (Löschprotokoll, `wal_checkpoint`, `secure_delete`) laufen über einen Haken im Env-Proxy, nach dem Muster von `AI_LOCAL_SOURCES`: `env.ACCOUNTS_HOOKS = {logDeletion(hash), checkpoint()}`. Unter Miniflare ist der Haken ein No-op. `server/accounts/` bleibt damit bei D1-API, WebCrypto und `fetch`.

**Verworfen:** gleiche Datei auf dem Server mit Bereinigungsskript für Kopien, `system_state` als Speicher, PostgreSQL.

### 3.3 Wo der Code liegt

- **`server/accounts/`** (nur D1-API, WebCrypto und `fetch`): `db.mjs`, `tokens.mjs`, `sessions.mjs`, `login.mjs`, `users.mjs`, `entitlements.mjs`, `rate-limit.mjs`, `user-data.mjs`, `mail.mjs`, `mail-outbox.mjs`, `mail-templates.mjs`, `access.mjs` (Gate).
- **`server/services/session.ts`:** `getSession()`, `requireUser()`, `requireFeature(name)`, `requireAccess()`, `adminState()`, `requireAdmin()`, `requireAdminWrite(request, {audit})`.
- **`server/services/http-guards.mjs`:** `requireSameOrigin` (aus `admin-access.mjs`, mit neutralem Fehlertext), `clientIp(request)`, `isAdminHost(request)`, `internalCall(request)`.
- **`shared/safe-next.mjs`:** `safeNext(path)`. Server und Anmeldeseite nutzen dieselbe Funktion.
- **`shared/plans.mjs`:** Stufen, Grenzen, Funktionen, Preis-Platzhalter, `FREE_ANALYTICS`.
- **Routen:**
  - `app/api/auth/{link,peek,verify,code,refresh,logout}/route.ts`
  - `app/api/me/route.ts` und `app/api/me/{sessions,searches,articles,settings,calendar-feed,calendar.ics,import,export,delete}/route.ts`
  - `app/api/calendar/feed/[token]/route.ts`
  - `app/api/internal/{health,outbox}/route.ts` (Bearer `IMPORT_TOKEN`)
  - nur im Dev-Server: `app/api/dev/{login,mails,tier}/route.ts`
- **Seiten:** `app/(monitor)/anmelden/bestaetigen/page.tsx`, `app/(monitor)/konto/...` (bestehende Kontoseiten), `/registrieren` leitet auf `/anmelden` um.
- **Skripte:** `scripts/accounts/{manage,maintenance}.mjs`, `scripts/check-caddy.mjs`. Ein Wrapper `deploy/node/ratsmonitor-accounts` wird nach `/usr/local/bin/` installiert.
- **Migrationen:** `drizzle-accounts/0001_accounts.sql`.

## 4. Datenmodell

Regeln:

- Zeitpunkte sind ISO-UTC-Text mit Millisekunden. IDs sind zufällig.
- Geheimnisse werden nur als SHA-256 (hex) von mindestens 256 Bit Zufall gespeichert. Ein Pepper ist bei dieser Entropie nicht nötig. Eine Sicherung erlaubt damit keine Anmeldung.
- Zählschlüssel für Adressen sind HMAC-SHA-256 mit einem Schlüssel aus `ACCOUNTS_SECRET` (HKDF, Zweck `email-rate`), nie die Adresse im Klartext.
- Die E-Mail bleibt in `users`, `login_tokens` und `invites` im Klartext, weil an sie versendet wird.
- Keine IP-Adressen, keine vollen User-Agents, keine Mailinhalte nach dem Versand (außer `dev_mail` im Dev-Modus).
- In `auth_events.detail` und `admin_audit.target` steht nur `users.id`, nie eine Adresse.

```sql
-- drizzle-accounts/0001_accounts.sql (Buchführung: accounts_migrations)
CREATE TABLE users (
  id TEXT PRIMARY KEY,                 -- 'u_' + 16 Byte base64url; später client_reference_id bei Stripe
  email TEXT NOT NULL UNIQUE,          -- trim, NFC, klein, ≤254
  email_verified_at TEXT NOT NULL,     -- Konto entsteht erst mit bestätigter Adresse
  name TEXT,
  org TEXT, customer_type TEXT CHECK (customer_type IN ('consumer','business')), -- erst ab Thema 3 erhoben
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
CREATE TABLE plan_grants (             -- wirksame Stufe = höchste gültige Zeile, sonst 'basic'
  id INTEGER PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tier TEXT NOT NULL CHECK (tier IN ('basic','pro','enterprise')),
  source TEXT NOT NULL CHECK (source IN ('manual','beta','stripe')),
  starts_at TEXT NOT NULL, ends_at TEXT, ref TEXT, note TEXT, created_by TEXT,
  end_notice_at TEXT                   -- Mail „Testzugang endet“ verschickt
);
CREATE INDEX plan_grants_user ON plan_grants(user_id, ends_at);
CREATE TABLE consents (                -- nur Vertragsnachweise; keine „Zustimmung zur Datenschutzerklärung“
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  doc TEXT NOT NULL CHECK (doc IN ('agb','alter18')),
  version TEXT NOT NULL, given_at TEXT NOT NULL, withdrawn_at TEXT,
  privacy_version TEXT,                -- Version der Datenschutzinformation beim Registrieren (ohne Haken)
  PRIMARY KEY (user_id, doc, version)
);
CREATE TABLE invites (                 -- wird beim Einlösen gelöscht
  email TEXT PRIMARY KEY, tier TEXT, tier_until TEXT, note TEXT NOT NULL, -- note: Anlass/Zustimmung
  invited_by TEXT, created_at TEXT NOT NULL, expires_at TEXT NOT NULL      -- Standard 30 Tage
);
CREATE TABLE login_requests (          -- jede Linkanforderung, für alle Adressarten; 24 h
  email_hmac TEXT NOT NULL, at TEXT NOT NULL
);
CREATE INDEX login_requests_email ON login_requests(email_hmac, at);
CREATE TABLE login_flows (             -- ein Zustand je Browser-Ablauf, für alle Adressarten; 24 h
  id TEXT PRIMARY KEY,                 -- SHA-256(Flow-Cookie)
  email_hmac TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0, -- Codeversuche, höchstens 5
  created_at TEXT NOT NULL, expires_at TEXT NOT NULL
);
CREATE INDEX login_flows_email ON login_flows(email_hmac, created_at);
CREATE TABLE login_tokens (            -- je Adresse und Zweck höchstens eines offen
  id TEXT PRIMARY KEY,                 -- SHA-256(Link-Token)
  flow_hash TEXT NOT NULL,             -- = login_flows.id
  code_hash TEXT NOT NULL,             -- SHA-256(purpose || flow_hash || Code)
  email TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('login','signup','delete','export')),
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE, -- NULL bei signup
  next TEXT,
  created_at TEXT NOT NULL, expires_at TEXT NOT NULL, used_at TEXT
);
CREATE INDEX login_tokens_email ON login_tokens(email, created_at);
CREATE INDEX login_tokens_flow ON login_tokens(flow_hash, code_hash);
CREATE INDEX login_tokens_exp ON login_tokens(expires_at);
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,                 -- SHA-256(Cookie-Wert)
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL, auth_at TEXT NOT NULL, last_seen_at TEXT NOT NULL,
  expires_at TEXT NOT NULL, absolute_expires_at TEXT NOT NULL,
  admin_host INTEGER NOT NULL DEFAULT 0, -- über ADMIN_HOSTS entstanden
  device TEXT                          -- grob, z. B. 'Firefox · Windows'
);
CREATE INDEX sessions_user ON sessions(user_id);
CREATE INDEX sessions_exp ON sessions(expires_at);
CREATE TABLE saved_searches (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id TEXT NOT NULL,                    -- Client-UUID
  signature TEXT NOT NULL,             -- signature() aus lib/savedSearch.ts:29
  name TEXT NOT NULL,
  ui_state TEXT NOT NULL,              -- SearchSnapshot nach Positivliste, ohne id/name/notify/created/lastSeen, ≤8 KB
  query TEXT, query_version INTEGER,   -- geprüft mit parseMonitorSearch
  position INTEGER NOT NULL,           -- Reihenfolge der Liste
  active INTEGER NOT NULL DEFAULT 1,
  notify_mail INTEGER NOT NULL DEFAULT 0, notify_freq TEXT, -- in Thema 1 nur Vormerkung
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  last_seen_at TEXT, last_notified_at TEXT,
  PRIMARY KEY (user_id, id),
  UNIQUE (user_id, signature)
) WITHOUT ROWID;
CREATE TABLE saved_articles (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic_id TEXT NOT NULL,
  follow INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1,
  snapshot TEXT,                       -- Titel, Datum, Gebiet, Status vom Server (search_cards), nie vom Client
  last_status TEXT, saved_at TEXT NOT NULL, last_seen_at TEXT,
  PRIMARY KEY (user_id, topic_id)
) WITHOUT ROWID;
CREATE INDEX saved_articles_topic ON saved_articles(topic_id);
CREATE TABLE user_settings (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  weekly INTEGER NOT NULL DEFAULT 0, weekly_day INTEGER,
  calendar TEXT NOT NULL DEFAULT '[]',     -- [{ags,name,km}], ≤200, für die Oberfläche
  calendar_ags TEXT NOT NULL DEFAULT '[]', -- aufgelöste AGS-Liste (Browser rechnet den Umkreis), ≤200, parseAgs
  updated_at TEXT NOT NULL
);
CREATE TABLE calendar_feeds (
  id TEXT PRIMARY KEY,                 -- SHA-256(Feed-Token)
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL, revoked_at TEXT
);
CREATE TABLE auth_events (             -- 90 Tage
  id INTEGER PRIMARY KEY, at TEXT NOT NULL,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,                  -- login, logout, logout_all, revoked, role, tier, blocked, email_changed, export, code_locked
  detail TEXT                          -- JSON nur mit IDs, ohne Token, Adressen, IP
);
CREATE INDEX auth_events_at ON auth_events(at);
CREATE TABLE admin_audit (             -- 12 Monate, nur auslösende Aktionen; Schritte je Stunde zusammengefasst
  id INTEGER PRIMARY KEY, at TEXT NOT NULL, user_id TEXT NOT NULL,
  method TEXT NOT NULL, path TEXT NOT NULL, action TEXT, target TEXT, -- target nur IDs
  hour TEXT, count INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX admin_audit_steps ON admin_audit(user_id, path, action, hour) WHERE hour IS NOT NULL;
CREATE TABLE mail_outbox (             -- Postausgang; Inhalt nach Versand gelöscht
  id INTEGER PRIMARY KEY, created_at TEXT NOT NULL,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  "to" TEXT, template TEXT NOT NULL, data TEXT,  -- "to" und data nach Versand auf NULL
  status TEXT NOT NULL CHECK (status IN ('queued','sent','failed','dropped')),
  attempts INTEGER NOT NULL DEFAULT 0, next_at TEXT, discard_after TEXT, -- Anmeldemails: nach 15 min verwerfen
  provider_ref TEXT, quota TEXT NOT NULL CHECK (quota IN ('login','signup','account'))
);
CREATE INDEX mail_outbox_due ON mail_outbox(status, next_at);
CREATE INDEX mail_outbox_at ON mail_outbox(created_at);  -- 30 Tage, dient zugleich als mail_log
-- nur im Dev-Modus und in Tests (MAIL_TRANSPORT=outbox):
CREATE TABLE dev_mail (id INTEGER PRIMARY KEY, at TEXT, "to" TEXT, subject TEXT, text TEXT, html TEXT);
```

**Wirksame Stufe:** `effectiveTier(user, now)` nimmt die höchste Zeile in `plan_grants` mit `starts_at ≤ now < ends_at` (oder leerem `ends_at`). Gibt es keine solche Zeile, gilt `ACCOUNT_DEFAULT_TIER` (`guest`, Abschnitt 9.1). Ohne Sitzung gilt `guest`. Rechte entstehen nur über `entitlements(tier)`, und kein Code liest `plan_grants` direkt.

**Löschprotokoll:** Es liegt außerhalb der Datei und damit außerhalb ihrer Sicherung, in `/srv/ratsmonitor/accounts/deleted.log`. Je Löschung gibt es eine Zeile mit dem SHA-256 der Konto-ID und dem HMAC der Adresse, jeweils mit Datum. Geschrieben wird es über `ACCOUNTS_HOOKS.logDeletion`.

## 5. Abläufe

### 5.1 Anmelden und Registrieren (ein Weg)

1. **Adresse eingeben.** `/anmelden` hat ein E-Mail-Feld. Darunter steht ein Link „Hinweise zum Datenschutz“ (ohne Haken), im Einladungsmodus außerdem ein fester Text (Abschnitt 6.5). Die Seite schickt `POST /api/auth/link {email, next}` mit `requireSameOrigin`. Der Server erledigt **synchron und für alle Adressarten gleich**:
   - Er normalisiert die Adresse und bildet `email_hmac`.
   - Er zählt die Anforderungen dieser Adresse in `login_requests` und je IP (Abschnitt 11) und schreibt eine Zeile in `login_requests`.
   - Ist ein gültiges Flow-Cookie mit gleichem `email_hmac` da, verwendet er es weiter. Sonst setzt er ein neues `__Host-rm_flow` (HttpOnly, Secure, SameSite=Strict, 15 min; über http `rm_flow`, im Dev-Server `rm_dev_flow`) und legt `login_flows` an.
   - Er antwortet `202` mit immer demselben Text. Das gilt auch über der Grenze: Dann kommt still keine Mail.
2. **Nach der Antwort** (`after()`): Der Server sucht Konto und Einladung und legt das Token an. Bei einer Mail schreibt er eine Zeile in `mail_outbox` und stößt den Versand an. Wer eine Mail bekommt:
   - bekanntes, aktives Konto: `purpose=login`;
   - unbekannte Adresse mit gültiger Einladung: `signup`;
   - unbekannte Adresse ohne Einladung im Einladungsmodus: keine Mail und keine Zeile in `login_tokens`;
   - gesperrtes Konto: keine Mail.
3. **Token und Code.** Erzeugt werden ein Token mit 32 Byte (base64url) und ein 8-stelliger Code (Ziffern, angezeigt als „1234 5678“). Gespeichert werden nur die Hashes. Beide gelten 15 Minuten und nur einmal. Eine neue Anforderung macht ältere offene Tokens derselben Adresse und desselben Zwecks ungültig, es ist also immer nur eines offen. Die Oberfläche sagt deshalb: „Es gilt nur die neueste E-Mail.“
4. **Die Mail** enthält `${SITE_URL}/anmelden/bestaetigen#t=<token>`, den Code und diese Sätze:
   - „Auf einem anderen Gerät? Geben Sie dort den Code ein, statt den Link zu öffnen.“
   - „Geben Sie den Code nur auf <SITE_URL> ein und nennen Sie ihn niemandem.“
   - „Nicht angefordert? Dann ignorieren.“

   Das Token steht im Fragment und gelangt so weder in Caddy-Protokolle noch in den Referer.
5. **Wartebildschirm** (`/anmelden` nach dem Absenden):
   - die eingegebene Adresse vollständig und die Absenderadresse wörtlich („von anmeldung@<domain>“);
   - der Hinweis auf Spam- und Quarantäneordner;
   - von Anfang an das Codefeld;
   - „Erneut senden“ mit Countdown und dem festen Satz „Höchstens 3 Links in 15 Minuten“;
   - „Andere Adresse“.
6. **Bestätigungsseite.** Sie liest das Fragment und entfernt es sofort (`history.replaceState`). Dann fragt sie `POST /api/auth/peek {token}`, das nichts verbraucht.
   - Angezeigt wird „Anmelden als <volle Adresse>“.
   - Fehlt im Browser das passende Flow-Cookie, weil die Anforderung von woanders kam, erscheint der Hinweis: „Diese Anmeldung wurde nicht in diesem Browser angefordert. Nur fortfahren, wenn Sie das selbst waren.“
   - Bei `signup` kommen Pflichthaken für AGB (mit Version) und „mindestens 18 Jahre“ dazu, außerdem ein optionales Namensfeld. Einen Haken „Datenschutz“ gibt es nicht. Die Datenschutzinformation ist verlinkt, ihre Version wird ohne Haken mitgeschrieben.
   - Die Seite sendet nichts automatisch ab. Erst der Klick schickt `POST /api/auth/verify`. So verbrauchen Mail-Scanner wie Safe Links das Token nicht.
7. **`verify`:**
   - löst atomar ein, nur für `purpose IN ('login','signup')`: `UPDATE login_tokens SET used_at=? WHERE id=? AND used_at IS NULL AND expires_at>? AND purpose IN ('login','signup') RETURNING …`;
   - prüft bei `login` im selben Batch `users.status='active'` und `users.email = login_tokens.email`;
   - legt bei `signup` in einem `batch` an: `users` mit `email_verified_at`, `consents`, `plan_grants` aus der Einladung (`source='beta'`, `ends_at` aus `tier_until`). Dabei wird die Einladung gelöscht;
   - löscht eine vorhandene Sitzung im Browser und legt eine neue an;
   - setzt das Cookie, schreibt `auth_events login` und leitet auf `safeNext(next)` weiter.

   Danach zeigt die Seite: „Sie sind auf diesem Gerät angemeldet. Wollten Sie sich an einem anderen Gerät anmelden? Geben Sie dort den Code aus der E-Mail ein.“ Der erste Klick bestätigt die Adresse und schließt den Vertrag nach AGB §3 (`info/AgbPage.tsx:46`). Danach folgt die Willkommensmail mit den Vertragsdaten (`:49`).
8. **Code statt Link.** Im ursprünglichen Tab schickt `POST /api/auth/code {code}` den Code. Ablauf für alle Adressarten gleich:
   - `UPDATE login_flows SET attempts=attempts+1 WHERE id=? AND attempts<5 AND expires_at>? RETURNING email_hmac`. Ohne Zeile lautet die Antwort „Bitte neuen Code anfordern“.
   - Haben alle Flows dieser `email_hmac` in 24 h zusammen 10 Fehlversuche, gilt für die Adresse nur noch der Link. Die Antwort ist für alle Adressarten gleich. Bei bestehenden Konten geht nach der Antwort eine Hinweismail raus (`auth_events code_locked`).
   - Sonst wird `SHA-256('login'|'signup' || flow_hash || code)` über `login_tokens_flow` gesucht. Ein Treffer löst wie bei `verify` ein. Ohne Treffer lautet die Antwort „Code falsch oder abgelaufen, noch N Versuche“.

   Der Code gilt also nur mit dem Flow-Cookie dieses Browsers. Er hilft, wenn die Mail auf dem Handy liegt und die Anmeldung am PC laufen soll, und im Tunnel, denn der Link zeigt auf `SITE_URL`.

Es entstehen nie unbestätigte Konten. Eine Einladung ist nur eine Zeile in `invites`.

### 5.2 Sitzung

- **Wert:** 32 Byte aus `crypto.getRandomValues`. In der Datenbank steht nur der Hash.
- **Cookie über https:** `__Host-rm_session; HttpOnly; Secure; SameSite=Lax; Path=/`. Auf https wird **nur** dieser Name gelesen. Das schützt auf der geteilten Domain sslip.io vor untergeschobenen Cookies.
- **Cookie über http** (Tunnel): `rm_session` ohne `Secure`. Im Dev-Server heißt es `rm_dev_session`. Cookies trennen nicht nach Port, deshalb überschreiben Dev-Server und Tunnel sich so nicht gegenseitig, und das Tunnel-Cookie geht nicht an andere lokale Dienste. Entschieden wird über `new URL(request.url).protocol`, hinter Caddy dank `VINEXT_TRUST_PROXY=1` verlässlich.
- **Tunnel-Adresse:** dokumentiert wird `http://127.0.0.1:8080`. Das ist ein anderer Cookie-Host als `localhost`, auf dem lokale Dev-Server laufen.
- **`Lax`** statt `Strict`, weil sonst jeder Klick aus einer Mail ohne Cookie ankäme.
- **Laufzeit:** 30 Tage ohne Nutzung, höchstens 90 Tage ab Anmeldung. Sitzungen auf einem Admin-Host (`admin_host=1`) gelten 12 h ohne Nutzung und höchstens 7 Tage.
- **GET schreibt nie.** `GET /api/me` meldet `renewAfter`, sobald `last_seen_at` älter als 24 h ist (auf Admin-Hosts 1 h). Die Oberfläche ruft dann `POST /api/auth/refresh`.
- **Kein Zwischenspeicher im Prozess.** Jede Anfrage mit Cookie liest `sessions` über den Primärschlüssel einer kleinen WAL-Datei. Widerruf, Sperre und Rollenentzug wirken sofort, auch wenn sie per CLI kommen. Anfragen ohne Cookie fragen nichts ab.
- **Antwort von `GET /api/me`:** `{accounts, user:{id,email,name}, tier, tierUntil, tierSource, roles, adminHere, features, limits, renewAfter}`, mit ETag. Ohne Sitzung: `{accounts:true, tier:'guest'}`. Ohne Kontendatei: `{accounts:false}`.
- **Sperre, Rollenwechsel, Adresswechsel, Löschen und `revoke`** löschen alle Sitzungen der Person und alle offenen `login_tokens` (`WHERE user_id=? OR email=?`).

### 5.3 Abmelden und Geräte

- `POST /api/auth/logout` löscht die Zeile und setzt das Cookie mit `Max-Age=0`. Der Client leert danach `ratsmonitor:recent:v1` und alle Kontodaten im Speicher und sendet das Kontosignal an die anderen Tabs (Abschnitt 8).
- `GET /api/me/sessions` zeigt je Sitzung Gerät, Beginn und letzte Nutzung (Tag) und markiert „dieses Gerät“. Die öffentliche ID sind die ersten 12 Zeichen des Hashes.
- `POST /api/me/sessions {revoke: <id> | 'others' | 'all'}` beendet einzelne Sitzungen, alle anderen oder alle.

### 5.4 Konto löschen

1. `POST /api/me/delete` setzt ein neues Flow-Cookie und legt ein Token `purpose='delete'` an, mit `user_id` des Sitzungskontos und gebunden an dieses Flow-Cookie. Der Code geht an die Kontoadresse.
2. `POST /api/me/delete {code}` löst nur ein, wenn drei Bedingungen erfüllt sind: `purpose='delete'`, `user_id` gleich dem Sitzungskonto und das Flow-Cookie passt. Dann folgt in einem `batch`:
   - `DELETE FROM login_tokens WHERE email=? OR user_id=?`
   - `DELETE FROM invites WHERE email=?`
   - `DELETE FROM mail_outbox WHERE user_id=? AND status='queued'`
   - `DELETE FROM users` (die Kaskade erfasst den Rest)

   Danach ruft der Server `ACCOUNTS_HOOKS.checkpoint()` auf (`wal_checkpoint(TRUNCATE)`). Die Kontendatei läuft mit `secure_delete=ON`.
3. Dann folgen der Eintrag über `ACCOUNTS_HOOKS.logDeletion`, die Mail „Konto gelöscht“ (an die zuvor gelesene Adresse, danach aus dem Postausgang entfernt) und das Entfernen des Cookies.

Ein gestohlenes Sitzungscookie reicht so nicht zum Löschen. Ein Anmeldecode löscht nicht, und ein Löschcode meldet nicht an. Admins können sich nicht selbst löschen, das geht nur per CLI. So verschwindet nie der letzte Admin. Kommt Thema 3, schließt das Löschen auch den Stripe-Kunden ein, soweit Aufbewahrungspflichten es zulassen (Abschnitt 9).

### 5.5 Datenauskunft

`GET /api/me/export` liefert eine JSON-Datei (Art. 15 und 20) mit diesen Daten:

- Konto, Rollen, Stufenzeilen, Zustimmungen, Einstellungen, Suchen, Artikel
- Sitzungen und `calendar_feeds` (ohne Hashes)
- `auth_events` und die Zeilen in `mail_outbox` (Vorlage, Status, Zeit)
- bei Admins die eigenen Zeilen in `admin_audit`
- offene `login_tokens` und `invites` zur Adresse (ohne Hashes)
- ein Verweis auf die Datenschutzerklärung (Zweck, Empfänger, Fristen, Art. 15 Abs. 1 a–h)

Der Export ist nur erlaubt, wenn `auth_at` höchstens 24 h alt ist. Sonst schickt die Kontoseite einen Code (`purpose='export'`, gleicher Mechanismus wie beim Löschen). Nach jedem Export geht eine Hinweismail raus („Ihre Daten wurden exportiert“). Kopfzeilen: `Content-Disposition: attachment`, `private, no-store`.

### 5.6 Adresse ändern

In der Testphase geht das nur per CLI: `ratsmonitor-accounts email --id <konto> --new-stdin`.

- Ein Bestätigungslink geht an die neue Adresse, ein Hinweis an die alte.
- Alle Sitzungen und offenen Tokens enden.
- Rollen hängen an `users.id`, nicht an der Adresse (TA-25).

Auf der Profilseite ist die Adresse nur lesbar, mit dem Text „Adresse ändern: bitte über [Kontakt]“. Selbstbedienung folgt nach der Testphase mit `purpose=email_change`.

## 6. Rollen und Admin-Trennung

### 6.1 Admin-Rolle

- Admin ist eine Zeile `user_roles(role='admin')` an der internen ID. Max und Nico bekommen sie, wie es der Gesellschaftsvertrag vorsieht (`docs/gesellschaft/gesellschaftsvertrag-gbr.md:19`).
- **`adminState()`** in `server/services/session.ts` ist die eine Prüfung für Routen und Seite. Admin ist nur, wer alle vier Bedingungen erfüllt:
  - eine Sitzung;
  - die Rolle `admin`;
  - `auth_at` nicht älter als 7 Tage, sonst „bitte neu anmelden“;
  - **Anfrage über einen Admin-Host** (`isAdminHost`): Der Host aus `new URL(request.url)` steht in `ADMIN_HOSTS` (Standard `127.0.0.1:8080,localhost:8080`), Protokoll http.

  Die Pfadsperre in Caddy ist damit nicht mehr die einzige Grenze. vinext normalisiert Pfade (`//`, `/./`, `%61`) und könnte eine Caddy-Regel umgehen. Eine Ausnahme vom Admin-Host gibt es erst mit TOTP (6.4).
- `requireAdmin()` (`admin-auth.ts:6`) ruft `adminState()` auf. Die 26 Routen und `adminRead` (`admin-http.ts:12-14`) laufen weiter darüber.
- **`app/admin/page.tsx`** wird umgebaut (AP3). `AdminContent` prüft über `adminState()`:
  - ohne Sitzung: Link auf `/anmelden?weiter=/admin`;
  - mit zu altem `auth_at`: „bitte neu anmelden“;
  - ohne Rolle oder außerhalb eines Admin-Hosts: „Kein Admin-Zugriff“;
  - Abmelden über `POST /api/auth/logout`.

  Die Zweige `setup`/`claim` gelten nur noch mit `ADMIN_LEGACY_HEADER=1`. Ein Test prüft, dass die Seite ohne Admin-Sitzung keine Admin-Daten rendert.
- **`requireAdminWrite(request, {audit})`** fasst `requireAdmin`, `requireSameOrigin` und das Audit zusammen und prüft `request.method`.
  - Auslösende Aktionen schreiben eine Zeile in `admin_audit`: Job starten oder anhalten, Datenbank übertragen, Zeitplan ändern, Import anlegen.
  - Wiederholte Schritte (`/api/admin/refresh` `action:'step'`, `components/admin-store.ts:39`, Fortsetzungen in `/api/admin/pipeline`) werden je Nutzer, Pfad, Aktion und Stunde zu einer Zeile mit Zähler zusammengefasst (UPSERT).
  - In `ai-local` wird es in `server/integrations/ai-local-http.mjs` nur für POST angewendet, nicht im gemeinsamen `handle()`.
  - Lesende Admin-Aufrufe schreiben nichts (`tests/admin-readonly.test.mjs`).
- `ADMIN_HEADERS` (`admin-auth.ts:5`) und `admin-http.ts:8`: `Vary` wird bei abgeschaltetem Altweg auf `Cookie` gesetzt, `oai-authenticated-user-id` entfällt dann.
- Das Admin-Symbol (`components/ratsmonitor/components/AccountMenu.tsx:35-37`) erscheint nur, wenn `/api/me` `adminHere:true` meldet.
- Im Dev-Server bleibt der Admin ohne Anmeldung (`admin-access.mjs:5`). Für Nico ändert sich nichts. Der Node-Build ist im Dev-Modus ohnehin gesperrt (`vite.config.ts:73`).

### 6.2 Kontenverwaltung nur per CLI

TA-25 verlangt, dass keine Nutzerlisten an den Browser gehen. Deshalb gibt es in der Testphase keinen Admin-Reiter für Konten.

**Aufruf:** nur über den Wrapper `/usr/local/bin/ratsmonitor-accounts`. Er lädt `ratsmonitor.env` und `accounts.env` und ruft `sudo -u ratsmonitor node …/scripts/accounts/manage.mjs` auf. Das Skript bricht ab, wenn es nicht als Eigentümer von `ACCOUNTS_FILE` läuft.

Adressen kommen nie als Argument, sondern über `--email-stdin` oder als Abfrage. Alternativ nimmt das Skript die Konto-ID. So landen sie nicht in `~/.bash_history` oder in journald.

Befehle:

- `invite --note "<Anlass/Zustimmung>" [--tier pro --until 2027-01-31] [--send] [--days 30]`, dazu `invite --resend`
- `role <admin|user>`
- `tier <tier> [--until …] [--source manual|beta]` (fügt eine Zeile in `plan_grants` hinzu)
- `block --note "<Grund>"`, `unblock`, `revoke`
- `email --new-stdin`, `delete`
- `export --out <datei>`: schreibt mit Rechten 600, nicht aufs Terminal
- `list [--invites]`: zeigt Status offen, abgelaufen oder benutzt; Adressen nur gekürzt, volle Anzeige nur mit `--full`
- `stats`: nur Summen
- `login-link [--base http://127.0.0.1:8080]`: Notzugang und Start ohne Mailanbieter
- `reapply-deletions`: löscht nach dem Rückspielen einer Sicherung erneut, was in `deleted.log` steht
- `cleanup-legacy`: löscht `admin-owner-v1` in der Inhaltsdatei, erst nach D3 (6.3)

Jeder Aufruf schreibt `auth_events` bzw. `admin_audit` mit `user_id='cli'`, nur mit IDs. Das Skript ersetzt auf dem Node-Server `scripts/bind-admin-owner.mjs`.

**Einladungen:** Eingeladen wird nur, wer vorher zugestimmt hat (Gespräch oder Mail). Das hält `--note` fest. Die Einladungsmail enthält kein Token. Sie enthält:

- einen Link auf `/anmelden`, die Adresse höchstens im Fragment vorbelegt;
- den Hinweis auf Link oder Code;
- die Herkunft der Adresse und einen Link zur Datenschutzerklärung (Art. 14).

Die Einladung gilt standardmäßig 30 Tage und wird danach gelöscht, beim Einlösen sofort.

Braucht es später doch eine Oberfläche, dann ohne Liste, nur mit Suche nach der genauen Adresse.

### 6.3 Ablösung von Kopfzeilen und Basic-Auth

Neue Caddy-Struktur:

- **`(app_proxy)`:** Proxy, Cache-Regeln für statische Dateien, keine Kennung.
- **`(public_site)`:**
  - entfernt alle vier `Oai-Authenticated-*`, `X-Prerender-Revalidate` und `X-Prerender-Revalidate-If-Generated`;
  - beantwortet `/admin*`, `/api/admin*` und ihre `.rsc`-Varianten mit `respond 404`;
  - setzt `Content-Security-Policy "frame-ancestors 'none'"`, `X-Frame-Options DENY` und `X-Content-Type-Options nosniff`, bis zur Öffnung außerdem `X-Robots-Tag "noindex, nofollow"`;
  - auf der eigenen Domain zusätzlich `Strict-Transport-Security "max-age=31536000"`, `includeSubDomains` erst nach Prüfung.
- **Tunnel-Site** (`http://127.0.0.1:8080, http://localhost:8080`, `bind 127.0.0.1`): importiert `(app_proxy)`.

Die Fassungen je Schritt stehen im Repo (`deploy/node/Caddyfile.step0` … `.step3`), ohne Passwort-Hash. `scripts/check-caddy.mjs` läuft vor jedem `systemctl reload caddy`. Es schlägt fehl, wenn eine Site, die nicht auf loopback läuft, `Oai-Authenticated-*` setzt, `(public_site)` nicht importiert oder Admin-Pfade nicht sperrt.

| Schritt | Caddy | App |
|---|---|---|
| 0, sofort | Snippets wie oben. Nur die Tunnel-Site setzt noch `Oai-Authenticated-User-Id/-Email` (heute `:27-28`). sslip importiert `(public_site)`, Basic-Auth bleibt. Der wirksame sslip-Block kommt ohne Hash ins Repo. | unverändert |
| 1, Konten intern | wie 0 | Release A: Konten aktiv, `ADMIN_LEGACY_HEADER=1`, `RM_ACCESS=open` |
| 2, Umschalten | Tunnel setzt keine Kennung mehr; `RM_ADMIN_*` aus `/etc/default/caddy` entfernen | `ADMIN_LEGACY_HEADER=0` (Standard) |
| 3, Gate | Basic-Auth bleibt vorerst | `RM_ACCESS=invite` (Gate, 6.5) |
| 4, Domain | neuer Site-Block für die eigene Domain mit `(public_site)` und HSTS; Basic-Auth entfällt; sslip leitet nach dem Übergangsfenster (Abschnitt 8) mit `redir https://<domain>{uri} permanent` weiter | `SITE_URL=https://<domain>` |
| 5, Aufräumen (Node) | – | Freischalttexte und Schritt `node-server.md:121` entfernen, Doku auf Konten umstellen |

**Nach Schritt 0** ist niemand mit dem Passwort mehr Admin, und Admin geht nur noch über den Tunnel. Die mobile Administration (`?seite=mobil`) über sslip.io fällt damit weg, bis Abschnitt 6.4 entschieden ist.

**Cloudflare-Build (Entscheidung: Variante a):** Der ChatGPT-Weg bleibt im Code. Dazu gehören `getChatGPTUser`, `claim`, `claimAdmin`, `ADMIN_SETUP_HASH`, `components/admin-activation` und `admin-owner-v1`, und zwar bis D3 (`requirements/code-analyse-2026-10-10.md:189`). Er wirkt nur mit `ADMIN_LEGACY_HEADER=1`. Erst danach löscht `ratsmonitor-accounts cleanup-legacy` den Schlüssel. Dafür gibt es keine Inhaltsmigration, weil sie den vollen Migrationsablauf mit Stopp und Sicherung auslösen würde. `serve.mjs` warnt, solange `admin-owner-v1` besteht und `ADMIN_LEGACY_HEADER=0` gilt.

**Abschalten der Kopfzeilen-Kennung:** Das geht über den Laufzeitschalter `ADMIN_LEGACY_HEADER`, nicht über `RM_TARGET`. `RM_TARGET` gibt es nur beim Bau (`vite.config.ts:42`). Ist der Schalter aus, liest `requireAdmin` die `oai-*`-Kopfzeilen gar nicht. Das ist doppelt gesichert: Caddy entfernt sie, und die App ignoriert sie.

### 6.4 Zweiter Faktor

In der Testphase ist der Tunnel der Admin-Weg. Der SSH-Schlüssel ist damit der Besitzfaktor zusätzlich zum Postfach, und `ADMIN_HOSTS` setzt das in der App durch. Admin über https wird erst freigegeben, wenn TOTP gebaut ist:

- RFC 6238, HMAC-SHA1 über WebCrypto, etwa 40 Zeilen.
- Das Geheimnis wird per AES-GCM verschlüsselt, mit einem Schlüssel aus `ACCOUNTS_SECRET` (HKDF, Zweck `totp`).
- Eingerichtet wird nur per CLI.
- Admin-Rechte über https gibt es nur mit einer TOTP-Prüfung, die nicht älter als 12 h ist. Der https-Host kommt erst dann in `ADMIN_HOSTS`.

Das ist ein eigenes Paket nach der Testphase (Entscheidung in Abschnitt 15). Ein Caddy-Passwort vor `/admin*` als Ersatz ist verworfen. Es wäre wieder ein gemeinsames Passwort, und in Caddy 2.6 sind zwei Basic-Auth-Bereiche nebeneinander umständlich.

### 6.5 Zugangsgate statt Basic-Auth

`RM_ACCESS=invite|open`. Im Node-Betrieb bricht `serve.mjs` den Start ab, wenn `RM_ACCESS` fehlt oder einen anderen Wert hat als genau `invite` oder `open`, nach dem Muster der HOST-Prüfung (`serve.mjs:23-34`). `ratsmonitor.env.example` belegt `invite` vor. Der wirksame Modus steht beim Start im Protokoll und im Admin unter „Jobs & Zeitpläne“.

**Im Einladungsmodus** prüft `middleware.ts` jede Anfrage. Der Matcher umfasst alle Pfade außer den statischen Bündeln, `/fonts/`, `/data/`, `/geo/`, Icons, Manifest und `sw.js`. Den Pfad der Bündel aus dem Build prüfen.

- **Frei** bleiben:
  - `/anmelden*`, `/registrieren` (Umleitung), `/api/auth/*`
  - `/impressum`, `/datenschutz`, `/agb`, `/widerruf`, `/kontakt`
  - `/api/internal/*` (Bearer) und `/api/calendar/feed/*` (Token)
- **Ohne gültige Sitzung** leiten Seiten per 302 auf `/anmelden?weiter=…` um, `/api/*` antwortet mit 401.
- **Interne Aufrufe:** `internalCall(request)` erkennt `Authorization: Bearer <IMPORT_TOKEN>` (mindestens 16 Zeichen, `validBearer`). Gate und `requireFeature` lassen solche Aufrufe durch. So wärmt `serve.mjs` die Analysen weiter vor (Abschnitt 13).
- Der Matcher muss alle Pfade umfassen. `app/(monitor)/beschluss/[id]/page.tsx` und `thema/[id]/page.tsx` lesen Vorgänge auf dem Server und schreiben sie ins HTML. Ein Gate nur für `/api/*` ließe sie offen.
- **Zweite Linie:** Die Datenrouten unter `/api/*` rufen zusätzlich `requireAccess()` auf. Damit greift das Gate auch dann, wenn die Middleware über `x-prerender-revalidate` übersprungen würde. Caddy entfernt diese Kopfzeile außerdem.
- Die Prüfung ist dieselbe Primärschlüssel-Abfrage wie in 5.2. Die Middleware gibt keine Kennung an die Route weiter, die Route liest die Sitzung selbst.
- Die Middleware holt `env` aus `cloudflare:workers` wie die Routen. In AP8 wird das per Test bestätigt. Geht es nicht, prüfen `app/(monitor)/layout.tsx` und `requireAccess()`.
- **Kopfzeilen der Middleware:** `no-store` nur für `/admin*`, `/api/admin*`, `/api/auth*`, `/api/me*` und `/anmelden*`. Alle anderen Antworten behalten ihre Cache-Regeln. `X-Robots-Tag` setzt Caddy.
- **Fail closed:** `invite` ohne `env.ACCOUNTS` verhindert den Start.
- **Text auf `/anmelden` im Einladungsmodus:** „Plenara ist in einer geschlossenen Testphase. Sie bekommen nur dann eine E-Mail, wenn diese Adresse eingeladen ist. Keine E-Mail? Adresse prüfen, Spam-Ordner ansehen oder [Kontakt].“ Wer über einen geteilten Link kommt, sieht zusätzlich: „Bitte melden Sie sich an, um diese Seite zu öffnen.“
- Zur Öffnung reichen `RM_ACCESS=open` und ein Neustart.

**Verworfen** ist Caddy `forward_auth`. Es lässt sich lokal nicht nachbilden, die Liste offener Pfade läge doppelt vor, und jede Anfrage kostet eine Unteranfrage. Basic-Auth bleibt nur als äußerer Zaun, bis das Gate auf dem Server geprüft ist. Danach muss sie weg, weil Mail-Links und Kalender-Abos an ihr scheitern.

## 7. Stufen und serverseitige Durchsetzung

**Eine Quelle.** `shared/plans.mjs` enthält:

- `LIMITS` aus `lib/tier.ts:27-32` mit denselben Werten;
- die Funktionen `analytics`, `calendar`, `lenaPerMin`;
- `FREE_ANALYTICS` (heute `pages/analytics/AnalyticsPages.tsx:63`);
- `PRICES` als Platzhalter. Bei `null` zeigt die Oberfläche „Preis folgt“.

Daraus lesen `tier.ts`, `PlanCards.tsx`, `info/PreisePage.tsx`, `info/content.ts` und `GateDialog.tsx`. `docs/produkt/stufen.md` wird von Hand mitgezogen, ein Test vergleicht.

| Route | Prüfung | Wann nötig | Kosten |
|---|---|---|---|
| `/api/me/searches`, `/api/me/articles` | Anlegen sowie `notify_mail` und `follow` gegen die Grenze; sonst 409 mit Grund | Start | `count(*)` über den Schlüsselanfang |
| `/api/analytics/*` (13 Routen) | `requireFeature('analytics')`, freie Übersichten und `internalCall` ausgenommen; `private, max-age=300`; `LiveThumb` zeigt bei 403 einen Platzhalter | vor gemischten Stufen | eine Sitzungsabfrage; spart teure Erstrechnungen |
| `/api/calendar` | `requireFeature('calendar')` | vor gemischten Stufen | eine Abfrage |
| `/api/calendar/feed/<token>.ics` (neu) | Token-Hash in `calendar_feeds`, nicht widerrufen, Stufe weiter `calendar`; Gebiete aus `user_settings.calendar_ags`; Links aus `SITE_URL`; Token auf der Kontoseite neu erzeugbar | vor gemischten Stufen | eine Abfrage |
| `/api/me/calendar.ics` (neu) | einmaliger Download mit Sitzung und `requireFeature('calendar')`, ersetzt `?download=1` (`KalenderPage.tsx:320`) | mit dem Feed | eine Abfrage |
| `/api/calendar/ics?ags=` (alt) | ohne `download=1`: 410 mit einem Kalendereintrag „Bitte neues Abo auf der Kontoseite einrichten“; mit `download=1`: 308 auf `/api/me/calendar.ics` | mit dem Feed | – |
| `/api/lena` | Grenze `lenaPerMin` je Konto-ID; Gäste je `clientIp` | Start | Speicher |
| `/api/search` | Gast: nur `page=1`, höchstens 10 Treffer, siehe unten. Gekürzt wird erst **nach** `cachedSearch`, der Zwischenspeicher bleibt geteilt. `private, max-age=30` statt `public`. Filter werden nicht gesperrt, die Startseite nutzt `from`, `to` und `area`. | vor der Öffnung (hinter dem Gate gibt es keine Gäste) | keine weitere Suche |
| `/api/push/*` | bis zur Entscheidung zu Push unverändert (Abschnitt 15) | – | – |
| `dokument`, `topics/[id]`, `sources`, `startseite-trends`, `search/coverage` | keine Stufe, im Einladungsmodus nur das Gate | – | – |

**Gastkürzung im Strom** (`part=stream`, Etappen `{known}`, `{known,total}`, `{articles:[…]}`, `{end,…}`, `monitor-search.mjs:200-233`):

- Die Artikel werden über alle Etappen gezählt, und jedes `articles`-Array wird auf den Rest bis 10 gekürzt.
- Danach sendet der Server selbst `{end:true,hasMore:true,revision,pageSize}` und beendet den Quell-Iterator mit `return()`.
- `part=page` wird genauso auf 10 gekürzt. `part=facets` bleibt unverändert, es enthält nur Zahlen.
- Testfall: zwei Etappen zu je 15 Treffern ergeben genau 10 Treffer und ein `end`-Objekt.

**Regeln:**

- Höhere Stufen vergibt in der Testphase der Admin, mit `source='beta'` oder `manual` und immer mit `ends_at`.
- Über der Grenze wird nichts gelöscht, neue Einträge werden abgelehnt. Bei einer Abstufung bleiben die obersten N Einträge (nach `position`) `active=1`, der Rest wird `active=0`. Ein Dialog nach der Abstufung lässt umwählen. Nur aktive Einträge benachrichtigen (Thema 2).
- **Ende einer Beta-Stufe:**
  - `/api/me` liefert `tierUntil` und `tierSource`.
  - Die Kontoseite zeigt „Testzugang Pro bis 31.01.2027“, ab 14 Tagen vorher als Hinweis.
  - `maintenance.mjs` schickt 14 Tage vorher einmal die Kontomail „Testzugang endet“ (`plan_grants.end_notice_at`), wie es die AGB verlangen (`info/AgbPage.tsx:40`).
- `MAX_PAGE=250` und das Exportlimit von 500 bleiben.
- `scripts/startseite-trends.mjs` ruft `diffusion` direkt auf und bleibt unberührt.

**Oberfläche:**

- `useTier` behält seine Signatur und liest aus dem Speicher für `/api/me`.
- Bis `ready` gesetzt ist, zeigen gesperrte Elemente einen neutralen Ladezustand statt eines Sperrdialogs.
- HTML wird nicht personalisiert. Die serverseitig gerenderten Vorgangsseiten bleiben für alle gleich, ohne `Vary: Cookie` am HTML.
- `setTier`, `ratsmonitor:tier:v1` und `DevTierSwitcher` gelten nur mit `IS_DEV`.
- **Upgrade-Knöpfe** („Pro wählen“, „Auf Pro upgraden“) zeigen bis Thema 3 „In der Testphase auf Anfrage“ mit Verweis auf `/kontakt`. Der Footer-Aufruf „Starten Sie kostenlos“ entfällt im Einladungsmodus.
- **Benachrichtigungen in Thema 1:** Glocke, Häufigkeit, Empfängerfeld (`SavedSearchesPage.tsx:103-112`, `:144-171`), Wochenbericht (`:299-310`) und die Kalenderbenachrichtigung (`KalenderPage.tsx:18-21`) erscheinen deaktiviert, mit dem Text „Folgt mit den E-Mail-Benachrichtigungen“. Vorhandene Werte werden als Vormerkung gespeichert und nicht versendet. Das Empfängerfeld entfällt.

## 8. Übernahme der Browserdaten

Übernommen werden die folgenden Schlüssel. Die Liste ist ausdrücklich, denn `CONTENT_KEYS` in `lib/storage.ts:7` passt nicht: Dort fehlen Suchen und Artikel, und `recent:v1` steht drin.

| Schlüssel | Ziel | Hinweis |
|---|---|---|
| `ratsmonitor:saved-searches:v2` | `saved_searches` | `ui_state` = SearchSnapshot nach Positivliste ohne `id`, `name`, `notify`, `created`, `lastSeen`. `notify.mail`/`freq` → `notify_mail`/`notify_freq` (Vormerkung), `created` → `created_at`, `lastSeen` → `last_seen_at`, Listenplatz → `position`, `signature()` → `signature`. `notify.on`, `notify.email` und `notify.recipients` verwirft der Server. |
| `ratsmonitor:saved-articles:v1` | `saved_articles` | nur `id`, `savedAt`, `follow`; `snapshot` setzt der Server aus `search_cards`, `mergedInto` wird aufgelöst |
| `rm-calendar:v1` | `user_settings.calendar` und `calendar_ags` | Den Umkreis rechnet der Browser (`KalenderPage.tsx:64-75`) und schickt die AGS-Liste mit; `mail`/`freq` gehören zu Thema 2 |
| `ratsmonitor:weekly:v1`, `ratsmonitor:weekly-day:v1` | `user_settings` | – |
| `ratsmonitor:profile:v1` | nur `name` | `email` wird verworfen, es gilt die bestätigte Adresse |

**Lokal bleiben** `ratsmonitor:recent:v1` und alle Schlüssel für die Darstellung. `recent:v1` wird beim Abmelden geleert.

**Ablauf:**

1. **Auslöser:** Der Browser hat übernehmbare Schlüssel, aber kein `ratsmonitor:imported:v1`. Das gilt auf jedem Gerät, nicht nur bei der ersten Anmeldung. Fehlt beim Anmelden das Flow-Cookie (Hinweis aus 5.1), öffnet sich der Dialog nicht von selbst. Er ist dann nur über die Kontoseite erreichbar.
2. **Dialog** (`<dialog>` wie `GateDialog`): „3 Suchen, 12 Artikel und Kalender mit 4 Gebieten in das Konto <volle Adresse> übernehmen?“ Zur Wahl stehen „Übernehmen“, „Nicht übernehmen“ und „Später“. Ohne Klick wird nichts gesendet. Das hält die Zusage in `pages/LegalPage.tsx:104`, die vorher angepasst wird.
3. **Vorbereitung:** Der Browser rechnet je Suche `savedSearchQuery` (`state/search.tsx:373-391`) und für den Kalender die AGS-Liste. Der Dialog lädt dafür das Kartenmodell.
4. **`POST /api/me/import`:**
   - höchstens 256 KB, 200 Suchen, 500 Artikel;
   - strenge Typprüfung über Positivlisten, auch für Profil und Kalender;
   - `query` wird mit `parseMonitorSearch` geprüft. Ist sie ungültig, wird `NULL` gespeichert und beim nächsten Öffnen nachgetragen;
   - ein `batch` mit `INSERT … ON CONFLICT DO NOTHING` über `(user_id,id)` und `(user_id,signature)`. Wiederholungen und dieselbe Suche von einem zweiten Gerät ergeben keine Doppelten; sie werden als „schon im Konto“ gemeldet;
   - Artikel-Snapshots kommen in **einer** Abfrage: `SELECT id,title,date,region_id,status FROM search_cards WHERE id IN (SELECT value FROM json_each(?))`. Nur Fehlende (zusammengeführte Vorgänge) laufen über die `mergedInto`-Auflösung, höchstens 20 je Anfrage. Der Rest wird beim ersten Öffnen der Merkliste nachgetragen. So hält die Übernahme keine Besucher an.
5. **Antwort:** Sie nennt Übernommenes und Übersprungenes. Alles bis zu den Obergrenzen wird gespeichert, aktiv sind nur so viele Einträge, wie die Stufe erlaubt.
6. **Lokal löschen:** Erst nach der Bestätigung durch den Server entfernt der Browser genau die bestätigten Einträge. Übersprungene bleiben lokal und werden mit ihrem lokalen Titel aufgelistet, bis der Nutzer sie verwirft. Danach löscht er `ratsmonitor:tier:v1` und `ratsmonitor:test-*` und setzt `ratsmonitor:imported:v1`.
7. **„Nicht übernehmen“:** Es folgt eine Rückfrage mit dem Angebot „vorher als Datei sichern“. Erst dann wird gelöscht. So wandert derselbe Bestand nicht in ein zweites Konto.
8. **„Später“:** Die Kontoseiten zeigen dauerhaft „3 Suchen aus diesem Browser noch nicht übernommen“.

**Datei statt Übernahme:** Auf jeder Origin bietet die Kontoseite „Daten aus diesem Browser als Datei sichern“ an (JSON, gleiches Format wie die Übernahme), dazu „Datei übernehmen“ über dieselbe Route `/api/me/import`.

**Übergang auf die eigene Domain:** `localStorage` gehört zur Origin. Daten unter `https://187-7-72-52.sslip.io` und `http://localhost:8080` sind auf der neuen Domain nicht sichtbar. Deshalb läuft Release A mit Konten zuerst auch auf sslip.io. Dort meldet man sich per Code an (der Code wirkt im anfragenden Browser, unabhängig von `SITE_URL`) und übernimmt die Daten. Erst nach diesem Fenster leitet sslip.io weiter (6.3, Schritt 4). Wer es verpasst, nutzt die Datei. Betroffen sind nur wenige Personen: Heute können nur angemeldete Testkonten speichern, Gäste haben die Grenzen 0 (`lib/tier.ts:30`).

**Danach:**

- `state/account.tsx`, `lib/savedArticles.ts`, `ProfilePage`, `KalenderPage` und der Wochenbericht lesen und schreiben nur noch über `services/api.ts` und `/api/me/*`.
- Gespeichert wird optimistisch, mit Rücknahme und Meldung bei 403 oder 409. `addSaved` und `toggleSavedArticle` werden asynchron, und `savedArticles.ts` bekommt einen `ready`-Zustand.
- „Rückgängig“ stellt `position` wieder her. Die API liefert nach `position`.

**Abgleich zwischen Tabs und Geräten:**

- Nach Anmelden, Abmelden und jeder Änderung schreibt der Client den Stempel `ratsmonitor:account-rev:v1`. `onOtherTab` hört künftig auf diesen Schlüssel statt auf die entfallenden.
- Andere Tabs laden dann `/api/me` und die Listen neu. Bei `visibilitychange` und `focus` lädt der Client `/api/me` mit ETag neu.
- Jede 401 einer Konto-Route setzt die Oberfläche sofort auf „abgemeldet“.

Die Vorschau „neue Treffer“ (`lib/queue.ts`, ein Abruf je Suche) bleibt in Thema 1. Die serverseitige Berechnung kommt mit Thema 2.

## 9. Anschlüsse für Benachrichtigungen und Bezahlung

**Thema 2 (Benachrichtigungen).** Aus Thema 1 vorhanden:

- die bestätigte Adresse und `user_settings`
- `saved_searches.query`, `query_version`, `signature`, `notify_*`, `last_notified_at`
- `saved_articles.follow`, `last_status` und der Index auf `topic_id`
- Mailadapter, Postausgang `mail_outbox` mit Kontingenten, Vorlagen, `SITE_URL`

Thema 2 ergänzt:

- eine Ereignistabelle in der **Inhaltsdatei**, geschrieben in `server/services/sync.ts:184-193` neben `decisions`. Das geschieht nur bei `old.size>0`, und Neubewertungen lösen nichts aus.
- in der Kontendatei einen Schlüssel gegen Doppelversand in `mail_outbox`, `email_suppressions`, One-Click-Abmeldung (RFC 8058) und `notification_recipients` mit Double-Opt-in
- einen eigenen Job im Zeitplaner (`server/integrations/schedules.mjs`), nie im Webprozess. Er liest die Inhaltsdatei nur und prüft gespeicherte Suchen gegen die IDs neuer Karten.
- das Freischalten der in Thema 1 deaktivierten Schalter
- „Neu“ heißt dann „nach Aufnahme“, nicht „nach Sitzungsdatum“.

**Thema 3 (Bezahlung).** Vorhanden:

- `users.id` als `client_reference_id`
- `users.customer_type` und `org`, erst im Bestellvorgang erhoben, für Widerruf und netto/brutto
- `plan_grants` mit `source='stripe'`, `ref` und `ends_at`
- `consents` mit Versionen

Ein Stripe-Webhook mit Signaturprüfung schreibt künftig nur Zeilen in `plan_grants`. Alle Prüfungen bleiben, weil alles über `effectiveTier` läuft. Thema 3 ergänzt:

- `billing_customers` und `subscriptions`;
- Rechnungsdaten mit eigener Frist (§ 147 AO, 8 Jahre), die beim Löschen des Kontos getrennt erhalten bleiben;
- vertragsrelevante Nachweise (AGB-Version, Zustimmung zum vorzeitigen Leistungsbeginn bzw. Verlust des Widerrufsrechts nach § 356 Abs. 4/5 BGB, Zeitpunkt). Sie werden in die Abrechnungstabellen kopiert, mit eigener Frist von 3 Jahren ab Vertragsende (§ 195 BGB), weil `consents` mit dem Konto gelöscht wird;
- das Löschen des Kontos schließt den Stripe-Kunden ein (löschen oder sperren, soweit die Aufbewahrung es zulässt);
- Stripe überträgt in die USA (DPF) und ist für die Zahlung teils eigener Verantwortlicher. Das wird in Thema 3 geklärt und in der Datenschutzerklärung genannt.

### 9.1 Bezahlung und Freischaltung (Entscheidung 13.10.2026)

Ein Konto wird erst freigeschaltet, wenn die Zahlung bestätigt ist. Ein Konto ohne gültige Zeile in `plan_grants` hat die
Rechte eines Gasts, dazu Kontoverwaltung, Bezahlen, Datenauskunft und Löschen (`ACCOUNT_DEFAULT_TIER='guest'` in
`shared/plans.mjs`, einstellbar, falls später doch eine kostenlose Stufe kommt). Testerinnen und Tester bekommen ihre
Stufe über die Einladung (`source='beta'`, mit Ende).

Ablauf mit dem Zahlungsdienst (Stripe, Mollie oder ein Merchant of Record; Entscheidung offen):

1. Erst anmelden (E-Mail bestätigt), dann bezahlen. Der Server legt den Bezahlvorgang mit `users.id` als Bezug an; die
   Zahlung läuft auf der Seite des Dienstleisters, Kartendaten berühren den Server nie.
2. Die Rückkehr auf die Kontoseite schaltet **nichts** frei (fälschbar, abbrechbar); sie zeigt „Zahlung wird geprüft“.
3. Freigeschaltet wird nur per Webhook (Server zu Server, Signatur geprüft): bezahlte Rechnung → Zeile in `plan_grants`
   mit `source='stripe'`, Ende des bezahlten Zeitraums plus wenige Tage Kulanz. Jede bezahlte Folgerechnung verlängert;
   Zahlungsausfall oder Kündigung → keine neue Zeile, die Stufe endet von selbst. Rücklastschrift oder Widerspruch beendet sie sofort.
4. Meldungen werden mit ihrer ID gespeichert und nur einmal verarbeitet; ein täglicher Abgleich mit dem Dienstleister im
   Zeitplaner fängt verpasste Meldungen auf.
5. Die Zugangssperre und Caddy lassen `/api/billing/webhook` ohne Anmeldung durch; dafür braucht es die eigene Domain mit
   https (hinter Basic-Auth kommen keine Webhooks an).

„Geldeingang“ heißt die Bestätigung des Dienstleisters: Karte und PayPal in Sekunden (sofort freischalten), SEPA-Lastschrift
nach 2 bis 5 Werktagen (Rücklastschrift bis 8 Wochen), Überweisung nach Tagen. Vorschlag: zum Start Karte und PayPal;
Enterprise für Kommunen von Hand per Rechnung (oft XRechnung), der Admin vergibt die Stufe nach Zahlungseingang
(`source='manual'`). Kündigen, Zahlart und Rechnungen über das Kundenportal des Dienstleisters.

## 10. Mailversand und Domain

Thema 1 braucht den Versand schon für diese Vorlagen: Anmeldelink/Code, Einladung, Willkommen, Code gesperrt, Löschcode, Konto gelöscht, Exportcode, Daten exportiert, Adresswechsel (neu und alt), Testzugang endet, Hinweis auf lange Inaktivität und Betreiberwarnung.

**Adapter** `server/accounts/mail.mjs`: `sendMail({to, template, data, userId, quota})` schreibt eine Zeile `queued` in `mail_outbox` und stößt den Versand mit `after()` an. Der Versand liest fällige Zeilen. Nach Erfolg setzt er `sent` und `provider_ref` und löscht `to` und `data`. Nach drei Versuchen (Abstand 10 s, 60 s) setzt er `failed`.

- **Weiterführung:** `serve.mjs` ruft beim Start und jede Minute `POST /api/internal/outbox` (Bearer `IMPORT_TOKEN`) auf. Offenes wird so nach einem Neustart fortgesetzt.
- **Verwerfen:** Anmelde- und Codemails mit überschrittenem `discard_after` (15 min) werden verworfen (`dropped`), nicht verschickt.
- **Transport** aus `MAIL_TRANSPORT`:
  - `outbox`: schreibt in `dev_mail`; Standard im Dev-Server und in Tests;
  - `log`: nur Vorlagenname und Status;
  - `http`: REST-API des Anbieters per `fetch`. Die Übersetzung steckt in einer einzigen Funktion.
- **Kein SMTP**, damit Miniflare und der Cloudflare-Build weiter bauen.
- Zeitgrenze je Versuch 10 s. Fehlertexte des Anbieters werden vor dem Speichern bereinigt.
- **Kontingente** je Stunde, gezählt in `mail_outbox`, übersteht Neustarts:
  - `login` (bestehende Konten) 100;
  - `signup` (Registrierung und Einladung) 20;
  - `account` (Kontovorgänge) 50.

  Ist ein Kontingent erschöpft, kommt trotzdem die gleiche 202-Antwort. Es gibt einen Protokolleintrag und **einmal je Stunde** eine Warnmail an `OPERATOR_EMAIL` (aus der Umgebung, nicht aus der Datenbank), die selbst nicht zählt. Ein erschöpftes Registrierungskontingent sperrt die Anmeldung bestehender Konten nicht.

**Anforderungen an den Anbieter** (Entscheidung offen):

- Sitz und Verarbeitung in der EU, AVV nach Art. 28
- HTTP-API, DKIM mit eigener Domain, Return-Path auf einer eigenen Subdomain
- Klick- und Öffnungsverfolgung abschaltbar und abgeschaltet, denn umgeschriebene Links legten Tokens offen
- Webhooks für Bounces und Beschwerden (Thema 2)
- Protokolle höchstens 30 Tage, kleiner Tarif

Zu prüfen sind etwa Scaleway TEM, Brevo, Mailjet und Lettermint (EU-Sitz jeweils bestätigen). Resend und Postmark aus der Strategie (`kommerzialisierungsstrategie.md:32`) sind US-Firmen.

**Domain:** Unter sslip.io lassen sich keine DNS-Einträge setzen. Eine eigene Domain ist Pflicht für den Start:

- SPF `v=spf1 include:<versanddienst> include:<postfachanbieter> -all`
- DKIM nach Vorgabe des Anbieters, 2048 Bit
- DMARC zuerst `p=none; rua=mailto:dmarc@<domain>`, nach 2 bis 4 sauberen Wochen `p=quarantine`
- Web- und Mail-Domain gleich, `SITE_URL` darauf, Caddy mit eigenem Zertifikat. `SITE_URL` ändert zugleich `metadataBase` (Vorschaubilder, `app/layout.tsx:5`), und `run-imports.mjs` verlangt https.

**Eingehende Post:** Die Versanddienste bieten in der Regel keine Postfächer. Deshalb gehören ein Postfachanbieter (EU) mit MX-Einträgen dazu und Postfächer für `kontakt@`, `datenschutz@`, `dmarc@` (oder ein EU-Auswertungsdienst mit AVV) und die Antwortadresse `MAIL_REPLY_TO`. Abnahmepunkt vor dem ersten Tester: je eine Testmail an `kontakt@` und `dmarc@`.

**Links** entstehen nur aus `SITE_URL`, nie aus `Host` oder `location.origin` (`lib/mails.ts:9`). Ohne `SITE_URL` antworten die Anmelderouten mit 503. Ausnahme: Im Dev-Server fällt `SITE_URL` auf die Origin der Anfrage zurück. So funktioniert auch der Handytest im WLAN (`RM_DEV_HOST=0.0.0.0`).

**Vorlagen** liegen in `server/accounts/mail-templates.mjs` und übernehmen die Gestaltung aus `lib/mails.ts`:

- Text plus schlichtes HTML mit `lang="de"`, keine externen Bilder, sprechende Linktexte
- Alle eingesetzten Werte werden zwingend escaped, über eine Tagged-Template-Funktion `html\`…\``. Das betrifft Name, Titel und künftig Suchnamen.
- Betreff ohne persönliche Angaben
- Satz „Nicht angefordert? Dann ignorieren.“
- Texte nach `docs/produkt/vorteile.json`. E-Mail-Alarme werden erst mit Thema 2 versprochen.

Das Dev-Postfach (`pages/PostfachPage.tsx:74`) zeigt HTML nur in einem `<iframe sandbox srcdoc>`, nicht mehr über `dangerouslySetInnerHTML`.

**Schlüssel:** `MAIL_API_KEY`, `ACCOUNTS_FILE` und `ACCOUNTS_SECRET` stehen in `/etc/ratsmonitor/accounts.env` (root:root 600). Nur `ratsmonitor.service` und `ratsmonitor-accounts.service` laden die Datei als zweites `EnvironmentFile`. Die übrigen Einheiten sehen sie nicht.

**Spam aus Sicht der Tester:**

- Die Tester werden vorab persönlich angeschrieben: Absender auf die Positivliste setzen, bei Kommunen die IT informieren.
- Einladungen gehen in kleinen Wellen raus.
- Vor der ersten Welle läuft ein Zustelltest mit den Postfacharten der Tester.

## 11. Sicherheit und Missbrauchsschutz

**Grenzen:**

| Vorgang | Grenze | Speicher |
|---|---|---|
| Link anfordern je Adresse | 3 in 15 min, 10 am Tag; darüber still keine Mail | `login_requests(email_hmac, at)` für alle Adressarten, übersteht Neustarts |
| Link anfordern je IP | 5 in 15 min, 20 am Tag | Prozess-Map (`rate-limit.mjs`) |
| Mails | Kontingente `login`/`signup`/`account` je Stunde | `mail_outbox` |
| `peek`/`verify`/`code` je IP | 30 in 15 min | Prozess-Map |
| Code-Versuche | 5 je Flow, 10 je Adresse in 24 h, danach nur Link | `login_flows`, atomar gezählt |
| schreibende Konto-API | 60 je Minute und Konto | Prozess-Map |

**Client-IP.** `clientIp()` nimmt im Node-Betrieb den letzten Eintrag in `X-Forwarded-For`, den Caddy setzt. `cf-connecting-ip` wird dort ignoriert, weil Caddy diese Kopfzeile nicht entfernt und ein Besucher sie fälschen könnte. IPv6-Adressen werden auf das /64-Präfix gekürzt, bevor sie als Schlüssel dienen. Lena wird mit umgestellt (`app/api/lena/route.ts:17`). Über den Tunnel ist die IP immer 127.0.0.1. Einmal auf dem Server prüfen, dass ein gefälschter Kopf nicht durchkommt.

**Weitere Regeln:**

- **Aufzählungsschutz:** Antwort und synchrone Arbeit sind für bekannte, unbekannte, gesperrte und eingeladene Adressen gleich (5.1). Alles, was von der Adresse abhängt, läuft nach der Antwort. `/api/auth/code` antwortet nur nach Flow-Zustand. Tests decken auch die Fälle „Grenze erreicht“ und „Code erschöpft“ ab.
- **Zweckbindung der Tokens:** `verify` und `code` lösen nur `login`/`signup` ein. `/api/me/delete` und `/api/me/export` lösen nur ihren eigenen Zweck ein, mit `user_id` gleich dem Sitzungskonto und passendem Flow-Cookie. Der Zweck steckt im Code-Hash.
- **CSRF:** `SameSite=Lax`. Jede schreibende Route unter `/api/auth/*`, `/api/me/*` und Admin verlangt `requireSameOrigin`: gleiche Origin, kein `Sec-Fetch-Site: cross-site`, JSON. Kein GET ändert etwas, auch nicht Einlösen oder Abmelden.
- **Login-CSRF und Clickjacking:** Die Bestätigungsseite und der Übernahmedialog zeigen die volle Kontoadresse. Fehlt das Flow-Cookie, erscheint der Hinweis aus 5.1. Der Code wirkt nur mit Flow-Cookie. `frame-ancestors 'none'` und `X-Frame-Options DENY` (Caddy, 6.3) verhindern das Einrahmen von `/anmelden*` und `/konto*`. Die App bettet sich nirgends selbst per `<iframe>` ein.
- **Session Fixation:** Jede Anmeldung bekommt eine neue Sitzung, die alte im Browser wird gelöscht.
- **Umleitungen:** `safeNext(path)` in `shared/safe-next.mjs`:
  - nur Werte, die mit `/` beginnen;
  - nach `new URL(value, 'https://app.local')` erneut prüfen: gleiche Origin, das Ergebnis beginnt mit genau einem `/` (`!/^\/[\/\\]/.test(result)`), keine Steuerzeichen;
  - nur bekannte Präfixe (`/`, `/suche`, `/konto`, `/beschluss/`, `/thema/`, `/analytics`, `/admin`, `/kalender`, `/gespeichert`);
  - sonst `/`.

  Testfälle: `/.//x`, `/%2e//x`, `/a/..//x`, `/\x`, `/\t/x`, `javascript:`.
- **Admin-Kanal:** `isAdminHost` (6.1). Von Hand per curl gegen die öffentliche Site testen: `//admin`, `/api//admin/x`, `/%61pi/admin/x`, `/ADMIN`, `/admin.rsc`. Alle müssen 404 oder 403 liefern.
- **Kopfzeilen:** `/api/auth/*`, `/api/me/*` und die Anmeldeseiten senden `Cache-Control: private, no-store`, `Vary: Cookie` und `Referrer-Policy: no-referrer`. Die Sicherheitskopfzeilen setzt Caddy (6.3). Eine vollständige CSP für Skripte ist ein eigenes Paket vor der Öffnung.
- **Logs:** SQL immer mit gebundenen Werten, denn das Protokoll langsamer Abfragen zeigt den SQL-Text (`d1-sqlite.mjs:123-126`). Fehlertexte ohne Adressen und Tokens.
- **Ohne CAPTCHA** in der Testphase. Der Einladungsmodus schließt Fremde aus. Vor einer freien Registrierung (Entscheidung 12) kommen eine Missbrauchsprüfung (EU-Anbieter wie Friendly Captcha oder Proof-of-Work) und eine strengere Grenze je /64.
- **Notzugang:** Fällt der Mailversand aus, erzeugt `ratsmonitor-accounts login-link` auf dem Server einen Link.

### 11.1 Bedingungen für den Eigenbau

Der Eigenbau ist nur unter diesen Bedingungen vertretbar (Abwägung vom 13.10.2026):

1. Kleiner Umfang: keine Passwörter, keine eigene Kryptografie (nur WebCrypto), keine Anmeldung über Google oder Apple.
2. Ein Test je Sicherheitsregel, abgeleitet aus OWASP ASVS Kapitel 2 und 3 (`tests/accounts-*.test.mjs`).
3. Vor den ersten Testern: Prüfung durch ein stärkeres Modell und `/security-review`.
4. Vor der öffentlichen Öffnung und vor der Bezahlung: Prüfung durch eine Fachperson (Pentest, einige Tage).
5. Fehlgeschlagene Anmeldungen und erreichte Grenzen landen im Protokoll und in der Überwachung.

Admin hängt nicht an der Anmeldung allein (Tunnel, SSH-Schlüssel); die geschützten Daten sind wenig sensibel (öffentliche
Ratsdaten, gespeicherte Suchen, Adressen), Zahlungsdaten liegen beim Dienstleister. Wechsel zu einem Dienst (z. B. Zitadel)
über `user_identities`, wenn Kommunen eigene Identitätsdienste verlangen oder ein zweiter Faktor für alle Pflicht wird.

## 12. Datenschutz

**Verarbeitungsverzeichnis** (neu: `docs/recht/verarbeitungsverzeichnis.md`, je Zeile mit Zweck, Daten, Grundlage, Empfänger, Frist):

| Verarbeitung | Rechtsgrundlage |
|---|---|
| Konto, Anmeldung, gespeicherte Daten, Testphase | Art. 6 Abs. 1 b |
| Einladung zur Testphase (nach vorheriger Zustimmung) | Art. 6 Abs. 1 b (vorvertraglich auf Anfrage) |
| Mailversand über den Anbieter | Art. 6 Abs. 1 b |
| Ratenbegrenzung (IP nur im Arbeitsspeicher bis 24 h; HMAC der Adresse 24 h) | Art. 6 Abs. 1 f |
| `auth_events`, `admin_audit`, Admin-Zugriff | Art. 6 Abs. 1 f |
| journald- und gegebenenfalls Caddy-Protokolle | Art. 6 Abs. 1 f |
| Sicherungen (eigene und des Hosters) | Art. 6 Abs. 1 b/f |
| Entwicklerkopien der Inhaltsdatei und PDF-Ablage | Art. 6 Abs. 1 f |

Einen Newsletter gibt es in Thema 1 nicht. Er kommt erst mit Double-Opt-in ins Verzeichnis.

**Empfänger** sind Hostinger, der Mailversanddienst und der Postfachanbieter, jeweils mit AVV. In Thema 1 gibt es kein Drittland. Stripe folgt mit Thema 3 (Abschnitt 9).

**Weitere Dokumente vor dem ersten Tester:**

- `docs/recht/tom.md` (Art. 32): Zugriff über root/SSH, Rechte 700/600, `InaccessiblePaths`, age, `secure_delete`, Tunnel für Admin, Entwicklerrechner verschlüsselt
- `docs/recht/datenpanne.md` (Art. 33/34): Wer bewertet, Meldung an die LDI NRW binnen 72 h, Benachrichtigung der Betroffenen, Widerruf aller Sitzungen per `revoke`

**Erhoben wird in Thema 1 nur:** Adresse, optional ein Name, AGB-Version, Altersbestätigung und die Version der Datenschutzinformation. `org` und `customer_type` kommen mit Thema 3.

**Fristen** (in `docs/recht/loeschkonzept.md` übernehmen, dort `:13` ohne Passwort fassen und `:27` angleichen):

| Daten | Frist |
|---|---|
| Anmeldetokens | 15 min gültig, gelöscht 24 h nach Ablauf |
| `login_requests`, `login_flows` | 24 h |
| Sitzungen | mit Ablauf |
| Einladungen | 30 Tage gültig, danach gelöscht; beim Einlösen sofort |
| `auth_events` | 90 Tage |
| `mail_outbox` (ohne Adresse und Inhalt nach Versand) | 30 Tage |
| `admin_audit` | 12 Monate |
| Konto | sofort bei Löschung |
| Konten ohne Anmeldung seit 24 Monaten (Platzhalter) | Hinweismail, 30 Tage später gelöscht |
| gesperrte Konten (Platzhalter) | 12 Monate nach Sperre, Grund in `block_note` |
| Testkonten am Ende der Testphase | Information mit Wahl: weiter als Basic oder löschen |
| eigene Sicherungen der Kontendatei | 7 Tage auf dem Server, 30 Tage beim Pull (s. u.) |
| Sicherungen der Inhaltsdatei | 2 Stände (`KEEP=2`) |
| Sicherungen und Snapshots des Hosters | prüfen (AP9); abschalten oder nennen |
| `deleted.log` | länger als die längste Sicherung, mindestens 60 Tage |
| journald | 7 Tage |
| Protokolle beim Mailanbieter | höchstens 30 Tage |

**Pflegejob:** `scripts/accounts/maintenance.mjs` wendet die Fristen an, verschickt „Testzugang endet“ und Inaktivitätshinweise und prüft die Überwachung (Abschnitt 13). Danach sichert er die Kontendatei. Dazu gehören:

- Eintrag `accounts` in `JOBS` (`server/integrations/schedules.mjs`) und in `TRIGGER_JOBS` (`server/integrations/job-trigger.mjs:8`);
- Einheiten `deploy/node/ratsmonitor-accounts.{service,timer,path}` und `ratsmonitor-stop-accounts.path`;
- Anpassung von `tests/job-trigger.test.mjs`.

Die Einheit lädt `accounts.env`, hat `ReadWritePaths=/srv/ratsmonitor/accounts`, `PrivateTmp=yes`, `TemporaryFileSystem=/run/accounts-backup` und `UMask=0077`. Sie protokolliert nach `/srv/ratsmonitor/accounts/maintenance.log`. Zeit: 02:40, damit sie nicht mit der Inhaltssicherung kollidiert.

**Sicherungen der Kontendatei:**

- `backup.sh` bekommt den Parameter `PREFIX`, heute ist es fest `ratsmonitor-` (`:18-38`). `DATABASE_FILE` und `BACKUP_DIR` sind schon Parameter.
- Für die Kontendatei schreibt `VACUUM INTO` in das tmpfs `/run/accounts-backup`. Von dort geht es direkt per `zstd | age -r <öffentlicher Schlüssel>` nach `/srv/ratsmonitor/accounts/backups/`, Präfix `accounts-`, `KEEP=7`. Unverschlüsselte Kontodaten landen so nie auf der Platte.
- Der Ordner liegt außerhalb von `/srv/ratsmonitor/backups`. Wer den Sicherungsordner der Inhalte holt, nimmt keine Konten mit.
- **Außer Haus (Startbedingung):** Max' Rechner holt täglich die neueste verschlüsselte Kontosicherung und `deleted.log` per Pull. Das läuft als geplante Aufgabe mit `scp` über einen eigenen SSH-Schlüssel mit `command=`-Einschränkung, nur zum Lesen, mit 30 Tagen Aufbewahrung. Der private age-Schlüssel liegt offline bei Max und Nico. Weil die Verantwortlichen selbst die Kopie halten, ist das keine Auftragsverarbeitung.
- `scripts/server-disk.mjs:51-55` bekommt den Ordner als eigene Kategorie.
- Nach dem Rückspielen folgt `ratsmonitor-accounts reapply-deletions`. Das Rückspielen wird vor dem ersten Tester einmal geübt und in `node-server.md` beschrieben.
- **Hoster:** Im hPanel prüfen, ob automatische Sicherungen und Snapshots laufen. Sie enthielten `accounts.sqlite`, `deleted.log` und `accounts.env` unverschlüsselt. Entweder abschalten oder ihre Aufbewahrung im Löschkonzept und in der Datenschutzerklärung nennen. Die Frist für `deleted.log` richtet sich danach.

**Entwicklerkopien:**

- Die Kontendatei verlässt den Server nur verschlüsselt über den Pull oben, nie als Entwicklerkopie. Das kommt in `docs/betrieb/node-server.md:96-126`, zusammen mit dem Hinweis, dass „Datenbank übertragen“ die Kontendatei nicht anfasst.
- Lokale Inhaltsdateien enthalten im Dev-Server Testkonten. `database-restore` bzw. der Schritt in `node-server.md` löscht die Kontotabellen vor dem Übertragen auf den Server. `serve.mjs` warnt, wenn die Inhaltsdatei Kontotabellen enthält.
- Danach enthält die Inhaltsdatei **keine Kontodaten** mehr, sobald `admin-owner-v1` nach D3 gelöscht ist und `push_subscriptions` die Datei je nach Push-Entscheidung verlässt. Namen aus öffentlichen Quellen bleiben darin, etwa Einwohnerfragen „… - Herr X“, private Bauanträge und Namen in Texten (`loeschkonzept.md:19`). Entwicklerkopien bleiben damit eine Verarbeitung personenbezogener Daten. Regeln im Verarbeitungsverzeichnis und in `node-server.md`:
  - Datenträger verschlüsselt (BitLocker);
  - höchstens zwei lokale Stände;
  - nach einem umgesetzten Löschwunsch eine neue Kopie ziehen oder die alte löschen;
  - keine Weitergabe an Dritte;
  - das gilt auch für Kopien der PDF-Ablage.
- Beide Entwickler sind root. Die Trennung verhindert die beiläufige Weitergabe, nicht den Zugriff.

**Export und MCP:**

- `TRANSFER_TABLES` (`shared/database-transfer.mjs:4-9`) bleibt eine Positivliste ohne Kontotabellen.
- Die Exportroute öffnet nur `env.DB`.
- `mcp-runtime.mjs` bekommt nie `ACCOUNTS_FILE`. Kundenrechte bleiben in der Betreiberkonfiguration.

**Logs:**

- Tokens stehen nur im Fragment.
- Caddy schreibt heute keine Zugriffsprotokolle, die Vorlage hat kein `log`. Werden sie eingeschaltet, gelten 7 Tage, und `/api/calendar/feed/*` wird maskiert.
- journald: Drop-in `deploy/node/journald-ratsmonitor.conf` mit `MaxRetentionSec=7day`, installiert über `deploy.sh`. Das ist Startbedingung vor dem ersten Tester.
- Shell-Historie: Die CLI nimmt keine Adressen als Argument (6.2). In `node-server.md` steht zusätzlich `HISTCONTROL=ignoreboth`.

**Cookies und lokaler Speicher:** Technisch notwendig sind `__Host-rm_session`/`rm_session`, `__Host-rm_flow`/`rm_flow` und in `localStorage` `ratsmonitor:recent:v1`, `ratsmonitor:imported:v1`, `ratsmonitor:account-rev:v1` sowie die Darstellungsschlüssel. Für die Übernahme wird `localStorage` ausgelesen. Grundlage ist jeweils § 25 Abs. 2 Nr. 2 TDDDG, ein Banner ist nicht nötig. Alle Schlüssel werden in der Datenschutzerklärung genannt.

**Rechtstexte vor dem ersten Tester:**

- `pages/LegalPage.tsx`:
  - Abschnitt 3: Hostinger statt Cloudflare;
  - Abschnitt 5 umschreiben statt streichen: Browser-Speicher, Übernahme, `:102-107`;
  - Abschnitt 9: Admin;
  - Abschnitt 10: Fristen;
  - neu: Konto, Sitzungscookie, Mailanbieter, Speicherdauer und Inaktivität;
  - die Zusagen `:73-75` ersetzen.
- `info/AgbPage.tsx:51` („Zugangsdaten“) und `:65-70`
- FAQ in `info/content.ts`
- `docs/recht/datenschutz-ergaenzungen.md`:
  - `:15`: ohne Passwort, ohne „Zustimmung zur Datenschutzerklärung“;
  - `:17`: „IP-Adresse nur im Arbeitsspeicher, höchstens 24 Stunden, zur Begrenzung von Anmeldeversuchen“;
  - `:29`: ohne Passwort-Zurücksetzung.
- `docs/recht/pflichten-und-avv.md` Abschnitt 2: Hostinger (AVV, Unterauftragnehmer, Rechenzentrum), Mailversand und Postfachanbieter eintragen
- AVV mit Hostinger, Mailversand und Postfachanbieter
- Betreiberdaten (`lib/betreiber.ts`), Kontakt- und Datenschutzadresse
- Anwaltsprüfung

## 13. Lokale Entwicklung, Miniflare, Cloudflare-Build, Betrieb, Tests

**Lokal:**

- **Keine Änderung an `.dev.vars` nötig.** Im Dev-Server gilt automatisch:
  - `accountsDb()` liefert `env.DB`;
  - `MAIL_TRANSPORT` ist `outbox`;
  - `SITE_URL` fällt auf die Origin der Anfrage zurück;
  - `ACCOUNTS_SECRET` ist ein fester Dev-Schlüssel;
  - die Cookies heißen `rm_dev_session`/`rm_dev_flow`.
- `scripts/run-framework.mjs dev` spielt vor dem Start `drizzle-accounts/` in die lokale D1-Datei ein (Buchführung `accounts_migrations`, Millisekunden). Danach legt es `basic@`, `pro@`, `enterprise@` und `admin@plenara.test` an.
- `wrangler.local.json`, `vite.config.ts` und die 18 Skripte bleiben unverändert.
- `database-restore.mjs` schreibt nur Transfertabellen. Nach dem Einspielen einer Server-Kopie legt der nächste Dev-Start die Testkonten neu an.

**Nur im Dev-Server** (`import.meta.env.DEV`; im Produktionsbuild 404, ein Test prüft das):

- `POST /api/dev/login {email}`
- `GET /api/dev/mails` für `/konto/postfach`
- `PATCH /api/dev/tier` für den `DevTierSwitcher`

`docs/videos/tools/rec-clip.mjs:29` nutzt künftig den Dev-Login statt `ratsmonitor:tier:v1`. `components/ratsmonitor/FRONTEND.md:69` beschreibt diese Wege statt `test1234`. `FRONTEND.md:65` ergänzt, dass auf dem Handy der Code oder `/api/dev/login` genutzt wird.

**Node-Betrieb:**

- `cloudflare-workers.mjs` liefert `ACCOUNTS` aus `ACCOUNTS_FILE` (eigener `globalThis`-Schlüssel) und `ACCOUNTS_HOOKS`.
- `serve.mjs`:
  - prüft beim Start `RM_ACCESS` (6.5);
  - prüft `users`, `sessions` und `accounts_migrations`. Fehlen sie, antworten die Kontorouten mit 503, und bei `RM_ACCESS=invite` startet der Dienst nicht;
  - verlangt bei `invite` außerdem `ACCOUNTS_SECRET` und `SITE_URL`;
  - schließt beim Beenden beide Verbindungen und warnt bei Kontotabellen in der Inhaltsdatei;
  - wärmt die Analysen mit `Authorization: Bearer <IMPORT_TOKEN>` vor (`:76-84`), damit Gate und `requireFeature` sie durchlassen;
  - ruft jede Minute `/api/internal/outbox` auf.
- **Gesundheitsweg** `GET /api/internal/health` (Bearer `IMPORT_TOKEN`): meldet Inhaltsdatei, Kontendatei, `accounts_migrations`, Mailtransport, offene Mails und `RM_ACCESS`.
- **`deploy.sh`:**
  - liest `ACCOUNTS_FILE` aus `accounts.env`;
  - legt vor dem Einspielen von `drizzle-accounts` eine Sicherung per `VACUUM INTO` nach `accounts/backups/pre-<sha>.sqlite` an und bricht bei einem Fehler vor dem Umschalten ab. Das ist eine bewusste Abweichung von der Regel „deploy.sh migriert nie“: Kontomigrationen sind klein und nur additiv (expand/contract), der laufende alte Stand arbeitet weiter. Für die Inhaltsdatei bleibt es bei „nur prüfen“;
  - prüft nach dem Neustart `/api/internal/health` und `/anmelden` auf 200, statt `/` und `/api/search` (`:52-59`). Diese antworten im Einladungsmodus mit 302/401;
  - verweigert Stände ohne Gate, wenn `RM_ACCESS` gesetzt ist. Der Build schreibt dazu `dist/standalone/features.json` mit `{"gate":true,"accounts":1}`, das `deploy.sh` vor dem Umschalten liest;
  - installiert das journald-Drop-in.

  Unit-Dateien installiert `deploy.sh` nicht. Das bleibt ein eigener Schritt (14.2).
- **Neue Variablen** in `deploy/node/ratsmonitor.env.example`, in einer neuen Vorlage `deploy/node/accounts.env.example` und in `cloudflare-env.d.ts`:
  - `ratsmonitor.env`: `RM_ACCESS`, `ADMIN_LEGACY_HEADER`, `ADMIN_HOSTS`, `MAIL_TRANSPORT`, `MAIL_API_URL`, `MAIL_FROM`, `MAIL_REPLY_TO`, `OPERATOR_EMAIL`;
  - `accounts.env`: `ACCOUNTS_FILE`, `ACCOUNTS_SECRET`, `MAIL_API_KEY`.

  `SITE_URL` gibt es schon, sie wird mit der Domain gesetzt.

**Überwachung:**

1. Der Pflegejob prüft nachts: Mails der letzten 24 h nach Status, alte `queued`-Zeilen, Alter der letzten Kontosicherung, `accounts_migrations`, Schreibbarkeit der Kontendatei. Bei Auffälligkeiten geht eine Warnmail an `OPERATOR_EMAIL`.
2. Eine Kachel „Konten“ im Reiter „Speicher & Sicherungen“ zeigt nur Summen ohne Adressen: Konten, aktive Sitzungen, Mails nach Status, letzte Sicherung. Das ist mit TA-25 vereinbar.
3. Ein externer Uptime-Check (EU) prüft `/anmelden`.

**Cloudflare-Build:** baut weiter.

- Ohne `ACCOUNTS` antworten die Kontorouten mit 503 (Muster `app/api/admin/ai-local/route.ts:9`), und `/api/me` meldet `{accounts:false}`.
- Admin geht dort nur über den ChatGPT-Weg mit `ADMIN_LEGACY_HEADER=1` in der Plattformkonfiguration (Variante a, 6.3).
- Zugesagt sind nur Node und Miniflare. Der Abbau folgt nach D3.

**Tests** (`node --test tests/*.test.mjs`, `tests/helpers/d1.mjs` bekommt `accountsMemoryDb()`):

| Datei | prüft |
|---|---|
| `accounts-login.test.mjs` | nur Hashes gespeichert; einmal einlösbar, auch bei zwei gleichzeitigen Versuchen; Ablauf; neue Anforderung entwertet ältere Tokens, Flow-Cookie bleibt; Code nur mit Flow-Cookie, 5 Versuche je Flow atomar, 10 je Adresse; gleiche Antworten für alle Adressarten, auch an der Grenze und bei erschöpftem Code; unbekannte Adresse erzeugt keine Zeile in `login_tokens`; `peek` verbraucht nichts; ohne Zustimmung kein Konto; Einladungsmodus; Sperre, Adresswechsel und `revoke` entwerten offene Tokens; `verify` prüft Status und Adresse; Zweckbindung (Anmeldecode löscht nicht, Löschcode meldet nicht an, Löschcode von A wirkt nicht bei B); `safeNext` mit den Fällen aus Abschnitt 11; Link aus `SITE_URL`; IPv6 /64 |
| `accounts-session.test.mjs` | Cookie je Protokoll, auf https nur `__Host-`, Dev-Namen getrennt; GET schreibt nie; `refresh` höchstens täglich; Leerlauf- und Höchstdauer, kürzer auf Admin-Hosts; Abmelden, Widerruf, Sperre wirken sofort; zwei Importe des Env-Moduls liefern dieselbe Verbindung |
| `accounts-admin.test.mjs` | alle Dateien unter `app/api/admin` ohne Admin-Sitzung 401/403 (Durchlauf wie `admin-readonly.test.mjs`, gemeinsamer Lader mit Stub für `@/server/services/session`); `/admin` rendert ohne Admin-Sitzung keine Admin-Daten; gefälschte `Oai-*` wirkungslos bei `ADMIN_LEGACY_HEADER=0`; `auth_at` über 7 Tage kein Admin; Admin-Sitzung mit öffentlichem Host 403; Liste der auditpflichtigen Aktionen, Schritte zusammengefasst |
| `accounts-tiers.test.mjs` | `shared/plans.mjs` gleich `stufen.md` und Frontend; `plan_grants`-Gültigkeit; Einladung oder Registrierung ohne Zeile ergibt `basic`; 409 über der Grenze; Abstufung setzt `active=0`; Analytics 403, intern 200; Feed-Token; Download mit Sitzung; alte ICS-Route 410/308; Gastkürzung bei `page` und Strom (zwei Etappen zu je 15 → 10 und `end`), Zwischenspeicher bleibt geteilt |
| `accounts-import.test.mjs` | Schema, Größe, Wiederholung und zweites Gerät ohne Doppelung (`signature`), Über-Grenze-Regel, `mergedInto`, `ui_state` enthält kein `@`, `notify.email`/`recipients` verworfen, `position` erhalten, Snapshot aus einer Abfrage |
| `accounts-privacy.test.mjs` | nach dem Löschen keine Adresse und Konto-ID in irgendeiner Tabelle der Kontendatei; Löschen mit und ohne `ACCOUNTS_HOOKS`; `secure_delete` an; Export vollständig ohne Hashes, nur mit frischem `auth_at` oder Code, mit Hinweismail; `reapply-deletions`; Fristen des Pflegejobs |
| `accounts-separation.test.mjs` | keine Kontotabelle in `drizzle/` und `TRANSFER_TABLES`; Export und MCP öffnen `ACCOUNTS_FILE` nicht; kein Rückfall auf `env.DB` in Builds ohne Schalter; `InaccessiblePaths` in allen übrigen Unit-Dateien; `ACCOUNTS_FILE` nicht in `ratsmonitor.env.example` |
| `accounts-csrf.test.mjs` | Schleife über alle ändernden `/api/auth/*`, `/api/me/*`: 403 bei fremder Herkunft, 415 ohne JSON |
| `accounts-gate.test.mjs` | 302/401/frei je Pfad; SSR-Vorgangsseiten geschützt; `requireAccess()` in Datenrouten; `__Host-`-Cookie hinter `X-Forwarded-Proto`; `/api/search` behält sein Cache-Control; Start bricht bei fehlendem oder falschem `RM_ACCESS` ab; WARM-Pfade mit internem Zugang 200 |
| `mail.test.mjs` | Links nur aus `SITE_URL`, Token im Fragment, kein Zählpixel, keine Tokens im Protokoll; `<img src=x onerror=…>` im Namen kommt maskiert an; Postausgang übersteht Neustart; abgelaufene Anmeldemails verworfen; Kontingente getrennt |

Anzupassen sind außerdem:

- `tests/admin.test.mjs`: Harness auf den Session-Stub umstellen; die `claim`-Tests (`:9`, `:24-35`, `:206-223`) bleiben hinter dem Legacy-Schalter; `:53`;
- `tests/admin-pipeline.test.mjs:49`;
- `tests/job-trigger.test.mjs`.

**Von Hand:**

- Link und Code in Gmail, GMX, web.de und Outlook mit Safe Links: Kein Scanner darf das Token verbrauchen.
- Link in der Webansicht einer Mail-App öffnen, dann Code im normalen Browser.
- Zustelltest mit SPF, DKIM und DMARC, Testmail an `kontakt@` und `dmarc@`.
- Tunnel unter `http://127.0.0.1:8080` mit Chrome, Firefox und Safari.
- curl gegen beide öffentlichen Hosts: Admin-Pfade und Varianten, Sicherheitskopfzeilen, gefälschte `Oai-*`, `X-Prerender-Revalidate`, `cf-connecting-ip`.
- Barrierefreiheit der neuen Abläufe mit Tastatur und Screenreader.
- Für das Frontend die Prüfbefehle aus `FRONTEND.md`, danach `node scripts/frontend-index.mjs`.

## 14. Vorgehen

### 14.1 Arbeitspakete

| AP | Inhalt | PT |
|---|---|---|
| 0 | Sofort: Caddy-Snippets und Schritt 0, wirksamen sslip-Block ohne Hash versionieren, `scripts/check-caddy.mjs`, Testhinweis `AccountPages.tsx:286-288` hinter `IS_DEV` | 1 |
| 7 | Früh anstoßen: Domain, Versanddienst, Postfachanbieter, AVV, DNS (SPF, DKIM, DMARC, MX); `http`-Transport | 1 + Vorlauf |
| 1 | Kontendatei: `openD1 secureDelete`, `env.ACCOUNTS` und `ACCOUNTS_HOOKS`, `accountsDb`, `drizzle-accounts/0001`, `node-migrate --dir --table`, `deploy.sh` (accounts.env, Vor-Sicherung, Gesundheitsweg, `features.json`), `serve.mjs`, Unit-Dateien mit `ReadWritePaths`/`InaccessiblePaths`, `accounts.env.example`, Dev-Start mit Seed, Testhelfer | 2 |
| 2 | Anmeldung: Tokens, Code, `login_requests`/`login_flows`, Flow-Cookie, Sitzungen, `/api/auth/*`, `/api/me`, Geräte, Grenzen, `clientIp`, `safeNext`, Postausgang, Mailadapter `outbox`/`log`, Vorlagen mit Escaping, Dev-Routen | 3,5 |
| 3 | Admin: Rolle, `adminState`, `ADMIN_HOSTS`, 7-Tage-Regel, Umbau `app/admin/page.tsx`, `requireAdminWrite` mit Audit-Auswahl, `ADMIN_LEGACY_HEADER`, `manage.mjs` und Wrapper, Testharness | 2 |
| 4 | Stufen: `shared/plans.mjs`, `effectiveTier`, `entitlements`, `internalCall`, Analysen, Kalender mit Feed und Download, Lena, Gastkürzung im Strom, Cache-Kopfzeilen | 2 |
| 5 | Konto-API: Suchen, Artikel, Einstellungen, Import, Export mit Code, Löschen mit Zweckbindung | 2,5 |
| 6 | Oberfläche (vorher `FRONTEND.md`), siehe unten | 5 |
| 8 | Gate: `middleware.ts` mit vollem Matcher und begrenzten Kopfzeilen, `requireAccess()` in Datenrouten, `RM_ACCESS` mit Startprüfung, `env` in der Middleware bestätigen | 1 |
| 9 | Betrieb und Recht, siehe unten | 3 + extern |
| 10 | Abnahme: Testdateien vollständig, ASVS Kap. 2/3, `/security-review`, Prüfung von Hand | 1,5 |
| 11 | Ausrollen, Übergangsfenster, Einladungen in Wellen, Aufräumen | 1 |

**Inhalt AP6 (Oberfläche):**

- `/anmelden` mit Wartebildschirm und Codefeld, `/anmelden/bestaetigen` (Seite und Einträge in `routes.ts`/`App.tsx`)
- `/registrieren` leitet um (Seite, Route, `pageTitle`, `isInfoPath`); Passwortfelder und „Passwort vergessen“ entfallen; Client statt `testAuth.ts`
- `useTier` aus `/api/me`, asynchrones Speichern, Kontosignal zwischen Tabs
- Übernahmedialog, Datei sichern und übernehmen
- Kontoseite mit Geräten, Feed, Export, Löschen, Laufzeit der Stufe; Profiladresse nur lesbar
- Admin-Symbol
- Upgrade-Knöpfe und Benachrichtigungsschalter deaktiviert (Abschnitt 7)
- Preise an einer Stelle; Dev-Postfach im iframe
- Barrierefreiheit:
  - ein Codefeld mit `autocomplete="one-time-code"`, `inputmode="numeric"`, Einfügen erlaubt;
  - Zustände als `role="status"`/`role="alert"`;
  - Fokus auf die neue Überschrift;
  - Ablaufzeit nennen und „neuen Code senden“ anbieten;
  - Pflichthaken als echte Checkboxen mit verknüpftem Fehlertext;
  - Dialoge als `<dialog>`;
  - WCAG 2.2 SC 2.2.1 und 3.3.8.
- danach `node scripts/frontend-index.mjs`

**Inhalt AP9 (Betrieb und Recht):**

- `backup.sh` mit `PREFIX` und tmpfs/age, Pull außer Haus, Rückspielen üben
- Pflegejob mit allen Teilen (Abschnitt 12), Überwachung
- `server-disk.mjs`, journald-Drop-in, Hostinger-Sicherungen prüfen
- `node-server.md`: Abschnitte „Vor dem Öffnen“ `:413-419` auf 6.3 umstellen, Zeilen `:58`, `:89`, `:121`, Entwicklerkopien, CLI-Regeln
- TA-25 in `requirements/vor-Ort_Anforderungen.md:763-775` auf Konto, Rolle, Sitzung, Admin-Host, 7-Tage-Regel und Gate umschreiben. Der Satz „frei gesetzte HTTP-Header dürfen nicht als Anmeldung gelten“ bleibt.
- neuer Abschnitt in `CLAUDE.md`
- Verarbeitungsverzeichnis, `tom.md`, `datenpanne.md`, Rechtstexte

**Summe:** etwa 25 Personentage.

**Reihenfolge:**

- AP0 sofort, AP7 gleich danach anstoßen.
- Dann 1 → 2 → 3 → 4 → 5. AP6 läuft parallel ab AP2.
- Dann 8, 9, 10, 11.
- Kritischer Pfad: AP1 → AP2 → AP3 → AP8 → AP10 → AP11. Domain, AVV und Anwalt laufen daneben.
- AP4 ist Pflicht, bevor Tester verschiedene Stufen haben. Die Gastkürzung der Suche ist erst vor der Öffnung nötig.
- Die Testphase ist in etwa fünf Wochen erreichbar, abhängig von Domain, Mailanbieter und Anwaltsprüfung.

### 14.2 Ausrollen ohne Ausfall

**Grundregel:** Kein Rückweg führt hinter Schritt 0. Fehler in Schritt 0 und später werden vorwärts behoben. Jede Caddy-Änderung läuft vorher durch `scripts/check-caddy.mjs`.

1. **Caddy-Schritt 0:** `Caddyfile.step0` prüfen, `systemctl reload caddy`.
2. **Vorbereitung auf dem Server:**
   - `/srv/ratsmonitor/accounts/` anlegen (700, `ratsmonitor`) und `accounts.env` (root 600) mit `ACCOUNTS_FILE` und `ACCOUNTS_SECRET` (zufällig, 32 Byte);
   - den öffentlichen age-Schlüssel ablegen;
   - die geänderten Unit-Dateien (`ReadWritePaths`, `InaccessiblePaths`, zweites `EnvironmentFile`) und `ratsmonitor-accounts.*` kopieren, `systemctl daemon-reload`;
   - im hPanel die Hoster-Sicherungen prüfen.
3. **Release A:** Kontocode und Frontend. `deploy.sh` sichert die Kontendatei und spielt `drizzle-accounts` ein. Gesetzt sind:
   - `SITE_URL` (vorerst die sslip-Adresse) und `MAIL_*`;
   - `ADMIN_LEGACY_HEADER=1`, `ADMIN_HOSTS`;
   - `RM_ACCESS=open`.

   Alles läuft weiter wie bisher. Prüfpunkt: `ratsmonitor-accounts login-link` erzeugt einen Link, und die Anmeldung damit gelingt.
4. **Admins anlegen:** `invite` für Max und Nico, `role admin`, Anmeldung im Tunnel unter `http://127.0.0.1:8080` per Code oder `login-link --base http://127.0.0.1:8080`. Admin über das Konto prüfen und den Pull außer Haus einrichten.
5. **Umschalten:** `ADMIN_LEGACY_HEADER=0`, `Caddyfile.step2` (Tunnel ohne Kennung), `RM_ADMIN_*` löschen. Rückweg: Schalter auf 1. Die Caddyfile bleibt bei Schritt 2.
6. **Gate:** `RM_ACCESS=invite` mit Basic-Auth davor prüfen (Abnahme AP10, curl-Prüfungen). Ab jetzt verweigert `deploy.sh` Stände ohne Gate.
7. **Domain und Start:** Startbedingungen sind Mail, DNS, Postfächer, journald, Rechtstexte, AVV, TOM, Datenpanne, geübtes Rückspielen und Zustelltest. Danach:
   - `Caddyfile.step3` mit Domain-Block und ohne Basic-Auth;
   - `SITE_URL` auf die Domain;
   - Übergangsfenster von 14 Tagen auf sslip.io (Abschnitt 8), danach Weiterleitung;
   - Tester in Wellen einladen.

   Rückweg: Basic-Auth-Block wieder einsetzen. Ein App-Stand vor Release A ist ab hier nicht mehr zulässig.
8. **Nach zwei Wochen ohne Befund aufräumen** (6.3, Schritt 5). `admin-owner-v1` bleibt bis D3.

**Rückweg-Matrix:**

| Nach Schritt | zulässiger App-Stand | zulässige Caddyfile |
|---|---|---|
| 1 | beliebig | step0 |
| 3, 4 | Release A oder neuer; davor nur mit `RM_ACCESS=open` | step0 |
| 5 | Release A oder neuer, `ADMIN_LEGACY_HEADER` 0 oder 1 | step2 |
| 6, 7 | nur Stände mit `features.json` `gate:true` | step2 + Basic-Auth oder step3 |

Die Inhaltsdatei und der Importprozess werden in keinem Schritt angefasst.

## 15. Offene Entscheidungen für Max

1. **Domain** für Website und Mail. Sie blockiert den Start der Testphase.
2. **Versanddienst und Postfachanbieter** aus der EU nach Abschnitt 10, dazu Absender-, Antwort-, Kontakt-, Datenschutz- und Betreiberadresse (`OPERATOR_EMAIL`).
3. **Admin über https:** In der Testphase nur über den Tunnel (Empfehlung). TOTP als eigenes Paket, bevor `?seite=mobil` wieder über https geht. Oder bewusst auf Dauer nur Tunnel.
4. **Stufe und Laufzeit der Tester:** Vorschlag ist Pro oder Enterprise mit `source='beta'` und `ends_at` am Ende der Testphase. Danach Wahl der Tester: weiter als Basic oder löschen.
5. **Preise und Namen:** Bis zur Entscheidung gelten Platzhalter in `shared/plans.mjs`. Offen sind 9,99/49,99 € brutto oder 149/399/990 € netto, Basic/Pro/Enterprise oder Starter/Professional/Team, `free` oder `basic`. Entscheidung gemeinsam mit Nico (`docs/gesellschaft/eckpunkte.md:5`).
6. **Grenzwerte:** Basic mit oder ohne E-Mail (`content.ts:317` gegen `tier.ts:29`), Enterprise mit 5 oder 6 Empfängern, Lena je Stufe, Mailkontingente je Stunde.
7. **Über der Grenze:** alles übernehmen und N aktiv (Empfehlung) oder kürzen.
8. **Web-Push:** Empfehlung ist entfernen. Die Oberfläche ist nicht eingebunden, und die Rundsendung gilt nur für Münster. Entfernt würden `push_subscriptions` aus der Inhaltsdatei, `components/notifications.tsx` und Datenschutz-Abschnitt 6. Behalten hieße: Tabelle in die Kontendatei mit `user_id`, Rundsendung ablösen.
9. **Fristen:** Sitzung 30/90 Tage, Admin 12 h/7 Tage, Ereignisse 90 Tage und 12 Monate, Kontosicherungen 7 Tage auf dem Server und 30 Tage beim Pull, Inaktivität 24 Monate, gesperrte Konten 12 Monate.
10. **Kontosicherung zusätzlich bei einem Dienstleister** (verschlüsselt, mit AVV): ja oder nein. Der Pull auf Max' Rechner ist Startbedingung.
11. **Testbedingungen:** kurze Bedingungen ohne Preis oder schon die AGB; Willkommensmail mit AGB in der kostenlosen Testphase.
12. **Spätere Öffnung:** freie Registrierung oder weiter nur Einladung bis zur Bezahlung. Bei freier Registrierung: welche Missbrauchsprüfung (EU-CAPTCHA oder Proof-of-Work).
13. **Recht:** Betreiberdaten, Hostinger-AVV, Anwaltsprüfung. Gilt die geschlossene Testphase schon als Start im Sinne der Arbeitgeberzustimmung (`docs/todo/todos.json:59`)?
14. **Cloudflare-Build:** Variante a (Altweg bis D3, Empfehlung) bestätigen oder Cloudflare-Admin mit dem Aufräumen beenden.

## 16. Risiken

| Risiko | Folge | Gegenmittel |
|---|---|---|
| Eigene Fehler im Anmeldecode | Kontoübernahme | kleiner Umfang, Test je Regel, ASVS und `/security-review`, Kriterien für einen externen Dienst |
| Raten des Codes | Kontoübernahme | 8 Stellen, ein offenes Token je Adresse, 5 Versuche je Flow, 10 je Adresse und Tag, atomares Zählen |
| Kontenaufzählung | gezielter Missbrauch | gleiche Antworten und gleiche synchrone Arbeit, Zählung für alle Adressarten |
| Offene Weiterleitung über `next` | Phishing | neues `safeNext` mit Prüfung nach der Normalisierung, Präfixliste, Tests |
| Admin über die öffentliche Site | Administration von außen | `ADMIN_HOSTS` in der App, Pfadsperre und Kopfzeilen-Filter in Caddy, `check-caddy.mjs` |
| Mail-Scanner verbrauchen Tokens | Anmeldung scheitert | Fragment, `peek`, Klick statt Automatik, Code als zweiter Weg, Prüfung mit Safe Links |
| Mails gehen bei Neustart verloren | Tester ohne Mail | Postausgang, Fortsetzung beim Start, Überwachung |
| Zustellung ohne Ruf der Domain | Links landen im Spam | eigene Domain mit SPF, DKIM, DMARC, Vorankündigung, Wellen, Wartebildschirm mit Hinweisen |
| vinext-Middleware kommt nicht an `env` oder wird übersprungen | Gate unwirksam | Test in AP8, `requireAccess()` in Datenrouten, Caddy entfernt `X-Prerender-Revalidate`, Basic-Auth bis zur Prüfung |
| Unit-Rechte falsch | Kontorouten schreibgeschützt oder Jobs lesen Konten | `ReadWritePaths`/`InaccessiblePaths` mit Test, Prüfpunkt `login-link` |
| CLI als root | Dienst kann nicht mehr schreiben | Wrapper mit `sudo -u ratsmonitor`, Abbruch bei falschem Benutzer |
| Kontotabellen gelangen über eine lokale Datei in die Server-Inhaltsdatei | Testkonten auf dem Server | Bereinigung vor dem Übertragen, Warnung in `serve.mjs`, Hinweis in `node-server.md` |
| Sperrkonkurrenz | Besucher warten | eigene Datei, Busy-Timeout 2 s, GET schreibt nie, höchstens eine Verlängerung je Tag, Snapshots aus einer Abfrage |
| Vorwärmen fällt aus | lange Erstrechnung blockiert alle | interner Bearer für WARM, Test |
| Verlust des Servers | Konten weg | tägliche verschlüsselte Sicherung, Pull außer Haus samt `deleted.log`, geübtes Rückspielen |
| Verlust des `age`-Schlüssels | Sicherungen nicht lesbar | Schlüssel bei Max und Nico offline, Rückspielen einmal üben |
| Hoster-Snapshots | Löschfristen nicht eingehalten | im hPanel prüfen, abschalten oder nennen |
| Postfach eines Admins gekapert | Admin-Zugriff | Admin nur über den Tunnel (SSH-Schlüssel), 7-Tage-Regel, TOTP vor Admin über https |
| Falscher Rückweg | Seite offen oder Admin-Kennung wieder aktiv | Rückweg-Matrix, `features.json`, kein Rückweg hinter Schritt 0 |
| Daten bleiben auf der alten Origin | Tester verlieren Suchen | Übergangsfenster auf sslip.io, Datei sichern und übernehmen |
| Gespeicherte `query` veraltet | falsche Treffer in Thema 2 | `query_version`, neue Auflösung beim Öffnen |
| Rechtstexte und AVV nicht fertig | Start verzögert sich | AP7 und AP9 früh, Rechtstexte als Startbedingung |
| Cloudflare ohne Konten | dort kein Admin über Konten | nur Node und Miniflare zugesagt, Altweg per Schalter bis D3 |
| Widersprüche bei Preisen und Grenzen | falsche Zusagen | Platzhalter an einer Stelle, Test gegen `stufen.md`, Versprechen erst mit Funktion, Schalter für Benachrichtigungen deaktiviert |
