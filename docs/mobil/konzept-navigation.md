# Mobil: Navigation und Bedienung (Konzept, Entwurf 18.10.2026)

Zweig `nico_mobil`. Ziel: Auf dem Handy (unter 640 px) kommt man mit einem Daumen in zwei Tipps zu jeder Seite. Inhalt, Namen und Aufbau bleiben wie am Desktop; geändert wird nur die Darstellung der Navigation.

## 1. Ist-Stand (Code: `Header.tsx`, `BottomNav.tsx`, `MainMenu.tsx`, `AccountMenu.tsx`)

- **Kopfzeile** (56 px): links ☰ + Logo, rechts Hell/Dunkel, Konto (bei Admin zusätzlich Administration). Auf Unterseiten ersetzt ein Zurück-Pfeil mit Seitentitel (nach dem Scrollen) das Logo.
- **Untere Leiste** (5): Start, Suche, Gespeichert, plenara.X, Konto.
- **☰-Menü**: sechs Aufklapp-Gruppen (Anwender, Funktionen, Analysen, Einblicke, Hintergründe, Informationen), eine Gruppe offen. Die Fragen („Wie viel?“) sind auf dem Handy ausgeblendet.

Schwächen:
1. **Doppelt:** „Konto“ steht in Leiste und Kopfzeile; „Funktionen“ im ☰ wiederholt Suche und Gespeichertes aus der Leiste.
2. **plenara.X ist ein Tab, aber 11 Seiten:** Seitenwechsel dort heißt ☰ (oben links, schwer erreichbar) → Gruppe aufklappen → Eintrag: 3 Tipps und viel Scrollen. Wer in der Leiste „plenara.X“ tippt, landet immer im Atlas.
3. **Oben links ist die schwächste Daumenzone**, dort sitzt aber der Zugang zu fast allem außer den vier Hauptzielen.
4. Hell/Dunkel in der Kopfzeile ist eine seltene Einstellung auf der wertvollsten Fläche.
5. Die Fragen („Was entsteht?“), die die Seiten erklären, fehlen genau dort, wo man wählt.

## 2. Beschlossen und umgesetzt (Phase 1, 18.10.2026, nur unter 640 px)

**Grundsatz:** Jedes Ziel steht nur an einem Ort, die Leiste ist für alle Stufen gleich. Unten: wohin ich will. Oben rechts: wer ich bin und Einstellungen. Oben links: nur das Logo (führt zur Startseite, ☰ entfällt).

- **Untere Leiste (5):** Suche, plenara.X, Folgen (gespeicherte Suchen), Artikel (gemerkte Artikel), Mehr. Keine Startseite (Logo), kein Kalender (nur Enterprise; erscheint nur im Umschalter Suchen / Artikel / Kalender oben auf diesen Seiten).
- **plenara.X:** Tab öffnet ein Blatt mit allen 11 Seiten in Analysen, Einblicke, Hintergründe, je mit Frage. Ohne Enterprise: Schloss an jedem Eintrag und ein Satz dazu; jede Seite zeigt dann die Sperrseite mit Erklärsatz (Live-Vorschau nur bei Themennetz, Trends, Ortsvergleich, Ausgang, Gremien).
- **Konto-Menü oben rechts:** Anmelden bzw. Konto, Preise, Dunkler Modus, Ansehen als (Admin), Dev-Postfach, Abmelden; Administration als eigenes Symbol für Admins.
- **Mehr:** Anwender, Informationen (Videos, Datenabdeckung, FAQ, Benachrichtigungen), Impressum, Datenschutz.
- **Gast:** Folgen und Artikel zeigen die Anmeldeaufforderung, plenara.X die Sperrseite, Suche und Karte voll nutzbar (10 Treffer).

- **Suche am Handy (seit 18.10.2026):** Karte und Ergebnisblatt teilen die Bildschirmhöhe, zwei Stufen. „Klein“: Karte groß, vom Blatt nur Griff und Zeile mit Trefferzahl; „voll“: Liste groß (scrollt im Blatt), Karte als schmaler Streifen mit Suchleiste. Wechsel per Tipp oder Wischen am Griff; Suchfeld und Filter schalten automatisch auf „klein“ (Platz für Vorschläge und Filter). Zustand in `lib/sheetStage.ts`, Stile am Ende von `app/ratsmonitor.css` (`data-stage`); Desktop unverändert. Die Rechtlich-Zeile entfällt dort (steht unter „Mehr“).

Code: `components/BottomNav.tsx`, `menu/{Sheet,MoreSheet,XSwitcher,SavedTabs}.tsx`, `components/{Header,AccountMenu}.tsx`; die Listen kommen aus `menu/MainMenu.tsx`.

## 4. Umsetzung (nach Freigabe, nur Frontend)

1. `BottomNav.tsx`: Ziel „Mehr“, Gespeichert-Umschalter; Blatt als neue Komponente `menu/MoreSheet.tsx`.
2. `Header.tsx`/`AccountMenu.tsx`: Handy-Variante (Suche, Konto-Kreis, Hell/Dunkel raus); `MainMenu.tsx` unter 640 px ohne ☰.
3. `menu/XSwitcher.tsx`: Seitenwahl für plenara.X, die Einträge kommen aus denselben Listen wie `MainMenu` (Listen in eine gemeinsame Datei, damit sie nicht doppelt gepflegt werden).
4. Prüfen im Browser mit Handy-Voreinstellung (375×812) plus 320 px; `tsc`, `eslint`, `npm test`.

## 5. Phase 2: Ist plenara insgesamt gut mit dem Handy bedienbar?

Vorgehen, erst nach Phase 1:
1. **Bestandsaufnahme:** alle Routen bei 375 px aufnehmen; je Seite Zahl der Wörter über dem Falz (OCR-Werkzeug aus `CLAUDE.md`), Zahl der Tipps bis zur Kernaktion, Tippflächen unter 44 px, horizontales Scrollen.
2. **Regeln zum Kürzen:** pro Seite ein Satz Einleitung, Erklärtext hinter „Mehr“; Kennzahlen vor Fließtext; Tabellen als Zeilen mit zwei Angaben; Filter im Blatt statt Leiste; Antwortsatz (`Befund`) bleibt, Methodik und Hinweise einklappen. Nur belegbare Vorteile (`docs/produkt/vorteile.json`, Stufe A) in Einleitungen.
3. **Ergebnis:** Liste je Seite „kürzen / umbauen / so lassen“, danach Umsetzung in kleinen Schritten.
