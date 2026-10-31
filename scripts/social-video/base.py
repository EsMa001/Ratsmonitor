import math, os, subprocess, sys, wave
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops
from multiprocessing import Pool

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..'))
# Arbeitsordner (Stimmen unter tts/, Zwischenstände, fertige Videos); nicht in Git
S_ = os.environ.get('SV_WORK', os.path.join(REPO, 'tmp', 'social-video'))
OUT = f'{S_}/vid3'
W, H = 1080, 1920
FPS = 30
FADE = 0.4
LEAD, TAIL = 0.25, 0.35
MX = 72                      # Seitenrand
CW = W - 2 * MX              # Inhaltsbreite

# Farben: Petrol klar (docs/design/brand.json)
INK = (24, 24, 27); GRAY = (82, 82, 91); GRAYL = (161, 161, 170)
PET = (38, 132, 120); PETD = (31, 112, 101); PETH = (230, 243, 241)
BLUE = (12, 74, 110); ORG = (180, 83, 9); LINE = (228, 228, 231)
DARK = (25, 30, 29); WHITE = (255, 255, 255); FLAECHE = (244, 244, 245)

FONTS = {'R': f'{REPO}/public/fonts/IBMPlexSans-Regular.ttf',
         'S': f'{REPO}/public/fonts/IBMPlexSans-SemiBold.ttf'}
_fc = {}
def F(size, w='R'):
    k = (size, w)
    if k not in _fc: _fc[k] = ImageFont.truetype(FONTS[w], size)
    return _fc[k]

# ---------- Text ----------
def adv(font, text, i, tr):
    a = font.getlength(text[i:i + 2]) - (font.getlength(text[i + 1]) if i + 1 < len(text) else 0)
    return a + tr

def tlen(font, text, tr):
    return sum(adv(font, text, i, tr) for i in range(len(text)))

def wrap(text, font, maxw, tr):
    out = []
    for para in text.split('\n'):
        cur = ''
        for w in para.split(' '):
            t = (cur + ' ' + w).strip()
            if tlen(font, t, tr) <= maxw or not cur: cur = t
            else: out.append(cur); cur = w
        out.append(cur)
    return out

def text_block(text, size, weight='R', fill=INK, maxw=CW, tr_em=0.0, lh=1.25, align='left'):
    font = F(size, weight); tr = tr_em * size
    lines = wrap(text, font, maxw, tr)
    step = int(size * lh)
    h = step * len(lines) + int(size * 0.4)
    im = Image.new('RGBA', (maxw, h), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    for n, l in enumerate(lines):
        x = 0
        L = tlen(font, l, tr)
        if align == 'center': x = (maxw - L) / 2
        for i, ch in enumerate(l):
            d.text((x, n * step), ch, font=font, fill=fill)
            x += adv(font, l, i, tr)
    return im

# ---------- Formen / Icons (Linienstil, 3x Supersampling) ----------
SS = 4
def icon_canvas(size):
    return Image.new('RGBA', (size * SS, size * SS), (0, 0, 0, 0))

def draw_icon(name, size, color, sw=5):
    im = icon_canvas(size); d = ImageDraw.Draw(im)
    k = size * SS / 100.0
    w = int(sw * k)
    P = lambda x, y: (x * k, y * k)
    def L(pts, **kw): d.line([P(*p) for p in pts], fill=color, width=w, joint='curve', **kw)
    def C(cx, cy, r, fill=None):
        d.ellipse([P(cx - r, cy - r), P(cx + r, cy + r)], outline=None if fill else color, width=w, fill=fill)
    def A(box, a0, a1): d.arc([P(box[0], box[1]), P(box[2], box[3])], a0, a1, fill=color, width=w)
    def dot(x, y):
        r = w / 2
        d.ellipse([x * k - r, y * k - r, x * k + r, y * k + r], fill=color)
    if name == 'elder':
        C(42, 22, 9); L([(42, 34), (42, 64)]); L([(42, 64), (34, 90)]); L([(42, 64), (52, 90)])
        L([(42, 46), (62, 52)]); L([(62, 52), (62, 90)]); A((62, 40, 76, 56), 180, 360)
        dot(34, 90); dot(52, 90)
    elif name == 'heart':
        pts = []
        for i in range(0, 361, 3):
            t = math.radians(i)
            x = 16 * math.sin(t) ** 3
            y = 13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)
            pts.append((50 + x * 2.3, 46 - y * 2.3))
        L(pts + pts[:2]); L([(28, 50), (42, 50), (48, 36), (54, 62), (60, 50), (72, 50)])
    elif name == 'kids':
        C(36, 28, 9); L([(36, 40), (36, 66)]); L([(36, 66), (28, 90)]); L([(36, 66), (44, 90)])
        C(66, 46, 6.5); L([(66, 56), (66, 74)]); L([(66, 74), (60, 90)]); L([(66, 74), (72, 90)])
        L([(36, 52), (66, 62)])
    elif name == 'house':
        L([(18, 50), (50, 22), (82, 50)]); L([(28, 44), (28, 84), (72, 84), (72, 44)]); L([(44, 84), (44, 62), (56, 62), (56, 84)])
        dot(18, 50); dot(82, 50)
    elif name == 'bell':
        A((28, 22, 72, 66), 180, 360); L([(28, 44), (24, 70)]); L([(72, 44), (76, 70)]); L([(20, 70), (80, 70)])
        C(50, 80, 5); L([(50, 14), (50, 22)])
    elif name == 'tree':
        C(50, 38, 24); L([(50, 62), (50, 90)]); L([(50, 80), (36, 68)]); L([(50, 72), (64, 60)])
    elif name == 'cross':
        a, b = 38, 62
        pts = [(a, 14), (b, 14), (b, a), (86, a), (86, b), (b, b), (b, 86), (a, 86), (a, b), (14, b), (14, a), (a, a), (a, 14)]
        L(pts)
    elif name == 'shield':
        L([(50, 14), (80, 26), (80, 52), (72, 68), (50, 88), (28, 68), (20, 52), (20, 26), (50, 14)])
        L([(36, 50), (46, 61), (66, 38)])
    elif name == 'thermo':
        d.rounded_rectangle([P(40, 10), P(60, 66)], radius=10 * k, outline=color, width=w)
        C(50, 76, 13); L([(50, 36), (50, 72)]); dot(50, 36)
    elif name == 'sun':
        C(50, 50, 16)
        for i in range(8):
            a = math.radians(i * 45)
            L([(50 + math.cos(a) * 27, 50 + math.sin(a) * 27), (50 + math.cos(a) * 40, 50 + math.sin(a) * 40)])
    elif name == 'check':
        L([(22, 52), (42, 72), (80, 28)])
    return im.resize((size, size), Image.LANCZOS)

