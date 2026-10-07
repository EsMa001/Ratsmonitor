import sys,subprocess,wave,re,json,os,hashlib,shutil
txt,out,sent,comma=sys.argv[1],sys.argv[2],float(sys.argv[3]),float(sys.argv[4])
M="voices/de_DE-thorsten-high.onnx"
# Zwischenspeicher: ein Satzteil wird nur einmal gesprochen (Schlüssel = Modell + Text), so braucht eine Textänderung nur den geänderten Satz
CACHE=os.environ.get('TTS_CACHE','cache/tts'); os.makedirs(CACHE,exist_ok=True)
def synth(t,f):
    k=f"{CACHE}/{hashlib.sha1((M+'|'+t).encode()).hexdigest()}.wav"
    if os.path.exists(k): shutil.copy(k,f); return
    synth_raw(t,f); shutil.copy(f,k)
def synth_raw(t,f):
    subprocess.run(["./venv/bin/python","-m","piper","-m",M,"-f",f],input=t.encode(),check=True,capture_output=True)
frames=[];params=None;pos=0.0;sents=[]
for line in open(txt,encoding="utf8").read().splitlines():
    line=line.strip()
    if not line: continue
    start=pos
    parts=re.findall(r'[^,]+,?',line) if comma>0 else [line]   # Kommapause 0: ganzer Satz in einem Stück, ohne künstliche Pause
    for i,p in enumerate(parts):
        f="/tmp/_s.wav"; synth(p.strip(),f)
        w=wave.open(f); params=w.getparams(); d=w.readframes(w.getnframes()); n=w.getnframes()/params.framerate; w.close()
        frames.append(d); pos+=n
        if i<len(parts)-1:
            frames.append(b"\0"*int(params.framerate*comma)*params.sampwidth*params.nchannels); pos+=int(params.framerate*comma)/params.framerate
    sents.append({"text":line,"start":round(start,2),"end":round(pos,2)})
    frames.append(b"\0"*int(params.framerate*sent)*params.sampwidth*params.nchannels); pos+=int(params.framerate*sent)/params.framerate
o=wave.open(out,"wb"); o.setparams(params); o.writeframes(b"".join(frames)); o.close()
json.dump({"sentences":sents,"total":round(pos,2)},open(out.replace(".wav",".json"),"w"),ensure_ascii=False,indent=1)
