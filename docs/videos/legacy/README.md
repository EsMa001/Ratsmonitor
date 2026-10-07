# Alte Videos (Stand vor der Umstellung auf Szenen, Kapitel und Videos)

Die 14 Videos auf der Seite (12 Funktionen, 2 Vorstellungen, Handy und Web) und das erste Webinar sind mit den Werkzeugen in `tools/` und den Texten in `texts/` dieses Ordners entstanden. Die Beschreibung stammt aus der früheren Haupt-README. Pfade `tools/…` und `texts/…` meinen hier `legacy/tools/…` und `legacy/texts/…`; die Werkzeuge `speak.py`, `build.py` usw. liegen teils im Ordner `docs/videos/tools/` (neu) bzw. `legacy/tools/` (alt). Für neue Videos gilt die Haupt-README.

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

## Webinar (ein Video, ca. 9 Minuten)

Datei auf der Seite: `public/videos/plenara-webinar.{mp4,jpg,vtt}` (Bereich „Webinar“, ganz oben). Skript: `texts/webinar/webinar.txt` (16 Kapitel, je Kapitel eine Zeile `[KAPITELSEITE | Icon | Titel | Stichpunkte]`). Kapitel 4 bis 7 sind die fertigen Funktionsvideos (`[VORHANDENES VIDEO | NN | name]`), alle anderen werden neu vertont und aufgenommen. Die Zahlen im Skript stammen aus dem Datenbestand vom 07.10.2026, vor einer neuen Aufnahme neu abfragen. Im Webinar gibt es **keine Kommapausen** (`speak.py ... 0.8 0`).

Werkzeuge in `tools/webinar/` (alle im Arbeitsordner `~/code/video-tools` starten, `R` = Repository):

```bash
S=$R/docs/videos
node $S/tools/webinar/prep.mjs $S/texts/webinar/webinar.txt out-web/w1      # Kapiteltexte und chapters.json
node $S/tools/webinar/cards.mjs out-web/w1                                  # Kapitelseiten (PNG, Farbverlauf, Icons der Website)
mkdir -p out-web/w1/c01 && python3 $S/tools/speak.py out-web/w1/c01.txt out-web/w1/c01/audio.wav 0.8 0   # je Kapitel
bash $S/tools/webinar/rec-all.sh w1 webinar/scenes-teil1.mjs c01 c02 ...    # aufnehmen + bauen (Szenen: tools/webinar/scenes-teil1.mjs)
# vorhandene Videos: public/videos/<name>.mp4 nach out-web/w1/cNN/cNN.mp4 und out-web/<alteNr>/audio.json nach out-web/w1/cNN/audio.json kopieren
python3 $S/tools/webinar/assemble.py w1 plenara-webinar                      # Kapitelseiten + Kapitel zu einem Video, mit Untertiteln
```

Die Kapitelseite steht doppelt so lange wie der erste Satz des Kapitels: erst still (Lesezeit), dann spricht der Satz darüber. Analysen (Graph, Vergleich, Gremiennetz) werden vor der Aufnahme einmal berechnet, damit die Antwort aus dem Browser-Cache sofort erscheint.

