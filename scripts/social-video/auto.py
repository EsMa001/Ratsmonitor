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

    from PIL import Image, ImageDraw

    def dot(d, col):
        S = d * 3; m = Image.new('L', (S, S), 0); ImageDraw.Draw(m).ellipse([0, 0, S - 1, S - 1], fill=255); m = m.resize((d, d), Image.LANCZOS)
        im = Image.new('RGBA', (d, d), tuple(col) + (255,)); im.putalpha(m); return im

    def grow_line(x, y0, y1, t0, dur=0.5):  # senkrechte Linie, die von oben nach unten wächst
        hgt = max(2, y1 - y0); frames = []
        for k in range(13):
            fr = Image.new('RGBA', (8, hgt), (0, 0, 0, 0)); ImageDraw.Draw(fr).rectangle([0, 0, 7, int(hgt * k / 12)], fill=tuple(PET) + (140,)); frames.append(fr)
        e = V_.E(frames[-1], x, y0, t0, dur=0.05, slide=0)
        e.anim = lambda t: frames[min(12, int(max(0.0, (t - t0) / dur) * 12))]
        return e

    def count_el(text, x, y, t0, dur=0.9):  # Betrag zählt hoch
        digits = ''.join(c for c in text if c.isdigit()); n = int(digits); tail = text[len(text.rstrip('€ ')) :] if False else ' €'
        steps = 24; frames = []
        for k in range(steps + 1):
            v = int(n * k / steps); frames.append(V_.big(f"{v:,}".replace(',', '.') + tail, 150, PET, tr=-0.05))
        e = V_.slam(frames[-1], x, y, t0, 0.2, 0.2)
        e.anim = lambda t: frames[min(steps, int(max(0.0, (t - t0) / dur) * steps))]
        return e, frames[-1].height

    def split_quote(text):  # wörtlich in drei Teile: Subjekt und Verb groß, Gegenstand in Petrol, Rest klein
        w = text.split(); idx = next((k for k, x in enumerate(w) if strip(x).lower() in VERBS or strip(x).lower() in ('wird', 'werden')), None)
        if idx is None or idx > 6: return None
        p1 = ' '.join(w[:idx + 1]); k = idx + 1; p2 = []
        while k < len(w) and len(' '.join(p2 + [w[k]])) <= 34 and strip(w[k]).lower() not in ('gemäß', 'als', 'zur', 'zum', 'für', 'und', 'zu'): p2.append(w[k]); k += 1
        if not p2: return None
        return p1, ' '.join(p2), ' '.join(w[k:])

    def align(words, wt):  # Zeit, zu der die Stimme jedes Wortes des Zitats beginnt (Zahlen sind ausgesprochen, daher mit Rückfall)
        out, j = [], 0
        for w in words:
            key = strip(w).lower()[:4]; hit = None
            for jj in range(j, min(len(wt), j + 4)):
                if strip(wt[jj][0]).lower()[:4] == key: hit = jj; break
            if hit is None: hit = min(len(wt) - 1, j)
            out.append(wt[hit][1]); j = min(len(wt) - 1, hit + 1)
        return out

    def layout(text, size, tr=-0.03, lh=1.05):
        font = b.F(size, 'S'); trp = tr * size
        lines = b.wrap(text, font, CW, trp); step = int(size * lh); sp = b.tlen(font, ' ', trp); pos = []
        for n, l in enumerate(lines):
            x = 0.0
            for wd in l.split(' '):
                w = b.tlen(font, wd, trp); pos.append((wd, x, n * step, w)); x += w + sp
        return pos, step * len(lines) + int(size * 0.4)

    def kern(wt):  # Szene 2: Kernsatz, jedes Wort erscheint, wenn es gesprochen wird; Kern groß, Rest klein
        pill = b.pill(sheet['zitatHinweis'], 52, b.PETH, b.PETD, padx=36, pady=18)
        els = V_.chips(cfg) + [V_.E(pill, MX, 350, 0.0, slide=0)]
        sfx, punch = [], []
        y = 450; text = sheet['zitat']; words = text.split(); times = align(words, wt)
        if sheet['betraege'] and not bars_on:
            e, hh = count_el(sheet['betraege'][0]['text'], MX - 4, y, 0.5); els.append(e); y += hh + 30; sfx.append((0.5, 'hit')); punch.append(0.5)
        parts = split_quote(text) or (text, '', '')
        sizes = [(150, INK), (124, PET), (72, GRAY2)] if split_quote(text) else [(92, INK)]
        plan = []
        for (sz, col), p in zip(sizes, parts):
            if not p: continue
            pos, hgt = layout(p, sz)
            while hgt > 560 and sz > 48: sz -= 6; pos, hgt = layout(p, sz)
            plan.append((sz, col, pos, hgt))
        used = sum(h_ + 24 for _, _, _, h_ in plan) + 110
        y = max(y, 430 + (1340 - 430 - used) // 2 + (y - 450))  # Block mittig zwischen Kopfzeile und Unterkante
        k0 = 0
        for sz, col, pos, hgt in plan:
            for n, (wd, x, dy, w) in enumerate(pos):
                im = b.text_block(wd, sz, 'S', col, maxw=int(w) + sz, tr_em=-0.03, lh=1.0)
                tw = max(times[min(k0 + n, len(times) - 1)] - 0.05, 0.3)
                els.append(V_.E(im, MX + int(x), y + dy, tw, dur=0.25, slide=22))
            tg = max(times[min(k0, len(times) - 1)] - 0.05, 0.3); sfx.append((tg, 'tick')); punch.append(tg)
            k0 += len(pos); y += hgt + 24
        cap = b.text_block(f"{sheet['ort']} · {sheet['meta'][0].split(' · ')[0]}" if sheet['meta'] else sheet['ort'], 54, 'R', GRAY2, maxw=CW - 84)
        tc = max(V_.find(wt, strip(text.split()[-1]), 4.0), V_.CUR_DUR - 4.0)
        els += [V_.E(V_.ic.icon('doc', 64, PET), MX, y + 20, tc, dur=0.5, slide=0), V_.E(cap, MX + 84, y + 16, tc, dur=0.5)]
        print('AUTO_A_END', y + 20 + 64, flush=True)
        return dict(bg=b.shimmer_bg().convert('RGB'), ring=(W - 60, 520, PET, 20, 5), els=els, marquee=None, sfx=sfx, punch=punch)

    items = [x for x in sheet.get('betraege', []) if x.get('label')][:3]
    bars_on = len(items) >= 2

    def bar_el(x, y, wpx, hpx, t0, dur=0.7):  # Balken wächst von links nach rechts
        frames = []
        for k in range(15):
            fr = Image.new('RGBA', (max(2, wpx), hpx), (0, 0, 0, 0)); ImageDraw.Draw(fr).rounded_rectangle([0, 0, max(2, int(wpx * k / 14)), hpx - 1], radius=14, fill=tuple(PET) + (255,)); frames.append(fr)
        e = V_.E(frames[-1], x, y, t0, dur=0.05, slide=0)
        e.anim = lambda t: frames[min(14, int(max(0.0, (t - t0) / dur) * 14))]
        return e

    def bars_scene(wt):  # Szene 4: Beträge als Balken, Länge nach Wert
        pill = b.pill('Beträge laut Vorlage', 52, b.PETH, b.PETD, padx=36, pady=18)
        els = V_.chips(cfg) + [V_.E(pill, MX, 350, 0.0, slide=0)]
        y = 470; mx = max(i_['value'] for i_ in items); sfx, punch = [], []; tprev = 0.0
        lab_s, amt_s, bh = (62, 92, 84) if len(items) == 2 else (54, 76, 70)
        for k, it in enumerate(items):
            lab = V_.big(it['label'], lab_s, INK, maxw=CW, tr=-0.02); amt = V_.big(it['text'], amt_s, PET, tr=-0.04)
            tl = max(V_.find(wt, it['label'][:5], 1.0) - 0.2, 0.4, tprev + 0.9)
            if k == len(items) - 1: tl = max(tl, V_.CUR_DUR - 4.0)
            tprev = tl; wpx = max(40, int(CW * it['value'] / mx))
            els += [V_.E(lab, MX, y, tl, dur=0.4), bar_el(MX, y + lab.height + 14, wpx, bh, tl + 0.2),
                    V_.slam(amt, MX, y + lab.height + 14 + bh + 10, tl + 0.9, 0.25, 0.3)]
            sfx += [(tl + 0.2, 'tick'), (tl + 0.9, 'hit')]; punch += [tl + 0.2]
            y += lab.height + 14 + bh + 10 + amt.height + 50
        print('AUTO_C_END', y - 50, flush=True)
        return dict(bg=b.shimmer_bg().convert('RGB'), ring=(W - 60, 520, PET, 20, 5), els=els, marquee=None, sfx=sfx, punch=punch)

    def verlauf(wt):  # Szene 3: Zeitleiste der Sitzungen (Punkte, wachsende Linie)
        h = V_.big('Bisheriger Verlauf:', 74, INK, maxw=CW, w='S', tr=-0.02, lh=1.05)
        els = V_.chips(cfg) + [V_.E(h, MX, 360, 0.3, dur=0.6, slide=0)]
        y, tprev, prev_c = 560 + max(0, 3 - len(sheet['verlauf'])) * 90, 0.0, None; sfx, punch = [], []
        rows = sheet['verlauf']; D = 60; cx = MX + D // 2
        for k, v in enumerate(rows):
            l1 = V_.big(f"{v['datum']} · {v['committee']}", 64, INK, maxw=CW - 130, lh=1.05, tr=-0.02)
            l2 = b.text_block(v['result'], 58, 'R', GRAY2, maxw=CW - 130) if v['result'] else None
            hgt = max(D, l1.height + (l2.height + 10 if l2 else 0))
            tt = max(V_.find(wt, v['spokenDay'][:6], 1.5) - 0.3, 0.5, tprev + 0.8)
            if k == len(rows) - 1: tt = max(tt, V_.CUR_DUR - 4.0)
            tprev = tt; sfx.append((tt, 'tick')); punch.append(tt)
            if prev_c is not None: els.append(grow_line(cx - 4, prev_c, y + D // 2, tt - 0.5))
            els += [V_.slam(dot(D, PET if k == len(rows) - 1 else GRAY2), MX, y, tt, 0.3, 0.3), V_.E(l1, MX + 100, y, tt + 0.2, dur=0.4, slide=0)]
            if l2: els.append(V_.E(l2, MX + 100, y + l1.height + 10, tt + 0.2, dur=0.4, slide=0))
            prev_c = y + D // 2; y += hgt + 130
        print('AUTO_B_END', y - 130, flush=True)
        return dict(bg=b.shimmer_bg().convert('RGB'), ring=(W - 60, 520, PET, 20, 5), els=els, marquee=None, sfx=sfx, punch=punch)

    cfg = dict(source=sheet['quelle'], ort=sheet['ort'], out=out, ticker='', icon=sheet['themaIcon'], status=st['icon'], stamp=st['stamp'], stampcol=stampcol, ssize=160,
               t1=sheet['titel1'], t1s=100, t2=sheet['titel2'], t2s=90, beatsA=kern, beatsB=verlauf, stkey=STKEY[key],
               quote='„' + (sheet['zitat2'] or sheet['zitat']) + '“', quote_cap=sheet['zitatHinweis'], hl=hl, standword=st['word'], standkey=STKEY[key],
               standlab=STANDLAB.get(st['extra'], 'STAND'), stsize=150, metasize=52, meta='\n'.join(sheet['meta']),
               texts=[sheet['sprechtext'][str(i)] or '' for i in range(1, 7)],
               hook_fast=True, sfx=True, naechste=sheet.get('naechste'), scene4=bars_scene if bars_on else None)
    return cfg


def wavlen(p):
    w = wave.open(p); return w.getnframes() / w.getframerate()


def make_voices(sheet, vdir, fixed):
    here = os.path.dirname(os.path.abspath(__file__)); os.makedirs(vdir, exist_ok=True)
    for i in (4, 6):
        if i == 4 and sheet['sprechtext'].get('4'): continue
        shutil.copy(f'{fixed}/v{i}.wav', f'{vdir}/v{i}.wav')
    for i in (1, 2, 3, 4, 5):
        if i == 4 and not sheet['sprechtext'].get('4'): continue
        subprocess.run([f'{here}/tts.sh', vdir, str(i), sheet['sprechtext'][str(i)]], check=True)


def total_len(cfg, vdir):
    vo = [wavlen(f'{vdir}/v{i + 1}.wav') for i in range(6)]
    mins = [6.0, 7.0, 7.0, max(6.5, 0.07 * len(cfg['quote'])), 7.0, 8.5]; tails = [1.0, 2.5, 3.0, 1.0, 1.5, 1.0]
    return sum(round(max(m, x + V.LEAD + t), 2) for m, x, t in zip(mins, vo, tails))


if __name__ == '__main__':
    sheet = json.load(open(sys.argv[1])); outfile = sys.argv[2]
    if not sheet.get('ok'): sys.exit('Datenblatt unvollständig: ' + '; '.join(sheet.get('warnings', [])))
    if not sheet.get('zitat2'): print('HINWEIS: kein zweites Zitat, Szene 4 wiederholt das erste', flush=True)
    if len([x for x in sheet.get('betraege', []) if x.get('label')][:3]) >= 2:
        sheet['sprechtext']['4'] = ' '.join(f"{x['label']}: {x['spoken']}." for x in [x for x in sheet['betraege'] if x.get('label')][:3])
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
