import sys, json, subprocess, os
OUT, VDIR, OUTFILE = sys.argv[1], sys.argv[2], sys.argv[3]
S_ = os.path.dirname(os.path.abspath(__file__))
t = json.load(open(f'{OUT}/timing.json')); durs, starts = t['durs'], t['starts']
LEAD = 0.5; total = sum(durs); n = len(durs)
subprocess.run(['python3', '-I', f'{S_}/music.py', f'{total:.1f}'], check=True, cwd=OUT)
ain = []; af = ''
for i in range(n):
    ain += ['-i', f'{VDIR}/v{i + 1}.wav']; ms = int((starts[i] + LEAD) * 1000)
    af += f'[{i}:a]aresample=44100,adelay={ms}|{ms}[a{i}];'
ain += ['-i', f'{OUT}/music.wav']
af += ''.join(f'[a{i}]' for i in range(n)) + f'amix=inputs={n}:normalize=0,highpass=f=90,equalizer=f=3200:t=q:w=1:g=3,acompressor=threshold=0.1:ratio=3:attack=5:release=120:makeup=2,apad=whole_dur={total:.2f}[vp];'
af += '[vp]asplit=2[vm][vsc];'
af += f'[{n}:a]aresample=44100,volume=0.6[mus];'
af += '[mus][vsc]sidechaincompress=threshold=0.02:ratio=10:attack=15:release=400[duck];'
af += '[vm][duck]amix=inputs=2:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=7,aresample=44100[aout]'
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', *ain, '-filter_complex', af, '-map', '[aout]', '-t', f'{total:.2f}', f'{OUT}/mix2.wav'], check=True)
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', f'{OUT}/video_only.mp4', '-i', f'{OUT}/mix2.wav', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', OUTFILE], check=True)
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-ss', '1.6', '-i', OUTFILE, '-frames:v', '1', OUTFILE.replace('.mp4', '_Titelbild.png')], check=True)
print(OUTFILE)