def circle_icon(name, d=140, bg=PETH, fg=PET, sz=88):
    im = Image.new('RGBA', (d * SS, d * SS), (0, 0, 0, 0))
    ImageDraw.Draw(im).ellipse([0, 0, d * SS - 1, d * SS - 1], fill=bg)
    im = im.resize((d, d), Image.LANCZOS)
    ic = draw_icon(name, sz, fg, sw=5.5)
    im.alpha_composite(ic, ((d - sz) // 2, (d - sz) // 2))
    return im

def rounded_mask(w, h, r):
    m = Image.new('L', (w * 2, h * 2), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, w * 2 - 1, h * 2 - 1], radius=r * 2, fill=255)
    return m.resize((w, h), Image.LANCZOS)

def photo_card(img, w, h, r=28, pad=70):
    im = img.convert('RGB')
    s = max(w / im.width, h / im.height)
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    x0 = (im.width - w) // 2; y0 = (im.height - h) // 2
    im = im.crop((x0, y0, x0 + w, y0 + h)).convert('RGBA')
    m = rounded_mask(w, h, r)
    out = Image.new('RGBA', (w + 2 * pad, h + 2 * pad), (0, 0, 0, 0))
    sh = Image.new('RGBA', out.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle([pad, pad + 24, pad + w, pad + h + 24], radius=r, fill=(15, 23, 42, 26))
    sh = sh.filter(ImageFilter.GaussianBlur(30))
    out.alpha_composite(sh)
    im.putalpha(m); out.alpha_composite(im, (pad, pad))
    return out, pad

def pill(text, size, bg, fg, padx=40, pady=18, weight='S'):
    f = F(size, weight); w = int(tlen(f, text, 0)) + 2 * padx; h = int(size * 1.25) + 2 * pady
    big = Image.new('RGBA', (w * 2, h * 2), (0, 0, 0, 0))
    ImageDraw.Draw(big).rounded_rectangle([0, 0, w * 2 - 1, h * 2 - 1], radius=h, fill=bg)
    im = big.resize((w, h), Image.LANCZOS)
    ImageDraw.Draw(im).text((padx, pady - 2), text, font=f, fill=fg)
    return im

def hline(w, col=LINE, th=2):
    im = Image.new('RGBA', (w, th), col + (255,)); return im

# ---------- Szenenbausteine ----------
try: src = Image.open(os.environ.get('SV_PHOTO', '/nonexistent')).convert('RGB')  # nur für die alten Foto-Szenen (Dresden v1)
except OSError: src = None
def crop_logo(path, dark=False):
    im = Image.open(path).convert('RGBA')
    if dark:
        bg = Image.new('RGBA', im.size, DARK + (255,))
        diff = ImageChops.difference(im, bg).convert('L').point(lambda v: 255 if v > 8 else 0)
        bb = diff.getbbox()
    else:
        bb = im.getchannel('A').getbbox()
    return im.crop(bb)

def logo_at(width, dark=False):
    im = crop_logo(f'{REPO}/docs/design/logo/plenara-logo{"-dunkel" if dark else ""}.png', dark)
    h = round(im.height * width / im.width)
    return im.resize((width, h), Image.LANCZOS)

def mark_at(height):
    im = crop_logo(f'{REPO}/docs/design/logo/plenara-bildmarke.png')
    w = round(im.width * height / im.height)
    return im.resize((w, height), Image.LANCZOS)

def shimmer_bg(dark=False):
    if dark: return Image.new('RGBA', (W, H), DARK + (255,))
    yy, xx = np.mgrid[0:H, 0:W]
    dist = np.sqrt((xx - (W + 80)) ** 2 + (yy + 120) ** 2)
    a = np.clip(1 - dist / 1100, 0, 1) ** 1.6 * 0.12
    base = np.ones((H, W, 3), np.float32) * 255
    base = base * (1 - a[..., None]) + np.array(PET, np.float32) * a[..., None]
    return Image.fromarray(base.astype(np.uint8)).convert('RGBA')

class El:
    def __init__(self, img, x, y, t0, dur=0.55, slide=36, fn=None):
        self.img, self.x, self.y, self.t0, self.dur, self.slide, self.fn = img, x, y, t0, dur, slide, fn

def progress_dots(idx, dark=False):
    n = 7; r = 8; gap = 40
    w = (n - 1) * gap + 2 * r + 4
    im = Image.new('RGBA', (w * 2, 2 * (2 * r + 4)), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    for i in range(n):
        c = PET if i == idx else ((70, 76, 75) if dark else LINE)
        cx = (r + 2 + i * gap) * 2; cy = (r + 2) * 2
        rr = (r + (3 if i == idx else 0)) * 2 if False else r * 2
        d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], fill=c)
    return im.resize((w, 2 * r + 4), Image.LANCZOS)

def head(idx, eyebrow, title, size=84, lines_w=CW, y=250):
    els = []
    mk = mark_at(76)
    els.append(El(mk, MX, 112, 0.05, slide=0))
    eb = text_block(eyebrow.upper(), 28, 'S', PET, maxw=CW, tr_em=0.12)
    els.append(El(eb, MX + mk.width + 24, 132, 0.05, slide=0))
    t = text_block(title, size, 'S', INK, maxw=lines_w, tr_em=-0.025, lh=1.08)
    els.append(El(t, MX, y, 0.3))
    return els, y + t.height

def row(icon, label, w=CW, h=176, size=48):
    CD = 140
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    im.alpha_composite(hline(w), (0, 0))
    ic = circle_icon(icon)
    im.alpha_composite(ic, (0, (h - 140) // 2))
    tb = text_block(label, size, 'S', INK, maxw=w - 190, tr_em=-0.01, lh=1.15)
    th = tb.height - int(size * 0.4)
    im.alpha_composite(tb, (190, (h - th) // 2 - 4))
    return im

# ---------- Szenen ----------
def scene1():
    bgi = shimmer_bg(); els = []
    els.append(El(logo_at(500), MX - 6, 130, 0.1, slide=0))
    t = text_block('Hitzeaktionsplan\nDresden', 108, 'S', INK, maxw=CW, tr_em=-0.025, lh=1.03)
    els.append(El(t, MX, 330, 0.35))
    pl = pill('2026 bis 2030', 54, PET, WHITE)
    els.append(El(pl, MX, 330 + t.height + 14, 0.9))
    sub = text_block('Mehr Schutz vor Hitze. Für die Gesundheit der Dresdner Bevölkerung.', 44, 'R', GRAY, maxw=CW, lh=1.35)
    els.append(El(sub, MX, 330 + t.height + 14 + pl.height + 44, 1.7))
    ph, pad = photo_card(src.crop((0, 372, 376, 640)), CW, 700)
    els.append(El(ph, MX - pad, 1010 - pad, 0.3, dur=0.9, slide=24))
    return bgi, els

def thermo_static():
    w, h = 300, 780
    im = Image.new('RGBA', (w * SS, h * SS), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    cx = 90 * SS; tw_ = 40 * SS
    top, bulb_c, bulb_r = 10 * SS, 690 * SS, 70 * SS
    lw = 8 * SS
    d.rounded_rectangle([cx - tw_ // 2, top, cx + tw_ // 2, bulb_c], radius=tw_ // 2, outline=INK, width=lw)
    d.ellipse([cx - bulb_r, bulb_c - bulb_r, cx + bulb_r, bulb_c + bulb_r], outline=INK, width=lw)
    # Teil der Röhre im Kolben überdecken
    d.rectangle([cx - tw_ // 2 + lw, bulb_c - bulb_r - 2 * SS, cx + tw_ // 2 - lw, bulb_c - bulb_r + 24 * SS], fill=(0, 0, 0, 0))
    d.rectangle([cx - tw_ // 2 + lw, bulb_c - bulb_r + 10 * SS, cx + tw_ // 2 - lw, bulb_c - bulb_r + 40 * SS], fill=(0, 0, 0, 0))
    # Skala 0..50
    y0, y1 = 620 * SS, 70 * SS  # y für 0 und 50
    f = F(34 * SS // SS * 1, 'R')
    for v in range(0, 51, 10):
        y = y0 + (y1 - y0) * v / 50
        d.line([(cx + tw_ // 2 + 18 * SS, y), (cx + tw_ // 2 + 62 * SS, y)], fill=GRAYL, width=3 * SS)
        d.text((cx + tw_ // 2 + 84 * SS, y), str(v), font=F(34 * SS, 'R'), fill=GRAY, anchor='lm')
    return im.resize((w, h), Image.LANCZOS)

def thermo_mercury(t, t0=0.9, t1=2.6, final=38):
    w, h = 300, 780
    p = min(1, max(0, (t - t0) / (t1 - t0))); p = 1 - (1 - p) ** 3
    v = 4 + (final - 4) * p
    im = Image.new('RGBA', (w * SS, h * SS), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    cx = 90 * SS; tw_ = 40 * SS; bulb_c, bulb_r = 690 * SS, 70 * SS; lw = 8 * SS
    d.ellipse([cx - bulb_r + lw + 6 * SS, bulb_c - bulb_r + lw + 6 * SS, cx + bulb_r - lw - 6 * SS, bulb_c + bulb_r - lw - 6 * SS], fill=ORG)
    y0, y1 = 620 * SS, 70 * SS
    yv = y0 + (y1 - y0) * v / 50
    mw = 16 * SS
    d.rounded_rectangle([cx - mw // 2, yv, cx + mw // 2, bulb_c], radius=mw // 2, fill=ORG)
    return im.resize((w, h), Image.LANCZOS)

def scene2():
    bgi = shimmer_bg()
    els, yb = head(1, 'Hitze', 'Hitze ist mehr als nur unangenehm.', size=88)
    ts = thermo_static()
    els.append(El(ts, MX + 20, 520, 0.6))
    els.append(El(None, MX + 20, 520, 0.6, slide=0, fn=thermo_mercury))
    els.append(El(draw_icon('sun', 260, ORG, sw=4), W - MX - 300, 620, 1.1))
    body = text_block('Sie kann ernsthafte Gesundheitsrisiken für alle Altersgruppen darstellen – besonders für vulnerable Menschen.', 46, 'R', GRAY, maxw=CW, lh=1.38)
    els.append(El(hline(CW), MX, 1400, 2.2))
    els.append(El(body, MX, 1440, 2.4))
    return bgi, els

def scene3():
    bgi = shimmer_bg()
    els, yb = head(2, 'Wer ist betroffen', 'Besonders betroffen sind …', size=88)
    rows = [('elder', 'ältere Menschen'), ('heart', 'Menschen mit Vorerkrankungen'), ('kids', 'Kinder und Jugendliche'), ('house', 'Menschen in sozial schwierigen Lebenslagen')]
    ts = [1.75, 2.65, 3.45, 4.2]
    y = 600
    for (ic, lb), t0 in zip(rows, ts):
        r = row(ic, lb, h=250, size=54)
        els.append(El(r, MX, y, t0))
        y += 250
    els.append(El(hline(CW), MX, y, ts[-1] + 0.2, slide=0))
    return bgi, els

def scene4():
    bgi = shimmer_bg()
    els, yb = head(3, 'Der Plan', 'Der Hitzeaktionsplan bündelt Maßnahmen.', size=84)
    rows = [('bell', 'Frühwarnung und Information'), ('tree', 'Kühlung im Stadtgebiet'), ('cross', 'Gesundheitsversorgung stärken'), ('shield', 'Besonders betroffene Gruppen schützen')]
    ts = [1.45, 2.4, 3.3, 4.1]
    y = 640
    for (ic, lb), t0 in zip(rows, ts):
        els.append(El(row(ic, lb, h=250, size=54), MX, y, t0)); y += 250
    els.append(El(hline(CW), MX, y, ts[-1] + 0.2, slide=0))
    return bgi, els

def scene5():
    bgi = shimmer_bg()
    els, yb = head(4, 'Beschluss', 'Was wurde beschlossen?', size=92)
    chk = Image.new('RGBA', (112 * 1, 112), (0, 0, 0, 0))
    big = Image.new('RGBA', (112 * SS, 112 * SS), (0, 0, 0, 0))
    ImageDraw.Draw(big).ellipse([0, 0, 112 * SS - 1, 112 * SS - 1], fill=BLUE)
    chk = big.resize((112, 112), Image.LANCZOS)
    chk.alpha_composite(draw_icon('check', 64, WHITE, sw=9), (24, 24))
    els.append(El(chk, W - MX - 112, 262, 0.5))
    quote = '„Der Stadtrat bestätigt den Hitzeaktionsplan 2026 bis 2030 der Landeshauptstadt Dresden gemäß Anlage 1 als Grundlage für Maßnahmen zur Minderung gesundheitlicher Risiken durch Hitze und zum Schutz der Dresdner Bevölkerung, insbesondere besonders betroffener Personengruppen.“'
    qb = text_block(quote, 47, 'R', INK, maxw=CW - 80, lh=1.42)
    ch = qb.height + 40
    card = Image.new('RGBA', (CW, ch + 70), (0, 0, 0, 0))
    big = Image.new('RGBA', (CW * 2, (ch + 70) * 2), (0, 0, 0, 0))
    ImageDraw.Draw(big).rounded_rectangle([0, 0, CW * 2 - 1, (ch + 70) * 2 - 1], radius=48, fill=WHITE, outline=LINE, width=4)
    card = big.resize((CW, ch + 70), Image.LANCZOS)
    ImageDraw.Draw(card).rounded_rectangle([0, 28, 8, ch + 70 - 28], radius=4, fill=PET)
    card.alpha_composite(qb, (56, 28))
    src_t = text_block('Aus der Vorlage', 32, 'R', GRAY, maxw=CW)
    card.alpha_composite(src_t, (56, ch + 70 - 60))
    y_card = 580
    els.append(El(card, MX, y_card, 0.9, dur=0.8))
    y = y_card + ch + 70 + 70
    cols = [('STAND', 'Beschlossen', BLUE), ('GREMIUM', 'Stadtrat', INK), ('ZULETZT BERATEN', '29.10.26', INK)]
    cw3 = CW // 3
    for i, (k, v, col) in enumerate(cols):
        im = Image.new('RGBA', (cw3 - 10, 150), (0, 0, 0, 0))
        im.alpha_composite(hline(cw3 - 24), (0, 0))
        im.alpha_composite(text_block(k, 26, 'S', GRAY, maxw=cw3 - 10, tr_em=0.1), (0, 26))
        im.alpha_composite(text_block(v, 42, 'S', col, maxw=cw3 - 10, lh=1.1, tr_em=-0.01), (0, 72))
        els.append(El(im, MX + i * cw3, y, 3.0 + 0.3 * i))
    return bgi, els

def scene6():
    bgi = shimmer_bg()
    els, yb = head(5, 'Gemeinsam', 'Gemeinsam für ein gesundes Dresden.', size=100)
    ph, pad = photo_card(src.crop((801, 1376, 1177, 1590)), CW, 640)
    els.append(El(ph, MX - pad, 700 - pad, 0.5, dur=0.9, slide=24))
    x = MX
    for i, n in enumerate(['tree', 'thermo', 'heart']):
        els.append(El(circle_icon(n, d=150, sz=92), x + i * 180, 1430, 1.1 + 0.2 * i))
    els.append(El(pill('Der Hitzeaktionsplan 2026–2030.', 44, PETH, PETD, padx=40, pady=22), MX, 1630, 1.7))
    return bgi, els

def scene7():
    bgi = shimmer_bg(dark=True); els = []
    t = text_block('Ein wichtiger Schritt für mehr Gesundheit, Klimaschutz und Lebensqualität in Dresden.', 46, 'R', GRAYL, maxw=CW, lh=1.35)
    els.append(El(t, MX, 330, 0.2))
    els.append(El(logo_at(620, dark=True), MX - 6, 760, 0.5, slide=0, dur=0.7))
    sl = text_block('Besser verstehen, was vor Ort beraten wird.', 84, 'S', WHITE, maxw=CW, tr_em=-0.025, lh=1.1)
    els.append(El(sl, MX, 1010, 1.7))
    els.append(El(text_block('www.plenara.de', 46, 'S', (79, 168, 155), maxw=CW), MX, 1010 + sl.height + 40, 2.5))
    return bgi, els

SCENES = [scene1, scene2, scene3, scene4, scene5, scene6, scene7]

def ease(p): p = min(1, max(0, p)); return 1 - (1 - p) ** 3

def render_scene(args):
    i, dur = args
    bgi, els = SCENES[i]()
    dots = progress_dots(i, dark=(i == 6))
    nfr = int((dur + (FADE if i < 6 else 0)) * FPS)
    cmd = ['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
           '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '16', '-pix_fmt', 'yuv420p', f'{OUT}/c{i + 1}.mp4']
    pr = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for fr in range(nfr):
        t = fr / FPS
        im = bgi.copy()
        for e in els:
            if t < e.t0: continue
            p = ease((t - e.t0) / e.dur)
            img = e.img if e.fn is None else e.fn(t)
            if p < 1 and e.fn is None:
                a = img.getchannel('A').point(lambda v, p=p: int(v * p))
                img = img.copy(); img.putalpha(a)
            dy = int(e.slide * (1 - p))
            im.alpha_composite(img, (int(e.x), int(e.y) + dy)) if (e.y + dy >= 0 and e.x >= 0) else im.paste(img, (int(e.x), int(e.y) + dy), img)
        im.alpha_composite(dots, ((W - dots.width) // 2, 1790))
        pr.stdin.write(im.convert('RGB').tobytes())
    pr.stdin.close(); pr.wait()
    return i

def wavlen(p):
    w = wave.open(p); return w.getnframes() / w.getframerate()

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    orig = [3, 3, 3, 3, 4, 3, 1]
    vo = [wavlen(f'{S_}/tts/v{i + 1}.wav') for i in range(7)]
    durs = [round(max(o, v + LEAD + TAIL), 2) for o, v in zip(orig, vo)]
    print('durs', durs, sum(durs))
    only = [int(a) for a in sys.argv[1:]]
    jobs = [(i, durs[i]) for i in range(7) if not only or (i + 1) in only]
    with Pool(4) as pool:
        for r in pool.imap_unordered(render_scene, jobs): print('scene', r + 1, 'ok', flush=True)
    if only: sys.exit()
    inputs = []
    for i in range(7): inputs += ['-i', f'{OUT}/c{i + 1}.mp4']
    filt = ''; prev = '[0:v]'; off = 0; starts = [0]
    for i in range(1, 7):
        off += durs[i - 1]; starts.append(off)
        filt += f"{prev}[{i}:v]xfade=transition=fade:duration={FADE}:offset={off:.2f}[v{i}];"; prev = f'[v{i}]'
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', *inputs, '-filter_complex', filt.rstrip(';'), '-map', prev, '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', f'{OUT}/video_only.mp4'], check=True)
    ain = []; af = ''
    for i in range(7):
        ain += ['-i', f'{S_}/tts/v{i + 1}.wav']
        ms = int((starts[i] + LEAD) * 1000)
        af += f'[{i}:a]aresample=44100,adelay={ms}|{ms},volume=1.6[a{i}];'
    af += ''.join(f'[a{i}]' for i in range(7)) + 'amix=inputs=7:normalize=0,alimiter=limit=0.95[aout]'
    total = sum(durs)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', *ain, '-filter_complex', af, '-map', '[aout]', '-t', f'{total:.2f}', f'{OUT}/voice.wav'], check=True)
    out = f'{S_}/Hitzeaktionsplan_Dresden_Plenara.mp4'
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', f'{OUT}/video_only.mp4', '-i', f'{OUT}/voice.wav', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out], check=True)
    print(out)
