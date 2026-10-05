import { sha256Hex } from "./sha256";
import { useSyncExternalStore } from "react";
import { resetMail, welcomeMail } from "./mails";
import { setTier, type Tier } from "./tier";

/**
 * Testmodus für Konten: Anmeldung, Registrierung und E-Mails laufen nur in diesem Browser.
 * Es wird nichts an einen Server geschickt; „E-Mails“ landen im Test-Postfach (/konto/postfach).
 *
 * Vorbereitete Testkonten (Passwort jeweils „test1234“):
 *   basic@parlamo.test · pro@parlamo.test · enterprise@parlamo.test
 */
export interface TestAccount {
  email: string;
  name: string;
  org?: string;
  tier: Exclude<Tier, "guest">;
  /** SHA-256 des Passworts (nur zur Prüfung im Testmodus) */
  hash: string;
}
export interface TestMail {
  id: string;
  to: string;
  subject: string;
  body: string;
  /** Gestaltete Fassung (Links hinter Knöpfen und Titeln) */
  html?: string;
  date: string;
  read?: boolean;
}

const ACCOUNTS = "ratsmonitor:test-accounts:v1";
const SESSION = "ratsmonitor:test-session:v1";
const MAILS = "ratsmonitor:test-mails:v1";
const PROFILE = "ratsmonitor:profile:v1";
export const TEST_PASSWORD = "test1234";

/* crypto.subtle fehlt außerhalb von https/localhost (z. B. Handy im WLAN): sha256Hex hat dafür einen Ersatz */
const sha = sha256Hex;

const load = <T,>(key: string, fallback: T): T => {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
  } catch {
    return fallback;
  }
};
const store = (key: string, v: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {}
  emit();
};

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => (listeners.add(l), () => listeners.delete(l));

async function accounts(): Promise<TestAccount[]> {
  const list = load<TestAccount[]>(ACCOUNTS, []);
  if (list.length) return list;
  const hash = await sha(TEST_PASSWORD);
  const seed: TestAccount[] = [
    { email: "basic@parlamo.test", name: "Test Basic", tier: "basic", hash },
    { email: "pro@parlamo.test", name: "Test Pro", tier: "pro", hash },
    { email: "enterprise@parlamo.test", name: "Test Enterprise", org: "Musterfirma GmbH", tier: "enterprise", hash },
  ];
  store(ACCOUNTS, seed);
  return seed;
}

function startSession(a: TestAccount) {
  store(SESSION, { email: a.email });
  setTier(a.tier);
  /* Kontoeinstellungen mit Name und E-Mail des Testkontos vorbelegen */
  const p = load<Record<string, unknown>>(PROFILE, {});
  store(PROFILE, { ...p, name: a.name, email: a.email });
}

export function sendTestMail(to: string, subject: string, body: string, html?: string) {
  const list = load<TestMail[]>(MAILS, []);
  store(MAILS, [{ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), to, subject, body, html, date: new Date().toISOString() }, ...list].slice(0, 100));
}

export async function login(email: string, password: string): Promise<string | null> {
  const a = (await accounts()).find((x) => x.email === email.trim().toLowerCase());
  if (!a || a.hash !== (await sha(password))) return "E-Mail-Adresse oder Passwort ist falsch.";
  startSession(a);
  return null;
}

export async function register(data: { name: string; org?: string; email: string; password: string; tier: TestAccount["tier"] }): Promise<string | null> {
  const list = await accounts();
  const email = data.email.trim().toLowerCase();
  if (list.some((x) => x.email === email)) return "Für diese E-Mail-Adresse gibt es schon ein Konto.";
  const a: TestAccount = { email, name: data.name.trim(), org: data.org?.trim() || undefined, tier: data.tier, hash: await sha(data.password) };
  store(ACCOUNTS, [...list, a]);
  startSession(a);
  welcomeMail(email, a.name);
  return null;
}

export async function requestReset(email: string) {
  const a = (await accounts()).find((x) => x.email === email.trim().toLowerCase());
  if (a) resetMail(a.email, a.name, `(Testmodus: Die vorbereiteten Konten nutzen „${TEST_PASSWORD}“.)`);
}

export function logout() {
  store(SESSION, null);
  setTier("guest");
}

/* Snapshots stabil halten (useSyncExternalStore vergleicht per Referenz) */
let sessCache: { raw: string | null; v: { email: string } | null } = { raw: null, v: null };
let mailCache: { raw: string | null; v: TestMail[] } = { raw: null, v: [] };
const raw = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const getSession = () => {
  const r = raw(SESSION);
  if (r !== sessCache.raw) sessCache = { raw: r, v: load(SESSION, null) };
  return sessCache.v;
};
const getMails = () => {
  const r = raw(MAILS);
  if (r !== mailCache.raw) mailCache = { raw: r, v: load<TestMail[]>(MAILS, []) };
  return mailCache.v;
};

export const useTestSession = () => useSyncExternalStore(subscribe, getSession, () => null);
const NO_MAILS: TestMail[] = [];
export const useTestMails = () => useSyncExternalStore(subscribe, getMails, () => NO_MAILS);
export function markMailsRead() {
  store(MAILS, getMails().map((m) => ({ ...m, read: true })));
}
export const deleteMails = () => store(MAILS, []);
