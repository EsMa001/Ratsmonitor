# Videos der Seite `/videos`

Videos für Plenara (Webinar, Vorstellung, Funktionen). Diese Anleitung beschreibt, **was im Repository liegt, wie Videos aus Szenen entstehen und wie man sie baut.** Die 14 älteren Videos (Handy und Web) und ihre Werkzeuge stehen unverändert unter `legacy/` (Beschreibung: `legacy/README.md`).

**Inhalt der Videos:** Aussagen und Vorteile kommen aus der zentralen Liste `docs/produkt/vorteile.json` (nach Relevanz sortiert, Rang 1 = wichtigster; Lesefassung `docs/produkt/VORTEILE.md`, Abfrage `node tools/vorteile.mjs 10`). Neue Kapitel, Einblendungen und Einleitungen richten sich danach; im Text als `{{v.3|text}}` einsetzbar. Nur belegbare Aussagen, `pruefen: true` vorher bestätigen.

## Aufbau: Szenen, Kapitel, Videos

| Ebene | Was | Wo |
|---|---|---|
| **Szene** | kleine Aufnahme der App (5 bis 20 s), ohne Text und Ton, mit Parametern (Thema, Ort), Start- und Endzustand und Beschreibung | `szenen/<id>/szene.mjs` |
| **Kapitel** | Sätze (`kurz.txt`, `lang.txt`) und Kapitelkarte (`kapitel.json`: Titel, Icon, Stichpunkte, Szenen) | `kapitel/<id>/` |
| **Video** | Liste von Kapiteln mit Parametern und Format | `videos/<name>.json` |

Der Vertrag für Szenen steht in `SZENEN.md`. `katalog.md` ist eine automatisch erzeugte Übersicht aller Szenen, Kapitel und Videos (`node tools/katalog.mjs`). Fakten für die Texte (echte Zahlen aus der App) stehen in `facts.json` (`node tools/facts.mjs`).

**In Git:** Szenen, Kapitel, Videolisten, Fakten, Werkzeuge, fertige Videos in `public/videos/`. **Nicht in Git:** Clips (`out-clips/`), Ton-Zwischenspeicher, Zwischenstände. Sie liegen im Arbeitsordner (siehe „Einrichten“) und entstehen beim Bauen neu.

## Ein Video bauen

```bash
R=/pfad/zum/Ratsmonitor
bash $R/docs/videos/tools/setup.sh                 # einmalig: Arbeitsordner, Playwright, Piper, Stimme
cd ~/code/video-tools                              # alle weiteren Befehle hier; die App läuft auf $BASE (Standard http://localhost:5173)
node $R/docs/videos/tools/facts.mjs                # echte Zahlen holen
node $R/docs/videos/tools/build-video.mjs <video>  # z. B. probe; Ergebnis: out-web/<video>/<ausgabe>.mp4/.vtt/.jpg
```

Optionen: `--refresh` nimmt alle Clips neu auf, `--only 2,3` baut nur diese Kapitel. Ablauf: Texte und Fakten, Kapitelkarten, Ton (Zwischenspeicher, nur geänderte Sätze werden neu gesprochen), Clips (nur wenn für Szene, Parameter und Format keiner da ist oder er veraltet ist), Zusammenbau je Satz, Gesamtvideo. Ein Satz bekommt die Zeit bis zum nächsten Satz; ist sie länger als die Schritte, bleibt das letzte Bild stehen, ist sie kürzer, läuft der Clip bis auf das Doppelte schneller.

Die Kapitelkarte steht doppelt so lange wie der erste Satz (erst still zum Lesen, dann spricht der Satz darüber). Der Ton hat keine Pausen nach Kommata (0,8 s nach Sätzen).

Weitere Werkzeuge (alle in `tools/`): `rec-clip.mjs <szene> [--format 16x9|1x1|9x16] [--p thema=…]` nimmt einen Clip auf, `status.mjs` zeigt fehlende und veraltete Clips, `compose.py`, `assemble.py`, `cards.mjs`, `speak.py` sind die Bausteine von `build-video.mjs`. Veraltet heißt: seit dem Commit der Aufnahme hat sich `components/ratsmonitor` oder `app` geändert.

## Neue Szene, neues Kapitel, neues Video

1. Szene: `szenen/<id>/szene.mjs` nach `SZENEN.md` anlegen; Clip testen mit `node tools/rec-clip.mjs <id>` (schlägt ein Schritt fehl, endet der Befehl mit Fehlercode).
2. Kapitel: `kapitel/<id>/kapitel.json` und `lang.txt` (`@szene.schritt Satz`, Platzhalter `{{fakt|format}}`, `{{p.thema|text}}`). Jedes Video beginnt mit dem Kapitel `einleitung`.
3. Video: `videos/<name>.json`, dann `build-video.mjs`. Danach `node tools/katalog.mjs`, die Dateien in `public/videos/` und der Eintrag in `components/ratsmonitor/info/VideosPage.tsx`.

## Die Stimme

