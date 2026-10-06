import json,subprocess,sys
FF=subprocess.check_output(['/Users/nico/.local/bin/node','-p',"require('/Users/nico/code/video-tools/node_modules/ffmpeg-static')"]).decode().strip()
name=sys.argv[1]; poster_t=float(sys.argv[2])
T=json.load(open('audio.json')); off=json.load(open('screen.json'))['offset']
LEAD=0.5; total=T['total']+LEAD+1.0
def ts(x):
    h=int(x//3600);m=int(x%3600//60);s=x%60
    return f'{h:02d}:{m:02d}:{s:06.3f}'
vtt=['WEBVTT\n']
for s in T['sentences']:
    vtt.append(f"{ts(s['start']+LEAD)} --> {ts(s['end']+LEAD+0.3)}\n{s['text'].replace('Plenarra','Plenara')}\n")
open(f'{name}.vtt','w',encoding='utf8').write('\n'.join(vtt))
vf=f"trim=start={off-LEAD:.3f}:end={off-LEAD+total:.3f},setpts=PTS-STARTPTS,fps=30,scale=1280:720"
af=f"adelay={int(LEAD*1000)}|{int(LEAD*1000)},apad=whole_dur={total:.2f},atrim=0:{total:.2f}"
r=subprocess.run([FF,'-y','-i','screen.webm','-i','audio.wav','-vf',vf,'-af',af,'-c:v','libx264','-preset','slow','-pix_fmt','yuv420p','-crf','24','-c:a','aac','-b:a','96k','-movflags','+faststart',f'{name}.mp4'],capture_output=True,text=True)
print(r.returncode, r.stderr[-400:] if r.returncode else 'ok')
r=subprocess.run([FF,'-y','-ss',str(poster_t),'-i',f'{name}.mp4','-frames:v','1','-vf','scale=960:-1','-q:v','4',f'{name}.jpg'],capture_output=True,text=True);print(r.returncode)
