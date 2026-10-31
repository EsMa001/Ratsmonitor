import sys, os, subprocess, json, math, re
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kern as v
import base as b
from PIL import Image, ImageDraw, ImageFont
from multiprocessing import Pool

W, H, MX, CW, S_, FPS = v.W, v.H, v.MX, v.CW, v.S_, 30
E, rr, ease = v.E, v.rr, v.ease
PET, PETD, ORG, BLUE, INK, WHITE, DARK = b.PET, b.PETD, b.ORG, b.BLUE, b.INK, b.WHITE, b.DARK
LIGHT = (126, 214, 200)
GRAY2 = (82, 82, 91)
FADE, LEAD, TAIL = 0.2, 0.5, 1.0
NS = 6
TRANS = ['slideleft', 'wipeup', 'circleopen', 'slideup']
CAP_SIZE, CAP_Y = 62, 1310

def big(text, size, col, maxw=2000, lh=1.0, tr=-0.04, w='S'):
    im = b.text_block(text, size, w, col, maxw=maxw, tr_em=tr, lh=lh)
    if maxw >= 2000:
        bb = im.getchannel('A').getbbox()
        if bb: im = im.crop((max(0, bb[0] - 2), 0, min(im.width, bb[2] + 2), im.height))
    return im

import icons as ic

