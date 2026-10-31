import numpy as np, wave, sys
sr=44100; total=float(sys.argv[1]); n=int(total*sr)
t=np.arange(n)/sr
def note(f,t0,dur,amp,attack=1.2,rel=1.5):
    m=(t>=t0)&(t<t0+dur+rel)
    tt=t[m]-t0
    env=np.minimum(1,tt/attack)*np.where(tt<dur,1,np.maximum(0,1-(tt-dur)/rel))
    s=sum(np.sin(2*np.pi*f*k*tt)/(k**1.6) for k in (1,2,3,4))
    out=np.zeros(n); out[m]=s*env*amp; return out
def pluck(f,t0,amp):
    m=(t>=t0)&(t<t0+1.6); tt=t[m]-t0
    s=np.sin(2*np.pi*f*tt)+0.3*np.sin(2*np.pi*2*f*tt)
    out=np.zeros(n); out[m]=s*np.exp(-tt*3.2)*amp; return out
chords=[(130.81,164.81,196.00,246.94),(110.00,130.81,164.81,196.00),(174.61,220.00,261.63,329.63),(196.00,246.94,293.66,392.00)]
arp=[523.25,659.25,783.99,987.77, 440.0,523.25,659.25,783.99, 698.46,880.0,1046.5,659.25, 783.99,987.77,1174.7,587.33]
y=np.zeros(n); step=4.0
for i in range(int(total/step)+2):
    for f in chords[i%4]: y+=note(f,i*step,step,0.10)
    for j,f in enumerate(arp[(i%4)*4:(i%4)*4+4]):
        y+=pluck(f,i*step+j*0.5+0.25,0.05)
        y+=pluck(f,i*step+2+j*0.5+0.25,0.04)
fade=np.minimum(1,np.minimum(t/1.0,(total-t)/2.0)); y*=fade
y=y/np.max(np.abs(y))*0.8
st=np.stack([y,np.roll(y,int(0.012*sr))],1)
w=wave.open('music.wav','wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(sr)
w.writeframes((st*32767).astype('<i2').tobytes()); w.close()
