// Fehler aus dem Browser (app/api/client-error/route.ts): eine Zeile im Server-Log, ohne Datenbank und ohne IP-Adresse.
// Angenommen wird nur Text bis MAX_BYTES von derselben Herkunft; höchstens PER_MINUTE Meldungen je Prozess und Minute.

export const MAX_BYTES = 4096;
export const PER_MINUTE = 60;

const cut = (value, n) => (typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, n) : '');

/** Meldung säubern: nur bekannte Felder, gekürzt; Seite ohne Suchparameter und Anker (die können Suchbegriffe enthalten) */
export function cleanReport(raw) {
 if (!raw || typeof raw !== 'object') return null;
 const message = cut(raw.message, 300);
 if (!message) return null;
 let page = '';
 try { page = new URL(cut(raw.page, 500), 'http://x').pathname.slice(0, 200); } catch { page = ''; }
 return {
  kind: ['error', 'rejection', 'render'].includes(raw.kind) ? raw.kind : 'error',
  message,
  stack: cut(raw.stack, 1500),
  page,
  browser: cut(raw.browser, 160),
 };
}

/** Mengenbegrenzung je Prozess: true, solange in dieser Minute noch Platz ist */
export function makeLimiter(perMinute = PER_MINUTE, now = () => Date.now()) {
 let minute = -1, count = 0;
 return () => {
  const m = Math.floor(now() / 60000);
  if (m !== minute) { minute = m; count = 0; }
  count++;
  return count <= perMinute;
 };
}

/** Gleiche Herkunft: Origin muss zur Adresse der Anfrage passen, keine fremde Seite */
export function sameOrigin(request) {
 const origin = request.headers.get('origin');
 return !!origin && origin === new URL(request.url).origin && request.headers.get('sec-fetch-site') !== 'cross-site';
}
