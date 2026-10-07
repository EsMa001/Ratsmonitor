"""Vergleicht Bilder per Wahrnehmungs-Hash (statt sie anzusehen): python3 bildvergleich.py <a.png> <b.png> [mehr ...]  (mit ~/code/video-tools/venv/bin/python starten)
Gibt den Abstand aller aufeinanderfolgenden Paare aus: 0 = gleich, bis 6 = sehr ähnlich, über 15 = deutlich verschieden."""
import sys, imagehash
from PIL import Image
h=[(f,imagehash.phash(Image.open(f))) for f in sys.argv[1:]]
for (fa,a),(fb,b) in zip(h,h[1:]): print(f"{a-b:3d}  {fa} -> {fb}")
