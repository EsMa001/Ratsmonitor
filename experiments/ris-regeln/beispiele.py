"""Erzeugt die Beispielliste für label_aus_text.mjs (JSON auf stdout).

Nimmt die 15 Münsteraner Vorlagen aus data/topics.json, die im Experiment besprochen wurden, und führt
ris_regeln.py darauf aus. Optional ein weiteres Dokument aus einer Textdatei:
  python3 -B beispiele.py > beispiele.json
  python3 -B beispiele.py --txt anlage.txt --titel "Titel des Dokuments" > beispiele.json
"""
import argparse, json, sys
from pathlib import Path
import ris_regeln as R

ROOT = Path(__file__).resolve().parents[2]
BEISPIELE = [
    ('Kita Wiegandweg (Trägervergabe)', 'Trägervergabe für die achtgruppige'),
    ('Jahresabschluss Stadt 2025', 'Entwurf des Jahresabschlusses 2025'),
    ('AirportPark FMO Jahresabschluss', 'AirportPark'),
    ('Schulzentrum Hiltrup', 'Bauliche Erweiterung des Schulzentrums'),
    ('Einzelhandelskonzept', 'Fortschreibung des Einzelhandels'),
    ('Förderprogramm altersgerecht', 'Anregung nach § 24'),
    ('72. FNP-Änderung', '72. Änderung des FNP'),
    ('Benennungsrechtssatzung', 'Satzung zur Änderung der Satzung zur Begründung'),
    ('Recyclinghof Hiltrup', 'Neuer Recyclinghof'),
    ('Junges Theater Meerwiese', 'Junges Theater'),
    ('Bauturbo-Bericht', 'Gesetz zur Beschleunigung des Wohnungsbaus'),
    ('Quartierstreffs AIQ', 'Altengerechte, inklusive Quartierstreffs'),
    ('Spielplätze Münster-Ost', 'Sanierung von Spielplätzen'),
    ('Kita Marga-Spiegel-Straße', 'Errichtungsbeschluss: Neubau einer fünfgruppigen'),
    ('Geh- und Radweg Gleistrasse', 'Geh- und Radwegeverbindung auf der ehemaligen'),
]


def eintrag(name, titel, alt, text):
    _, sätze = R.extrahiere_mit_regel(text)
    return {'name': name, 'title': titel, 'alt': alt, 'sentences': [{'regel': r, 'satz': s} for r, s in sätze]}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--txt', help='zusätzliches Dokument als Textdatei (pdftotext -layout)')
    ap.add_argument('--titel', help='Titel dazu')
    a = ap.parse_args()
    t = json.load(open(ROOT / 'data' / 'topics.json', encoding='utf8'))['topics']
    out = []
    for name, pre in BEISPIELE:
        x = next(y for y in t if y['title'].startswith(pre) and y.get('hasDocumentText') in (True, 'True'))
        out.append(eintrag(name, x['title'], x['category'], x['sourceText']))
    if a.txt:
        out.append(eintrag(a.titel or a.txt, a.titel or a.txt, '(nicht im Bestand)', open(a.txt, encoding='utf8').read()))
    json.dump(out, sys.stdout, ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
