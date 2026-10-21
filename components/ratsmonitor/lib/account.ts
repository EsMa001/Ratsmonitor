import { useSyncExternalStore } from "react";
import { LIMITS as PLAN_LIMITS, FEATURES as PLAN_FEATURES } from "@/shared/plans.mjs";
import { onOtherTab } from "./otherTab";
import { clearRecent } from "./recentSearches";
import type { Tier, TierLimits } from "./tier";

/**
 * Konto im Browser: der Stand von GET /api/me (Stufe, Grenzen, Rechte, Anmeldung) und die Abrufe der Kontorouten.
 * Cookies sind HttpOnly und gehen von selbst mit; der Browser kennt nur, was /api/me meldet.
 * Abgleich zwischen Tabs über den Stempel ACCOUNT_REV (requirements/konten-konzept.md, Abschnitt 8).
 */
export interface Me {
  /** /api/me ist beantwortet; vorher zeigen gesperrte Elemente einen neutralen Ladezustand */
  ready: boolean;
  /** false: Der Server hat keine Konten (Anmeldung ausblenden, alles wie Gast) */
  accounts: boolean;
  tier: Tier;
  limits: TierLimits;
  features: { analytics: boolean; calendar: boolean; mcp: boolean; lenaPerMin: number };
  user: { id: string; email: string; name: string | null } | null;
  tierUntil: string | null;
  tierSource: "beta" | "manual" | "stripe" | null;
  roles: string[];
  adminHere: boolean;
  /** Nur für Admins: ok, totp (Code fehlt), setup (zweiter Faktor nicht eingerichtet), stale (neu anmelden) */
  admin?: "ok" | "totp" | "setup" | "stale";
  /** Nur für Admins: eigene Stufe und die gerade angesehene (null = eigene) */
  realTier?: Tier;
  viewTier?: Tier | null;
  /** Zugang des Servers, sofern /api/me ihn meldet (invite = geschlossene Testphase) */
  access?: "invite" | "open";
  /** Absenderadresse der Anmeldemails (aus MAIL_FROM), sofern der Server sie nennt */
  sender?: string;
  /** Wege der Anmeldeseite: Link und Code per Mail (mail), E-Mail-Adresse und Code aus der Authenticator-App (totp) */
  login?: { mail: boolean; totp: boolean };
  /** Zählt Anmelden, Abmelden und Änderungen aus anderen Tabs: Listen laden dann neu */
  rev: number;
}

const ACCOUNT_REV = "ratsmonitor:account-rev:v1";

const guestLimits = (): TierLimits => ({ ...(PLAN_LIMITS.guest as TierLimits) });
const INITIAL: Me = {
  ready: false,
  accounts: true,
  tier: "guest",
  limits: guestLimits(),
  features: { ...PLAN_FEATURES.guest },
  user: null,
  tierUntil: null,
  tierSource: null,
  roles: [],
  adminHere: false,
  rev: 0,
};

let state: Me = INITIAL;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
function set(next: Partial<Me>) {
  state = { ...state, ...next };
  emit();
}
export const getMe = () => state;

/** Fehler einer Kontoroute mit Status und Antwort (z. B. {limit:'bookmarks'}, {duplicate:true}, {needConsent:true}) */
export class AccountApiError extends Error {
  constructor(message: string, readonly status: number, readonly data: Record<string, unknown>) {
    super(message);
  }
}

const TIERS: Tier[] = ["guest", "basic", "pro", "enterprise"];
const tierOf = (v: unknown): Tier => (TIERS.includes(v as Tier) ? (v as Tier) : "guest");
/** Grenzen aus der Antwort: null heißt unbegrenzt */
function limitsOf(tier: Tier, raw: unknown): TierLimits {
  const base = { ...(PLAN_LIMITS[tier] as TierLimits) };
  if (!raw || typeof raw !== "object") return base;
  const out = base as unknown as Record<string, number | boolean>;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!(k in out)) continue;
    if (v === null) out[k] = Number.POSITIVE_INFINITY;
    else if (typeof v === "number" || typeof v === "boolean") out[k] = v;
  }
  return base;
}

