"""Setzt Bilder und Ton zu einem Video zusammen: python3 build.py <NN> <Vorschaubild-Sekunde> <name> [web]  (im Ordner ~/code/video-tools starten)
Schreibt out/<NN>/<name>.mp4/.jpg/.vtt (name z. B. erste-suche-mobil)."""
import json,subprocess,sys,os
TOOLS=os.environ.get('VIDEO_TOOLS',os.path.expanduser('~/code/video-tools'))
FF=subprocess.check_output(['node','-p',f"require('{TOOLS}/node_modules/ffmpeg-static')"]).decode().strip()
NN=sys.argv[1]; poster_t=float(sys.argv[2]); name=sys.argv[3]
WEB=len(sys.argv)>4 and sys.argv[4]=='web'   # Web: Querformat 1280x720, Ordner out-web/
D=f'out-web/{NN}' if WEB else f'out/{NN}'
SIZE='1280:720' if WEB else '780:1688'
T=json.load(open(f'{D}/audio.json')); S=json.load(open(f'{D}/screen.json'))
t0=S['t0']; fr=S['frames']
LEAD=0.5; total=T['total']+LEAD+1.0
start=t0-LEAD*1000; end=start+total*1000
def ts(x):
    h=int(x//3600);m=int(x%3600//60);s=x%60
    return f'{h:02d}:{m:02d}:{s:06.3f}'
vtt=['WEBVTT\n']
for s in T['sentences']:
    vtt.append(f"{ts(s['start']+LEAD)} --> {ts(s['end']+LEAD+0.3)}\n{s['text'].replace('Plenarra','Plenara')}\n")
open(f'{D}/{name}.vtt','w',encoding='utf8').write('\n'.join(vtt))
idx=[i for i,t in enumerate(fr) if t<=end]
first=max([i for i in idx if fr[i]<=start] or [idx[0]])
sel=[i for i in idx if i>=first]
lines=[]
for k,i in enumerate(sel):
    a=max(fr[i],start); b=min(fr[sel[k+1]] if k+1<len(sel) else end, end)
    lines.append(f"file 'raw/f{i:05d}.jpg'\nduration {max((b-a)/1000,0.001):.4f}")
lines.append(f"file 'raw/f{sel[-1]:05d}.jpg'")
open(f'{D}/list.txt','w').write('\n'.join(lines))
af=f"adelay={int(LEAD*1000)}|{int(LEAD*1000)},apad=whole_dur={total:.2f},atrim=0:{total:.2f}"
r=subprocess.run([FF,'-y','-f','concat','-safe','0','-i',f'{D}/list.txt','-i',f'{D}/audio.wav','-vf','fps=30,scale='+SIZE+':flags=lanczos,format=yuv420p','-af',af,'-c:v','libx264','-preset','slow','-crf','24','-c:a','aac','-b:a','96k','-t',f'{total:.2f}','-movflags','+faststart',f'{D}/{name}.mp4'],capture_output=True,text=True)
print(r.returncode, r.stderr[-400:] if r.returncode else 'ok')
r=subprocess.run([FF,'-y','-ss',str(poster_t),'-i',f'{D}/{name}.mp4','-frames:v','1','-q:v','4',f'{D}/{name}.jpg'],capture_output=True,text=True);print(r.returncode)
