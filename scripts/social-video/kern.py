import sys, os, subprocess, random, wave, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import base as b
from PIL import Image, ImageDraw, ImageFilter
from multiprocessing import Pool

W, H, MX, CW, FPS = b.W, b.H, b.MX, b.CW, b.FPS
S_ = b.S_
OUT = f'{S_}/vid5'
NAVY, PET = b.BLUE, b.PET
FADE, LEAD, TAIL = 0.3, 0.2, 0.3
src = b.src
SUB_Y = 1380

# ---------------- Bausteine ----------------
def cover(img, blur=0, lighten=0.0, ay=0.5):
    s = max(W / img.width, H / img.height)
    im = img.resize((round(img.width * s), round(img.height * s)), Image.LANCZOS)
    x = (im.width - W) // 2; y = int((im.height - H) * ay)
    im = im.crop((x, y, x + W, y + H))
    im = im.filter(ImageFilter.GaussianBlur(blur)) if blur else im.filter(ImageFilter.UnsharpMask(radius=2.5, percent=90, threshold=2))
    im = im.convert('RGBA')
    if lighten: im = Image.alpha_composite(im, Image.new('RGBA', (W, H), (255, 255, 255, int(255 * lighten))))
    return im.convert('RGB')

def rr(w, h, r, fill, outline=None, ow=0, alpha=255):
    big = Image.new('RGBA', (w * 2, h * 2), (0, 0, 0, 0))
    ImageDraw.Draw(big).rounded_rectangle([0, 0, w * 2 - 1, h * 2 - 1], radius=r * 2, fill=fill + (alpha,),
                                          outline=(outline + (255,)) if outline else None, width=ow * 2)
    return big.resize((w, h), Image.LANCZOS)

def with_shadow(im, pad=44, blur=22, dy=14, a=42):
    out = Image.new('RGBA', (im.width + 2 * pad, im.height + 2 * pad), (0, 0, 0, 0))
    m = im.getchannel('A').point(lambda v: int(v * a / 255))
    lay = Image.new('RGBA', im.size, (15, 23, 42, 255)); lay.putalpha(m)
    sh = Image.new('RGBA', out.size, (0, 0, 0, 0)); sh.alpha_composite(lay, (pad, pad + dy))
    sh = sh.filter(ImageFilter.GaussianBlur(blur))
    out.alpha_composite(sh); out.alpha_composite(im, (pad, pad))
    return out, pad

def brush(text, size, w, rot=-2.2, seed=1):
    rng = random.Random(seed)
    t = b.text_block(text, size, 'S', b.WHITE, maxw=w, tr_em=-0.02, lh=1.1)
    th = t.height - int(size * 0.35); pad = 44
    bw, bh = w + 2 * pad, th + 2 * pad; m = 30
    big = Image.new('RGBA', ((bw + 2 * m) * 2, (bh + 2 * m) * 2), (0, 0, 0, 0)); d = ImageDraw.Draw(big)
    def edge(a, c, n): return [(a[0] + (c[0] - a[0]) * i / n + rng.uniform(-5, 5), a[1] + (c[1] - a[1]) * i / n + rng.uniform(-5, 5)) for i in range(n)]
    x0, y0, x1, y1 = m, m, bw + m, bh + m
    pts = edge((x0, y0), (x1, y0), 40) + edge((x1, y0), (x1, y1), 14) + edge((x1, y1), (x0, y1), 40) + edge((x0, y1), (x0, y0), 14)
    d.polygon([(x * 2, y * 2) for x, y in pts], fill=NAVY + (255,))
    im = big.resize((bw + 2 * m, bh + 2 * m), Image.LANCZOS)
    im.alpha_composite(t, (m + pad, m + pad - 4))
    return im.rotate(rot, resample=Image.BICUBIC, expand=True)

def logo_chip():
    lg = b.logo_at(300)
    chip = rr(lg.width + 56, lg.height + 40, 26, b.WHITE, alpha=238)
    chip.alpha_composite(lg, (28, 20)); return chip

