"""Video aus einem Datenblatt bauen, ohne handgeschriebenen Szenencode.
Aufruf: python3 auto.py <datenblatt.json> <Ausgabedatei.mp4>
Das Datenblatt kommt von `node scripts/social-video/sheet-cli.mjs <bericht.json> <Ort> [Stichtag]`.
Stimmen werden mit tts.sh erzeugt (Arbeitsordner SV_WORK, siehe README).
"""
import sys, os, json, subprocess, shutil, wave
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import videos as V
import base as b

STKEY = {'approved': 'beschlossen', 'rejected': 'abgelehnt', 'announced': 'angekündigt', 'consulting': 'beratung', 'recommended': 'empfehlung',
         'postponed': 'vertagt', 'info': 'kenntnis', 'unknown': 'offen'}
STANDLAB = {'Noch nicht beschlossen': 'NOCH NICHT BESCHLOSSEN', 'Noch nicht entschieden': 'NOCH NICHT ENTSCHIEDEN', 'Keine Sachentscheidung': 'KEINE SACHENTSCHEIDUNG'}
VERBS = ('bestätigt', 'beschließt', 'beauftragt', 'genehmigt', 'empfiehlt', 'beschlossen', 'zugestimmt')
MAX_TOTAL = 65.0
strip = lambda w: w.strip(',.„“[]…"():;')


def highlight(quote, title):
    tw = {strip(w).lower() for w in title.split() if len(strip(w)) >= 4}
    return {strip(w) for w in quote.split() if strip(w).lower() in tw or strip(w).lower() in VERBS or strip(w).isdigit()}


