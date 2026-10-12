# Konzept: Admin-Seite „PDF-Ablage“

Stand 12.10.2026, umgesetzt am selben Tag (Reiter heißt jetzt „PDF-Import“; dazu die Reiter „Jobs & Zeitpläne“ und
„Speicher & Sicherungen“, siehe `docs/betrieb/node-server.md`). Grundlage: die heutige Seite (`components/admin-pdf.tsx`, `/admin?seite=pdf`), die Skripte unter
`scripts/pdf-store/` und die Fragen, die im Betrieb seit dem 11.10.2026 offen blieben.

## 1. Wozu die Seite da ist

Die Seite beantwortet vier Fragen, in dieser Reihenfolge:

1. **Läuft gerade etwas?** Welcher Lauf, welcher Schritt, wie weit, wann ist er fertig, kann ich ihn anhalten?
2. **Wie vollständig ist die Ablage?** Hauptdokumente und übrige PDFs: geladen, mit Text, fehlgeschlagen, offen; wie weit
   zurück; wie voll die 100 GB sind.
3. **Warum fehlt etwas?** Fehlergründe, Server, die nicht liefern, Scans ohne OCR.
4. **Was kann ich tun?** Lauf starten, Fehlgeschlagene erneut versuchen, übrige PDFs laden, anhalten, neu zählen.

Was heute fehlt (aus dem Betrieb):

- Man sieht nicht, ob und was gerade läuft (Schritt, Fortschritt, OCR-Lauf, Nachtkette). Das musste per `ssh` geklärt werden.
- Die Zahlen sind nur so neu wie der letzte Lauf. Während eines dreistündigen Laufs ändert sich nichts, auch nicht der
  Anteil „mit Text“, obwohl OCR läuft.
- Ein Lauf lässt sich nicht anhalten. Heute ging das nur per `systemctl stop` auf dem Server.
- Es gibt nur einen Auftrag zur Zeit. Ein zweiter Knopf ist gesperrt, bis der erste fertig ist.
- Auf `localhost` legt ein Knopf einen Auftrag an, den nie jemand ausführt. Die Seite sagt das nicht.
- Die Fehlerliste je Dokument und die ausgelassenen Server gibt es nur auf der Kommandozeile.
- Nachtkette, Läufe von Hand und ihre Ergebnisse stehen nur im Systemprotokoll des Servers.

## 2. Aufbau der Seite (von oben nach unten)

### A. Jetzt (Statuskasten, immer oben)

Eine Zeile je laufendem Vorgang, sonst „Nichts läuft. Nächste Nachtkette heute 05:30 Uhr.“

- **Auftrag oder Nachtkette:** Art (Lauf, Erneuter Versuch, Übrige PDFs, Nachtkette), gestartet um, Schritt
  (Laden, Textebene, OCR, Zusammenfassungen, Fakten, Wortliste, Stand), im Schritt Laden: Monat, geladen, Fehler,
  Rate je Sekunde, belegter Platz. Voraussichtliches Ende (Startzeit plus Zeitgrenze, nicht geschätzt).
- **OCR-Lauf von Hand:** Dateien fertig von gesamt, Seiten, Rate.
- **Knopf „Anhalten“** je Vorgang (siehe 3.3). Was schon geladen oder gelesen ist, bleibt; das steht neben dem Knopf.
- **Warteschlange:** angeforderte Aufträge in Reihenfolge, je Auftrag „Entfernen“.
- **Hinweis ohne Server-Dienst:** „Auf diesem Rechner führt niemand Aufträge aus“, Knöpfe gesperrt (siehe 3.4).
- Aktualisierung alle 30 Sekunden, solange etwas läuft oder wartet; sonst nur beim Öffnen.

### B. Hauptdokumente (Kennzahlen wie heute)

Verlinkt, Heruntergeladen, Mit Text, Fehlgeschlagen, Noch nicht versucht, Ältestes geladenes Dokument, Platz.
Ergänzt:

- **Bis wohin vollständig:** der älteste Monat, bis zu dem alle Hauptdokumente versucht sind (statt nur „ältestes
  geladenes Dokument“, das schon bei einer einzelnen alten Datei weit zurück zeigt).
- **Abdeckung je Monat:** gestapelte Balken je Sitzungsmonat (geladen als PDF, nur Text, fehlgeschlagen, offen),
  neueste links. Zeigt auf einen Blick, wie weit der Lauf zurück ist und wo Lücken sind. Klick auf einen Monat: Zahlen und
  die Server mit den meisten offenen Dokumenten in diesem Monat.

