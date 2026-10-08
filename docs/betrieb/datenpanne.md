# Ablauf bei Datenpannen (Entwurf)

Stand: 08.10.2026. Entwurf, nicht anwaltlich geprüft. Offene Stellen sind mit **[offen]** markiert.

## Was als Datenpanne gilt

Jede Verletzung der Sicherheit, die zu Vernichtung, Verlust, Veränderung oder unbefugter Offenlegung oder unbefugtem Zugang zu personenbezogenen Daten führt (Art. 4 Nr. 12 DSGVO). Beispiele: Zugangsdaten gelangen nach außen, ein Admin-Zugang wird unbefugt genutzt, Kontodaten oder Logs werden versehentlich veröffentlicht, ein Backup geht verloren.

## Meldefrist

- Meldung an die zuständige Aufsichtsbehörde **binnen 72 Stunden** nach Bekanntwerden (Art. 33 DSGVO), auch wenn noch nicht alles geklärt ist. Spätere Angaben werden nachgereicht.
- Die Meldung ist unterblieben, wenn die Panne voraussichtlich kein Risiko für Rechte und Freiheiten Betroffener hat. Diese Entscheidung wird schriftlich begründet und abgelegt.
- Zuständige Behörde: **[offen]** (Sitz der Gesellschaft bzw. der GbR; vor Gründung prüfen).

## Ablauf

1. **Erkennen und melden (sofort).** Wer die Panne bemerkt, informiert innerhalb von 2 Stunden die Verantwortlichen (siehe Vertretung unten). Keine Einzelfallentscheidungen vorab.
2. **Eindämmen.** Betroffene Zugänge sperren, Schlüssel und Passwörter wechseln, Datenfluss stoppen. Nichts löschen, Protokolle sichern.
3. **Erfassen.** Art der Panne, Zeitpunkt des Vorfalls und des Bekanntwerdens, betroffene Datenarten und ungefähre Anzahl, mögliche Folgen, bereits getroffene Maßnahmen. Ergebnis in einem Protokoll festhalten.
4. **Bewerten.** Risiko für Betroffene: gering, mittel oder hoch. Bei hohem Risiko zusätzlich Benachrichtigung der Betroffenen (Art. 34 DSGVO), ohne unangemessene Verzögerung.
5. **Melden.** Meldung an die Aufsichtsbehörde über das Formular der Behörde. Pflichtangaben laut Art. 33 Abs. 3 DSGVO.
6. **Nachverfolgen.** Ursache beheben, Maßnahmen dokumentieren, Verarbeitungsverzeichnis und technische Maßnahmen anpassen.

## Verantwortlich

- Erste Ansprechperson: **[offen, Name]**
- Vertretung: **[offen, Name]**
- Für Auftragsverarbeiter (Cloudflare, OpenAI): deren Meldepflichten gegenüber uns sind im AVV geregelt (siehe `docs/recht/pflichten-und-avv.md`). Sie informieren uns ohne unangemessene Verzögerung.

## Dokumentation

Jede Panne bekommt einen Eintrag im Vorfallprotokoll, auch wenn sie nicht meldepflichtig ist. Der Eintrag enthält die Bewertung und die Begründung. Aufbewahrung: **[offen]**.