def build_cfg(sheet, out):
    st = sheet['stand']; key = st['statusKey']; V_ = V
    stampcol = V_.BLUE if key == 'approved' else V_.ORG if key == 'rejected' else (63, 63, 70)
    hl = highlight((sheet['zitat2'] or sheet['zitat']) + ' ' + sheet['zitat'], sheet['titel2'])
    PET, INK, GRAY2, W, MX, CW = V_.PET, V_.INK, V_.GRAY2, V_.W, V_.MX, V_.CW

    def kern(wt):  # Szene 2: Kernsatz, wird vorgelesen
        pill = b.pill(sheet['zitatHinweis'], 52, b.PETH, b.PETD, padx=36, pady=18)
        qs = 84
        while True:
            q = V_.hl_block('„' + sheet['zitat'] + '“', qs, set(), INK, INK, CW - 20)
            if q.height <= 800 or qs <= 52: break
            qs -= 4
        cap = b.text_block(f"{sheet['ort']} · {sheet['meta'][0].split(' · ')[0]}" if sheet['meta'] else sheet['ort'], 54, 'R', GRAY2, maxw=CW - 84)
        tc = max(V_.find(wt, strip(sheet['zitat'].split()[-1]), 4.0), V_.CUR_DUR - 4.0)
        els = V_.chips(cfg) + [V_.E(pill, MX, 350, 0.0, slide=0), V_.E(q, MX, 450, 0.5, dur=0.6),
                               V_.E(V_.ic.icon('doc', 64, PET), MX, 450 + q.height + 44, tc, dur=0.5, slide=0), V_.E(cap, MX + 84, 450 + q.height + 40, tc, dur=0.5)]
        return dict(bg=b.shimmer_bg().convert('RGB'), ring=(W - 60, 520, PET, 20, 5), els=els, marquee=None)

    def verlauf(wt):  # Szene 3: Verlauf der Sitzungen
        h = V_.big('Bisheriger Verlauf:', 74, INK, maxw=CW, w='S', tr=-0.02, lh=1.05)
        els = V_.chips(cfg) + [V_.E(h, MX, 360, 0.3, dur=0.6, slide=0)]
        y, tprev = 540, 0.0
        rows = sheet['verlauf']
        for k, v in enumerate(rows):
            l1 = V_.big(f"{v['datum']} · {v['committee']}", 58, INK, maxw=CW - 170, lh=1.05, tr=-0.02)
            l2 = b.text_block(v['result'], 52, 'R', GRAY2, maxw=CW - 170) if v['result'] else None
            hgt = max(130, l1.height + (l2.height + 10 if l2 else 0))
            tt = max(V_.find(wt, v['spokenDay'][:6], 1.5) - 0.3, 0.5, tprev + 0.8)
            if k == len(rows) - 1: tt = max(tt, V_.CUR_DUR - 4.0)
            tprev = tt
            els += [V_.slam(V_.ibadge('hall', 130), MX, y + (hgt - 130) // 2, tt, 0.3, 0.3), V_.E(l1, MX + 170, y, tt + 0.2, dur=0.4, slide=0)]
            if l2: els.append(V_.E(l2, MX + 170, y + l1.height + 10, tt + 0.2, dur=0.4, slide=0))
            y += hgt + 70
        print('AUTO_B_END', y - 70, flush=True)
        return dict(bg=b.shimmer_bg().convert('RGB'), ring=(W - 60, 520, PET, 20, 5), els=els, marquee=None)

    cfg = dict(source=sheet['quelle'], ort=sheet['ort'], out=out, ticker='', icon=sheet['themaIcon'], status=st['icon'], stamp=st['stamp'], stampcol=stampcol, ssize=160,
               t1=sheet['titel1'], t1s=100, t2=sheet['titel2'], t2s=90, beatsA=kern, beatsB=verlauf, stkey=STKEY[key],
               quote='„' + (sheet['zitat2'] or sheet['zitat']) + '“', quote_cap=sheet['zitatHinweis'], hl=hl, standword=st['word'], standkey=STKEY[key],
               standlab=STANDLAB.get(st['extra'], 'STAND'), stsize=150, metasize=52, meta='\n'.join(sheet['meta']),
               texts=[sheet['sprechtext'][str(i)] or '' for i in range(1, 7)])
    return cfg


def wavlen(p):
    w = wave.open(p); return w.getnframes() / w.getframerate()


def make_voices(sheet, vdir, fixed):
    here = os.path.dirname(os.path.abspath(__file__)); os.makedirs(vdir, exist_ok=True)
    for i in (4, 6): shutil.copy(f'{fixed}/v{i}.wav', f'{vdir}/v{i}.wav')
    for i in (1, 2, 3, 5):
        subprocess.run([f'{here}/tts.sh', vdir, str(i), sheet['sprechtext'][str(i)]], check=True)


def total_len(cfg, vdir):
    vo = [wavlen(f'{vdir}/v{i + 1}.wav') for i in range(6)]
    mins = [6.0, 7.0, 7.0, max(6.5, 0.07 * len(cfg['quote'])), 7.0, 8.5]; tails = [1.0, 2.5, 3.0, 1.0, 1.5, 1.0]
    return sum(round(max(m, x + V.LEAD + t), 2) for m, x, t in zip(mins, vo, tails))


if __name__ == '__main__':
    sheet = json.load(open(sys.argv[1])); outfile = sys.argv[2]
    if not sheet.get('ok'): sys.exit('Datenblatt unvollständig: ' + '; '.join(sheet.get('warnings', [])))
    if not sheet.get('zitat2'): print('HINWEIS: kein zweites Zitat, Szene 4 wiederholt das erste', flush=True)
    work = V.S_; vdir = f'{work}/tts/auto'; fixed = f'{work}/tts/o7'
    while True:
        cfg = build_cfg(sheet, f'{work}/vid13a')
        make_voices(sheet, vdir, fixed)
        tot = total_len(cfg, vdir)
        print('Gesamtlänge (geplant):', round(tot, 1), flush=True)
        if tot <= MAX_TOTAL or len(sheet['verlauf']) <= 2: break
        sheet['verlauf'] = sheet['verlauf'][1:]  # ältesten Verlaufseintrag weglassen
        sheet['sprechtext']['3'] = 'Bisher: ' + ' '.join(v['spoken'] for v in sheet['verlauf'])
        cfg = None
    V.run(cfg, vdir, outfile)
