"""Leise Hintergrundmusik für ein fertiges Video: python3 musik.py <video.mp4>   (im Ordner ~/code/video-tools starten, venv mit numpy und scipy)
Erzeugt die Musik selbst (keine fremde Datei, keine Lizenzfrage): ruhiger Klangteppich in D-Dur, 84 Schläge je Minute, Akkorde D, h, G, A je Takt,
dazu ein leises Zupfmotiv, Bass und ein weicher Shaker, mit Hall. Die Musik endet mit dem Video auf dem Grundakkord.
Mischung: unter der Stimme wird die Musik automatisch leiser (sidechaincompress), in Pausen und auf der Schlussfolie etwas lauter; am Anfang und Ende weich ein- und ausgeblendet.
Das Video wird ersetzt (Ton danach 44,1 kHz Stereo); die reine Musik liegt daneben als <name>.musik.wav."""
import sys, os, subprocess, re, json
import numpy as np
from scipy.signal import fftconvolve, butter, sosfilt
from scipy.io import wavfile

TOOLS = os.environ.get('VIDEO_TOOLS', os.path.expanduser('~/code/video-tools'))
FF = subprocess.check_output(['node', '-p', f"require('{TOOLS}/node_modules/ffmpeg-static')"]).decode().strip()
SR = 44100; BPM = 84; BEAT = 60 / BPM; BAR = 4 * BEAT
rng = np.random.default_rng(7)  # fest, damit jeder Bau dieselbe Musik ergibt

def hz(m): return 440 * 2 ** ((m - 69) / 12)
# Akkorde als MIDI-Noten (Grundton für den Bass, Akkordtöne für Fläche und Zupfmotiv)
CHORDS = [(38, [62, 66, 69, 74]), (35, [62, 66, 71, 74]), (31, [62, 67, 71, 74]), (33, [61, 64, 69, 73])]  # D, h, G, A
LAST = (38, [62, 66, 69, 74, 78])

def env(n, a, r):
    e = np.ones(n); a = min(int(a * SR), n); r = min(int(r * SR), n)
    e[:a] = np.linspace(0, 1, a); e[n - r:] *= np.linspace(1, 0, r); return e

def pad(notes, dur):
    n = int(dur * SR); t = np.arange(n) / SR; L = np.zeros(n); R = np.zeros(n)
    for m in notes:
        f = hz(m)
        for k, (dl, dr) in enumerate([(-0.0025, 0.0025), (0.0018, -0.0018)]):
            L += np.sin(2 * np.pi * f * (1 + dl) * t + k) + 0.18 * np.sin(4 * np.pi * f * t)
            R += np.sin(2 * np.pi * f * (1 + dr) * t + k + 1) + 0.18 * np.sin(4 * np.pi * f * t)
    e = env(n, 0.9, 1.2) / (len(notes) * 2)
    return L * e, R * e

def pluck(m, dur=1.1):
    n = int(dur * SR); t = np.arange(n) / SR; f = hz(m)
    s = (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(4 * np.pi * f * t) * np.exp(-t * 9)) * np.exp(-t * 4.2)
    return s * env(n, 0.004, 0.05)

def bass(m, dur):
    n = int(dur * SR); t = np.arange(n) / SR; f = hz(m)
    return (np.sin(2 * np.pi * f * t) + 0.25 * np.sin(4 * np.pi * f * t)) * env(n, 0.05, 0.6) * np.exp(-t * 0.35)

def shaker():
    n = int(0.09 * SR); s = rng.standard_normal(n) * np.exp(-np.arange(n) / SR * 55)
    return sosfilt(butter(2, [5000, 11000], 'bandpass', fs=SR, output='sos'), s)

