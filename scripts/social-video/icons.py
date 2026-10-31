"""Vektor-Icons (selbst gezeichnet, 4x supersampled) fuer die Social-Videos. Keine externen Bilder."""
import math
from PIL import Image, ImageDraw

SS = 4


class _C:
    def __init__(self, n=100):
        self.k = SS * 4  # 400 px Arbeitsflaeche pro 100 Einheiten
        self.m = Image.new('L', (100 * self.k // 4 * 1, 100 * self.k // 4 * 1), 0)
        self.s = self.m.width / 100.0
        self.d = ImageDraw.Draw(self.m)

    def c(self, x, y, r, f=255):
        s = self.s; self.d.ellipse([(x - r) * s, (y - r) * s, (x + r) * s, (y + r) * s], fill=f)

    def r(self, x0, y0, x1, y1, rad=0, f=255):
        s = self.s; self.d.rounded_rectangle([x0 * s, y0 * s, x1 * s, y1 * s], radius=rad * s, fill=f)

    def p(self, pts, f=255):
        s = self.s; self.d.polygon([(x * s, y * s) for x, y in pts], fill=f)

    def l(self, pts, w, f=255):
        s = self.s
        for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
            self.d.line([(x0 * s, y0 * s), (x1 * s, y1 * s)], fill=f, width=int(w * s))
        for x, y in pts:
            self.c(x, y, w / 2, f)


def _tree(c, ox=0, oy=0, sc=1.0):
    def T(x, y): return ox + x * sc, oy + y * sc
    for (x, y, r) in [(50, 32, 22), (33, 50, 19), (67, 50, 19), (50, 58, 20)]:
        X, Y = T(x, y); c.c(X, Y, r * sc)
    a = T(44, 62); b_ = T(56, 92); c.r(a[0], a[1], b_[0], b_[1], 0)


def draw(name):
    c = _C()
    if name == 'pin':
        c.c(50, 38, 27); c.p([(26, 48), (74, 48), (50, 92)]); c.c(50, 38, 11, 0)
    elif name == 'tree':
        _tree(c)
    elif name == 'tree_measure':
        _tree(c, 15, 0, 0.7)
        c.l([(14, 86), (86, 86)], 5); c.p([(8, 86), (22, 78), (22, 94)]); c.p([(92, 86), (78, 78), (78, 94)])
    elif name == 'sun':
        c.c(50, 50, 20)
        for i in range(8):
            a = i * math.pi / 4; c.l([(50 + 31 * math.cos(a), 50 + 31 * math.sin(a)), (50 + 45 * math.cos(a), 50 + 45 * math.sin(a))], 6.5)
    elif name == 'thermo':
        c.r(38, 8, 62, 70, 12); c.c(50, 76, 19)
        c.r(45, 18, 55, 66, 5, 0); c.c(50, 76, 11, 0)
        c.r(47.5, 40, 52.5, 70, 2.5); c.c(50, 76, 8)
        for y in (20, 31, 42): c.l([(70, y), (82, y)], 4.5)
    elif name == 'drop':
        c.c(50, 62, 28); c.p([(50, 8), (24, 56), (76, 56)])
    elif name == 'rain':
        c.c(32, 42, 16); c.c(51, 33, 21); c.c(70, 44, 15); c.r(24, 42, 82, 58, 8)
        for x in (34, 52, 70): c.l([(x + 3, 68), (x - 4, 86)], 6)
    elif name == 'elder':
        c.c(40, 20, 11); c.r(28, 34, 52, 70, 11); c.l([(35, 66), (33, 92)], 10); c.l([(47, 66), (51, 92)], 10)
        c.l([(50, 46), (66, 52)], 7); c.l([(68, 50), (68, 92)], 5.5); c.l([(60, 46), (68, 41), (76, 47)], 5.5)
    elif name == 'child':
        c.c(50, 34, 15); c.r(36, 52, 64, 80, 9); c.l([(43, 78), (43, 93)], 9); c.l([(57, 78), (57, 93)], 9)
        c.l([(36, 58), (24, 70)], 7); c.l([(64, 58), (76, 70)], 7)
    elif name == 'heart':
        c.c(34, 36, 19); c.c(66, 36, 19); c.p([(16, 44), (84, 44), (50, 90)])
        c.r(46, 34, 54, 62, 1, 0); c.r(35, 44, 65, 52, 1, 0)
    elif name == 'group':
        c.c(34, 28, 12); c.r(19, 44, 49, 82, 12); c.c(68, 33, 11); c.r(55, 48, 83, 82, 11)
    elif name == 'doc':
        c.r(22, 8, 78, 92, 8); c.p([(78, 28), (58, 8), (58, 28)], 0)
        c.r(33, 44, 67, 50, 3, 0); c.r(33, 58, 67, 64, 3, 0); c.r(33, 72, 55, 78, 3, 0)
    elif name == 'coin':
        c.c(50, 50, 43); c.c(50, 50, 33, 0)
        # Euro-Zeichen aus Geometrie
        c.d.arc([30 * c.s, 30 * c.s, 66 * c.s, 70 * c.s], 55, 305, fill=255, width=int(7 * c.s))
        c.l([(28, 44), (56, 44)], 5.5); c.l([(28, 56), (56, 56)], 5.5)
    elif name == 'pencil':
        c.p([(68, 10), (90, 32), (38, 84), (14, 88), (16, 64)])
        c.l([(24, 60), (42, 78)], 4.5, 0); c.l([(60, 18), (82, 40)], 4.5, 0)
    elif name == 'crane':
        c.l([(30, 20), (30, 90)], 9); c.l([(8, 22), (90, 22)], 8); c.r(8, 22, 24, 38, 2)
        c.l([(30, 12), (52, 22)], 4); c.l([(78, 24), (78, 58)], 3.5); c.r(70, 58, 86, 72, 3)
        c.r(16, 86, 44, 94, 2)
    elif name == 'check':
        c.c(50, 50, 44); c.l([(29, 52), (44, 67), (72, 35)], 10, 0)
    elif name == 'cross':
        c.c(50, 50, 44); c.l([(34, 34), (66, 66)], 10, 0); c.l([(66, 34), (34, 66)], 10, 0)
    elif name == 'hourglass':
        c.r(22, 6, 78, 16, 4); c.r(22, 84, 78, 94, 4)
        c.p([(28, 16), (72, 16), (54, 50), (72, 84), (28, 84), (46, 50)])
        c.p([(40, 30), (60, 30), (50, 44)], 0)
        c.p([(40, 76), (60, 76), (50, 58)], 0)
    elif name == 'road':
        c.p([(32, 10), (68, 10), (94, 92), (6, 92)])
        c.r(47, 18, 53, 34, 2, 0); c.r(46, 44, 54, 62, 2, 0); c.r(44, 72, 56, 88, 2, 0)
    elif name == 'parking':
        c.r(10, 10, 90, 90, 14)
        c.r(32, 24, 44, 76, 0, 0); c.c(53, 42, 19, 0); c.c(53, 42, 8, 255)
    elif name == 'house':
        c.p([(8, 52), (50, 14), (92, 52)]); c.r(20, 48, 80, 90, 3); c.r(42, 62, 58, 90, 2, 0)
    elif name == 'hall':
        c.p([(8, 36), (50, 10), (92, 36)]); c.r(10, 38, 90, 45, 2)
        for x in (18, 37, 56, 75): c.r(x, 48, x + 9, 78, 2)
        c.r(8, 82, 92, 91, 2)
    elif name == 'calendar':
        c.r(12, 18, 88, 90, 9); c.r(21, 42, 79, 81, 3, 0)
        for rr_ in range(2):
            for cc in range(3):
                c.r(27 + cc * 18, 48 + rr_ * 16, 38 + cc * 18, 59 + rr_ * 16, 2)
        c.r(28, 6, 37, 28, 4); c.r(63, 6, 72, 28, 4)
    elif name == 'mag':
        c.c(42, 42, 30); c.c(42, 42, 20, 0); c.l([(64, 64), (88, 88)], 11)
    else:
        raise KeyError(name)
    return c.m


def icon(name, size, fg):
    m = draw(name).resize((size, size), Image.LANCZOS)
    im = Image.new('RGBA', (size, size), tuple(fg) + (255,)); im.putalpha(m)
    return im


def badge(name, d, fg, bg, pad=0.22):
    """Rundes Badge mit Glyph."""
    S = d * 3
    base = Image.new('L', (S, S), 0); ImageDraw.Draw(base).ellipse([0, 0, S - 1, S - 1], fill=255)
    base = base.resize((d, d), Image.LANCZOS)
    im = Image.new('RGBA', (d, d), tuple(bg) + (255,)); im.putalpha(base)
    g = int(d * (1 - 2 * pad)); gi = icon(name, g, fg)
    im.alpha_composite(gi, ((d - g) // 2, (d - g) // 2))
    return im


if __name__ == '__main__':
    names = ['pin', 'tree', 'tree_measure', 'sun', 'thermo', 'drop', 'rain', 'elder', 'child', 'heart', 'group', 'doc', 'coin', 'pencil', 'crane', 'check', 'cross', 'hourglass', 'house', 'hall', 'calendar', 'mag']
    sheet = Image.new('RGB', (6 * 190, 4 * 190), (30, 40, 38))
    for i, n in enumerate(names):
        bd = badge(n, 170, (20, 30, 28), (126, 214, 200)); sheet.paste(bd, ((i % 6) * 190 + 10, (i // 6) * 190 + 10), bd)
    sheet.save('review/icons.png')
