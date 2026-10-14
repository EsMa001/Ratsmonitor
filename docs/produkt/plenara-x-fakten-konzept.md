# Konzept: Fakten in plenara.X

Stand 14.10.2026. Grundlage sind die Messungen vom selben Tag. Die Abdeckung bezieht sich auf die 8.016 Gemeinden mit Sachvorgängen. Die Seitenübersicht stammt aus `branchen-enterprise.ts`.

## 1. Kernbefund

Die Fakten sind nicht alle von derselben Art. Sie beantworten zwei verschiedene Fragen und brauchen deshalb zwei verschiedene Ansichten:

| | **Vergleichswerte** | **Signale** |
|---|---|---|
| Frage | Wo liegt meine Gemeinde im Vergleich? | Wo passiert gerade etwas, und wie weit ist es? |
| Beispiele | Hebesatz, Gebühren, Hundesteuer, Abfall, Kita-Beitrag, Jahresergebnis | neues Baugebiet, Windpark, Wärmeplanung, Bürgerbus, Straßenausbau, Grundstücksverkauf |
| Abdeckung | **wichtig**: Ein Vergleich braucht viele Orte (Ziel ab 30 %) | **unwichtig**: Wichtig ist, dass jedes neue Ereignis früh erkannt wird (Trefferquote, Aktualität) |
| Wert entsteht durch | Vollständigkeit und Einordnung (Viertel, Gruppe) | Aktualität, Stand des Verfahrens, Benachrichtigung |
| Passende Ansicht | Karte / Ortsvergleich | Liste („Feed“) mit Filtern und Alarm |

Der Atlas mischt bisher beides auf einer Karte. Für Signale ist eine Karte mit Anteilen die falsche Form. Ein Fertighausbauer will keine Prozentfläche sehen, sondern eine Liste: „Baugebiet X, 3,5 ha Wohnen, Satzungsbeschluss am 12.10., Quelle“. Dasselbe gilt für Windprojektierer.

## 2. Vorschlag: drei Orte für Fakten

### A. plenara.X Signale (neu; ersetzt die Idee „Radar“, nur aus Fakten)
Eine Liste neuer Ereignisse je Branche, mit Ort, Stand, Kennzahlen und Quelle, gefiltert nach Gebiet und Zeitraum. Dazu ein E-Mail-Alarm und eine kleine Karte als Punktekarte, nicht als Anteile. Das passt zu den Vorteilen 2, 3, 6 und 7 („Früher erfahren“, „Alarme“, „Stand jedes Vorgangs“, „Sofort sehen, wo etwas passiert“).

| Signal | Fakten (vorhanden oder neu) | Für wen |
|---|---|---|
| **Neue Baugebiete Wohnen** | `plan` (Stand), `plan_use`=Wohnen, `plan_area` (ha, neu), `housing` (WE), `plot_price` | Fertighausbauer, Bauträger, Banken/Bausparkassen, Makler |
| **Neue Gewerbegebiete** | `plan` + `plan_use`=Gewerbe/Industrie, `plan_area`, `land_price` | Projektentwickler, Wirtschaftsförderung, Logistik, Handel |
| **Wind und Solar** | `plan`/`plan_use`=Energie, `wind_count` (neu), `ee_power` (MW), Stand | Projektierer, Stadtwerke, Netzbetreiber, Bürgerenergie |
| **Wärmeplanung und Wärmenetze** | `heat_plan` (Schritt) | Stadtwerke, Energieberater, Heizungs- und Wärmepumpenanbieter |
| **Straßen und Tiefbau** | `road` (neu: Art, Kosten) | Bauindustrie, Ingenieurbüros |
| **Mobilitätsangebote** | `project` (neu: Bürgerbus, Carsharing, Ladesäulen, Mitfahrbank, Verleih) | Mobilitätsanbieter, Ladeinfrastruktur, ÖPNV |
| **Digitales** | `project` = öffentliches WLAN (später Glasfaser, Smart City) | Telekommunikation, Smart-City-Anbieter |
| **Förderung** | `funding`, `funding_euro` | Fördermittelberater, Verbände, Medien |

Der Stand kommt aus „Was geschieht“ (`stage`) und aus `plan` (Aufstellung → Auslegung → Satzungsbeschluss). Für Signale zählt vor allem die **Trefferquote**: Wie viele echte neue Baugebiete erkennen wir? Gemessen wird das an Titeln von Hand, nicht als Anteil der Gemeinden.

### B. Ortsvergleich mit Vergleichswerten (vorhandene Seite ausbauen)
„Wo liegt meine Gemeinde?“: Wert, Viertel in der Vergleichsgruppe (`peer-norms.mjs`), Verlauf und Quelle. Als Karte nur dort, wo die Abdeckung trägt; sonst eine Liste der bekannten Werte mit dem Hinweis „x von y Gemeinden“.

| Wert | Abdeckung heute → mit facts-v26 | Für wen |
|---|---|---|
| Hebesatz (A, B, Gewerbe) | 10,5 % → 14,0 % | Kämmerer, Unternehmen (Standortwahl), Medien, Steuerzahlerbund, Bürger |
| Wasser/Abwasser/Niederschlag | 8,3 % → 10,8 % | Kämmerer, Verbraucherschutz, Medien, Bürger |
| Hundesteuer | 2,5 % → 6,0 % | Medien, Bürger (Lokaljournalismus „Was kostet …“) |
| Abfallgebühren (Richtung) | neu 4,3 % | Medien, Entsorger |
| Kita-Beitrag (Richtung) | 17,5 % | Eltern, Träger, Medien |
| Jahresergebnis | 35,4 % | Kämmerer, Aufsicht, Medien, Banken |
| Parkgebühr | 0,9 % | Medien, Handel |

