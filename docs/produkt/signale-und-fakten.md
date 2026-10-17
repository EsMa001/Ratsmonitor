# Signale und Fakten: Abgrenzung und Zuordnung

Stand 17.10.2026, Entwurf zur Abstimmung (Branch `plenara-x-fakten-qualitaet`).

## Grundsatz

- **Signal** = ein Ereignis, das eine Branche wissen will: „Wo entsteht gerade etwas Neues?“ Besteht aus Vorgang, Ort, Art (Filter), Stand (Verfahrensschritt), Datum und optional Größe. Qualität: Gehört der Vorgang zur Kategorie? Trefferquote: Finden wir die passenden Vorgänge? Ziel je über 90 % bzw. 80 %.
- **Fakt** = ein Zahlenwert mit Einheit, vergleichbar über Orte und Zeit (Karte, Trends). Qualität: Ist der Wert richtig? Abdeckung: Bekommen die Berichte, die einen Wert haben, ihn auch?
- Größe eines Vorhabens (Hektar, Anlagenzahl, Leistung, Wohneinheiten) ist eine **Angabe am Signal**, kein Fakt auf der Karte. Sie darf das Signal nicht blockieren; sie wird getrennt bewertet und im Signal nur angezeigt, wenn sie belegt ist.

## Zuordnung der heutigen Faktarten

| Faktart | Bisher | Künftig | Messung |
|---|---|---|---|
| `hebesatz`, `fee_rate`, `land_price`, `plot_price`, `kita_fee`, `dog_tax`, `second_home_tax`, `amusement_tax`, `waste_fee`, `annual_result`, `budget`, `grant`, `faction` | Fakt | **Fakt** | Wert richtig / Abdeckung |
| `plan_area`, `housing`, `wind_count`, `ee_power` | Fakt | **Angabe am Signal** (Größe) | getrennt vom Signal, Anzeige nur wenn belegt |
| `plan` (Verfahrensschritt), `heat_plan` (Schritt), `stage` | Fakt | **Stand des Signals** | Stand richtig (ab 90 %) |
| `plan_use`, `house_type`, `road`, `project`, `tender` | Fakt | **Art des Signals** (Filter) | Gehört dazu / Trefferquote |

## Kategorien: Was „neu“ heißt

| Signal | Ereignis (Auslöser) | Art/Filter | Stand | Größe (optional) |
|---|---|---|---|---|
| Windenergie | Vorrangfläche oder Sondergebiet ausgewiesen, Antrag (BImSchG), Einvernehmen | Genehmigungsantrag, Bauleitplanung, Einvernehmen, Beteiligung | Verfahrensschritt | Anlagenzahl |
| Solarenergie | Freiflächen-PV, Agri-PV, Speicher: Aufstellung oder Antrag | Freifläche, Agri, Dach, Speicher | Verfahrensschritt | Fläche, Leistung |
| Wohnbaugebiete | Neues Baugebiet, Erweiterung, Erschließung, Bauplatzverkauf | wie bisher | Verfahrensschritt | Fläche, Wohneinheiten, Hausformen |
| Gewerbe/Industrie | Ausweisung oder Grundstücksverkauf | Gewerbe, Industrie, Logistik, Rechenzentrum … | Verfahrensschritt | Fläche, €/m² |
| Ausschreibungen | Ausschreibung, Vergabe, Nachtrag | Hochbau, Tiefbau … | Ausschreibung/Vergabe/Nachtrag | Betrag, wenn genannt |
| Wärme | Wärmeplan, Wärmenetz | wie bisher | Schritt der Planung | – |
| Mobilität/Straße | Vorhaben der Kommune | Bürgerbus, Ladesäulen, Radweg … | Beschluss/Planung | Kosten |

Neu denkbar (jeweils erst Regel bauen und messen):
- **Schrittwechsel** eines Vorhabens („geht in die Auslegung“, „Satzungsbeschluss“): Meldung, wenn der Stand eines bekannten Vorhabens sich ändert.
- **Änderung eines Fakts** (Hebesatz oder Gebühr gegenüber Vorjahr): der Fakt wird zum Signal. Braucht frühere Werte desselben Orts.
- **Neuer Standort** Einzelhandel, Pflege, Schule aus der Nutzung in der Bauleitplanung.
- **Große Vergabe** über einer Schwelle je Branche.

## Folgen für Messung und Anzeige

1. Signalqualität und Fakt-Qualität getrennt führen (`shared/rule-quality.json`: Gruppe „Signale“ mit Art, Stand, Trefferquote; Gruppe „Fakten“ nur für Zahlenwerte; Größen als eigene Zeilen „Angabe“).
2. Eine Signalangabe unter 90 % blockiert nicht das Signal, wird aber nur gezeigt, wenn sie im Text belegt ist.
3. Das Tor `X_FACT_GATE` gilt nur für Fakten auf der Karte; Signale haben ihr eigenes Tor (`gate` je Kategorie).
4. Mehr Abdeckung lohnt sich vor allem bei den echten Fakten (`fee_rate` 69 %, `faction` 65 %, `plan` 79 %).

## Entschieden (17.10.2026)

- `plan` ist der **Stand** eines Signals (Verfahrensschritt), `plan_use` die **Art** (Wohnen, Gewerbe, Industrie …). Beide sind keine Fakten für die Karte: Sie beschreiben ein Vorhaben, einen Vergleichswert zwischen Orten liefern sie nicht. In `rule-quality.json` wandern sie in die Gruppe „Signale“ (Zeilen „Stand“ und „Art“), im Tor `X_FACT_GATE` bleiben sie vorerst, bis die Signale ihr eigenes Tor haben.
- Gleiches gilt für `heat_plan` (Stand der Wärmeplanung).

## Offen

- Schrittwechsel-Meldung: braucht ein Gedächtnis je Vorhaben; Vorgang-ID über Sitzungen (`case_key`) liegt vor.
