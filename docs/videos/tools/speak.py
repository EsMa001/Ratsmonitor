import sys,subprocess,wave,re,json
txt,out,sent,comma=sys.argv[1],sys.argv[2],float(sys.argv[3]),float(sys.argv[4])
M="voices/de_DE-thorsten-high.onnx"
def synth(t,f):
    subprocess.run(["./venv/bin/python","-m","piper","-m",M,"-f",f],input=t.encode(),check=True,capture_output=True)
frames=[];params=None;pos=0.0;sents=[]
for line in open(txt,encoding="utf8").read().splitlines():
    line=line.strip()
    if not line: continue
    start=pos
    parts=re.findall(r'[^,]+,?',line)
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
