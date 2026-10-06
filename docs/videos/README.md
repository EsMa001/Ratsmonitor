# Videos der Seite `/videos`

Videos zu Funktionen (12) und Vorstellungsvideos (2) für Plenara. Diese Anleitung beschreibt, **was im Repository liegt, woher Stimme und Bilder kommen und wie man ein Video neu erzeugt.**

Stand: Alle 14 Videos gibt es als **Handy-Fassung** (Hochformat). Von den **Web-Fassungen** (Querformat 1280×720) ist bisher nur Video 1 neu aufgenommen (mit dem neuen Text, `texts/web/01.txt`). Für die übrigen sind die Web-Texte und die Szenen (`tools/scenes-web.mjs`) angelegt, aber noch nicht aufgenommen. Auf der Seite zeigen Handys die Handy-Fassung, am Computer steht bei den übrigen „Video folgt“.

## Was wo liegt

| Pfad | Inhalt |
|---|---|
| `public/videos/` | Fertige Dateien, die die Seite ausliefert (siehe Benennung unten) |
| `docs/videos/texts/mobil/` und `texts/web/` | Sprechtexte, ein Satz pro Zeile, **getrennt für Handy und Web**. Sie dürfen auseinanderlaufen, sind aber im Moment bis auf 01 und 08 gleich. `web/02.txt` (ohne Umkreis) und `web/12.txt` (Menüpunkt in der Kopfzeile) unterscheiden sich außerdem |
| `docs/videos/tools/` | Skripte: Sprache erzeugen, Bildschirm aufnehmen, Video zusammensetzen |
| `docs/videos/tools/alt-web/` | Skripte der alten Web-Fassung von Video 1 (nur zur Nachvollziehbarkeit) |
| `components/ratsmonitor/info/VideosPage.tsx` | Die Seite selbst; hier stehen Titel, Beschreibung und die Dateinamen |

**Nicht im Repository** (zu groß, aus dem Netz ladbar): Sprachmodelle, Python-Umgebung, `node_modules`, Zwischenstände (Einzelbilder, Ton). Sie liegen in einem Arbeitsordner, siehe „Einrichten“.

## Benennung der Dateien in `public/videos/`

Pro Video drei Dateien mit gleichem Namen:

| Datei | Was es ist | Woher |
|---|---|---|
| `<name>.mp4` | Das Video mit Ton, 780×1688 (Handy) bzw. 1280×720 (Web), H.264, `faststart` | `tools/build.py` |
| `<name>.jpg` | **Vorschaubild**, vor dem Klick zu sehen | Ein Standbild aus dem fertigen Video, Sekunde steht im Aufruf von `build.py` |
| `<name>.vtt` | **Untertitel** (Deutsch, nur im Player zuschaltbar) | Aus den Sätzen und ihren Zeiten, `tools/build.py` |

Das Endstück `-mobil` kennzeichnet die Handy-Fassung. Die Vorschaubilder sind also keine eigenen Bilder, sondern Ausschnitte aus der Aufnahme der App.

| Nr. | Titel | Dateiname (Handy) | Text | Länge |
|---|---|---|---|---|
| 1 | Erste Suche und Karte | `erste-suche-mobil` (Web: `erste-suche`) | `mobil/01.txt` / `web/01.txt` | 47 s |
| 2 | Filter und Zeitraum | `filter-zeitraum-mobil` | `mobil/02.txt` | 33 s |
| 3 | Alarme einrichten | `alarme-einrichten-mobil` | `mobil/03.txt` | 32 s |
| 4 | Exakter Begriff und mehrere Wörter | `exakter-begriff-mobil` | `mobil/04.txt` | 34 s |
| 5 | Die Karte im Detail | `karte-im-detail-mobil` | `mobil/05.txt` | 37 s |
| 6 | Trefferliste und Sortierung | `trefferliste-sortierung-mobil` | `mobil/06.txt` | 34 s |
| 7 | Artikel speichern und teilen | `artikel-speichern-teilen-mobil` | `mobil/07.txt` | 33 s |
| 8 | Export als PDF, Excel und CSV | `export-mobil` | `mobil/08.txt` (Web: `web/08.txt`) | 33 s |
| 9 | Kalender und Sitzungen | `kalender-sitzungen-mobil` | `mobil/09.txt` | 29 s |
| 10 | Postfach und Wochenbericht | `postfach-wochenbericht-mobil` | `mobil/10.txt` | 34 s |
| 11 | Konto und Profil | `konto-profil-mobil` | `mobil/11.txt` | 36 s |
| 12 | Datenabdeckung prüfen | `datenabdeckung-mobil` | `mobil/12.txt` | 32 s |
| 13 | Politik vor Ort im Blick (Vorstellung) | `politik-vor-ort-mobil` | `mobil/13.txt` | 40 s |
| 14 | Für Unternehmen und Verbände (Vorstellung) | `unternehmen-verbaende-mobil` | `mobil/14.txt` | 48 s |