### C. Texte und Auswertung

Die Kette nach dem Laden, je Stufe ein Wert:

- **Textebene:** Dateien mit Text, Dateien ohne Textebene (Scans).
- **OCR:** wartende Dateien und Seiten (nur Hauptdokumente), gelesen im letzten Lauf, Rate je Stunde, bei dieser Rate
  ungefähr fertig in N Tagen (als Rechnung gekennzeichnet).
- **Zusammenfassungen:** Berichte mit Text im Hauptdokument, davon mit Regel-Zusammenfassung, ohne (Sitzungsunterlagen,
  zu kurz).
- **Fakten und Wortliste:** Stand und Zeitpunkt der letzten Berechnung (`facts-v13`, Wortliste aktuell ja/nein).

### D. Platz und Grenze

- Ein Balken über 100 GB: PDFs der Hauptdokumente, PDFs der übrigen PDFs, Texte, frei.
- **Tausch im letzten Lauf:** behalten, verdrängt, nicht besser, zu groß (nur Text), Seiten vor dem Löschen per OCR
  (aus `keeper.stats()`).
- **Schwelle:** Wert je Byte der schlechtesten noch behaltenen Datei, als Satz erklärt („neue Dateien unter diesem Wert
  bleiben nur als Text“). Hinweis auf die feste Regel: übrige PDFs stehen immer unter Hauptdokumenten.
- **Festplatte des Servers:** frei in GB (Datenbank, Sicherungen und Ablage teilen sich die Platte). Warnung unter 20 GB.

### E. Übrige PDFs der Berichte (wie heute)

Verlinkt, Heruntergeladen, Mit Text, Fehlgeschlagen, Noch nicht versucht. Ergänzt: Abdeckung je Monat wie in B (eigene
Balken), Hinweis „nur Textebene, kein OCR; stehen immer unter den Hauptdokumenten“.

### F. Fehler und Server

- **Gründe** wie heute, getrennt nach Hauptdokumenten und übrigen PDFs (Umschalter).
- **Server, die nicht liefern:** Tabelle mit Server, Abrufe, Anteil Fehler, häufigster Grund, letzter Erfolg,
  ausgelassen ja/nein (Regel: mindestens 10 Abrufe, mindestens 90 % Fehler), offene Dokumente. Sortierbar nach offenen
  Dokumenten, damit sichtbar ist, wo sich Nachfragen beim Betreiber lohnen. Keine Umgehung von Sperren.
- **Download:** „Fehlerliste als CSV“ (dasselbe wie `fetch.mjs --errors --csv`).

### G. Läufe (Protokoll)

Die letzten 20 Läufe (Nachtkette, Aufträge), je Zeile: Art, Start, Dauer, geladen, Fehler, OCR-Seiten, neue
Zusammenfassungen, Platz danach, Ergebnis (fertig, mit Fehlern in Schritt X, abgebrochen). Aufklappbar: Zeiten je Schritt.

### H. Aktionen

Knöpfe mit einem Satz Erklärung, was sie tun und wie lange es dauert:

| Knopf | Wirkung |
|---|---|
| Lauf starten | Kette wie nachts: neue und noch nicht versuchte Hauptdokumente, Texte, OCR, Auswertung |
| Fehlgeschlagene erneut versuchen | wie oben, dazu fehlgeschlagene Abrufe und ausgelassene Server |
| Übrige PDFs laden | nur die übrigen PDFs, nur Textebene |
| Texte erstellen | nichts laden; Text aus schon abgelegten PDFs ohne Text, dann OCR und Auswertung (`nightly.mjs --texts`) |
| Stand neu zählen | nur `stats.mjs` (etwa 1 Minute), ohne Laden |
| Anhalten | im Statuskasten, je laufendem Vorgang |

Weitere Einstellungen (Startmonat, Zeitgrenze) bleiben auf der Kommandozeile; die Seite nennt den Befehl unter
„Für Fortgeschrittene“.

### Mobil

Statuskasten und Kennzahlen zweispaltig wie heute; Balken je Monat waagerecht scrollbar; Server-Tabelle als Liste mit
Server und offenen Dokumenten, Rest aufklappbar.

## 3. Technik