def subtitle_img(text):
    t = b.text_block(text, 46, 'S', b.WHITE, maxw=CW - 90, lh=1.25, align='center')
    h = t.height - 8
    box = rr(CW, h + 56, 30, b.INK, alpha=192)
    box.alpha_composite(t, (45, 24)); return box

def photo_rr(img, w, h, r=36, ay=0.5, ax=0.5):
    s = max(w / img.width, h / img.height)
    im = img.resize((round(img.width * s), round(img.height * s)), Image.LANCZOS)
    x = int((im.width - w) * ax); y = int((im.height - h) * ay)
    im = im.crop((x, y, x + w, y + h)).filter(ImageFilter.UnsharpMask(radius=2, percent=80, threshold=2)).convert('RGBA')
    im.putalpha(b.rounded_mask(w, h, r)); return im

def extra_icon(name, size, color, sw=5.5):
    im = b.icon_canvas(size); d = ImageDraw.Draw(im); k = size * b.SS / 100.0; w = int(sw * k)
    P = lambda x, y: (x * k, y * k)
    if name == 'search':
        d.ellipse([P(20, 20), P(64, 64)], outline=color, width=w)
        d.line([P(58, 58), P(82, 82)], fill=color, width=w)
        r = w / 2; d.ellipse([82 * k - r, 82 * k - r, 82 * k + r, 82 * k + r], fill=color)
    elif name == 'pin':
        d.ellipse([P(26, 14), P(74, 62)], outline=color, width=w)
        d.line([P(33, 55), P(50, 88)], fill=color, width=w); d.line([P(67, 55), P(50, 88)], fill=color, width=w)
        d.ellipse([P(42, 30), P(58, 46)], outline=color, width=w)
    elif name == 'doc':
        d.rounded_rectangle([P(24, 10), P(76, 90)], radius=8 * k, outline=color, width=w)
        for y in (36, 52, 68): d.line([P(36, y), P(64, y)], fill=color, width=w)
    return im.resize((size, size), Image.LANCZOS)

