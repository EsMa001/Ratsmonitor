/** Gemeinsame Texte und Aufräumen für das, was die App im Browser speichert */
export const NO_STORAGE = "Der Browser erlaubt derzeit keine dauerhafte Speicherung.";

/** Inhalte der Nutzerin bzw. des Nutzers: Profil, Verlauf, Kalender, Wochenbericht, Test-Postfach.
 *  Gespeicherte Suchen und Artikel räumen ihre eigenen Module auf (clearSaved, clearSavedArticles), damit die Anzeige mitzieht.
 *  Anmeldung, Tarif und Darstellung (hell/dunkel, Listenansicht) bleiben. */
const CONTENT_KEYS = ["ratsmonitor:profile:v1", "ratsmonitor:recent:v1", "rm-calendar:v1", "ratsmonitor:weekly:v1", "ratsmonitor:weekly-day:v1"];

export function clearStoredContent() {
  for (const k of CONTENT_KEYS) {
    try {
      localStorage.removeItem(k);
    } catch {
      /* ohne Speicher gibt es nichts zu löschen */
    }
  }
}
