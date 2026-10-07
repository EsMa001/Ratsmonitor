"""Setzt Kapitelseiten und Kapitel zu einem Video zusammen: python3 assemble.py <ordner> <name> [kartenzeit-s]  (im Ordner ~/code/video-tools starten)
Schreibt out-web/<ordner>/<name>.mp4, .vtt und .jpg (Vorschaubild = erste Kapitelseite)."""
import json,subprocess,sys,os,re,glob
TOOLS=os.environ.get('VIDEO_TOOLS',os.path.expanduser('~/code/video-tools'))
FF=subprocess.check_output(['node','-p',f"require('{TOOLS}/node_modules/ffmpeg-static')"]).decode().strip()
PRESET,CRF=('veryfast','30') if os.environ.get('VIDEO_ENTWURF') else ('slow','24')
O=f'out-web/{sys.argv[1]}'; name=sys.argv[2]; CARD=float(sys.argv[3]) if len(sys.argv)>3 else 3.0
KARTEN=not (len(sys.argv)>4 and sys.argv[4]=='keine')  # 'keine' = Kapitel ohne Kapitelseite, nahtlos hintereinander
chs=json.load(open(f'{O}/chapters.json'))
def run(*a):
    r=subprocess.run([FF,'-y','-loglevel','error',*a],capture_output=True,text=True)
    if r.returncode: print(r.stderr[-500:]); sys.exit(1)
parts=[];vtt=['WEBVTT\n'];t=0.0
def ts(x):
    return f'{int(x//3600):02d}:{int(x%3600//60):02d}:{x%60:06.3f}'
def dur(p):
    r=subprocess.run([FF,'-i',p],capture_output=True,text=True).stderr
    m=re.search(r'Duration: (\d+):(\d+):([\d.]+)',r);return int(m[1])*3600+int(m[2])*60+float(m[3])
ENC=['-ar','22050','-ac','1','-c:v','libx264','-crf',CRF,'-c:a','aac','-b:a','96k']
def folie(n,wav=None,delay=0.0):
    # Folie (ohne Ton) mit gesprochenem Text (um delay verzögert) oder Stille zu einem Teil machen
    v=f'{O}/f-{n}.mp4'
    if not os.path.exists(v): return None
    out=f'{O}/p-{n}.mp4'
    if wav: run('-i',v,'-i',wav,'-map','0:v','-map','1:a','-af',f'adelay={int(delay*1000)}:all=1,apad','-shortest',*ENC,out)
    else: run('-i',v,'-f','lavfi','-i','anullsrc=r=22050:cl=mono','-map','0:v','-map','1:a','-shortest',*ENC,out)
    return out
p=folie('titel')
if p: parts.append(p); t+=dur(p)
for c in chs:
    n=f"{c['nr']:02d}"
    ch=f'{O}/c{n}/c{n}.mp4'; aj=json.load(open(f'{O}/c{n}/audio.json'))
    if not KARTEN:
        body=f'{O}/body{n}.mp4'
        run('-i',ch,'-vf','fps=30,scale=1280:720,format=yuv420p','-ar','22050','-ac','1','-c:v','libx264','-crf','24','-c:a','aac','-b:a','96k',body)
        for s in aj['sentences']:
            vtt.append(f"{ts(t+0.5+s['start'])} --> {ts(t+0.5+s['end']+0.3)}\n{s['text'].replace('Plenarra','Plenara')}\n")
        t+=dur(ch); parts.append(body); continue
    # Die Kapitelseite bleibt stehen, während der erste Satz gesprochen wird (mindestens CARD Sekunden)
    tc=min(9.0,max(CARD,0.5+aj['sentences'][0]['end']+0.5))
    card=f'{O}/card{n}.mp4'; body=f'{O}/body{n}.mp4'
    # Kapitelseite doppelt so lang: erst tc Sekunden still (zum Lesen), dann spricht der erste Satz darüber
    run('-loop','1','-t',str(2*tc),'-i',f'{O}/card{n}.png','-t',str(tc),'-i',ch,'-map','0:v','-map','1:a','-af',f'adelay={int(tc*1000)}:all=1,apad=whole_dur={2*tc:.2f}',
        '-vf',f'fps=30,format=yuv420p,fade=t=in:st=0:d=0.5,fade=t=out:st={2*tc-0.3}:d=0.3','-ar','22050','-ac','1','-c:v','libx264','-crf','24','-c:a','aac','-b:a','96k',card)
    run('-ss',str(tc),'-i',ch,'-vf','fps=30,scale=1280:720,format=yuv420p','-ar','22050','-ac','1','-c:v','libx264','-crf','24','-c:a','aac','-b:a','96k',body)
    for s in aj['sentences']:
        vtt.append(f"{ts(t+tc+0.5+s['start'])} --> {ts(t+tc+0.5+s['end']+0.3)}\n{s['text'].replace('Plenarra','Plenara')}\n")
    t+=tc+dur(ch)
    parts+=[card,body]
def vtt_add(txt,a,b): vtt.append(f"{ts(a)} --> {ts(b)}\n{txt.replace('Plenarra','Plenara')}\n")
p=folie('vorteile',f'{O}/ende1/audio.wav',0.7)
if p:
    for s_ in json.load(open(f'{O}/ende1/audio.json'))['sentences']: vtt_add(s_['text'],t+0.7+s_['start'],t+0.7+s_['end']+0.3)
    parts.append(p); t+=dur(p)
p=folie('schluss',f'{O}/ende2/audio.wav',1.9)
if p:
    for s_ in json.load(open(f'{O}/ende2/audio.json'))['sentences']: vtt_add(s_['text'],t+1.9+s_['start'],t+1.9+s_['end']+0.3)
    parts.append(p); t+=dur(p)
open(f'{O}/list-final.txt','w').write('\n'.join(f"file '{os.path.abspath(p)}'" for p in parts))
run('-f','concat','-safe','0','-i',f'{O}/list-final.txt','-vf','fps=30,scale=1280:720,format=yuv420p','-ar','22050','-ac','1','-c:v','libx264','-preset',PRESET,'-crf',CRF,'-c:a','aac','-b:a','96k','-movflags','+faststart',f'{O}/{name}.mp4')
open(f'{O}/{name}.vtt','w',encoding='utf8').write('\n'.join(vtt))
run('-i',f'{O}/card01.png' if KARTEN else f'{O}/{name}.mp4',*([] if KARTEN else ['-ss','4']),'-frames:v','1','-q:v','4',f'{O}/{name}.jpg')
print('Länge',round(dur(f'{O}/{name}.mp4')),'s',round(os.path.getsize(f'{O}/{name}.mp4')/1e6,1),'MB')