Grundsatz wie in `requirements/admin-performance-konzept.md`: Die Seite rechnet beim Öffnen nichts, GETs lesen nur
`system_state`. Alles Rechnen machen die Skripte auf dem Server.

### 3.1 Fortschritt (neu: `pdf-store-progress`)

`nightly.mjs`, `fetch.mjs` und `text.mjs --ocr` schreiben jede Minute einen kleinen Eintrag nach `system_state`
(Vorgang, Schritt, Monat, Zähler, Rate, Platz, Prozess, Zeitpunkt). Ein Eintrag älter als 3 Minuten gilt als beendet.
Damit sind Statuskasten und „Mit Text“ auch während eines Laufs aktuell.

### 3.2 Protokoll (neu: `pdf-store-runs`)

`nightly.mjs` hängt am Ende eines Laufs eine Zeile an (höchstens 50, älteste fallen weg). `fetch.mjs` gibt seine Zähler
und `keeper.stats()` als letzte Zeile maschinenlesbar aus, `nightly.mjs` übernimmt sie.

### 3.3 Anhalten

Auftrag bekommt den Zustand `stop`. `fetch.mjs` prüft ihn jede Minute (mit dem Fortschritt) und hört wie bei Strg+C auf:
laufende Abrufe zu Ende, dann Schluss. `nightly.mjs` prüft ihn vor jedem Schritt. OCR hört nach der laufenden Datei auf.
Kein `systemctl stop` mehr nötig. Der verwaiste Zustand wird schon heute erkannt (`job.mjs`, „abgebrochen“).

### 3.4 Warteschlange und Server-Dienst

- `pdf-store-job` wird eine Liste. `job.mjs` nimmt den ältesten wartenden Auftrag; gleiche Art zweimal hintereinander
  wird zusammengelegt. Parallel laufen weiterhin keine zwei Ladeläufe (eine Grenze, ein Platzzähler).
- `job.mjs` schreibt bei jedem Timer-Aufruf (alle 10 Minuten) einen Herzschlag. Ist er älter als 20 Minuten, sperrt die
  Seite die Knöpfe mit dem Hinweis aus 2.A. Lokal gibt es keinen Herzschlag, also keinen Auftrag, der nie startet.

### 3.5 Zusätzliche Zahlen in `stats.mjs`

Abdeckung je Monat (Hauptdokumente und übrige), „vollständig bis“, Server-Tabelle (aus `pdfs` je Host), Festplatte frei
(`fs.statfs`), Zusammenfassungen (Berichte mit Text im Hauptdokument und mit `ruleSummary`), Schwelle. Laufzeit heute
etwa eine Minute; die Monats- und Server-Zählung kommt im selben Durchgang dazu.

### 3.6 CSV-Download

Neue Route `GET /api/admin/pdf-ablage/fehler.csv`. Die Fehlerliste liegt in der Ablage, nicht in der Datenbank der
Website; `stats.mjs` legt deshalb zusätzlich eine gepackte Liste in `system_state` ab (bei 40.000 Fehlern rund 2 MB
gepackt) oder die Route liest die Ablage direkt, wenn sie im selben Node-Prozess erreichbar ist (`RM_PDF_STORE`).
Entscheidung beim Bau.

## 4. Reihenfolge

1. **Stufe 1, Betrieb ohne ssh:** Statuskasten mit Fortschritt (3.1), Anhalten (3.3), „Stand neu zählen“,
   Hinweis ohne Server-Dienst (3.4, Herzschlag), Protokoll der Läufe (3.2).
2. **Stufe 2, Vollständigkeit:** Abdeckung je Monat, „vollständig bis“, Texte und Auswertung (C), Platz mit Tausch und
   Festplatte (D).
3. **Stufe 3, Fehlersuche:** Server-Tabelle, CSV-Download, Gründe getrennt.
4. **Stufe 4:** Warteschlange.

## 5. Offene Fragen

- Soll „Stand neu zählen“ auch während eines Laufs gehen (liest nur, schreibt nur `pdf-store-stats`)? Vorschlag: ja.
- Server-Tabelle: alle Server oder nur die mit Fehlern? Vorschlag: nur mit mindestens einem Fehler, sortiert nach
  offenen Dokumenten.
- Soll die Nachtkette die übrigen PDFs später selbst mitnehmen, wenn die Hauptdokumente vollständig sind?
- Warnschwelle für die Festplatte (Vorschlag 20 GB frei).
