// Einstellungen der Konten aus der Umgebung (env aus 'cloudflare:workers' oder in Tests ein einfaches Objekt).
// requirements/konten-konzept.md, Abschnitte 3.2, 6, 10 und 13.

/** Lokaler Dev-Server (vinext dev): feste Dev-Werte, Konten in der lokalen D1-Datei, Mails ins Dev-Postfach. */
export const isDev=()=>import.meta.env?.DEV===true;
const DEV_SECRET='dev-only-secret-not-for-production-0123456789abcdef';
const ACCESS=['open','invite'];

/**
 * Datenbank der Konten. Server: eigene Datei (env.ACCOUNTS). Dev-Server: die Inhaltsdatei (env.DB), damit lokal eine
 * einzige D1-Datei bleibt. In Builds nie still auf env.DB zurückfallen, nur mit ACCOUNTS_IN_MAIN_DB=1 (lokaler Node-Build).
 */
export function accountsDb(env,{dev=isDev()}={}){
 if(dev)return env?.DB;
 if(env?.ACCOUNTS)return env.ACCOUNTS;
 if(env?.ACCOUNTS_IN_MAIN_DB==='1')return env.DB;
 return undefined;
}
export function accountsConfig(env,{dev=isDev()}={}){
 const list=value=>String(value||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
 return {
  dev,
  db:accountsDb(env,{dev}),
  secret:dev?(env?.ACCOUNTS_SECRET||DEV_SECRET):env?.ACCOUNTS_SECRET,
  siteUrl:env?.SITE_URL?String(env.SITE_URL).replace(/\/+$/,''):undefined,
  access:ACCESS.includes(env?.RM_ACCESS)?env.RM_ACCESS:(dev?'open':undefined),
  openSignup:dev||env?.ACCOUNTS_OPEN_SIGNUP==='1',
  adminHosts:list(env?.ADMIN_HOSTS||'127.0.0.1:8080,localhost:8080'),
  // Alter Admin-Weg (Caddy-Kopfzeilen): ausdrücklich mit 1; ohne Angabe nur, solange es keine Kontendatei gibt (sonst wäre
  // die Administration nach dem Ausrollen gesperrt, bevor ein Admin-Konto existiert)
  legacyHeader:env?.ADMIN_LEGACY_HEADER==='1'||(env?.ADMIN_LEGACY_HEADER===undefined&&!env?.ACCOUNTS_FILE&&!accountsDb(env,{dev})),
  mail:{
   // outbox (Test-Postfach dev_mail) hält Links und Codes im Klartext: nur im Dev-Server oder ausdrücklich für Tests
   transport:dev?(env?.MAIL_TRANSPORT||'outbox'):(env?.MAIL_TRANSPORT==='outbox'&&env?.ACCOUNTS_TEST_OUTBOX!=='1'?'log':(env?.MAIL_TRANSPORT||'log')),
   apiUrl:env?.MAIL_API_URL, apiKey:env?.MAIL_API_KEY,
   // MAIL_TRANSPORT=smtp: Postfach (IONOS: smtp.ionos.de, 465, TLS). Passwort Base64-kodiert (SMTP_PASSWORD_B64), damit
   // Sonderzeichen in der systemd-Umgebungsdatei nichts anrichten; SMTP_PASSWORD nur für lokale Versuche
   smtp:{host:env?.SMTP_HOST||'smtp.ionos.de',port:Number(env?.SMTP_PORT||465),secure:env?.SMTP_SECURE!=='0',user:env?.SMTP_USER,
    pass:env?.SMTP_PASSWORD_B64?new TextDecoder().decode(Uint8Array.from(atob(String(env.SMTP_PASSWORD_B64).trim()),c=>c.charCodeAt(0))):env?.SMTP_PASSWORD},
   from:env?.MAIL_FROM||'Plenara <anmeldung@plenara.test>', replyTo:env?.MAIL_REPLY_TO, operator:env?.OPERATOR_EMAIL,
  },
  // Anmelden mit E-Mail-Adresse und Code aus der Authenticator-App, ohne Mail (nur Konten mit eingerichtetem zweiten
  // Faktor, also Admins): ausdrücklich mit 1. Das ist ein Faktor statt zwei (Link aus der Mail und App), gedacht für die
  // Zeit ohne Mailanbieter hinter dem Passwort der Seite (requirements/konten-konzept.md 6.4)
  totpLogin:env?.LOGIN_TOTP==='1',
  hooks:env?.ACCOUNTS_HOOKS,
  internalToken:env?.IMPORT_TOKEN,
  // Kunden-MCP über das Netz (server/accounts/oauth.mjs): Geheimnis der Zugangstoken und Kundendatei des Betreibers,
  // beide aus /etc/ratsmonitor/mcp.env; im Dev-Server feste Werte und tmp/mcp-customers.json
  mcp:{secret:env?.MCP_TOKEN_SECRET||(dev?DEV_SECRET:undefined),customersFile:env?.MCP_CUSTOMERS_FILE||(dev?'tmp/mcp-customers.json':undefined)},
  // Bezahlung über Stripe (server/accounts/billing.mjs): nur mit allen drei Werten; Live-Schlüssel nur mit STRIPE_LIVE=1.
  // STRIPE_PORTAL_CONFIG: eigene Einstellung des Kundenportals (scripts/billing/setup-stripe.mjs), sonst die des Dashboards
  billing:{secretKey:env?.STRIPE_SECRET_KEY,webhookSecret:env?.STRIPE_WEBHOOK_SECRET,price:env?.STRIPE_PRICE_PLUS,live:env?.STRIPE_LIVE==='1',
   portalConfig:env?.STRIPE_PORTAL_CONFIG},
 };
}
/** Anmelden per Link und Code aus der Mail: nur mit echtem Versand (Transport log verschickt nichts) */
export const mailLogin=cfg=>cfg.mail.transport!=='log';
/** Basisadresse für Links in Mails: nur SITE_URL, im Dev-Server die Origin der Anfrage (Handy im WLAN) */
export function siteBase(cfg,request){
 if(cfg.siteUrl)return cfg.siteUrl;
 if(cfg.dev&&request)return new URL(request.url).origin;
 return undefined;
}