/** JSON-Abruf an eine Kontoroute. Nicht-GET immer als JSON (der Server verlangt es); 401 einer Kontoroute meldet ab. */
export async function api<T = Record<string, unknown>>(path: string, init: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  const method = init.method ?? "GET";
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      credentials: "same-origin",
      cache: "no-store",
      headers: method === "GET" ? undefined : { "Content-Type": "application/json" },
      body: method === "GET" ? undefined : JSON.stringify(init.body ?? {}),
      signal: init.signal,
    });
  } catch (e) {
    if (init.signal?.aborted) throw e;
    throw new AccountApiError("Keine Verbindung zum Server. Bitte prüfen Sie die Internetverbindung.", 0, {});
  }
  const text = await response.text();
  let data: Record<string, unknown> = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    /* keine JSON-Antwort (Fehlerseite des Proxys) */
  }
  if (!response.ok) {
    if (response.status === 401 && (path.startsWith("/api/me") || path === "/api/auth/refresh")) loggedOutHere();
    const own = typeof data.error === "string" ? data.error : "";
    throw new AccountApiError(own || (response.status === 429 ? "Zu viele Anfragen. Bitte einen Moment warten." : response.status >= 500 ? "Der Server ist gerade nicht erreichbar. Bitte gleich erneut versuchen." : "Das hat nicht geklappt."), response.status, data);
  }
  return data as T;
}

/** Stempel für die anderen Tabs: dort laden Konto und Listen neu */
export function touchAccount() {
  try {
    localStorage.setItem(ACCOUNT_REV, String(Date.now()));
  } catch {
    /* ohne Speicher kein Abgleich zwischen Tabs */
  }
}

let loading: Promise<void> | null = null;
let renewed = false;
/** GET /api/me (mit ETag) und den Stand übernehmen; ein laufender Abruf wird geteilt */
function loadMe(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  loading ??= (async () => {
    try {
      const r = await fetch("/api/me", { credentials: "same-origin", cache: "no-cache" });
      const text = await r.text();
      let d: Record<string, unknown> = {};
      try {
        d = text ? JSON.parse(text) : {};
      } catch {
        /* keine JSON-Antwort */
      }
      /* Ohne Kontendatei: {accounts:false} (oder 503 „nicht eingerichtet“); dann bleibt alles wie für Gäste */
      if (d.accounts === false || (r.status === 503 && typeof d.error === "string" && /nicht (vollständig )?eingerichtet/.test(d.error))) {
        set({ ...INITIAL, ready: true, accounts: false, rev: state.rev });
        return;
      }
      if (!r.ok) {
        /* Vorübergehender Fehler: bisherigen Stand behalten, beim ersten Mal als Gast weiter */
        if (!state.ready) set({ ready: true });
        return;
      }
      const tier = tierOf(d.tier);
      const u = d.user as Me["user"] | undefined;
      const before = state.user?.id ?? null;
      const access = d.access === "invite" || d.access === "open" ? d.access : undefined;
      const sender = typeof d.sender === "string" && d.sender.includes("@") ? d.sender : undefined;
      const way = d.login as { mail?: unknown; totp?: unknown } | undefined;
      const login = way && typeof way === "object" ? { mail: way.mail !== false, totp: way.totp === true } : undefined;
      set({
        ready: true,
        accounts: true,
        tier,
        limits: limitsOf(tier, d.limits),
        features: { ...PLAN_FEATURES[tier], ...((d.features as Me["features"]) ?? {}) },
        user: u && typeof u.id === "string" ? { id: u.id, email: String(u.email ?? ""), name: typeof u.name === "string" ? u.name : null } : null,
        tierUntil: typeof d.tierUntil === "string" ? d.tierUntil : null,
        tierSource: (d.tierSource as Me["tierSource"]) ?? null,
        roles: Array.isArray(d.roles) ? (d.roles as string[]) : [],
        adminHere: d.adminHere === true,
        admin: d.admin === "ok" || d.admin === "totp" || d.admin === "setup" || d.admin === "stale" ? d.admin : undefined,
        realTier: d.realTier ? tierOf(d.realTier) : undefined,
        viewTier: d.viewTier ? tierOf(d.viewTier) : null,
        access,
        sender,
        login,
        rev: (u?.id ?? null) !== before ? state.rev + 1 : state.rev,
      });
      if (d.renewAfter === true && !renewed) {
        renewed = true;
        api("/api/auth/refresh", { method: "POST" }).catch(() => {});
      }
    } catch {
      if (!state.ready) set({ ready: true });
    } finally {
      loading = null;
    }
  })();
  return loading;
}

