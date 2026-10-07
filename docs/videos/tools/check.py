"""Prüft ein fertiges Video auf Blitzbilder: python3 check.py <video.mp4>  (im Ordner ~/code/video-tools starten)
Ein Bild, das nur kurz (unter 0,5 s) zwischen zwei Schnitten steht, ist fast immer ein Fehler (Ladebildschirm, Sprung der Scrollposition). Gibt WARNUNG mit Zeitpunkten aus, Exitcode 0."""
import subprocess,sys,os,re
TOOLS=os.environ.get('VIDEO_TOOLS',os.path.expanduser('~/code/video-tools'))
FF=subprocess.check_output(['node','-p',f"require('{TOOLS}/node_modules/ffmpeg-static')"]).decode().strip()
v=sys.argv[1]
r=subprocess.run([FF,'-i',v,'-vf',"select='gt(scene,0.12)',showinfo",'-an','-f','null','-'],capture_output=True,text=True).stderr
cuts=[float(x) for x in re.findall(r'pts_time:([0-9.]+)',r)]
bad=[(a,b) for a,b in zip(cuts,cuts[1:]) if b-a<0.5]
for a,b in bad: print(f'WARNUNG: Blitzbild bei {a:.1f} s (steht nur {b-a:.2f} s), Szene prüfen (Laden/Scroll in H.hidden oder setup)')
print('Blitzbild-Prüfung:', 'ok' if not bad else f'{len(bad)} Auffälligkeit(en)')
