"""Setzt Kapitelseiten und Kapitel zu einem Video zusammen: python3 assemble.py <ordner> <name> [kartenzeit-s]  (im Ordner ~/code/video-tools starten)
Schreibt out-web/<ordner>/<name>.mp4, .vtt und .jpg (Vorschaubild = erste Kapitelseite)."""
import json,subprocess,sys,os,re,glob
TOOLS=os.environ.get('VIDEO_TOOLS',os.path.expanduser('~/code/video-tools'))
FF=subprocess.check_output(['node','-p',f"require('{TOOLS}/node_modules/ffmpeg-static')"]).decode().strip()
O=f'out-web/{sys.argv[1]}'; name=sys.argv[2]; CARD=float(sys.argv[3]) if len(sys.argv)>3 else 3.0
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
for c in chs:
    n=f"{c['nr']:02d}"
    ch=f'{O}/c{n}/c{n}.mp4'; aj=json.load(open(f'{O}/c{n}/audio.json'))
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
open(f'{O}/list-final.txt','w').write('\n'.join(f"file '{os.path.abspath(p)}'" for p in parts))
run('-f','concat','-safe','0','-i',f'{O}/list-final.txt','-vf','fps=30,scale=1280:720,format=yuv420p','-ar','22050','-ac','1','-c:v','libx264','-preset','slow','-crf','24','-c:a','aac','-b:a','96k','-movflags','+faststart',f'{O}/{name}.mp4')
open(f'{O}/{name}.vtt','w',encoding='utf8').write('\n'.join(vtt))
run('-i',f'{O}/card01.png','-frames:v','1','-q:v','4',f'{O}/{name}.jpg')
print('Länge',round(dur(f'{O}/{name}.mp4')),'s',round(os.path.getsize(f'{O}/{name}.mp4')/1e6,1),'MB')
