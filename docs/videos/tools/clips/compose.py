"""Setzt aus einem Clip (rec-clip.mjs) und dem Ton (speak.py) ein Video zusammen: python3 compose.py <szene> <kapitelordner> <name> [vorschau-sekunde]
(im Ordner ~/code/video-tools starten). Der Kapitelordner enthält audio.json (speak.py) und beats.json (prep.mjs: je Satz die Clip-Schritte).
Jeder Satz bekommt die Zeit bis zum nächsten Satz. Die ihm zugeordneten Schritte laufen so lange, wie sie aufgenommen wurden: ist der Satz länger, bleibt das
letzte Bild stehen, ist er kürzer, läuft der Clip bis auf das Doppelte schneller. Sätze ohne Schritt halten das letzte Bild. Ergebnis: <kapitelordner>/<name>.mp4/.vtt/.jpg"""
import json,subprocess,sys,os
TOOLS=os.environ.get('VIDEO_TOOLS',os.path.expanduser('~/code/video-tools'))
FF=subprocess.check_output(['node','-p',f"require('{TOOLS}/node_modules/ffmpeg-static')"]).decode().strip()
scene,D,name=sys.argv[1:4]; poster=float(sys.argv[4]) if len(sys.argv)>4 else 1.0
C=json.load(open(f'out-clips/{scene}/clip.json')); T=json.load(open(f'{D}/audio.json')); B=json.load(open(f'{D}/beats.json'))
fr=C['frames']; byname={b['name']:b for b in C['beats']}
LEAD=0.5; total=T['total']+LEAD+1.0
S=T['sentences']
def ts(x): return f'{int(x//3600):02d}:{int(x%3600//60):02d}:{x%60:06.3f}'
def beat_frames(b):
    idx=[i for i,t in enumerate(fr) if b['start']<=t<b['end']]
    return [(i,((fr[i+1] if i+1<len(fr) else b['end'])-fr[i])/1000) for i in idx]
out=[]; last=None
# Folgen mehrere Sätze mit denselben Schritten aufeinander, laufen die Schritte einmal über alle diese Sätze
groups=[]
for k in range(len(S)):
    if groups and B[k] and B[k]==B[groups[-1][0]]: groups[-1][1]=k
    else: groups.append([k,k])
for k0,k1 in groups:
    a=0.0 if k0==0 else S[k0]['start']+LEAD
    e=(S[k1+1]['start']+LEAD) if k1+1<len(S) else total
    span=e-a
    seg=[]
    for n in B[k0]:
        if n not in byname: sys.exit(f'Schritt "{n}" gibt es im Clip {scene} nicht')
        seg+=beat_frames(byname[n])
    if not seg:
        if last is None: sys.exit('Der erste Satz braucht einen Schritt')
        out.append((last,span)); continue
    tot=sum(d for _,d in seg)
    if tot<=span: seg[-1]=(seg[-1][0],seg[-1][1]+span-tot)
    else:
        f=max(span/tot,0.5); acc=0; cut=[]
        for i,d in seg:
            d*=f
            if acc+d>=span: cut.append((i,span-acc)); break
            cut.append((i,d)); acc+=d
        seg=cut
    out+=seg; last=seg[-1][0]
lines=[]
for i,d in out: lines.append(f"file '{os.path.abspath(f'out-clips/{scene}/raw/f{i:05d}.jpg')}'\nduration {max(d,0.001):.4f}")
lines.append(f"file '{os.path.abspath(f'out-clips/{scene}/raw/f{out[-1][0]:05d}.jpg')}'")
open(f'{D}/list-{name}.txt','w').write('\n'.join(lines))
vtt=['WEBVTT\n']+[f"{ts(s['start']+LEAD)} --> {ts(s['end']+LEAD+0.3)}\n{s['text'].replace('Plenarra','Plenara')}\n" for s in S]
open(f'{D}/{name}.vtt','w',encoding='utf8').write('\n'.join(vtt))
af=f"adelay={int(LEAD*1000)}|{int(LEAD*1000)},apad=whole_dur={total:.2f},atrim=0:{total:.2f}"
r=subprocess.run([FF,'-y','-f','concat','-safe','0','-i',f'{D}/list-{name}.txt','-i',f'{D}/audio.wav','-vf','fps=30,scale=1280:720:flags=lanczos,format=yuv420p','-af',af,'-c:v','libx264','-preset','slow','-crf','24','-c:a','aac','-b:a','96k','-t',f'{total:.2f}','-movflags','+faststart',f'{D}/{name}.mp4'],capture_output=True,text=True)
print(r.returncode,'ok' if r.returncode==0 else r.stderr[-400:])
subprocess.run([FF,'-y','-loglevel','error','-ss',str(poster),'-i',f'{D}/{name}.mp4','-frames:v','1','-q:v','4',f'{D}/{name}.jpg'])
print('Clip-Stand',C['commit'],'Länge',round(total))