def ci(name, d=88, sz=56):
    im = Image.new('RGBA', (d * b.SS, d * b.SS), (0, 0, 0, 0))
    ImageDraw.Draw(im).ellipse([0, 0, d * b.SS - 1, d * b.SS - 1], fill=b.PETH)
    im = im.resize((d, d), Image.LANCZOS)
    ic = extra_icon(name, sz, PET) if name in ('search', 'pin', 'doc') else b.draw_icon(name, sz, PET, sw=5.5)
    im.alpha_composite(ic, ((d - sz) // 2, (d - sz) // 2)); return im

def row_img(icon, label, w, h=122, size=42, line=True, d=88, sz=56):
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    if line: ImageDraw.Draw(im).line([(0, 1), (w, 1)], fill=b.LINE, width=2)
    im.alpha_composite(ci(icon, d, sz), (0, (h - d) // 2))
    tb = b.text_block(label, size, 'S', b.INK, maxw=w - d - 28, tr_em=-0.01, lh=1.1)
    im.alpha_composite(tb, (d + 28, (h - (tb.height - 16)) // 2 - 2)); return im

class E:
    def __init__(self, img, x, y, t0, dur=0.5, slide=34, shadow=False, kind='fade'):
        if shadow: img, pad = with_shadow(img); x -= pad; y -= pad
        self.img, self.x, self.y, self.t0, self.dur, self.slide = img, int(x), int(y), t0, dur, slide


ORT = None

def ort_chip(text, h):
    ic = extra_icon('pin', 56, b.WHITE, sw=7)
    f = b.F(44, 'S'); tw = int(b.tlen(f, text, 0)) + 6
    w = 30 + 56 + 14 + tw + 38
    im = rr(w, h, 26, PET)
    im.alpha_composite(ic, (30, (h - 56) // 2))
    tb = b.text_block(text, 44, 'S', b.WHITE, maxw=tw + 20)
    im.alpha_composite(tb, (30 + 56 + 14, (h - (tb.height - 18)) // 2 - 2))
    return im

def hook_head(ort, kicker):
    t = b.text_block(ort, 96, 'S', b.INK, maxw=CW, tr_em=-0.03, lh=1.0)
    k = b.text_block(kicker.upper(), 28, 'S', PET, maxw=CW, tr_em=0.12)
    return [E(t, MX, 262, -1.0, slide=0), E(k, MX + 4, 262 + t.height - 6, -1.0, slide=0)]

# ---------------- Szenen ----------------
def sc_hook(vo):
    raw = src.crop((0, 372, 376, 640)); sh_ = round(raw.height * W / raw.width)
    strip = raw.resize((W, sh_), Image.LANCZOS).filter(ImageFilter.UnsharpMask(radius=2.2, percent=90, threshold=2))
    y_s = 860
    top = raw.crop((0, 0, raw.width, 6)).resize((W, y_s + 200), Image.BILINEAR).filter(ImageFilter.GaussianBlur(40))
    bot = raw.crop((0, raw.height - 6, raw.width, raw.height)).resize((W, H - (y_s + sh_) + 200), Image.BILINEAR).filter(ImageFilter.GaussianBlur(40))
    bg = Image.new('RGB', (W, H)); bg.paste(top, (0, 0)); bg.paste(bot, (0, y_s + sh_ - 200))
    fm = Image.new('L', (W, sh_), 255); fd = ImageDraw.Draw(fm)
    for k in range(160):
        v = int(255 * (k / 160)); fd.line([(0, k), (W, k)], fill=v); fd.line([(0, sh_ - 1 - k), (W, sh_ - 1 - k)], fill=v)
    bg.paste(strip, (0, y_s), fm)
    scr = Image.new('RGBA', (W, H), (0, 0, 0, 0)); sd = ImageDraw.Draw(scr)
    for y in range(1100, H):
        a = int(130 * ((y - 1100) / (H - 1100)) ** 1.4); sd.line([(0, y), (W, y)], fill=(25, 30, 29, a))
    bg = Image.alpha_composite(bg.convert('RGBA'), scr).convert('RGB')
    lab = brush('Hitze in Dresden: Hitzeaktionsplan beschlossen', 80, CW - 90, seed=3)
    pl = b.pill('Hitzeaktionsplan 2026 bis 2030', 44, PET, b.WHITE, padx=40, pady=20)
    els = [E(logo_chip(), MX, 120, -1.0, slide=0, shadow=True),
           E(lab, MX - 20, 520, -1.0, slide=0, shadow=True),
           E(pl, MX, 520 + lab.height - 10, -1.0, slide=0, shadow=True)] + hook_head('Landeshauptstadt Dresden', 'Stadtrat')
    return bg, els, ['Der Stadtrat hat den Hitzeaktionsplan beschlossen.'], 3.2

def sc_hitze(vo):
    crop = src.crop((392, 300, 788, 560))
    bg = cover(crop, blur=22, lighten=0.18)
    lab = brush('Hitze kann die Gesundheit gefährden.', 66, CW - 40, seed=4)
    cy = 235 + lab.height - 44; PH = 1345 - cy
    ph = photo_rr(crop, CW, PH, ax=0.8)
    pill = b.pill('Hintergrund zum Plan', 38, PET, b.WHITE, padx=34, pady=18)
    els = [E(logo_chip(), MX, 120, -1.0, slide=0, shadow=True),
           E(lab, MX - 20, 235, 0.2, shadow=True),
           E(ph, MX, cy, 0.55, dur=0.7, shadow=True),
           E(pill, MX + 30, cy + PH - 30 - pill.height, 1.9, shadow=True)]
    return bg, els, ['Hitze kann die Gesundheit gefährden.'], 4.0

def sc_betroffen(vo):
    crop = src.crop((801, 300, 1179, 520))
    bg = cover(crop, blur=22, lighten=0.18)
    lab = brush('Laut Plan besonders gefährdet:', 66, CW - 40, seed=5)
    y0 = 235 + lab.height - 44
    PHH = max(280, min(430, 1345 - y0 - 20 - 440))
    ph = photo_rr(crop, CW, PHH, ay=0.5)
    rows = [('elder', 'ältere Menschen'), ('heart', 'Menschen mit Vorerkrankungen'), ('kids', 'Kinder und Jugendliche'), ('house', 'Menschen in sozial schwierigen Lebenslagen')]
    rh = 104; ch = len(rows) * rh + 24
    card = rr(CW, ch, 40, b.WHITE, outline=b.LINE, ow=2, alpha=250)
    cy = y0 + PHH + 20
    els = [E(logo_chip(), MX, 120, -1.0, slide=0, shadow=True),
           E(lab, MX - 20, 235, 0.2, shadow=True),
           E(ph, MX, y0, 0.45, dur=0.7, shadow=True),
           E(card, MX, cy, 0.9, shadow=True)]
    ts = [1.3, 2.1, 2.9, 3.5]
    for i, ((ic, lb), t) in enumerate(zip(rows, ts)):
        els.append(E(row_img(ic, lb, CW - 100, h=rh, size=40, line=(i > 0), d=80, sz=52), MX + 50, cy + 12 + i * rh, t, slide=24))
    return bg, els, ['Laut Hitzeaktionsplan besonders gefährdet:', 'ältere Menschen, Vorerkrankte, Kinder, sozial Benachteiligte.'], 5.0

def sc_beschluss(vo):
    bg = cover(src.crop((801, 1376, 1177, 1590)), blur=18, lighten=0.22)
    lab = brush('Was wurde beschlossen?', 66, CW - 40, seed=6)
    cy = 235 + lab.height - 40
    q = b.text_block('„Der Stadtrat bestätigt den Hitzeaktionsplan 2026 bis 2030 der Landeshauptstadt Dresden.“', 46, 'S', b.INK, maxw=CW - 100, tr_em=-0.01, lh=1.25)
    cap = b.text_block('Aus der Vorlage', 30, 'R', b.GRAY, maxw=CW)
    rows = [('bell', 'Frühwarnung und Information'), ('tree', 'Kühlung im Stadtgebiet'), ('cross', 'Gesundheitsversorgung')]
    rh = 122; qh = q.height - 12
    h1 = 40 + qh + 20 + cap.height - 8 + 24
    card1 = rr(CW, h1, 40, b.WHITE, outline=b.LINE, ow=2, alpha=250)
    ImageDraw.Draw(card1).rounded_rectangle([0, 30, 8, 30 + qh + 8], radius=4, fill=PET)
    h2 = len(rows) * rh + 24
    card2 = rr(CW, h2, 40, b.WHITE, outline=b.LINE, ow=2, alpha=250)
    sc = rr(CW, 140, 34, b.WHITE, outline=b.LINE, ow=2, alpha=250)
    cw3 = CW // 3
    for i, (k, v, col) in enumerate([('STAND', 'Beschlossen', b.BLUE), ('GREMIUM', 'Stadtrat', b.INK), ('ZULETZT BERATEN', '29.10.26', b.INK)]):
        x = 34 + i * cw3
        sc.alpha_composite(b.text_block(k, 24, 'S', b.GRAY, maxw=cw3, tr_em=0.1), (x, 22))
        sc.alpha_composite(b.text_block(v, 42, 'S', col, maxw=cw3, tr_em=-0.01, lh=1.1), (x, 64))
        if i: ImageDraw.Draw(sc).line([(x - 18, 26), (x - 18, 112)], fill=b.LINE, width=2)
    d = vo
    t_rows = LEAD + d * 0.56
    ysrc = cy + h1 + 22
    y2 = ysrc + 140 + 22
    els = [E(logo_chip(), MX, 120, -1.0, slide=0, shadow=True),
           E(lab, MX - 20, 235, 0.2, shadow=True),
           E(card1, MX, cy, 0.6, shadow=True),
           E(q, MX + 54, cy + 36, 0.75, slide=16),
           E(cap, MX + 54, cy + 36 + qh + 14, 0.9, slide=0),
           E(sc, MX, ysrc, LEAD + d * 0.36, shadow=True),
           E(card2, MX, y2, t_rows - 0.1, shadow=True)]
    y = y2 + 12
    for i, (ic, lb) in enumerate(rows):
        t = t_rows + d * 0.13 * i
        els.append(E(row_img(ic, lb, CW - 100, h=rh, size=42, line=(i > 0), d=88, sz=56), MX + 50, y, t, slide=22)); y += rh
    subs = ['Stand: beschlossen.', 'Der Plan nennt laut Vorlage Frühwarnung, Kühlung und Gesundheitsversorgung.']
    return bg, els, subs, 7.0

def sc_plenara(vo):
    bg = b.shimmer_bg().convert('RGB')
    lg = b.logo_at(560)
    head = b.text_block('Beschlüsse zu Ihrem Ort finden', 84, 'S', b.INK, maxw=CW, tr_em=-0.025, lh=1.08)
    rows = [('search', 'Suche nach Thema und Ort'), ('pin', 'Karte mit Treffern'), ('doc', 'Originalunterlagen zum Beschluss')]
    els = [E(lg, MX - 6, 150, 0.0, slide=0),
           E(head, MX, 420, 0.3)]
    y = 700
    for i, (ic, lb) in enumerate(rows):
        els.append(E(row_img(ic, lb, CW, h=190, size=50, line=True, d=120, sz=76), MX, y, 0.9 + 0.55 * i)); y += 190
    els.append(E(b.hline(CW), MX, y, 2.3, slide=0))
    return bg, els, ['Beschlüsse und Unterlagen zu Ihrem Ort finden Sie bei Plenara.'], 3.6

def sc_end(vo):
    bg = Image.new('RGB', (W, H), b.DARK)
    t = b.text_block('Besser verstehen, was vor Ort beraten wird.', 96, 'S', b.WHITE, maxw=CW, tr_em=-0.025, lh=1.08)
    u = b.text_block('plenara.de', 120, 'S', (79, 168, 155), maxw=CW, tr_em=-0.03)
    els = [E(b.logo_at(760, dark=True), MX - 6, 360, -1.0, slide=0, dur=0.3),
           E(t, MX, 640, 0.15),
           E(u, MX, 640 + t.height + 70, 0.6, dur=0.25, slide=0),
           E(b.text_block('Quelle: öffentliche Ratsunterlagen', 40, 'R', b.GRAYL, maxw=CW), MX, 1240, 1.0)]
    els[2].pop = 0.3
    return bg, els, [], 3.5

SCENES = [sc_hook, sc_hitze, sc_betroffen, sc_beschluss, sc_plenara, sc_end]
sc_hook.chip = False; sc_plenara.chip = False; sc_end.chip = False

# ---------------- Rendering ----------------
def ease(p): p = min(1, max(0, p)); return 1 - (1 - p) ** 3

def sub_chunks(texts, vo):
    n = sum(len(t) for t in texts) or 1; out = []; t = LEAD
    for s in texts:
        dd = vo * len(s) / n; out.append((s, t, t + dd + 0.05)); t += dd
    return out

def render_scene(args):
    i, dur, vo = args
    bg, els, subs, _ = SCENES[i](vo)
    if ORT and getattr(SCENES[i], 'chip', True):
        lc = logo_chip(); els.append(E(ort_chip(ORT, lc.height), MX + lc.width + 20, 120, -1.0, slide=0, shadow=True))
    chunks = sub_chunks(subs, vo); simgs = {s: subtitle_img(s) for s in subs}
    nfr = int((dur + (FADE if i < len(SCENES) - 1 else 0)) * FPS)
    zoom = 0.06 if i != 5 else 0.0
    cmd = ['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
           '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '16', '-pix_fmt', 'yuv420p', f'{OUT}/c{i + 1}.mp4']
    pr = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for fr in range(nfr):
        t = fr / FPS
        u = min(1.0, t / dur)
        z = 1 + zoom * u if i % 2 == 0 else 1 + zoom * (1 - u)
        if zoom:
            bw, bh = W / z, H / z; x0, y0 = (W - bw) / 2, (H - bh) / 2
            im = bg.resize((W, H), Image.BICUBIC, box=(x0, y0, x0 + bw, y0 + bh))
        else:
            im = bg.copy()
        for e in els:
            if t < e.t0: continue
            p = ease((t - e.t0) / e.dur); img = e.img
            if p < 1:
                img = img.copy(); img.putalpha(img.getchannel('A').point(lambda v, p=p: int(v * p)))
            ox, oy = e.x, e.y + int(e.slide * (1 - p))
            pop = getattr(e, 'pop', 0)
            if pop and p < 1:
                sc = 1 + pop * (1 - p) ** 2
                nw, nh = int(img.width * sc), int(img.height * sc)
                ox -= (nw - img.width) // 2; oy -= (nh - img.height) // 2
                img = img.resize((nw, nh), Image.BICUBIC)
            im.paste(img, (ox, oy), img)
        for s, a, c in chunks:
            if a <= t < c:
                img = simgs[s]; p = ease((t - a) / 0.15)
                if p < 1:
                    img = img.copy(); img.putalpha(img.getchannel('A').point(lambda v, p=p: int(v * p)))
                im.paste(img, (MX, SUB_Y), img)
        pr.stdin.write(im.tobytes())
    pr.stdin.close(); pr.wait()
    return i

def wavlen(p):
    w = wave.open(p); return w.getnframes() / w.getframerate()

if __name__ == '__main__':
    ORT = 'Dresden'
    os.makedirs(OUT, exist_ok=True)
    mins = [SCENES[i](1.0)[3] for i in range(6)] if False else [3.2, 4.0, 5.0, 7.0, 3.6, 3.5]
    vo = [wavlen(f'{S_}/tts/m/v{i + 1}.wav') for i in range(6)]
    durs = [round(max(m, v + LEAD + TAIL), 2) for m, v in zip(mins, vo)]
    print('durs', durs, round(sum(durs), 2), flush=True)
    only = [int(a) for a in sys.argv[1:]]
    jobs = [(i, durs[i], vo[i]) for i in range(6) if not only or (i + 1) in only]
    with Pool(4) as pool:
        for r in pool.imap_unordered(render_scene, jobs): print('scene', r + 1, 'ok', flush=True)
    if only: sys.exit()
    inputs = []
    for i in range(6): inputs += ['-i', f'{OUT}/c{i + 1}.mp4']
    filt = ''; prev = '[0:v]'; off = 0; starts = [0]
    for i in range(1, 6):
        off += durs[i - 1]; starts.append(off)
        filt += f"{prev}[{i}:v]xfade=transition=fade:duration={FADE}:offset={off:.2f}[v{i}];"; prev = f'[v{i}]'
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', *inputs, '-filter_complex', filt.rstrip(';'), '-map', prev, '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', f'{OUT}/video_only.mp4'], check=True)
    import json
    json.dump({'durs': durs, 'starts': starts}, open(f'{OUT}/timing.json', 'w'))
    subprocess.run(['python3', '-I', f'{b.HERE}/remix.py', OUT, f'{S_}/tts/m', f'{S_}/Hitzeaktionsplan_Dresden_Social_v2.mp4'], check=True)