def hl_block(text, size, hl, col_hl, col_base, maxw, lh=1.16, tr_em=-0.012, weight='S'):
    font = b.F(size, weight); tr = tr_em * size
    lines = b.wrap(text, font, maxw, tr); step = int(size * lh)
    im = Image.new('RGBA', (maxw, step * len(lines) + int(size * 0.4)), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    for n, l in enumerate(lines):
        x = 0; tok = 0; 
        for i, ch in enumerate(l):
            if ch == ' ': tok += 1
            words = l.split(' ')
            w_ = words[min(tok, len(words) - 1)].strip(',.„“[]…"')
            col = col_hl if w_ in hl else col_base
            d.text((x, n * step), ch, font=font, fill=col)
            x += b.adv(font, l, i, tr)
    return im

def fit(text, size, maxw, **kw):
    while True:
        im = big(text, size, **kw) if False else None
        break
    return size

def ibadge(name, d, dark=False, col=PET):
    return ic.badge(name, d, WHITE, col, pad=0.19)

def fitbig(text, size, col, maxw, **kw):
    im = big(text, size, col, **kw)
    while im.width > maxw and size > 40:
        size -= 6; im = big(text, size, col, **kw)
    return im

def panel():
    im = b.shimmer_bg().convert('RGBA').crop((0, 0, W, H))
    d = ImageDraw.Draw(im); d.rectangle([0, 0, W, 16], fill=PET + (255,))
    return im

def P(e, pop=0.35):
    e.pop = pop; return e

def solid(col): return Image.new('RGB', (W, H), col)

# ---------- Wort-Zeiten ----------
def word_times(text, vo):
    words = text.split()
    n = [len(w) + 2 for w in words]; tot = sum(n); t = LEAD; out = []
    for w, k in zip(words, n):
        d = vo * k / tot; out.append((w, t, t + d)); t += d
    return out

def find(wt, key, default=0.5):
    for w, a, c in wt:
        if w.lower().startswith(key.lower()): return a
    return default

# ---------- Untertitel (Wort für Wort) ----------
FONT = None
def cap_chunks(wt):
    f = b.F(CAP_SIZE, 'S'); segs = []; cur = []
    for it in wt:
        cur.append(it)
        if re.search(r'[:,.;?!]$', it[0]): segs.append(cur); cur = []
    if cur: segs.append(cur)
    chunks = []
    for seg in segs:
        part = []; lines = 1; line = ''
        for it in seg:
            t = (line + ' ' + it[0]).strip()
            if b.tlen(f, t, 0) > CW - 60:
                if lines == 2: chunks.append(part); part = []; lines = 1; line = it[0]
                else: lines = 2; line = it[0]
            else: line = t
            part.append(it)
        if part: chunks.append(part)
    # kurze Reste an den vorigen Block hängen, wenn Platz
    out = []
    for c in chunks:
        if out and len(c) <= 2 and len(out[-1]) + len(c) <= 9 and not re.search(r'[.?!]$', out[-1][-1][0]):
            trial = out[-1] + c
            lines = 1; line = ''
            for it in trial:
                t = (line + ' ' + it[0]).strip()
                if b.tlen(f, t, 0) > CW - 60: lines += 1; line = it[0]
                else: line = t
            if lines <= 2: out[-1] = trial; continue
        out.append(c)
    return out

def render_chunk(chunk):
    f = b.F(CAP_SIZE, 'S'); lines = []; line = []
    for it in chunk:
        t = ' '.join(x[0] for x in line + [it])
        if line and b.tlen(f, t, 0) > CW - 60: lines.append(line); line = [it]
        else: line.append(it)
    lines.append(line)
    lh = int(CAP_SIZE * 1.28); h = lh * 2 + 20; off = (2 - len(lines)) * lh // 2
    parts = []
    for li, ln in enumerate(lines):
        lw = b.tlen(f, ' '.join(x[0] for x in ln), 0); x = (W - lw) / 2 - MX; sp = b.tlen(f, ' ', 0)
        for it in ln:
            ww = b.tlen(f, it[0], 0); parts.append((it, x, li * lh + 6 + off)); x += ww + sp
    def draw(col, which=None, alpha=255, pill=False):
        im = Image.new('RGBA', (CW, h), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
        if pill: im.alpha_composite(rr(CW, h, 30, (12, 16, 15), alpha=225))
        for it, x, y in parts:
            if which is not None and it is not which: continue
            if col == LIGHT:
                ww = b.tlen(f, it[0], 0); d.rounded_rectangle([x - 10, y + 2, x + ww + 10, y + lh - 4], radius=14, fill=LIGHT + (255,))
                d.text((x, y), it[0], font=f, fill=INK + (255,))
            else:
                d.text((x, y), it[0], font=f, fill=col + (alpha,), stroke_width=2, stroke_fill=(10, 14, 13, 230))
        return im
    return dict(parts=parts, base=draw(WHITE, alpha=170, pill=True), white={id(it): draw(WHITE, it) for it, x, y in parts},
                acc={id(it): draw(LIGHT, it) for it, x, y in parts}, t0=chunk[0][1], t1=chunk[-1][2] + 0.3)

# ---------- Hintergrund-Bausteine ----------
def dot_ring(color, alpha, size=1500):
    im = Image.new('RGBA', (size * 2, size * 2), (0, 0, 0, 0)); d = ImageDraw.Draw(im); c = size
    for n, r, dr in [(44, 700, 10), (34, 560, 9), (24, 420, 8), (16, 290, 7)]:
        for k in range(n):
            a = 2 * math.pi * k / n; x = c + r * 2 * math.cos(a) / 2 * 1.0; y = c + r * math.sin(a)
            d.ellipse([c + r * math.cos(a) - dr * 2, c + r * math.sin(a) - dr * 2, c + r * math.cos(a) + dr * 2, c + r * math.sin(a) + dr * 2], fill=color + (alpha,))
    return im.resize((size, size), Image.LANCZOS)

def marquee_strip(text, col_bg, col_fg):
    f = b.F(36, 'S'); unit = text + '   ·   '; uw = int(b.tlen(f, unit, 0.08 * 36)) + 10
    strip = Image.new('RGBA', (uw * 3, 76), col_bg + (255,)); d = ImageDraw.Draw(strip)
    for i in range(3): d.text((i * uw + 10, 16), unit.upper(), font=f, fill=col_fg + (255,))
    return strip, uw

def scrim():
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    for y in range(1180, H):
        a = int(215 * min(1, (y - 1180) / 260)); d.line([(0, y), (W, y)], fill=(12, 16, 15, a))
    return im
SCRIM = None

# ---------- Szenen ----------
def chips(cfg, t0=-1.0):
    lc = v.logo_chip()
    return [E(lc, MX, 190, t0, slide=0, shadow=True), E(v.ort_chip(cfg['ort'], lc.height), MX + lc.width + 20, 190, t0, slide=0, shadow=True)]

def stamp(text, col, size, rot=-5):
    t = big(text, size, WHITE, tr=-0.02)
    while t.width + 150 > 860 and size > 60:
        size -= 6; t = big(text, size, WHITE, tr=-0.02)
    im = rr(t.width + 150, t.height + 30, 22, col); im.alpha_composite(t, (75, 8))
    return im.rotate(rot, resample=Image.BICUBIC, expand=True)

def slam(img, x, y, t0, pop=0.5, dur=0.28): return P(E(img, x, y, t0, dur=dur, slide=0), pop)

def shake_stamp(text, col, size, cx, y, t0, dur=1.0):
    """Stempel schlaegt ein und wackelt nach (Winkel klingt ab)."""
    rots = [-5 + 4.0 * math.exp(-k / 6.0) * math.cos(k * 0.9) for k in range(0, 40)]
    ims = []
    for r in rots:
        im = stamp(text, col, size, rot=r); ims.append(im)
    Wm = max(i.width for i in ims); Hm = max(i.height for i in ims)
    fr = []
    for im in ims:
        c = Image.new('RGBA', (Wm, Hm), (0, 0, 0, 0)); c.alpha_composite(im, ((Wm - im.width) // 2, (Hm - im.height) // 2)); fr.append(c)
    e = slam(fr[0], cx - Wm // 2, y, t0, 0.9, 0.3)
    e.anim = lambda t: fr[min(len(fr) - 1, max(0, int((t - t0 - 0.12) * 30)))] if t >= t0 + 0.12 else fr[0]
    return e, Hm

def url_pulse(u, x, y, t0):
    pad = 24; Wc, Hc = u.width + 2 * pad, u.height + 2 * pad; fr = []
    for k in range(60):
        sc = 1.0 + 0.04 * max(0.0, math.sin(k / 60.0 * 2 * math.pi))
        im = u.resize((int(u.width * sc), int(u.height * sc)), Image.BICUBIC)
        c = Image.new('RGBA', (Wc, Hc), (0, 0, 0, 0)); c.alpha_composite(im, ((Wc - im.width) // 2, (Hc - im.height) // 2)); fr.append(c)
    e = slam(fr[0], x - pad, y - pad, t0 - 0.35, 0.3, 0.3)
    e.anim = lambda t: fr[int(max(0.0, t - t0) * 30) % 60]
    return e

def pulse_badge(name, d, cx, y, t0):
    base = ibadge(name, d, dark=True); Wc = int(d * 1.1)
    fr = []
    for k in range(60):
        sc = 1.0 + 0.045 * math.sin(k / 60.0 * 2 * math.pi)
        im = base.resize((int(d * sc), int(d * sc)), Image.BICUBIC)
        c = Image.new('RGBA', (Wc, Wc), (0, 0, 0, 0)); c.alpha_composite(im, ((Wc - im.width) // 2, (Wc - im.height) // 2)); fr.append(c)
    e = slam(fr[0], cx - Wc // 2, y, t0, 0.5, 0.3)
    e.anim = lambda t: fr[int(max(0.0, t - t0) * 30) % 60]
    return e, Wc

def make(cfg):
    sc = []
    # 1 Hook
    def hook(wt):
        els = chips(cfg)
        st = stamp(cfg['stamp'], cfg['stampcol'], cfg['ssize'])
        t1 = None
        for _s in range(cfg['t1s'] + 46, cfg['t1s'] - 20, -2):
            t1 = big(cfg['t1'], _s, INK, lh=1.0)
            if t1.width <= CW: break
        t2 = big(cfg['t2'], cfg['t2s'] + 10, cfg.get('t2col', PET), maxw=CW, lh=1.02)
        sh0 = stamp(cfg['stamp'], cfg['stampcol'], cfg['ssize']).height + 30
        G1, G2, G3, IB = 40, 90, 70, 300
        y0 = 400
        while y0 + t1.height + G1 + t2.height + G2 + sh0 + G3 + IB > 1440 and (IB > 220 or G2 > 50):
            if IB > 220: IB -= 20
            if G2 > 50: G2 -= 10
            G3 = max(40, G3 - 5)
        bottom = y0 + t1.height + G1 + t2.height + G2 + sh0 + G3 + IB
        if bottom > 1440: y0 = max(370, y0 - (bottom - 1440))
        yt2 = y0 + t1.height + G1; ys_ = yt2 + t2.height + G2
        fast = cfg.get('hook_fast')
        tst = min(1.0, max(0.25, find(wt, cfg['stkey'], 0.8) - 0.3)) if fast else min(4.2, max(1.8, find(wt, cfg['stkey'], 2.6) - 0.3))
        tt2 = 0.45 if fast else 0.5  # Thema sofort sichtbar, nicht erst beim Sprechen
        se, sh = shake_stamp(cfg['stamp'], cfg['stampcol'], cfg['ssize'], W // 2 + 5, ys_, tst)
        pe, pw = pulse_badge(cfg['icon'], IB, W // 2, ys_ + sh + G3 - 20, 0.5)
        els += [slam(t1, MX, y0, -1.0, 0, 0.01), slam(t2, MX, yt2, tt2, 0.2), se, pe]
        return dict(bg=b.shimmer_bg().convert('RGB'), ring=(W - 120, 1000, PET, 22, 6), els=els, marquee=(PET, WHITE), punch=[tst, tt2], sfx=[(tst, 'hit'), (tt2, 'tick')])
    # 2 Beats
    def beatsA(wt): return cfg['beatsA'](wt)
    def beatsB(wt): return cfg['beatsB'](wt)
    # 3 Zitat (still, zum Lesen)
    def quote_scene(wt):
        qs = 92
        while True:
            q = hl_block(cfg['quote'], qs, cfg['hl'], INK, (82, 82, 91), CW - 20)
            _f = b.F(qs, 'S')
            if (q.height <= 800 and max(_f.getlength(w_.strip()) for w_ in cfg['quote'].split()) <= CW - 40) or qs <= 48: break
            qs -= 2
        cap = b.text_block(cfg['quote_cap'] + ' · ' + cfg['ort'], 54, 'R', GRAY2, maxw=CW - 80)
        tot_ = q.height + 70 + cap.height
        Y0 = 400 + max(0, (1040 - tot_) // 2)
        els = chips(cfg) + [E(q, MX, Y0, 0.15, dur=0.6), E(ic.icon('doc', 64, PET), MX, Y0 + q.height + 44, 1.6, dur=0.5, slide=0), E(cap, MX + 84, Y0 + q.height + 40, 1.6, dur=0.5, slide=0)]
        return dict(bg=b.shimmer_bg().convert('RGB'), ring=(W - 100, 300, PET, 22, -5), els=els, marquee=(PET, WHITE))
    # 3b Status
    def status_scene(wt):
        sb = ibadge(cfg['status'], 300, col=cfg['stampcol'])
        st = fitbig(cfg['standword'], cfg['stsize'], INK, CW, lh=1.0)
        ta = min(max(find(wt, cfg['standkey'], 1.2) - 0.5, 0.3), 0.8)
        lab = b.text_block(cfg.get('standlab', 'STAND'), 48, 'S', GRAY2, maxw=CW, tr_em=0.14)
        y = 430
        band = Image.new('RGBA', (W, 60 + 300 + 30 + st.height + 70), tuple(cfg['stampcol']) + (30,))
        els = chips(cfg) + [E(band, 0, y, 0, dur=0.4, slide=0), E(lab, MX, y + 36, 0, dur=0.4, slide=0), slam(sb, (W - 300) // 2, y + 100, ta, 0.5, 0.4), slam(st, (W - st.width) // 2, y + 100 + 300 + 30, ta + 0.4, 0.4, 0.4)]
        yy = y + 60 + 300 + 30 + st.height + 50 + 60
        nrows = len(cfg['meta'].split('\n'))
        for k, row in enumerate(cfg['meta'].split('\n')):
            row = row.replace(' · ', '\n')
            mi = ic.icon(['calendar', 'hall'][k], 68, PET); mt = big(row, cfg.get('metasize', 60), INK, maxw=CW - 100, w='R', lh=1.15, tr=-0.01)
            tm = ta + 1.2 + 0.5 * k
            if k == nrows - 1: tm = max(tm, CUR_DUR - 4.0)
            els += [E(mi, MX, yy + 4, tm, dur=0.5), E(mt, MX + 90, yy, tm, dur=0.5)]
            yy += mt.height + 40
        sfx = [(ta, 'hit'), (ta + 0.4, 'tick')]
        return dict(bg=b.shimmer_bg().convert('RGB'), ring=(W - 100, 300, PET, 22, -5), els=els, marquee=(PET, WHITE), punch=[ta, ta + 0.4], sfx=sfx)
    # 4 Plenara + Ende
    def plen(wt):
        t = big('Beschlüsse zu Ihrem Ort', 100, INK, maxw=700, lh=1.0); t2 = big('finden Sie bei', 64, PET, w='S', tr=-0.01)
        chip = b.logo_at(520, dark=False)
        sl = big('Besser verstehen, was vor Ort beraten wird.', 64, INK, maxw=CW, lh=1.1, tr=-0.02)
        ut = big('plenara.de', 104, WHITE, tr=-0.035); u = rr(ut.width + 110, ut.height + 40, 44, PET); u.alpha_composite(ut, (55, 20))
        q = b.text_block(cfg['source'], 50, 'R', INK, maxw=CW); dis = b.text_block('Zusammenfassung von Plenara, kein amtliches Dokument.', 48, 'R', INK, maxw=CW)
        y0 = 190; yp = y0 + t.height + 24; yc = yp + 84 + 20; ys = yc + chip.height + 40; yu = ys + sl.height + 40; yq = yu + u.height + 46
        print('OUTRO_END', yq + q.height + 14 + dis.height, flush=True)
        els = [slam(t, MX, y0, -1.0, 0, 0.01), E(ic.icon('pin', 76, PET), MX, yp + 4, 0.4), E(t2, MX + 96, yp + 6, 0.4), slam(chip, MX, yc, 0.3, 0.45, 0.35),
               E(sl, MX, ys, 1.1, dur=0.5), url_pulse(u, MX, yu, 1.5),
               E(q, MX, yq, 1.6, slide=0), E(dis, MX, yq + q.height + 14, 1.6, slide=0)]
        return dict(bg=b.shimmer_bg().convert('RGB'), ring=(W // 2, 1250, PET, 34, 5), els=els, marquee=None, punch=[0.3, 1.5], sfx=[(0.3, 'hit'), (1.5, 'tick')])
    for f_ in (hook, beatsA, beatsB, quote_scene, status_scene, plen, cfg.get('scene4')):
        if f_: f_.caption = False
    return [hook, beatsA, beatsB, cfg.get('scene4') or quote_scene, status_scene, plen]

# ---------- Renderer ----------
SCENES = []; CAPTIONS = []; CFG = None; CUR_DUR = 0

def render_scene(args):
    global CUR_DUR
    i, dur, vo, text, t_start, t_total = args
    CUR_DUR = dur
    wt = word_times(text, vo) if text else []
    sd = SCENES[i](wt)
    bg = sd['bg']; els = sd['els']
    punch = sd.get('punch', []) if CFG.get('sfx') else []
    json.dump(sd.get('sfx', []) if CFG.get('sfx') else [], open(f"{CFG['out']}/sfx_{i + 1}.json", 'w'))
    chunks = [render_chunk(c) for c in cap_chunks(wt)] if SCENES[i].caption and wt else []
    for a_, b_ in zip(chunks, chunks[1:]): a_['t1'] = min(a_['t1'], b_['t0'] - 0.05)
    ring = None
    if sd.get('ring'):
        cx, cy, col, al, spd = sd['ring']; ring = (dot_ring(col, al), cx, cy, spd)
    mq = None
    if False: mq = marquee_strip(CFG['ticker'], *sd['marquee'])
    scr = None
    OUT = CFG['out']
    nfr = int((dur + (FADE if i < NS - 1 else 0)) * FPS)
    cmd = ['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
           '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '16', '-pix_fmt', 'yuv420p', f'{OUT}/c{i + 1}.mp4']
    pr = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for fr in range(nfr):
        t = fr / FPS
        base = bg.copy()
        if ring:
            r, cx, cy, spd = ring; rot = r.rotate(t * spd * 6, resample=Image.BICUBIC)
            base.paste(rot, (cx - r.width // 2, cy - r.height // 2), rot)
        im = base.convert('RGBA')
        for e in els:
            if t < e.t0: continue
            p = ease((t - e.t0) / e.dur); img = e.anim(t) if getattr(e, 'anim', None) else e.img
            if p < 1:
                img = img.copy(); img.putalpha(img.getchannel('A').point(lambda a, p=p: int(a * p)))
            ox, oy = e.x, e.y + int(e.slide * (1 - p)); pop = getattr(e, 'pop', 0)
            if pop and p < 1:
                s = 1 + pop * (1 - p) ** 2; nw, nh = int(img.width * s), int(img.height * s)
                ox -= (nw - img.width) // 2; oy -= (nh - img.height) // 2; img = img.resize((nw, nh), Image.BICUBIC)
            im.alpha_composite(img, (ox, oy)) if (ox >= 0 and oy >= 0 and ox + img.width <= W and oy + img.height <= H) else im.paste(img, (ox, oy), img)
        im.paste(Image.new('RGBA', (max(1, int(W * min(1.0, (t_start + t) / t_total))), 16), PET + (255,)), (0, 0))
        if scr: im.alpha_composite(scr)
        if mq:
            strip, uw = mq; x = int((t * 170) % uw)
            im.paste(strip.crop((x, 0, x + W, 76)), (0, 1262))
        for ch in chunks:
            if ch['t0'] - 0.05 <= t < ch['t1']:
                a = ease((t - ch['t0'] + 0.05) / 0.12)
                lay = ch['base'].copy()
                for it, x, y in ch['parts']:
                    if t >= it[1]:
                        lay.alpha_composite(ch['acc' if (it[1] <= t < it[2]) else 'white'][id(it)])
                if a < 1: lay.putalpha(lay.getchannel('A').point(lambda v_, a=a: int(v_ * a)))
                im.alpha_composite(lay, (MX, CAP_Y))
        zoom = 1 + 0.04 * min(1, t / dur)
        for tp in punch:
            if tp <= t < tp + 0.8: zoom += 0.028 * math.exp(-(t - tp) / 0.11)
        out = im.convert('RGB')
        if i != NS - 1:
            bw, bh = W / zoom, H / zoom; x0, y0 = (W - bw) / 2, (H - bh) / 2
            out = out.resize((W, H), Image.BICUBIC, box=(x0, y0, x0 + bw, y0 + bh))
        pr.stdin.write(out.tobytes())
    pr.stdin.close(); pr.wait()
    return i

def run(cfg, vdir, outfile):
    global SCENES, CFG
    CFG = cfg; SCENES = make(cfg); os.makedirs(cfg['out'], exist_ok=True)
    vo = [v.wavlen(f'{vdir}/v{i + 1}.wav') for i in range(NS)]
    mins = [6.0, 7.0, 7.0, max(6.5, 0.05 * len(cfg['quote'])), 7.0, 5.0]
    tails = [1.0, 2.5, 3.0, 1.0, 1.5, 1.0]
    durs = [round(max(m, x + LEAD + t_), 2) for m, x, t_ in zip(mins, vo, tails)]
    print('durs', durs, round(sum(durs), 2), flush=True)
    tot = sum(durs); st_ = [sum(durs[:i]) for i in range(NS)]
    jobs = [(i, durs[i], vo[i], cfg['texts'][i], st_[i], tot) for i in range(NS)]
    with Pool(3) as pool:
        for r in pool.imap_unordered(render_scene, jobs): pass
    inputs = []
    for i in range(NS): inputs += ['-i', f"{cfg['out']}/c{i + 1}.mp4"]
    filt = ''; prev = '[0:v]'; off = 0; starts = [0]
    for i in range(1, NS):
        off += durs[i - 1]; starts.append(off)
        filt += f"{prev}[{i}:v]xfade=transition={TRANS[(i - 1) % 4]}:duration={FADE}:offset={off:.2f}[v{i}];"; prev = f'[v{i}]'
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', *inputs, '-filter_complex', filt.rstrip(';'), '-map', prev, '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', f"{cfg['out']}/video_only.mp4"], check=True)
    json.dump({'durs': durs, 'starts': starts, 'sfx': bool(cfg.get('sfx'))}, open(f"{cfg['out']}/timing.json", 'w'))
    subprocess.run(['python3', '-I', f'{b.HERE}/remix.py', cfg['out'], vdir, outfile], check=True)
    subprocess.run([f'{b.HERE}/loud.sh', outfile], check=True)

# ---------------- Halle ----------------
def cnt_el(final, x, y, t0, upto=50, dur=0.75):
    frames = []
    for k in range(upto + 1):
        im = big(str(k), 400, PET, tr=-0.06); fr = Image.new('RGBA', final.size, (0, 0, 0, 0)); fr.alpha_composite(im, (0, 0)); frames.append(fr)
    e = slam(final, x, y, t0, 0.2, 0.3)
    e.anim = lambda t: frames[min(upto, int(max(0.0, (t - t0) / dur) * upto))]
    return e

def halle_A(wt):
    cfg = HAL
    tL = find(wt, 'Laubb', 1.6)
    pill = b.pill('Antrag der AfD-Stadtratsfraktion', 52, b.PETH, b.PETD, padx=36, pady=18)
    n = big('50', 340, PET, tr=-0.06); cm = big('cm', 130, PET, tr=-0.03)
    t = big('Der Antrag sah vor: ab diesem Stammumfang sollten Laubbäume unter die Satzung fallen.', 70, INK, maxw=CW, lh=1.12, tr=-0.015)
    s_ = b.text_block('gemessen in 100 cm Höhe', 60, 'R', GRAY2, maxw=CW)
    els = chips(cfg) + [E(pill, MX, 350, 0.0, slide=0), slam(n, MX, 450, 0.4, 0.4, 0.4), slam(cm, MX + n.width - 30, 450 + n.height - cm.height - 20, 1.0, 0.4, 0.3),
                        slam(ibadge('tree_measure', 260), W - MX - 260, 540, 1.4, 0.5, 0.3),
                        E(t, MX, 450 + n.height + 40, max(tL, 2.0), dur=0.6), E(s_, MX, 450 + n.height + 40 + t.height + 24, max(tL, 2.0) + 1.6, dur=0.6, slide=0)]
    return dict(bg=b.shimmer_bg().convert('RGB'), ring=(W - 60, 520, PET, 20, 5), els=els, marquee=(PET, WHITE))

def halle_B(wt):
    cfg = HAL
    n2 = big('1:1', 300, PET, tr=-0.06)
    t2 = big('Ersatzpflanzung nur in diesem Verhältnis bei Ein-, Zweifamilien- und Reiheneinfamilienhäusern', 62, INK, maxw=CW, lh=1.12, tr=-0.015)
    s2 = b.text_block('sowie Wochenendgrundstücken, die überwiegend der Erholung dienen', 54, 'R', GRAY2, maxw=CW)
    pl2 = b.pill('Antrag der AfD-Stadtratsfraktion', 52, b.PETH, b.PETD, padx=36, pady=18)
    els = chips(cfg) + [E(pl2, MX, 350, 0.0, slide=0), slam(n2, MX, 450, 0.4, 0.5, 0.3), slam(ibadge('house', 260, dark=True), W - MX - 260, 520, 1.1, 0.5, 0.3),
            E(t2, MX, 450 + n2.height + 40, 1.7, dur=0.6), E(s2, MX, 450 + n2.height + 40 + t2.height + 24, 2.8, dur=0.6, slide=0)]
    return dict(bg=b.shimmer_bg().convert('RGB'), ring=(W - 60, 520, PET, 20, 5), els=els, marquee=(PET, WHITE))

def dresden_A(wt):
    cfg = DRE
    els = chips(cfg)
    ws = ['Hitze', 'kann die', 'Gesundheit', 'gefährden.']; ts_ = [0.4, 1.4, 2.4, 3.4]
    y = 420
    for wd, tt in zip(ws, ts_):
        im = big(wd, 250 if wd == 'Hitze' else 178 if wd == 'kann die' else 186, INK if wd != 'gefährden.' else PET, tr=-0.05)
        els.append(slam(im, MX - 6, y, tt, 0.45, 0.35)); y += int(im.height * 0.97)
    els.append(slam(ibadge('thermo', 300), W - MX - 300, 460, 0.8, 0.5, 0.3))
    return dict(bg=b.shimmer_bg().convert('RGB'), ring=(W - 60, 520, PET, 20, 5), els=els, marquee=(PET, WHITE))

def dresden_B(wt):
    cfg = DRE
    els = chips(cfg)
    h = big('Laut Plan besonders gefährdet:', 80, INK, maxw=CW, w='S', tr=-0.02, lh=1.05)
    els += [E(h, MX, 350, 0.3, dur=0.6, slide=0)]
    y = 580
    rows = [('Ältere Menschen', 'ältere', 'elder'), ('Vorerkrankte', 'Vorerk', 'heart'), ('Kinder', 'Kinder', 'child'), ('Sozial Benachteiligte', 'sozial', 'group')]
    for wd, k, icn in rows:
        im = big(wd, 84, INK, maxw=CW - 240, lh=0.98, tr=-0.035); tt = max(min(find(wt, k, 1.5) - 0.2, 1.4 + 0.9 * rows.index((wd, k, icn))), 0.5)
        els += [slam(ibadge(icn, 176, dark=True), MX, y, tt, 0.3, 0.3), E(im, MX + 214, y + (176 - im.height) // 2, tt + 0.25, dur=0.4, slide=0)]
        y += 176 + 62
    return dict(bg=b.shimmer_bg().convert('RGB'), ring=(W - 60, 520, PET, 20, 5), els=els, marquee=(PET, WHITE))

HAL = dict( source='Quelle: öffentliche Ratsunterlagen der Stadt Halle (Saale)', ort='Halle (Saale)', out=f'{S_}/vid8h', ticker='Halle (Saale) · Stadtrat · Baumschutzsatzung · Antrag',
    icon='tree', status='cross', stamp='ABGELEHNT', stampcol=ORG, ssize=168, t1='Baumschutzsatzung Halle:', t1s=96, t2='Antrag der AfD-Stadtratsfraktion', t2s=66, t2col=GRAY2, beatsA=halle_A, beatsB=halle_B, stkey='abgelehnt',
    quote='„[…] Laubbäume, die in 100 cm Höhe über dem Erdboden einen Stammumfang von mindestens 50 cm aufweisen.“',
    quote_cap='Aus der Vorlage', hl={'mindestens','50','cm','Laubbäume'}, standword='Abgelehnt', standkey='abgelehnt', stsize=190, meta='Stadtrat · zuletzt beraten am 28.10.26',
    texts=['Halle: Antrag der AfD zur Baumschutzsatzung abgelehnt.',
           'Der Antrag sah vor: Laubbäume ab 50 cm Stammumfang sollten unter die Satzung fallen.', 'Ersatzpflanzung bei Wohngrundstücken nur im Verhältnis 1:1.', '',
           'Stand: abgelehnt. Zuletzt beraten am 28.10.26.',
           'Beschlüsse und Unterlagen zu Ihrem Ort finden Sie bei Plenara.'])

DRE = dict(source='Quelle: öffentliche Ratsunterlagen der Landeshauptstadt Dresden', ort='Dresden', out=f'{S_}/vid8d', ticker='Dresden · Stadtrat · Hitzeaktionsplan 2026 bis 2030',
    icon='thermo', status='check', stamp='BESCHLOSSEN', stampcol=BLUE, ssize=160, t1='Hitze in Dresden:', t1s=108, t2='Hitzeaktionsplan 2026 bis 2030', t2s=94, beatsA=dresden_A, beatsB=dresden_B, stkey='beschlossen',
    quote='„Der Stadtrat bestätigt den Hitzeaktionsplan 2026 bis 2030 der Landeshauptstadt Dresden.“',
    quote_cap='Aus der Vorlage', hl={'bestätigt','Hitzeaktionsplan','2026','2030'}, standword='Beschlossen', standkey='beschlossen', stsize=170, meta='Stadtrat · zuletzt beraten am 29.10.26',
    texts=['Dresden: Der Stadtrat hat den Hitzeaktionsplan beschlossen.',
           'Hitze kann die Gesundheit gefährden.', 'Laut Hitzeaktionsplan besonders gefährdet: ältere Menschen, Vorerkrankte, Kinder und sozial Benachteiligte.', '',
           'Stand: beschlossen. Zuletzt beraten am 29.10.26.',
           'Beschlüsse und Unterlagen zu Ihrem Ort finden Sie bei Plenara.'])


def bil_A(wt):
    cfg = BIL
    pill = b.pill('Empfehlung aus der Vorlage', 52, b.PETH, b.PETD, padx=36, pady=18)
    w1 = big('Förderung', 150, PET, tr=-0.05); w2 = big('empfohlen', 150, PET, tr=-0.05)
    t = big('Der Begutachterausschuss hat die Maßnahmen zur Förderung empfohlen.', 70, INK, maxw=CW, lh=1.12, tr=-0.015)
    s_ = b.text_block('EFRE/JTF-Programm 2021–2027, Klimaanpassung.Kommunen.NRW', 60, 'R', GRAY2, maxw=CW)
    els = chips(cfg) + [E(pill, MX, 350, 0.0, slide=0), slam(w1, MX - 6, 470, 0.4, 0.5, 0.3), slam(w2, MX - 6, 470 + w1.height + 10, 1.2, 0.5, 0.3), slam(ibadge('coin', 180), W - MX - 180, 490, 0.9, 0.5, 0.3),
                        E(t, MX, 470 + w1.height + w2.height + 100, 2.0, dur=0.6), ]
    return dict(bg=b.shimmer_bg().convert('RGB'), ring=(W - 60, 520, PET, 20, 5), els=els, marquee=None)

def bil_B(wt):
    cfg = BIL
    els = chips(cfg)
    h = big('Der Vorschlag laut Vorlage:', 74, INK, maxw=CW, w='S', tr=-0.02, lh=1.05)
    els += [E(h, MX, 360, 0.3, dur=0.6, slide=0)]
    y = 540
    rows = [('Förderantrag stellen', 'Förderantrag', 'doc'), ('Mittel einstellen', 'Mittel', 'coin'), ('Planungen beauftragen', 'Planungen', 'pencil'), ('Bau ausschreiben', 'Bau', 'crane')]
    y_first = y
    for wd, k, icn in rows:
        im = big(wd, 84, INK, maxw=CW - 240, lh=0.98, tr=-0.035); tt = max(min(find(wt, k, 1.5) - 0.2, 1.4 + 0.9 * rows.index((wd, k, icn))), 0.5)
        els += [slam(ibadge(icn, 176, dark=True), MX, y, tt, 0.3, 0.3), E(im, MX + 214, y + (176 - im.height) // 2, tt + 0.25, dur=0.4, slide=0)]
        if y > y_first: els.insert(len(els) - 2, E(Image.new('RGBA', (8, 62 + 20), PET + (110,)), MX + 84, y - 62 - 10, tt - 0.05, dur=0.3, slide=0))
        y += 176 + 62
    return dict(bg=b.shimmer_bg().convert('RGB'), ring=(W - 60, 520, PET, 20, 5), els=els, marquee=None)

BIL = dict(source='Quelle: öffentliche Ratsunterlagen der Stadt Billerbeck', ort='Billerbeck', out=f'{S_}/vid8b', ticker='',
    icon='rain', status='hourglass', stamp='STAND OFFEN', stampcol=(63, 72, 80), ssize=168, t1='Billerbeck:', t1s=96, t2='Starkregenschutz Weihgarten', t2s=84, beatsA=bil_A, beatsB=bil_B, stkey='offen',
    quote='„Der Förderantrag bei der Bezirksregierung Münster […] wird gestellt, die notwendigen Mittel im Haushalt eingestellt […]“',
    quote_cap='Aus der Vorlage', hl={'Förderantrag','gestellt','Mittel','Haushalt','eingestellt'}, standword='Stand offen', standkey='offen', standlab='NOCH NICHT BESCHLOSSEN', stsize=150, meta='Rat der Stadt · zuletzt beraten am 13.10.26\nDavor: Umweltausschuss, 10.09.26',
    texts=['Billerbeck: Starkregenschutz Weihgarten. Der Stand ist offen.',
           'Förderung empfohlen.', 'Der Vorschlag: Förderantrag stellen, Mittel einstellen, Planungen beauftragen, Bau ausschreiben.', '',
           'Stand: offen. Rat der Stadt, zuletzt beraten am 13.10.26.',
           'Beschlüsse und Unterlagen zu Ihrem Ort finden Sie bei Plenara.'])


def lbadge(letter, d, col=PET):
    S = d * 3
    base = Image.new('L', (S, S), 0); ImageDraw.Draw(base).ellipse([0, 0, S - 1, S - 1], fill=255)
    base = base.resize((d, d), Image.LANCZOS)
    im = Image.new('RGBA', (d, d), tuple(col) + (255,)); im.putalpha(base)
    g = big(letter, int(d * 0.62), WHITE, tr=-0.02)
    im.alpha_composite(g, ((d - g.width) // 2, (d - g.height) // 2 - int(d * 0.02)))
    return im

def nth(wt, key, n, default=1.5):
    k = 0
    for w, a, c in wt:
        if w.lower().startswith(key.lower()):
            if k == n: return a
            k += 1
    return default

def clamp(x, lo, hi): return max(lo, min(hi, x))

def ost_A(wt):
    cfg = OST
    els = chips(cfg)
    h = big('Zwei Varianten zur Wahl:', 74, INK, maxw=CW, w='S', tr=-0.02, lh=1.05)
    els += [E(h, MX, 360, 0.3, dur=0.6, slide=0)]
    y = 560
    rows = [('A', 'Quartier Zentrum nördlich der Möllner Landstraße', nth(wt, 'variante', 1)), ('B', 'Quartiere Ziegeleistraße und Grenzweg', nth(wt, 'variante', 2))]
    tprev = 0.5
    for letter, txt, tv in rows:
        im = big(txt, 76, INK, maxw=CW - 240, lh=1.02, tr=-0.03)
        tt = clamp(tv - 0.2, tprev + 0.9, 2.2 + 2.0 * (tprev > 0.5)); tprev = tt
        els += [slam(lbadge(letter, 176), MX, y, tt, 0.3, 0.3), E(im, MX + 214, y + (176 - im.height) // 2 if im.height < 176 else y, tt + 0.25, dur=0.4, slide=0)]
        y += max(176, im.height) + 110
    return dict(bg=b.shimmer_bg().convert('RGB'), ring=(W - 60, 520, PET, 20, 5), els=els, marquee=None)

def ost_B(wt):
    cfg = OST
    pill = b.pill('Förderantrag bereits beschlossen', 52, b.PETH, b.PETD, padx=36, pady=18)
    els = chips(cfg) + [E(pill, MX, 350, 0.0, slide=0)]
    y = 470
    blocks = [('2027–2029', 'dreijährige Projektlaufzeit', 'drei', 'calendar'), ('225.000 €', 'Gesamtausgaben, bis zu', 'zweihundert', 'coin'), ('22.500 €', 'kommunaler Eigenanteil, bis zu', 'zweiundzwanzig', 'coin')]
    tprev = -0.3
    for num, lab, key, icn in blocks:
        n = big(num, 118, PET, tr=-0.05); l = b.text_block(lab, 56, 'R', GRAY2, maxw=CW)
        tt = clamp(find(wt, key, 2.0) - 0.4, tprev + 1.0, 1.4 if tprev < 0 else 9.0); tprev = tt
        els += [slam(n, MX - 4, y, tt, 0.5, 0.3), slam(ibadge(icn, 130), W - MX - 130, y + (n.height - 130) // 2, tt + 0.1, 0.4, 0.3), E(l, MX, y + n.height + 14, tt + 0.5, dur=0.5, slide=0)]
        y += n.height + 12 + l.height + 64
    print('OST_B_END', y - 64, flush=True)
    return dict(bg=b.shimmer_bg().convert('RGB'), ring=(W - 60, 520, PET, 20, 5), els=els, marquee=None)

OST = dict(source='Quelle: öffentliche Ratsunterlagen der Gemeinde Oststeinbek', ort='Oststeinbek', out=f'{S_}/vid9o', ticker='',
    icon='house', status='calendar', stamp='NOCH OFFEN', stampcol=(63, 63, 70), ssize=168, t1='Oststeinbek:', t1s=96, t2='Wärmeplanung: Welches Quartier?', t2s=84, beatsA=ost_A, beatsB=ost_B, stkey='offen',
    quote='„Variante A […] wird das Quartier ‚Zentrum nördlich der Möllner Landstraße‘ festgelegt.“',
    quote_cap='Vorschlag aus der Vorlage', hl={'Variante','A','Quartier','‚Zentrum','nördlich','Möllner','Landstraße‘','festgelegt'}, standword='Angekündigt', standkey='angekündigt', standlab='NOCH NICHT BESCHLOSSEN', stsize=140, metasize=52,
    meta='Ortsbeirat · zuletzt beraten am 29.10.26\nUmweltausschuss · nächste Sitzung 05.11.26',
    texts=['Oststeinbek: Wärmeplanung. Die Entscheidung ist noch offen. Welches Quartier wird ausgewählt?',
           'Zwei Varianten stehen zur Wahl. Variante A: Zentrum nördlich der Möllner Landstraße. Variante B: Ziegeleistraße und Grenzweg.',
           'Dafür ist ein Förderantrag beschlossen. Laufzeit: drei Jahre. Ausgaben: bis zu zweihundertfünfundzwanzigtausend Euro. Eigenanteil: bis zu zweiundzwanzigtausendfünfhundert Euro.', '',
           'Angekündigt. Noch kein Beschluss. Nächste Sitzung: Umweltausschuss, fünfter November.',
           'Beschlüsse und Unterlagen zu Ihrem Ort finden Sie bei Plenara.'])


def wirt_A(wt):
    cfg = WIRT
    pill = b.pill('Vorschlag aus der Vorlage', 52, b.PETH, b.PETD, padx=36, pady=18)
    w1 = fitbig('Prioritätenliste', 150, PET, CW - 230, tr=-0.05)
    t = big('Der Rat soll die aktualisierte Liste für den Ausbau beschließen.', 70, INK, maxw=CW, lh=1.12, tr=-0.015)
    s_ = b.text_block('Ausbau von Wirtschaftswegen ab 2027', 60, 'R', GRAY2, maxw=CW)
    ts = max(find(wt, 'Ausbau', 4.0), CUR_DUR - 4.0)
    els = chips(cfg) + [E(pill, MX, 350, 0.0, slide=0), slam(w1, MX - 4, 470, 0.4, 0.5, 0.3), slam(ibadge('road', 180), W - MX - 180, 470 + (w1.height - 180) // 2, 0.9, 0.5, 0.3),
                        E(t, MX, 470 + w1.height + 70, max(find(wt, 'Rat', 1.5) - 0.2, 1.5), dur=0.6), E(s_, MX, 470 + w1.height + 70 + t.height + 40, ts, dur=0.6, slide=0)]
    return dict(bg=b.shimmer_bg().convert('RGB'), ring=(W - 60, 520, PET, 20, 5), els=els, marquee=None)

def wirt_B(wt):
    cfg = WIRT
    els = chips(cfg)
    h = big('Das steht in der Vorlage:', 74, INK, maxw=CW, w='S', tr=-0.02, lh=1.05)
    els += [E(h, MX, 360, 0.3, dur=0.6, slide=0)]
    y = 540
    rows = [('Haushaltsmittel einplanen', 'Haushaltsmittel', 'coin'), ('Förderantrag stellen', 'Förderantrag', 'doc'),
            ('10 % Eigenanteil der Anlieger im Außenbereich', 'zehn', 'group'), ('Ablauf vor Ort besprechen', 'besprochen', 'pin')]
    y_first = y
    for k_, (wd, k, icn) in enumerate(rows):
        im = big(wd, 66 if k_ == 2 else 80, INK, maxw=CW - 240, lh=1.0, tr=-0.03)
        tt = max(find(wt, k, 1.5) - 0.2, 0.5)
        if k_ == len(rows) - 1: tt = max(tt, CUR_DUR - 4.0)
        els += [slam(ibadge(icn, 176, dark=True), MX, y, tt, 0.3, 0.3), E(im, MX + 214, y + (176 - im.height) // 2, tt + 0.25, dur=0.4, slide=0)]
        if y > y_first: els.insert(len(els) - 2, E(Image.new('RGBA', (8, 62 + 20), PET + (110,)), MX + 84, y - 62 - 10, tt - 0.05, dur=0.3, slide=0))
        y += 176 + 62
    print('WIRT_B_END', y - 62, flush=True)
    return dict(bg=b.shimmer_bg().convert('RGB'), ring=(W - 60, 520, PET, 20, 5), els=els, marquee=None)

WIRT = dict(source='Quelle: öffentliche Ratsunterlagen der Stadt Billerbeck', ort='Billerbeck', out=f'{S_}/vid10w', ticker='',
    icon='road', status='hourglass', stamp='STAND OFFEN', stampcol=(63, 63, 70), ssize=168, t1='Billerbeck:', t1s=96, t2='Wirtschaftswege ab 2027', t2s=84, beatsA=wirt_A, beatsB=wirt_B, stkey='offen',
    quote='„Für den ersten Weg der Prioritätenliste 562 (COE 114) werden Haushaltsmittel eingeplant und ein Förderantrag gestellt.“',
    quote_cap='Vorschlag aus der Vorlage', hl={'562','Haushaltsmittel','eingeplant','Förderantrag','gestellt'}, standword='Stand offen', standkey='offen', standlab='NOCH NICHT BESCHLOSSEN', stsize=150, metasize=52,
    meta='Rat der Stadt · zuletzt beraten am 13.10.26\nDavor: Stadtentwicklungs- und Bauausschuss · 08.09.26',
    texts=['Billerbeck: Ausbau der Wirtschaftswege. Der Stand ist offen.',
           'Der Rat soll die aktualisierte Prioritätenliste für den Ausbau beschließen.',
           'Für den ersten Weg, Nummer fünfhundertzweiundsechzig: Haushaltsmittel einplanen und Förderantrag stellen. Im Dezember zweitausendvierundzwanzig wurde beschlossen: Anlieger im Außenbereich tragen zehn Prozent Eigenanteil. Der Ablauf wird vor Ort besprochen.', '',
           'Stand offen. Noch kein Beschluss. Zuletzt beraten im Rat der Stadt am dreizehnten Oktober.',
           'Beschlüsse und Unterlagen zu Ihrem Ort finden Sie bei Plenara.'])


def park_A(wt):
    cfg = PARK
    pill = b.pill('Vorschlag aus der Vorlage', 52, b.PETH, b.PETD, padx=36, pady=18)
    w1 = fitbig('Förderantrag', 150, PET, CW - 230, tr=-0.05)
    t = big('Die Verwaltung soll mit der vorgestellten Planung den Förderantrag stellen.', 70, INK, maxw=CW, lh=1.12, tr=-0.015)
    s_ = b.text_block('Mittel dafür im Haushalt 2027 ff. einplanen', 60, 'R', GRAY2, maxw=CW)
    ts = max(find(wt, 'Mittel', 4.0), CUR_DUR - 4.0)
    els = chips(cfg) + [E(pill, MX, 350, 0.0, slide=0), slam(w1, MX - 4, 470, 0.4, 0.5, 0.3), slam(ibadge('doc', 180), W - MX - 180, 470 + (w1.height - 180) // 2, 0.9, 0.5, 0.3),
                        E(t, MX, 470 + w1.height + 70, max(find(wt, 'Verwaltung', 1.5) - 0.2, 1.5), dur=0.6), E(s_, MX, 470 + w1.height + 70 + t.height + 40, ts, dur=0.6, slide=0)]
    return dict(bg=b.shimmer_bg().convert('RGB'), ring=(W - 60, 520, PET, 20, 5), els=els, marquee=None)

def park_B(wt):
    cfg = PARK
    els = chips(cfg)
    y = 400
    blocks = [('241.000 €', 'geschätzte Gesamtkosten', 'zweihunderteinund', 'coin'), ('200.000 €', 'voraussichtliche Förderung', 'zweihunderttausend', 'doc'), ('253.000 €', 'eingeplant, mit 5 % Puffer', 'zweihundertdreiund', 'coin')]
    tprev = -0.3
    for k_, (num, lab, key, icn) in enumerate(blocks):
        n = big(num, 118, PET, tr=-0.05); l = b.text_block(lab, 56, 'R', GRAY2, maxw=CW)
        tt = max(find(wt, key, 2.0) - 0.4, tprev + 1.0, 0.5)
        if k_ == 0: tt = min(tt, 1.2)
        if k_ == len(blocks) - 1: tt = max(tt, CUR_DUR - 4.0)
        tprev = tt
        els += [slam(n, MX - 4, y, tt, 0.5, 0.3), slam(ibadge(icn, 130), W - MX - 130, y + (n.height - 130) // 2, tt + 0.1, 0.4, 0.3), E(l, MX, y + n.height + 14, tt + 0.5, dur=0.5, slide=0)]
        y += n.height + 12 + l.height + 90
    print('PARK_B_END', y - 90, flush=True)
    return dict(bg=b.shimmer_bg().convert('RGB'), ring=(W - 60, 520, PET, 20, 5), els=els, marquee=None)

PARK = dict(source='Quelle: öffentliche Ratsunterlagen der Stadt Billerbeck', ort='Billerbeck', out=f'{S_}/vid11p', ticker='',
    icon='parking', status='hourglass', stamp='IN BERATUNG', stampcol=(63, 63, 70), ssize=168, t1='Billerbeck:', t1s=96, t2='P&R Weihgarten', t2s=96, beatsA=park_A, beatsB=park_B, stkey='beratung',
    quote='„Es ist vorgesehen an der Straße Weihgarten einen Gehbereich, eine ausreichend breite Straßenverkehrsfläche und daran anschließend die Stellplätze anzulegen.“',
    quote_cap='Vorschlag aus der Vorlage', hl={'Gehbereich,','Straßenverkehrsfläche','Stellplätze','anzulegen.“','Gehbereich','anzulegen'}, standword='In Beratung', standkey='beratung', standlab='NOCH NICHT BESCHLOSSEN', stsize=150, metasize=52,
    meta='Rat der Stadt · zuletzt beraten am 13.10.26\nDavor: Stadtentwicklungs- und Bauausschuss · 08.09.26',
    texts=['Billerbeck: P und R Weihgarten. Stand: In Beratung.',
           'Die Verwaltung soll den Förderantrag stellen und Mittel ab dem Haushalt zweitausendsiebenundzwanzig einplanen.',
           'Die Gesamtkosten werden auf zweihunderteinundvierzigtausend Euro geschätzt. Die voraussichtliche Förderung: zweihunderttausend Euro. Eingeplant sind, mit fünf Prozent Puffer, zweihundertdreiundfünfzigtausend Euro.', '',
           'In Beratung. Noch kein Beschluss. Zuletzt beraten im Rat der Stadt am dreizehnten Oktober.',
           'Beschlüsse und Unterlagen zu Ihrem Ort finden Sie bei Plenara.'])


def dresden2_A(wt):
    cfg = DRE2
    pill = b.pill('Beschluss laut Vorlage', 52, b.PETH, b.PETD, padx=36, pady=18)
    w1 = fitbig('Hitzeaktionsplan', 150, PET, CW - 230, tr=-0.05)
    t = big('Der Stadtrat bestätigt den Plan 2026 bis 2030 als Grundlage für Maßnahmen gegen gesundheitliche Risiken durch Hitze.', 66, INK, maxw=CW, lh=1.12, tr=-0.015)
    s_ = b.text_block('Gemäß Anlage 1 der Vorlage', 58, 'R', GRAY2, maxw=CW)
    ts = max(find(wt, 'Grundlage', 4.0), CUR_DUR - 4.0)
    els = chips(cfg) + [E(pill, MX, 350, 0.0, slide=0), slam(w1, MX - 4, 470, 0.4, 0.5, 0.3), slam(ibadge('thermo', 180), W - MX - 180, 470 + (w1.height - 180) // 2, 0.9, 0.5, 0.3),
                        E(t, MX, 470 + w1.height + 70, max(find(wt, 'bestätigt', 1.5) - 0.2, 1.5), dur=0.6), E(s_, MX, 470 + w1.height + 70 + t.height + 40, ts, dur=0.6, slide=0)]
    return dict(bg=b.shimmer_bg().convert('RGB'), ring=(W - 60, 520, PET, 20, 5), els=els, marquee=None)

def dresden2_B(wt):
    cfg = DRE2
    els = chips(cfg)
    h = big('Der Stadtrat beauftragt den Oberbürgermeister:', 70, INK, maxw=CW, w='S', tr=-0.02, lh=1.05)
    els += [E(h, MX, 360, 0.3, dur=0.6, slide=0)]
    y = 600
    rows = [('Plan umsetzen', 'umzusetzen', 'crane'), ('Plan evaluieren', 'evaluieren', 'mag'), ('Fortschreibung am Ende des Zeitraums prüfen', 'Fortschreibung', 'calendar')]
    for k_, (wd, k, icn) in enumerate(rows):
        im = big(wd, 80 if k_ < 2 else 66, INK, maxw=CW - 240, lh=1.0, tr=-0.03)
        tt = max(find(wt, k, 1.5) - 0.2, 0.5)
        if k_ == len(rows) - 1: tt = max(tt, CUR_DUR - 4.0)
        els += [slam(ibadge(icn, 176, dark=True), MX, y, tt, 0.3, 0.3), E(im, MX + 214, y + (176 - im.height) // 2, tt + 0.25, dur=0.4, slide=0)]
        y += 176 + 62
    return dict(bg=b.shimmer_bg().convert('RGB'), ring=(W - 60, 520, PET, 20, 5), els=els, marquee=None)

DRE2 = dict(source='Quelle: öffentliche Ratsunterlagen der Landeshauptstadt Dresden', ort='Dresden', out=f'{S_}/vid12d', ticker='',
    icon='thermo', status='check', stamp='BESCHLOSSEN', stampcol=BLUE, ssize=160, t1='Hitze in Dresden:', t1s=108, t2='Hitzeaktionsplan 2026 bis 2030', t2s=94, beatsA=dresden2_A, beatsB=dresden2_B, stkey='beschlossen',
    quote='„Der Stadtrat bestätigt den Hitzeaktionsplan 2026 bis 2030 der Landeshauptstadt Dresden gemäß Anlage 1 als Grundlage für Maßnahmen zur Minderung gesundheitlicher Risiken durch Hitze […]“',
    quote_cap='Aus der Vorlage', hl={'bestätigt','Hitzeaktionsplan','2026','2030','Minderung','Risiken','Hitze'}, standword='Beschlossen', standkey='beschlossen', stsize=170, metasize=52,
    meta='Stadtrat · zuletzt beraten am 29.10.26\nDavor: Stadtrat · 24.09.26, vertagt',
    texts=['Dresden: Hitzeaktionsplan zweitausendsechsundzwanzig bis zweitausenddreißig. Stand: beschlossen.',
           'Der Stadtrat bestätigt den Plan als Grundlage für Maßnahmen gegen gesundheitliche Risiken durch Hitze.',
           'Der Stadtrat beauftragt den Oberbürgermeister: den Plan umzusetzen, ihn zu evaluieren und am Ende des Zeitraums die Fortschreibung zu prüfen.', '',
           'Beschlossen. Zuletzt beraten: Stadtrat, neunundzwanzigster Oktober. Am vierundzwanzigsten September war der Punkt vertagt worden.',
           'Beschlüsse und Unterlagen zu Ihrem Ort finden Sie bei Plenara.'])

if __name__ == '__main__':
    if sys.argv[1] == 'p': run(PARK, f'{S_}/tts/p1', f'{S_}/PundR_Weihgarten_Billerbeck_Social_v1.mp4'); sys.exit()
    if sys.argv[1] == 'w': run(WIRT, f'{S_}/tts/w1', f'{S_}/Wirtschaftswege_Billerbeck_Social_v1.mp4'); sys.exit()
    if sys.argv[1] == 'd2': run(DRE2, f'{S_}/tts/d7', f'{S_}/Hitzeaktionsplan_Dresden_Social_v5.mp4'); sys.exit()
    if sys.argv[1] == 'b': run(BIL, f'{S_}/tts/b6', f'{S_}/Starkregenschutz_Billerbeck_Social_v4.mp4'); sys.exit()
    if sys.argv[1] == 'o': run(OST, f'{S_}/tts/o7', f'{S_}/Quartierswaermemanagement_Oststeinbek_Social_v5.mp4'); sys.exit()
    if sys.argv[1] == 'h': run(HAL, f'{S_}/tts/h6', f'{S_}/Baumschutz_Halle_Social_v4.mp4')
    else: run(DRE, f'{S_}/tts/d6', f'{S_}/Hitzeaktionsplan_Dresden_Social_v4.mp4')