/** Eine Kontoroute meldet 401: sofort abgemeldet anzeigen (der nächste Abruf von /api/me bestätigt es) */
function loggedOutHere() {
  if (!state.user) return;
  set({ ...INITIAL, ready: true, accounts: state.accounts, access: state.access, login: state.login, rev: state.rev + 1 });
}

/** Nach Anmelden oder einer Kontoänderung: neu laden, Listen auffrischen, andere Tabs benachrichtigen */
export async function accountChanged() {
  const before = state.rev;
  await loadMe();
  /* Neues Konto zählt loadMe schon hoch; sonst (gleiches Konto, geänderte Daten) hier */
  if (state.rev === before) set({ rev: state.rev + 1 });
  touchAccount();
}

/** Abmelden: Sitzung beenden, Suchverlauf und Kontodaten im Speicher leeren, andere Tabs benachrichtigen */
export async function logout() {
  try {
    await api("/api/auth/logout", { method: "POST" });
  } catch {
    /* auch ohne Antwort hier abmelden */
  }
  clearRecent();
  set({ ...INITIAL, ready: true, accounts: state.accounts, access: state.access, login: state.login, rev: state.rev + 1 });
  touchAccount();
  void loadMe();
}

/** Nur Admins: Seite mit den Rechten einer Stufe ansehen (null = eigene Stufe); gilt für diese Sitzung, auch serverseitig */
export async function setViewTier(tier: Tier | null) {
  await api("/api/me/view-tier", { method: "POST", body: { tier } });
  await accountChanged();
}

/** Nur Entwicklung: Testkonto der Stufe anmelden (POST /api/dev/login), Gast = abmelden */
export async function devLogin(tier: Tier) {
  if (tier === "guest") return logout();
  try {
    await api("/api/dev/login", { method: "POST", body: { email: `${tier}@plenara.test` } });
    /* Falls das Testkonto noch ohne Stufe angelegt wurde (Dev-Einrichtung fehlte): Stufe für diese Sitzung setzen */
    await api("/api/dev/tier", { method: "PATCH", body: { tier } }).catch(() => {});
  } catch {
    /* Dev-Route fehlt (Produktion) */
  }
  await accountChanged();
}

let started = false;
let lastLoad = 0;
function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  lastLoad = Date.now();
  void loadMe();
  /* Anderer Tab hat an- oder abgemeldet oder etwas geändert: Konto und Listen neu laden */
  onOtherTab([ACCOUNT_REV], () => {
    void loadMe().then(() => set({ rev: state.rev + 1 }));
  });
  /* Zurück im Tab: Stand prüfen (mit ETag, höchstens alle 15 s) */
  const again = () => {
    if (document.visibilityState !== "visible" || Date.now() - lastLoad < 15000) return;
    lastLoad = Date.now();
    void loadMe();
  };
  document.addEventListener("visibilitychange", again);
  window.addEventListener("focus", again);
}

function subscribe(l: () => void) {
  start();
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
/** Kontostand in einer Komponente; auf dem Server und beim Hydrieren der Anfangsstand (nicht bereit, Gast) */
export function useMe(): Me {
  return useSyncExternalStore(subscribe, getMe, () => INITIAL);
}
/** Für Module außerhalb von React (gespeicherte Artikel): auf Änderungen hören */
export function onMe(l: () => void): () => void {
  return subscribe(l);
}

/** „Testzugang Pro bis 31.01.27“: Datum der Stufe (zweistelliges Jahr) */
export const shortDate = (iso: string | null | undefined) => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" });
};