Handy und Web haben getrennte Textordner. Die Web-Texte 02 bis 07 und 09 bis 14 sind im Moment Kopien der Handy-Texte, Aufnahmen gibt es nur für das Handy. Unterschied bei 08: Auf dem Handy gibt es keinen Export der Trefferliste (nur den Export im Artikel), im Web kommen beide Exporte vor. Alle Texte sagen „klicken“.

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

## Ein Web-Video erzeugen

Wie beim Handy-Video, nur mit `texts/web/NN.txt`, `rec-web.mjs` (Querformat 1280×720, Maus) und `scenes-web.mjs`; Ordner `out-web/NN` statt `out/NN`:

```bash
mkdir -p out-web/NN
python3 $R/docs/videos/tools/speak.py $R/docs/videos/texts/web/NN.txt out-web/NN/audio.wav 0.8 0.1
node $R/docs/videos/tools/rec-web.mjs NN
python3 $R/docs/videos/tools/build.py NN 14 <name> web      # <name> ohne -mobil, z. B. erste-suche
cp out-web/NN/<name>.{mp4,jpg,vtt} $R/public/videos/
```

In `VideosPage.tsx` beim Eintrag `file: "<name>"` setzen.

## Ein Handy-Video erzeugen

Alle Befehle im Arbeitsordner `~/code/video-tools` ausführen, `NN` ist die Nummer (`01` … `14`), `R` das Repository.

```bash
R=/pfad/zum/Ratsmonitor
mkdir -p out/NN

# 1. Ton und Satzzeiten: out/NN/audio.wav und audio.json
python3 $R/docs/videos/tools/speak.py $R/docs/videos/texts/mobil/NN.txt out/NN/audio.wav 0.8 0.1

# 2. Bildschirm im Handy-Format aufnehmen (Schritte stehen in scenes-mobil.mjs)
node $R/docs/videos/tools/rec-mobil.mjs NN

# 3. Zusammensetzen; die Zahl ist die Sekunde für das Vorschaubild, am Ende der Dateiname
python3 $R/docs/videos/tools/build.py NN 14 filter-zeitraum-mobil

# 4. In die Seite legen
cp out/NN/filter-zeitraum-mobil.{mp4,jpg,vtt} $R/public/videos/
```

Danach in `components/ratsmonitor/info/VideosPage.tsx` beim Eintrag `mobile: "<name>-mobil"` setzen (für das Web-Video `file: "<name>"`) und `node scripts/frontend-index.mjs` ausführen.

Wie es zusammenhängt:

- **`speak.py`** teilt den Text in Sätze und Satzteile, ruft Piper auf und schreibt zu jedem Satz Start und Ende in `audio.json`.
- **`rec-mobil.mjs`** öffnet die App in Chromium als Handy (390×844, doppelte Auflösung, Berührung), führt zu jedem Satz die Schritte aus `scenes-mobil.mjs` aus und speichert dabei etwa 20 Bilder pro Sekunde als JPG. Ein Fingerpunkt zeigt die Berührungen. Vor der Aufnahme läuft `setup` (Startzustand, z. B. eine fertige Suche).
- **`build.py`** setzt die Bilder mit dem Ton (0,5 s Vorlauf, 1 s Nachlauf) zu einem Video zusammen, erzeugt das Vorschaubild und die Untertitel.
- **`scenes-mobil.mjs`** ist die Regie: Pro Video eine Liste `[Satznummer ab 0, Verzögerung in s, Name, Funktion]`.

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

Die Videos in `public/videos/` sind zusammen rund 26 MB. Jede neu erzeugte Fassung bleibt in der Git-Historie. Wenn das zu viel wird, können die Dateien später in einen Speicher außerhalb von Git (z. B. Cloudflare R2) umziehen, dann ändert sich nur die Adresse der Dateien in `VideosPage.tsx`.
