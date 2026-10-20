// Antworten der Datenrouten (Suche, plenara.X): eine Fehlerantwort und eine Angabe für den Zwischenspeicher statt je einer Kopie.

/** Fünf Minuten im Browser, danach bis zu zehn Minuten der alte Stand, während der neue geladen wird. gated() macht daraus
 *  „private“ mit Vary: Cookie, weil die Antwort an der Stufe hängt (server/services/session.ts). */
export const X_CACHE='public, max-age=300, stale-while-revalidate=600';

/**
 * Fehler einer Datenroute: ein Fehler der Klasse known (AnalyticsError, SearchError: mit status) mit seiner Meldung,
 * alles andere als 503 ohne Ursache; nie zwischengespeichert.
 * @param {unknown} error
 * @param {new (...args: any[]) => Error & {status:number}} known
 */
export function dataFailure(error,known){
 const ok=error instanceof known;
 return Response.json({error:ok?error.message:'Der Datenbestand ist gerade nicht erreichbar. Bitte erneut versuchen.'},{status:ok?error.status:503,headers:{'Cache-Control':'no-store'}});
}
