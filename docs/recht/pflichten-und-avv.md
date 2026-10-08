# Rechtliche Pflichten und Auftragsverarbeitung (AVV)

Stand: 08.10.2026. Allgemeine Einschätzung nach meinem Kenntnisstand, keine Rechtsberatung. Die Texte (Impressum, Datenschutz, AGB, Widerruf) sind Entwürfe und sollten einmal anwaltlich geprüft werden.

## 1. Texte auf der Website

| Text | Stand | Offen |
|---|---|---|
| Impressum (`/impressum`) | Entwurf eingebunden | Namen der Gesellschafter, Anschrift, E-Mail in `lib/betreiber.ts` eintragen |
| Datenschutzerklärung (`/datenschutz`) | Entwurf eingebunden, passt zum heutigen Stand ohne Konten | Bausteine für Konto, Zahlung, E-Mail, Kontaktformular, Newsletter: `docs/recht/datenschutz-ergaenzungen.md` |
| AGB (`/agb`) | Entwurf eingebunden (Basic, Pro, Enterprise nach `content.ts`) | Zahlungsdienstleister eintragen, Betreiberdaten, anwaltliche Prüfung |
| Widerrufsbelehrung (`/widerruf`) | Gesetzliches Muster für Dienstleistungen eingebunden | Betreiberdaten, später Bestellablauf mit Zustimmung zum vorzeitigen Leistungsbeginn |

Links im Fuß der Seite: Impressum, Datenschutz, AGB, Widerruf (von jeder Seite erreichbar).

## 2. AVV (Auftragsverarbeitungsvertrag, Art. 28 DSGVO)

Ein AVV ist nötig, wenn ein Dienstleister personenbezogene Daten **in unserem Auftrag und nach unseren Weisungen** verarbeitet. Er regelt Zweck, Sicherheit, Unterauftragnehmer und Löschung. Ohne AVV ist die Weitergabe ein Datenschutzverstoß.

| Dienst | Rolle | AVV nötig? | Wie bekommen |
|---|---|---|---|
| Cloudflare (Workers, D1, Hosting) | Auftragsverarbeiter | Ja | Das Cloudflare-DPA ist nach meinem Kenntnisstand Teil der Nutzungsbedingungen und gilt mit Vertragsschluss. Einmal prüfen, speichern, Datum notieren. |
| OpenAI API (Zusammenfassungen) | Auftragsverarbeiter | Ja, weil die Ratsunterlagen Namen enthalten können | OpenAI bietet ein Data Processing Addendum online an. Abschließen und ablegen. Datenschutzerklärung nennt OpenAI schon. |
| E-Mail-Versand (Bestätigungen, Alarme) | Auftragsverarbeiter | Ja | Anbieter mit EU-Servern wählen, dessen AVV akzeptieren (Todo Backend 9 und Frontend 1). |
| Zahlungsdienstleister | meist eigener Verantwortlicher für die Zahlungsabwicklung | Prüfen | Die Nutzungsbedingungen des Anbieters regeln das. Bei Einbindung genau lesen, in der Datenschutzerklärung benennen. |
| Newsletter-Tool (später) | Auftragsverarbeiter | Ja | AVV des Anbieters, Double-Opt-in. |
| Postfach und Dokumente (z. B. Google Workspace, Microsoft 365) | Auftragsverarbeiter | Ja, wenn dort Kundendaten liegen | AVV des Anbieters akzeptieren. |
| Buchhaltungssoftware | Auftragsverarbeiter | Ja | AVV des Anbieters. |
| Steuerberater | meist eigener Verantwortlicher | Nein, aber Vertrag | Standardmandat. |
| Push-Dienste der Browserhersteller (Google, Mozilla, Apple, Microsoft) | keine Auftragsverarbeiter, die ihr auswählt | Nein | In der Datenschutzerklärung benannt (Abschnitt 6). |

Wichtig: Wo ein Dienstleister Daten in die USA übermitteln kann, in der Datenschutzerklärung die Grundlage nennen (EU-US Data Privacy Framework oder Standardvertragsklauseln, wie bei Cloudflare und OpenAI bereits geschehen).