def music(total, cuts=()):
    n = int((total + 3) * SR); L = np.zeros(n); R = np.zeros(n)
    def add(sig, at, gl, gr=None):
        i = int(at * SR); j = min(n, i + len(sig))
        if j <= i: return
        L[i:j] += sig[:j - i] * gl; R[i:j] += sig[:j - i] * (gl if gr is None else gr)
    bars = int(max(BAR, total - 3.2) // BAR); start = 0.0; end_at = bars * BAR  # Takt ab 0 (der Auftakt springt im Sechzehntel dazu), Schlussakkord auf einer Taktgrenze
    arp = [0, 2, 1, 3, 2, 1, 3, 2]                # Reihenfolge der Akkordtöne im Zupfmotiv (Achtel)
    sh = shaker()
    for b in range(bars):
        root, notes = CHORDS[b % 4]; t0 = start + b * BAR
        pl, pr = pad(notes, BAR + 1.2); add(pl, t0, 0.32); add(pr, t0, 0, 0.32)
        add(bass(root, BAR), t0, 0.30)
        if b > 0 or start <= 0:                   # Zupfmotiv ab dem ersten vollen Takt
            for k, a in enumerate(arp):
                p = pluck(notes[a] + 12); pan = 0.35 if k % 2 else 0.65
                add(p, t0 + k * BEAT / 2, 0.16 * (1 - pan) * 2, 0.16 * pan * 2)
        for k in range(8):
            if k % 2: add(sh, t0 + k * BEAT / 2, 0.05 if k % 4 == 3 else 0.03)
    if start > 0:                                 # Auftakt vor dem ersten vollen Takt: Fläche auf D
        pl, pr = pad(CHORDS[0][1], start + 1.2); add(pl, 0, 0.32); add(pr, 0, 0, 0.32)
    pl, pr = pad(LAST[1], 4.5); add(pl, end_at, 0.36); add(pr, end_at, 0, 0.36); add(bass(LAST[0], 4.5), end_at, 0.3)
    for k, m in enumerate([74, 78, 81, 86]): add(pluck(m, 2.5), end_at + k * BEAT / 2, 0.14)
    for cut in cuts:  # Auftakt: Rauschen schwillt zum Schnitt an, dort ein weicher tiefer Schlag
        rn = int(1.3 * SR); rs = sosfilt(butter(2, [800, 6000], 'bandpass', fs=SR, output='sos'), rng.standard_normal(rn)) * np.linspace(0, 1, rn) ** 2.5
        add(rs, cut - 1.3, 0.22)
        tn = int(0.6 * SR); tt = np.arange(tn) / SR; add(np.sin(2 * np.pi * (48 + 60 * np.exp(-tt * 30)) * tt) * np.exp(-tt * 7), cut, 0.55)
    # Hall: abklingendes Rauschen als Raum
    ir_n = int(2.2 * SR); ir = rng.standard_normal((2, ir_n)) * np.exp(-np.arange(ir_n) / SR * 3.2); ir[:, :int(0.012 * SR)] = 0
    L = L + 0.10 * fftconvolve(L, ir[0])[:n]; R = R + 0.10 * fftconvolve(R, ir[1])[:n]
    lp = butter(2, 7000, 'lowpass', fs=SR, output='sos'); hp = butter(1, 45, 'highpass', fs=SR, output='sos')
    st = np.stack([sosfilt(hp, sosfilt(lp, L)), sosfilt(hp, sosfilt(lp, R))], 1)[:int(total * SR)]
    st *= env(len(st), 0.6, 1.6)[:, None]
    return (st / (np.abs(st).max() + 1e-9) * 0.7).astype(np.float32)

def dur(p):
    r = subprocess.run([FF, '-i', p], capture_output=True, text=True).stderr
    m = re.search(r'Duration: (\d+):(\d+):([\d.]+)', r); return int(m[1]) * 3600 + int(m[2]) * 60 + float(m[3])

if __name__ == '__main__':
    v = sys.argv[1]; base = v[:-4]; total = dur(v)
    tj = f'{base}.timeline.json'  # Schnitte nach Auftakt und Zwischenfolien bekommen einen Akzent
    cuts = [f['ende'] for f in json.load(open(tj))['folien'] if f['name'] in ('auftakt', 'zwischen')] if os.path.exists(tj) else []
    wav = f'{base}.musik.wav'; wavfile.write(wav, SR, music(total, cuts))
    tmp = f'{base}.mix.mp4'
    # Musik -15 dB unter Vollaussteuerung, unter der Stimme rund 9 dB leiser; Gesamtlautheit -16 LUFS (übliche Lautheit im Netz)
    # Stimme zweimal einlesen statt asplit (asplit mit Seitenkette blockiert in ffmpeg)
    fc = ('[0:a]aresample=44100,pan=stereo|c0=c0|c1=c0[vo];[2:a]aresample=44100,pan=stereo|c0=c0|c1=c0[sc];'
          '[1:a]volume=-15dB[mu];[mu][sc]sidechaincompress=threshold=0.015:ratio=5:attack=40:release=700:makeup=1[duck];'
          '[vo][duck]amix=inputs=2:duration=first:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11[a]')
    r = subprocess.run([FF, '-nostdin', '-y', '-loglevel', 'error', '-i', v, '-i', wav, '-i', v, '-filter_complex', fc, '-map', '0:v', '-map', '[a]',
                        '-c:v', 'copy', '-c:a', 'aac', '-b:a', '128k', '-ar', '44100', '-movflags', '+faststart', tmp], capture_output=True, text=True)
    if r.returncode: print(r.stderr[-600:]); sys.exit(1)
    os.replace(tmp, v); print('Musik eingemischt', round(total, 1), 's')
