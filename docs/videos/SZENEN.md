# Szenen-Vertrag

Eine **Szene** ist eine kleine, wiederverwendbare Aufnahme der App (5 bis 20 Sekunden) ohne Text und Ton. Ein **Kapitel** (`kapitel/<id>/`) gibt Szenen Sätze und eine Kapitelkarte. Ein **Video** (`videos/<name>.json`) ist eine Liste von Kapiteln. Rolle- und Branchenvideos sind später nur neue Listen mit anderen Parametern und Sätzen.

## `szenen/<id>/szene.mjs`

```js
export default {
  meta: { bereich: "suche", dauer: "8-12 s", zeigt: "Thema tippen, Karte, erste Treffer", tags: ["anleitung", "werbung", "webinar", "wow"] },
  parameter: { thema: "Wärmeplanung" },        // Vorgabewerte; das Kapitel kann sie überschreiben (nur diese Namen)
  start: "Startseite",                          // Zustand, in dem die Szene beginnt (Beschreibung)
  ende: "Suchergebnis, Liste sichtbar",         // Zustand am Ende
  setup: async (H, p) => { /* stellt den Startzustand selbst her */ },
  beats: (p) => [ ["eingabe", async (H, p) => { /* Handlung */ }, 2 /* Haltezeit in s */], ... ],
};
```

Regeln:
1. **Eigenständig:** `setup` stellt die Voraussetzung selbst her (Suche, offener Artikel). Die Szene läuft in jeder Reihenfolge.
2. **Mit Parametern:** Thema, Ort, Zeitraum kommen aus `p`, nie fest im Code. Ein Parameter, den eine Szene nicht deklariert, wird ihr nicht übergeben.
3. **Ohne Worte:** Keine Texte im Bild außer denen der App. Sätze stehen im Kapitel.
4. **Start und Ende beschreiben:** damit Szenen sinnvoll aufeinander folgen. Passt das Ende nicht zum Start der nächsten Szene, setzt der Zusammenbau einen Schnitt.
5. **Format ist Parameter:** `--format 16x9 | 1x1 | 9x16`, nicht Teil der Szene (Fenstergröße, Responsive-Layout der App).
6. **Robust gegen Daten:** Inhalte werden dynamisch gesucht (z. B. erster Eintrag mit Zeitstrahl), keine festen Treffer.
7. **Beschrieben:** `meta` füllt den Katalog (`node tools/katalog.mjs` schreibt `katalog.md`). Tags: `anleitung`, `werbung`, `webinar`, `wow` (starkes Bild für den Einstieg).
8. **Fehler fallen auf:** Schlägt ein Schritt fehl, endet die Aufnahme mit „ACHTUNG“ und Fehlercode, der Clip ist nicht zu verwenden.

Clips liegen in `out-clips/<schlüssel>/` (nicht in Git). Schlüssel = `szene[@format][@parameter-wert]`; dasselbe Thema oder Format wird nur einmal aufgenommen. `node tools/status.mjs` zeigt fehlende und veraltete Clips.

## `kapitel/<id>/`

- `kapitel.json`: `{ titel, icon, stichpunkte, szenen: [ids] }` (Kapitelkarte wird beim Bauen erzeugt, nie als Bild gespeichert).
- `kurz.txt`, `lang.txt`: ein Satz pro Zeile, `@szene.schritt Satz`. Folgen mehrere Sätze mit demselben Schritt, läuft er einmal über alle. Platzhalter: `{{fakt|format}}` (Fakten, `tools/fmt.mjs`) und `{{p.thema|text}}` (Parameter des Kapitels). Jedes Video beginnt mit dem Kapitel `einleitung`. Aussagen und Vorteile in den Sätzen und Einblendungen stammen aus `docs/produkt/vorteile.json` (Rang 1 = wichtigster), einsetzbar als `{{v.<rang>|text}}`.

## `videos/<name>.json`

```json
{ "ausgabe": "dateiname", "kapitel": [ { "kapitel": "suchen", "text": "lang", "parameter": { "thema": "Wärmeplanung" }, "format": "16x9" } ] }
```
Bauen: `node tools/build-video.mjs <name>` (im Arbeitsordner `~/code/video-tools`).
