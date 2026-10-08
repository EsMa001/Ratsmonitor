# Löschkonzept und Betroffenenrechte (Entwurf)

Stand: 08.10.26. Entwurf zur technischen Umsetzung. Vor dem Start anwaltlich prüfen lassen (siehe To-do `re-anwaltspruefung`).

## 1. Grundsatz

Personenbezogene Daten werden nur so lange gespeichert, wie es der Zweck verlangt. Nach Ende des Zwecks werden sie gelöscht oder so anonymisiert, dass kein Personenbezug mehr besteht.

## 2. Datenarten und Fristen

| Datenart | Zweck | Frist | Löschung |
|---|---|---|---|
| Konto (Name, E-Mail, Passwort als Prüfwert) | Anmeldung | bis zur Kontolöschung | sofort mit der Kontolöschung |
| Gespeicherte Suchen, Benachrichtigungen | Dienst für Konto | bis zur Kontolöschung oder Löschung der Suche | sofort |
| Kontaktformular-Nachrichten | Anfrage beantworten | 6 Monate nach Abschluss der Anfrage | automatisch |
| Server-Logs (IP-Adresse, Zeitpunkt) | Sicherheit, Fehlersuche | 7 Tage | automatisch |
| Zahlungsdaten | Abrechnung | Zahlungsanbieter, Belege 8 Jahre (§ 147 AO) | beim Anbieter bzw. nach Frist |
| Rechnungen und Buchungsbelege | Buchführung | 8 Jahre (§ 147 AO) | nach Fristablauf |
| Inhalte aus öffentlichen Quellen (Beschlüsse, Namen in Ratsunterlagen) | Dienst | solange der Quelleintrag besteht | bei Löschwunsch geprüft, siehe Abschnitt 4 |

Fristen sind Vorschläge und mit dem Steuerberater und Anwalt abzugleichen (To-do `fi-steuerberater`).

## 3. Automatische Löschung

- Kontolöschung entfernt Konto, gespeicherte Suchen und Benachrichtigungen vollständig.
- Ablauf der Fristen für Kontaktnachrichten und Logs läuft über einen regelmäßigen Job (noch umzusetzen).
- Sicherungen (Backups) enthalten gelöschte Daten noch bis zum Überschreiben, höchstens 30 Tage. Das wird in der Datenschutzerklärung genannt.

## 4. Löschwünsche zu Inhalten

Die Abläufe stehen in [docs/betrieb/support.md](../betrieb/support.md), Abschnitt 4. Kurz: Prüfung, dann Begrenzung oder Entfernung aus Oberfläche und Suchindex, Antwort innerhalb eines Monats.

## 5. Betroffenenrechte

| Recht | Umsetzung | Frist |
|---|---|---|
| Auskunft (Art. 15) | Export im Konto, sonst E-Mail | 1 Monat |
| Berichtigung (Art. 16) | Konto bearbeiten, sonst E-Mail | 1 Monat |
| Löschung (Art. 17) | Konto löschen, Inhalte nach Abschnitt 4 | 1 Monat |
| Einschränkung (Art. 18) | E-Mail, Sperrung bis zur Prüfung | 1 Monat |
| Widerspruch (Art. 21) | E-Mail, Abwägung im Einzelfall | 1 Monat |
| Datenübertragung (Art. 20) | Export im Konto (JSON) | 1 Monat |

## 6. Offen

- Konkrete Löschjobs für Kontaktnachrichten und Logs umsetzen.
- Kontolöschung im Konto (To-do `fe-kontobereich`) und Löschpfad im Backend prüfen.
- Fristen mit Steuerberater und Anwalt abstimmen.
