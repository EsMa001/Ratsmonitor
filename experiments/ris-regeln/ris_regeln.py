"""Allgemeine Regeln für Ratsinformationssystem-Dokumente (Stand 09.10.2026, Experiment).

Zieht aus dem Text einer Vorlage, Anlage oder Vereinbarung wenige Originalsätze
heraus (Beschluss, Anlass, Kern, Zahlen, Fristen). Kein KI-Modell, nichts wird
neu formuliert. Nicht in die App eingebunden: kein Import, keine API und keine
Oberfläche ruft diesen Code auf. Siehe README.md in diesem Ordner.

Aufruf:
  python3 ris_regeln.py dokument.txt                 Text aus einer PDF (pdftotext -layout)
  python3 ris_regeln.py data/topics.json             zufällige Vorlage aus dem Münster-Bestand
  python3 ris_regeln.py data/topics.json --id papers-vo-2004056483
  python3 ris_regeln.py data/topics.json --titel "Satzung zur Änderung"
"""
import re, sys, json, random, argparse

# Abkürzungen mit Punkt, die keine Satzgrenze sind (Liste wächst: "gem." fehlt noch)
ABK = ['Abs.', 'Nr.', 'Dr.', 'Co.', 'Mio.', 'Mrd.', 'Tsd.', 'ca.', 'bzw.', 'ggf.', 'vgl.', 'Art.', 'Satz.',
       'z. B.', 'u. a.', 'i. H. v.', 'i. V. m.', 'd. h.', 'Str.', 'Prof.', 'e. V.', 'zzgl.', 'inkl.', 'evtl.']
B = '¶'  # harte Satzgrenze (Überschrift, Aufzählungsnummer)
TYPEN = (r'\b(ENTWURF|Entwurf|Berichtsvorlage|Beschlussvorlage|Mitteilungsvorlage|Niederschrift|Protokoll|'
         r'Antrag|Anfrage|Vereinbarung|Satzung|Vertrag|Bebauungsplan|Jahresabschluss|Haushalt)\b')


def vorbereiten(txt):
    """Zeilen aufräumen: wiederkehrende Kopf-/Fußzeilen und Seitenzahlen weg, Silbentrennung zusammenfügen,
    Überschriften als harte Satzgrenze markieren."""
    lines = [l.strip() for l in txt.splitlines()]
    cnt = {}
    for l in lines:
        cnt[l] = cnt.get(l, 0) + 1
    lines = [l for l in lines if l and cnt[l] < 2 and not re.fullmatch(r'(Seite )?\d+( von \d+)?', l)]
    out = []
    for l in lines:
        # Trennstrich am Zeilenende (nicht bei Ergänzungsstrichen wie "Einzelhandels- und")
        if (out and out[-1].endswith('-') and re.match(r'[a-zäöüß]', l)
                and not re.match(r'(und|oder|bzw|sowie)\b', l) and re.search(r'[a-zäöüß]-$', out[-1])):
            out[-1] = out[-1][:-1] + l
            continue
        out.append(l)
    res = []
    for l in out:
        # Überschrift: kurz, kein Satzzeichen am Ende, beginnt groß/§/Ziffer, kein finites Hilfsverb
        head = (len(l) <= 60 and re.match(r'[A-ZÄÖÜ§0-9]', l) and not re.search(r'[.,;“]$', l)
                and not re.search(r'\b(wird|werden|ist|sind|soll|sollen)\b', l))
        res.append(B + ' ' + l + ' ' + B if head else l)
    return res


def sätze(flat):
    s = flat
    for a in ABK:
        s = s.replace(a, a.replace('.', '․'))
    # Aufzählungsnummern nach Satzende oder Doppelpunkt sind Grenzen, Ordnungszahlen mitten im Satz nicht
    s = re.sub(r'(?<=[.!?:“])\s+\d{1,2}\.\s+(?=[A-ZÄÖÜ§„])', ' ' + B + ' ', s)
    s = re.sub(r'^\d{1,2}\.\s+', ' ', s)
    s = re.sub(r'(\d{1,3})\.(?=\s+[A-ZÄÖÜ])', lambda m: m.group(1) + '․', s)
    s = re.sub(r':\s+(?=„)', ': ' + B + ' ', s)
    parts = []
    for blk in s.split(B):
        parts += re.split(r'(?<=[.!?“])\s+(?=[A-ZÄÖÜ„§])', blk)
    return [p.replace('․', '.').strip() for p in parts if len(p.strip()) > 1]