- **Verwendet:** Piper, Modell **`de_DE-thorsten-high`** (Sprecher „Thorsten“, männlich, Hochdeutsch, hohe Qualität, rund 114 MB). Läuft komplett lokal, kein Konto, kein Schlüssel.
- **Quelle:** <https://huggingface.co/rhasspy/piper-voices> im Pfad `de/de_DE/thorsten/high/` (zwei Dateien: `de_DE-thorsten-high.onnx` und `de_DE-thorsten-high.onnx.json`).
- **Lizenz:** Nach meinem Kenntnisstand ist die Thorsten-Stimme gemeinfrei (CC0), die genaue Lizenz steht auf der Modellseite. **Vor einer Veröffentlichung dort bestätigen.**
- **Warum diese Stimme:** Verglichen wurden macOS-Stimmen (Anna, Flo, Sandy, Shelley), Microsoft-Stimmen über `edge-tts` (Katja, Amala, Seraphina, Conrad, Killian, Florian) und die weiblichen Piper-Stimmen (`kerstin`, `ramona`, `eva_k`, alle nur niedrige Qualität). Thorsten high hat am besten gefallen. Weibliche Piper-Stimmen gibt es nur in niedriger Qualität.
- **Aussprache von „Plenara“:** Die Betonung soll auf dem ersten „a“ liegen. Dafür wird im Ton die Schreibweise **„Plenarra“** gesprochen. In den Texten steht „Plenarra“, die Untertitel ersetzen es wieder durch „Plenara“.
- **Pausen:** 0,8 s nach jedem Satz, 0,1 s nach einem Komma. `speak.py` spricht jeden Satzteil einzeln und fügt die Stille ein. Pausen mitten im Satz gibt es nicht.
- **Schreibweise:** Abkürzungen mit Bindestrichen („C-S-V“, „P-D-F“), damit sie als Buchstaben gelesen werden.


## Einrichten (einmalig)

Alles liegt in einem Arbeitsordner außerhalb des Repositorys, Standard `~/code/video-tools` (oder Umgebungsvariable `VIDEO_TOOLS`).

```bash
mkdir -p ~/code/video-tools && cd ~/code/video-tools
npm init -y
npm install playwright ffmpeg-static
npx playwright install chromium
python3 -m venv venv
./venv/bin/pip install piper-tts
mkdir -p voices out
B=https://huggingface.co/rhasspy/piper-voices/resolve/main/de/de_DE/thorsten/high
curl -L -o voices/de_DE-thorsten-high.onnx      $B/de_DE-thorsten-high.onnx
curl -L -o voices/de_DE-thorsten-high.onnx.json $B/de_DE-thorsten-high.onnx.json
```

Benötigt: Node 20 oder neuer, Python 3, und den laufenden Dev-Server der App auf `http://localhost:5173` (anderer Port: Umgebungsvariable `BASE`).


## Hinweise und Stolperstellen

- **Aufgenommen wird eine laufende App** mit echten Daten. Die Treffer (z. B. Zahlen und Einträge) hängen vom Datenstand ab und sehen bei einer neuen Aufnahme anders aus.
- **Tarif und Testmodus:** Die Aufnahme setzt im Browser Marke „Plenara“ und Tarif „Enterprise“. Der Testmodus wird nicht abgemeldet, daher zeigt das Konto-Menü „Konto, Test-Postfach, Abmelden“.
- **Seitenwechsel:** Aus der Trefferliste in einen Artikel zu klicken stürzt im Dev-Server ab. Deshalb öffnet `openFirstArticle` den Artikel direkt per Adresse. Zurück-Navigation verliert die Suche.
- **Zwei-Finger-Zoom** (`pinch`) wirkt nur auf der Karte mit Treffern, auf der leeren Startkarte zoomt er die ganze Seite.
- **Karte neu laden** setzt die Suche zurück und wird deshalb nicht angetippt.
- **Handy-Besonderheiten:** Kein Export der Trefferliste (nur im Artikel), kein Zoomen mit Tasten, Menü über das Symbol links oben.
- **Ändert sich ein Satz,** muss Ton und Aufnahme dieses Videos neu erzeugt werden, weil die Schritte an den Satzzeiten hängen.


## Einbindung auf der Seite

- Vor dem Klick lädt nur das Vorschaubild (`preload` erst nach dem Klick), danach das Video.
- Handy (unter 768 px): kleine Vorschau neben dem Text, das Video klappt beim Antippen in der Karte auf. Vollbild über das Symbol im Player.
- Untertitel sind aus und im Player zuschaltbar (CC).
- Am Ende eines Videos wird das nächste vorgeschlagen.
- Ein Klick neben das Video schließt es wieder (zurück zur Vorschau), ebenso das Öffnen eines anderen Videos. Es ist immer nur ein Video geöffnet.
- Reihenfolge auf der Seite: zuerst die Vorstellungsvideos, dann die Videos zu Funktionen (Reihenfolge der Liste `GROUPS` in `VideosPage.tsx`).
- Das Verhalten im Vollbild bestimmt der Browser: Auf dem iPhone öffnet Safari seinen eigenen Player und hält das Bild innerhalb des sicheren Bereichs, daher können schmale schwarze Ränder bleiben.


## Größe

Die Videos in `public/videos/` sind zusammen rund 42 MB. Jede neu erzeugte Fassung bleibt in der Git-Historie. Wenn das zu viel wird, können die Dateien später in einen Speicher außerhalb von Git (z. B. Cloudflare R2) umziehen, dann ändert sich nur die Adresse der Dateien in `VideosPage.tsx`.
