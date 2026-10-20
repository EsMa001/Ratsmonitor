/** Fehler im Browser an den eigenen Server melden (app/api/client-error/route.ts, landet im Server-Log). Nur im Produktionsbau,
 *  höchstens MAX je Seitenaufruf, jede Meldung einmal; Seite ohne Suchparameter (das kürzt auch der Server). */
const MAX = 5;
const sent = new Set<string>();

export function reportError(kind: "error" | "rejection" | "render", error: unknown) {
  if (process.env.NODE_ENV !== "production" || typeof window === "undefined" || sent.size >= MAX) return;
  const e = error instanceof Error ? error : new Error(typeof error === "string" ? error : "Unbekannter Fehler");
  const key = kind + ":" + e.message;
  if (sent.has(key)) return;
  sent.add(key);
  const body = JSON.stringify({ kind, message: e.message, stack: e.stack ?? "", page: location.pathname, browser: navigator.userAgent.slice(0, 160) });
  try {
    /* text/plain: sendBeacon darf ohne Vorabanfrage senden; der Server liest JSON aus dem Text */
    if (!navigator.sendBeacon?.("/api/client-error", new Blob([body], { type: "text/plain" })))
      void fetch("/api/client-error", { method: "POST", body, keepalive: true, headers: { "content-type": "text/plain" } }).catch(() => {});
  } catch { /* Melden darf selbst nie stören */ }
}

/** Einmal beim Start: unbehandelte Fehler und abgelehnte Promises melden */
let installed = false;
export function installErrorReporting() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener("error", (ev) => reportError("error", ev.error ?? ev.message));
  window.addEventListener("unhandledrejection", (ev) => reportError("rejection", ev.reason));
}
