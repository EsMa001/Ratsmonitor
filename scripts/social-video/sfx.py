"""Töne für das Video, selbst erzeugt (keine fremden Dateien).
Aufruf: python3 sfx.py <Ausgabe.wav> <Gesamtlänge s> <ereignisse.json>
ereignisse.json: [[Sekunde, "hit"|"tick"|"whoosh"|"logo"|"logo_end"], ...]
"""
import sys, json, wave
import numpy as np
SR = 44100
rng = np.random.default_rng(7)


def hit(d=0.45):  # tiefer Schlag mit kurzem Knack (Stempel)
    t = np.arange(int(SR * d)) / SR
    f = 50 + 110 * np.exp(-t * 28)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9)
    n = rng.standard_normal(len(t)); n = n - np.convolve(n, np.ones(12) / 12, 'same')
    return 0.85 * body + 0.35 * n * np.exp(-t * 90)


def tick(d=0.12):  # kurzes helles Klicken
    t = np.arange(int(SR * d)) / SR
    return 0.32 * np.sin(2 * np.pi * 1480 * t) * np.exp(-t * 42) + 0.05 * rng.standard_normal(len(t)) * np.exp(-t * 120)


def whoosh(d=0.42):  # Rauschen, dessen Helligkeit steigt und fällt
    n = int(SR * d); t = np.arange(n) / SR
    x = rng.standard_normal(n); y = np.zeros(n); a_prev = 0.0
    for i in range(n):
        a = 0.04 + 0.5 * np.sin(np.pi * i / n) ** 1.5
        a_prev += a * (x[i] - a_prev); y[i] = a_prev
    env = np.sin(np.pi * t / d) ** 2
    return 0.55 * y * env


def bell(f, d=1.1):
    t = np.arange(int(SR * d)) / SR
    return (np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * 2.01 * f * t) + 0.12 * np.sin(2 * np.pi * 3.02 * f * t)) * np.exp(-t * 3.4)


def logo(notes=(523.25, 659.25, 783.99), gap=0.11):  # drei aufsteigende Töne
    out = np.zeros(int(SR * (gap * len(notes) + 1.2)))
    for k, f in enumerate(notes):
        b = bell(f); s = int(k * gap * SR); out[s:s + len(b)] += 0.28 * b[:len(out) - s]
    return out


def norm(f, peak):  # jeden Ton auf eine feste Spitze bringen, damit nichts übersteuert
    def g():
        x = f(); return x / max(1e-9, np.abs(x).max()) * peak
    return g


KINDS = {'hit': norm(hit, 0.8), 'tick': norm(tick, 0.3), 'whoosh': norm(whoosh, 0.38), 'logo': norm(logo, 0.5),
         'logo_end': norm(lambda: logo((659.25, 783.99, 1046.5), 0.13), 0.5)}

if __name__ == '__main__':
    out, total, ev = sys.argv[1], float(sys.argv[2]), json.load(open(sys.argv[3]))
    y = np.zeros(int(SR * total))
    for t0, kind in ev:
        s = int(max(0.0, t0) * SR); x = KINDS[kind]()[:max(0, len(y) - s)]
        y[s:s + len(x)] += x
    y = np.clip(y, -0.95, 0.95)
    w = wave.open(out, 'wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((y * 32767).astype('<i2').tobytes()); w.close()
