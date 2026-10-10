# Frontend-Bewertung (ohne Admin), Stand 10.10.2026

Noten 1 (sehr gut) bis 5 (mangelhaft). Geprüft am lokalen Dev-Server, Desktop 1280 px und Mobil 375 px, ausgeloggt (Gast).

Kategorien: **A** Verständlichkeit und Aussage · **B** Design und Konsistenz · **C** Mobil · **D** Zugänglichkeit und Technik · **E** Vertrauen und Rechtliches.

Messbar geprüft: Überschriftenstruktur, `lang`, Landmarks, Sprunglink, Bilder ohne Alt-Text, Schaltflächen ohne Namen, Querscroll mobil, Platzhalter im Text. Sichtprüfung nur an Startseite, Preise (mobil) und Anwender. Die übrigen Noten in B beruhen auf Struktur und Code, nicht auf Bildern.

| Seite | A | B | C | D | E | Anmerkung |
|---|---|---|---|---|---|---|
| Startseite `/` | 2 | 2 | 3 | 2 | 2 | Mobil: Karte „wird aufgebaut“ und Leerfläche vor der Liste, die Treffer beginnen erst unter dem Falz. Überschrift beschreibt, der Slogan fehlt oben. |
| Beschluss `/beschluss/[id]` | 2 | 2 | 2 | 2 | 2 | Messung meldete einen namenlosen Link, war ein Messfehler (Link hat Text). |
| Thema `/thema/[id]` | – | – | – | – | – | Nicht bewertet: Beispiel-ID liefert keine Seite. |
| Preise | 2 | 2 | 2 | 2 | 3 | Klar, Slogan im Einleitungstext. Einführungspreis-Kennzeichnung und Tarifgrenzen noch offen (`ma-preise`, `pr-stufen`). |
| FAQ | 3 | 2 | 2 | 2 | 3 | Nur 1.276 Zeichen, sechs Fragen, wenig zu Datenschutz, Kündigung und Quellen. |
| Datenabdeckung | 2 | 2 | 2 | 2 | 2 | Belegt Zahlen, „Hinter den Kulissen“ schafft Vertrauen. |
| Videos | 2 | 2 | 2 | 2 | 2 | Vorschaubilder mit leerem Alt-Text, das ist als dekorativ richtig. |
| Funktion Suche | 2 | 2 | 2 | 2 | 2 | Starke Überschrift, Vorteile erkennbar. |
| Funktion Benachrichtigungen | 1 | 2 | 2 | 2 | 2 | Beste Aussage: „Früher wissen. Alarme statt tägliches Suchen.“ |
| Anwender `/anwender/immobilien` | 1 | 2 | 2 | 2 | 2 | Konkreter Nutzen je Rolle. Alte Adressen (`/anwender/bauwesen`, `energie`, …) liefern 404. |
| Analytics (plenara.X) | 3 | 2 | 2 | 2 | 3 | Fachbegriffe (Diffusionsanalyse, Knowledge Graph) ohne Laienerklärung, nur Enterprise. |
| Anmelden | 2 | 2 | 2 | 2 | 3 | Funktioniert nur mit Testkonten, kein Backend. |
| Registrieren | 2 | 2 | 2 | 2 | 4 | Nur Browser-Validierung, Konto wird nicht angelegt (`fe-registrierung`, `be-konten`). |
| Kontakt | 2 | 2 | 2 | 2 | 4 | Simulierter Versand, Nachricht geht nirgends hin (`fe-kontaktformular`, `be-kontakt`). |
| Konto `/konto` | 3 | 3 | 2 | 2 | 3 | Zeigt „Hilfe & Datenquellen“, bewusst ohne Benutzerkonto. Tarif, Rechnungen, Löschung fehlen (`fe-kontobereich`). |
| Impressum | 2 | 2 | 2 | 2 | 3 | Betreiberdaten noch nicht belegt (`re-betreiberdaten`). |
| Datenschutz | 2 | 2 | 2 | 2 | 3 | Ausführlich, aber Entwurf, nicht anwaltlich geprüft. |
| AGB | 2 | 2 | 2 | 2 | 4 | Platzhalter „[Name des Zahlungsdienstleisters]“, Entwurf (`re-agb`, `fi-zahlungsanbieter`). |
| Widerruf | 2 | 2 | 2 | 2 | 3 | Entwurf nach gesetzlichem Muster, nicht geprüft. |
| Abgemeldet | – | – | – | – | – | Gewollte Weiterleitung auf die Startseite (`app/abgemeldet/page.tsx`), `/analysen` ebenso. Es gibt noch keine Abmeldung, keine Seite nötig. |
| 404 | 2 | 2 | 2 | 2 | 2 | Eigene Seite mit Titel, Rückweg vorhanden. |

## Durchschnitt je Kategorie (bewertete Seiten)

A 2,1 · B 2,1 · C 2,1 · D 2,2 · E 2,8

## Was auffällt

1. **Vertrauen (E) ist die schwächste Kategorie.** Formulare ohne Backend, Rechtstexte als ungeprüfter Entwurf, Platzhalter in den AGB, Betreiberdaten.
2. **`/konto`** trägt den Namen „Konto“, zeigt aber eine Hilfeseite. Erst sinnvoll zu ändern, wenn es Konten gibt.
3. **Alte Anwender-Adressen** (`bauwesen`, `energie`, `umwelt`, `wirtschaft`, `medien`) gaben 404. Behoben am 10.10.2026: sie zeigen jetzt die aufbauende Gruppe. `entsorgung-und-wasser`, `verkehr`, `vereine` haben keine eindeutige Gruppe und bleiben 404.
4. **Mobil:** kein Querscroll, Navigation und Tarif-Reiter funktionieren. Mangel: Startseite mit Karte vor der Liste.
5. **Technik:** `lang="de"`, ein Sprunglink, ein sichtbares `main` je Seite, alle Formularfelder beschriftet.

## Offen

- FAQ um Datenschutz, Kündigung und Quellen erweitern (Text muss von dir freigegeben werden).