def extrahiere(txt):
    """Gibt (Typwörter, bis zu fünf Originalsätze) zurück."""
    lines = vorbereiten(txt)
    flat = re.sub(r'\s+', ' ', ' '.join(lines))
    S = sätze(flat)
    ok = lambda s: 50 <= len(s) <= 420
    typ = sorted(set(re.findall(TYPEN, ' '.join(lines[:25]))))
    # R2 Beschluss: zwei Sätze nach Beschlussvorschlag, sonst "Der Rat beschließt ..."
    g2 = []
    m = re.search(r'(Beschlussvorschlag|Beschlussempfehlung|Beschlussentwurf)\s*:?\s*' + B + r'?\s*(.{40,900})', flat)
    if m:
        g2 = [s for s in sätze(m.group(2)) if ok(s)][:2]
    if not g2:
        g2 = [s for s in S if re.search(r'\b(Rat|Ausschuss|Bezirksvertretung|Kreistag|Kreisausschuss)\b[^.]{0,80}\b(beschließt|empfiehlt|nimmt)\b', s) and ok(s)][:1]
    # R3 Anlass: erster Satz der ersten Dokumenthälfte mit Auslösewort
    n = len(S)
    g3 = [s for i, s in enumerate(S) if i < n * 0.5 and ok(s) and s not in g2
          and re.search(r'\b(Aufgrund|Vor dem Hintergrund|Ziel (?:ist|der|des)|erforderlich|notwendig|daher|deshalb|Anlass)\b', s)][:1]
    # R4 Kern: Entscheidungsverb, die zwei Sätze mit der höchsten Faktendichte
    verb = (r'\b(?:soll|sollen|wird|werden)\b.*\b(?:errichtet|eingerichtet|geändert|neu gefasst|beauftragt|vergeben|genehmigt|'
            r'beschlossen|angemietet|erweitert|erneuert|saniert|gebaut|aufgestellt|ermächtigt|übertragen)\b|'
            r'\b(?:beschließt|genehmigt|beauftragt|vergibt)\b')

    def fakten(s):
        return (len(re.findall(r'\d', s)) * 0.5 + len(re.findall(r'(?<!^)\b[A-ZÄÖÜ][a-zäöüß]{3,}', s))) / max(1, len(s) / 50)
    cand = [(fakten(s), i, s) for i, s in enumerate(S) if ok(s) and re.search(verb, s) and s not in g2 + g3]
    g4 = [s for _, i, s in sorted(sorted(cand, reverse=True)[:2], key=lambda a: a[1])]
    # R5 Zahlen: Betrag oder Prozent mit Vergleichswort
    g5 = [s for s in S if ok(s) and re.search(r'\d[\d.,]*\s?(Mio\.|Mrd\.|T€|€|Euro|%)', s)
          and re.search(r'(Vorjahr|VJ|gegenüber|Vergleich|insgesamt|Gesamtkosten|Kosten)', s) and s not in g2 + g3 + g4][:1]
    # R6 Fristen, Inkrafttreten, Genehmigung
    g6 = [s for s in S if ok(s) and re.search(r'(tritt .{0,60}in Kraft|bedarf der Genehmigung|spätestens|Frist)', s)
          and s not in g2 + g3 + g4 + g5][:1]
    return typ, (g2 + g3 + g4 + g5 + g6)[:5]


def main():
    ap = argparse.ArgumentParser(description='Allgemeine Regeln für RIS-Dokumente (Experiment)')
    ap.add_argument('quelle', help='Textdatei (pdftotext -layout) oder topics.json')
    ap.add_argument('--id', help='Vorgangs-ID in topics.json')
    ap.add_argument('--titel', help='Titelanfang in topics.json')
    a = ap.parse_args()
    if a.quelle.endswith('.json'):
        t = json.load(open(a.quelle, encoding='utf8'))['topics']
        c = [x for x in t if x.get('hasDocumentText') in (True, 'True')]
        if a.id:
            x = next(y for y in c if y['id'] == a.id)
        elif a.titel:
            x = next(y for y in c if y['title'].startswith(a.titel))
        else:
            x = random.choice([y for y in c if 3000 < len(y['sourceText']) < 30000])
        name, txt = x['title'], x['sourceText']
    else:
        name, txt = a.quelle, open(a.quelle, encoding='utf8').read()
    typ, sätze_ = extrahiere(txt)
    print('##', name, '| Typ-Wörter:', typ)
    for s in sätze_:
        print(' -', s)
    if not sätze_:
        print(' (nichts erkannt)')


if __name__ == '__main__':
    main()