Mehr Abdeckung bringen hier vor allem die **Anlagen**: Satzungen und Haushaltssatzungen (siehe Messung). Die Werte gibt es sonst nirgends gesammelt, höchstens punktuell, etwa vom Bund der Steuerzahler. Das ist das Alleinstellungsmerkmal, auch wenn die Abdeckung erst langsam wächst. Denn jeder Haushalt und jede Gebührensatzung kommt einmal im Jahr wieder.

### C. Atlas (verschlanken)
Der Atlas bleibt die **Aufmerksamkeitskarte**: Wo wird wie oft worüber beraten (Thema, Unterthema, „Was geschieht“, Anteil, Monat)? Dazu kommen die Vergleichswerte als Ebene, sobald sie über dem Qualitätstor und über 30 % Abdeckung liegen. Signal-Fakten verschwinden aus dem Atlas. Er verlinkt stattdessen auf die passende Signal-Liste („12 neue Wohnbaugebiete in dieser Auswahl →“).

## 3. Die übrigen plenara.X-Seiten

| Seite | Rolle der Fakten |
|---|---|
| **Ausbreitung** | Vorhaben wie Bürgerbus, Carsharing und Wärmeplanung eignen sich ideal: Wo kam es zuerst, wer folgt? Statt Freitext-Begriff ein fester Fakt, das ist genauer. |
| **Trends** | Zahl der Signale je Monat: neue Baugebiete, Windanlagen, Gebührenerhöhungen. |
| **Ortsvergleich** | Heimat der Vergleichswerte (B). |
| **Beschlüsse / Beratungswege** | Keine Fakten nötig. Optional Dauer von der Aufstellung bis zum Satzungsbeschluss je Baugebiet (aus `plan`). |
| **Fraktionsprofil** | `faction`, `faction_advice` bleiben dort. |
| **Newsradar** | Bekommt Signale als Aufhänger („Gemeinde X erhöht Hundesteuer auf 96 €“), nur über dem Qualitätstor. |
| **Themennetz** | Unverändert. |
| **Branchenseiten** | Verweisen künftig auf die Signal-Liste der Branche statt auf eine Atlas-Auswahl (zum Beispiel Fertighaus → „Neue Baugebiete Wohnen“). |

## 4. Fakten: behalten, verschieben, streichen

- **Behalten als Vergleichswert:** `hebesatz`, `fee_rate`, `dog_tax`, `waste_fee`, `kita_fee`, `annual_result`, `park_fee` (Parkgebühr nur als Liste, die Abdeckung ist zu klein für eine Karte).
- **Behalten als Signal:** `plan`, `plan_use`, `plan_area`, `housing`, `plot_price`, `land_price`, `ee_power`, `wind_count`, `heat_plan`, `road`, `project`, `funding`, `funding_euro`, `grant`.
- **Behalten als Profil:** `faction`, `faction_advice`.
- **Streichen oder einfrieren:** `kita_places` (0,6 % Abdeckung, als Kita-Ausbau in `plan`/`project` besser aufgehoben), `funding_granted` (geht in `funding` auf).
- **Neue Kandidaten** (Liste aus den Durchgängen): Zweitwohnungssteuer, Friedhofsgebühren, Grundgebühren Wasser, Kurtaxe, Elternbeiträge Schulkindbetreuung, Auftragsvergaben mit Betrag, geplantes Ergebnis im Haushalt, Glasfaserausbau.

## 5. Ziele und Messung je Art

| Art | Qualitätsziel | Abdeckungsziel | Messung |
|---|---|---|---|
| Vergleichswert | ≥ 90 % richtig | ≥ 30 % der Gemeinden für Karte, sonst Liste | frische Server-Stichprobe, Gemeinden mit Wert / Gemeinden mit Sachvorgängen |
| Signal | ≥ 90 % richtig (Art und Stand) | **Trefferquote** ≥ 80 % der passenden Titel | Stichprobe passender Titel: erkannt ja/nein; Verzug ab Import |
| Profil | ≥ 90 % | – | wie bisher |

## 6. Nächste Schritte

1. facts-v26 fertig messen: frische Stichprobe, Werte in `rule-quality.json`, Commit, nach Freigabe ausrollen.
2. Signal-Liste „Neue Baugebiete Wohnen“ als erste Seite bauen: Daten aus `x_cases` und `topic_facts`, Filter Gebiet/Zeitraum/Stand, Alarm über die vorhandenen Benachrichtigungen. Dann Wind/Solar und Wärmeplanung.
3. Ortsvergleich um die Vergleichswerte erweitern. Den Atlas zurückbauen, ohne Signal-Fakten.
4. Abdeckung der Vergleichswerte über weitere Anlagen erhöhen. Die übrigen PDFs (Satzungen, Begründungen) bekommen dafür beim Laden einen höheren Rang (`pdf-rank.mjs`).