## 3. Was sonst noch gebraucht wird

| Thema | Pflicht? | Hinweis |
|---|---|---|
| Verzeichnis der Verarbeitungstätigkeiten (Art. 30) | Ja, weil die Verarbeitung nicht nur gelegentlich ist | Kurze Tabelle: Zweck, Daten, Empfänger, Löschfristen. Entwurf kann ich erstellen. |
| Technische und organisatorische Maßnahmen (Art. 32) | Ja | Zwei Seiten: Zugriff, Verschlüsselung, Backups, 2-Faktor. |
| Interessenabwägung für die Ratsdaten (Art. 6 Abs. 1 lit. f) | Ja, schriftlich festhalten | Begründung, warum eure Interessen überwiegen, und welche Maßnahmen (Namen filtern) schützen. |
| Löschkonzept und Aufbewahrungsfristen | Ja | Nach meinem Kenntnisstand: Buchungsbelege und Rechnungen 8 Jahre, Handels- und Geschäftsbriefe 6 Jahre, Jahresabschluss 10 Jahre. Konto- und Nutzungsdaten sonst nach Vertragsende löschen. |
| Ablauf bei Datenpannen (Art. 33) | Ja | Meldung an die Aufsichtsbehörde binnen 72 Stunden (To-Do Sicherheit 3). |
| Betroffenenanfragen (Art. 15 bis 21) | Ja | Antwort binnen einem Monat. Ablauf und Vorlage (To-Do Betrieb 3). |
| Datenschutzbeauftragter | Nein | Erst ab 20 Personen, die ständig mit automatisierter Verarbeitung befasst sind (§ 38 BDSG). |
| Datenschutz-Folgenabschätzung | Vermutlich nein | Bei Anwaltsprüfung kurz mitklären. |
| Cookie-Banner | Nach heutigem Stand nein | Es werden nur technisch notwendige Speicherungen genutzt (§ 25 Abs. 2 TDDDG). Bei Tracking oder Analyse ändert sich das. |
| Button „zahlungspflichtig bestellen“, Bestätigungs-E-Mail, Kündigungsbutton | Ja, sobald es kostenpflichtige Tarife gibt (§ 312j, § 312k BGB) | Kündigungsbutton muss leicht erreichbar sein und „Verträge hier kündigen“ o. ä. heißen. |
| Preisangaben | Ja | Endpreise inklusive Umsatzsteuer, wie in den AGB. Wenn ihr Kleinunternehmer seid (§ 19 UStG), „inkl. MwSt.“ durch den passenden Hinweis ersetzen (Finanzen 3). |
| Barrierefreiheit (BFSG) | Nach meinem Kenntnisstand für Kleinstunternehmen mit Dienstleistungen ausgenommen (weniger als 10 Beschäftigte, höchstens 2 Mio. Euro Umsatz) | Trotzdem lohnt der Mobil- und Barrierefreiheitstest (Frontend 11). |
| E-Rechnung | Empfang ab 2025 Pflicht, Ausstellung gestaffelt bis 2028 | Mit dem Steuerberater oder der Buchhaltungssoftware klären. |
| Impressum bei der GbR | Ja | Name der GbR, alle Gesellschafter mit Namen, ladungsfähige Anschrift, E-Mail. Telefon ist nicht nötig, wenn E-Mail und Kontaktformular schnelle Kontaktaufnahme ermöglichen. |

## 4. Reihenfolge, die ich empfehle

1. Betreiberdaten eintragen (`lib/betreiber.ts`), damit Impressum, Datenschutz, AGB und Widerruf vollständig sind.
2. Cloudflare-DPA und OpenAI-DPA prüfen und ablegen.
3. Texte einmal anwaltlich prüfen lassen (inklusive der Fragen: Preisänderungsklausel, Haftungsklausel, Übertragung auf die UG).
4. Vor dem Start der Bezahlfunktion: Zahlungsdienstleister eintragen, Bestellablauf mit Widerrufszustimmung bauen, Datenschutz-Bausteine einfügen.
5. Dann Verzeichnis der Verarbeitungstätigkeiten, Löschkonzept und Interessenabwägung (kann ich als Entwurf liefern).
