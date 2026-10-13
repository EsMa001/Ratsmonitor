/** Abrufe mit verständlichen deutschen Fehlermeldungen. Ohne das stand bei einer HTML-Fehlerseite (502, Zeitüberschreitung)
 *  „Unexpected token '<' …“ in der Oberfläche. Der Fehlertext des Servers ({error:"…"}) hat Vorrang; sonst ein Text je Lage. */
export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

const byStatus = (status: number, fallback: string) =>
  status === 404 ? "Nicht gefunden." : status === 429 ? "Zu viele Anfragen. Bitte einen Moment warten und erneut versuchen." : status >= 500 ? "Der Server ist gerade nicht erreichbar. Bitte gleich erneut versuchen." : fallback;

/** Antwort als JSON; wirft ApiError mit deutschem Text. Ein Abbruch (AbortSignal) wird unverändert weitergegeben. */
export async function fetchJson<T>(url: string, init?: RequestInit, fallback = "Die Daten konnten nicht geladen werden."): Promise<T> {
  return readJson<T>(await fetchOrFail(url, init), fallback);
}

/** Antwort lesen wie fetchJson (für Abrufe, die erst den Status prüfen, z. B. Ströme) */
export async function readJson<T>(response: Response, fallback: string): Promise<T> {
  const text = await response.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    /* keine JSON-Antwort, z. B. eine Fehlerseite des Proxys */
  }
  const own = body && typeof body === "object" && typeof (body as { error?: unknown }).error === "string" ? (body as { error: string }).error : "";
  if (!response.ok) throw new ApiError(own || byStatus(response.status, fallback), response.status);
  if (body === null) throw new ApiError(fallback, response.status);
  return body as T;
}

/** fetch mit deutschem Text bei fehlender Verbindung; prüft response.ok nicht (für Ströme) */
export async function fetchOrFail(url: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (e) {
    if (init?.signal?.aborted || (e instanceof DOMException && e.name === "AbortError")) throw e;
    throw new ApiError("Keine Verbindung zum Server. Bitte prüfen Sie die Internetverbindung.", 0);
  }
}

/** Fehlertext für die Oberfläche: eigene Texte durchreichen, alles andere (Programmfehler) durch den Ersatztext ersetzen */
export const errorText = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);
