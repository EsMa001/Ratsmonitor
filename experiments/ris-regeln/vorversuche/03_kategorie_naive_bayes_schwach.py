import json,re,sys,math,collections,random
t=json.load(open(sys.argv[1]))['topics']
tok=lambda s:[w.lower() for w in re.findall(r'[A-Za-zÄÖÜäöüß]{4,}',s)]
D=[(y['id'],y['title'],y['category'],collections.Counter(tok(y['sourceText']))) for y in t if y.get('hasDocumentText') in (True,'True')]
lab=[d for d in D if d[2]!='Stadtleben']; stad=[d for d in D if d[2]=='Stadtleben']
print('mit Text:',len(D),'| bereits eingeordnet:',len(lab),'| in Stadtleben:',len(stad))
def train(data):
    cls=collections.defaultdict(collections.Counter); n=collections.Counter()
    for _,_,c,tf in data: cls[c].update({w:1 for w in tf}); n[c]+=1   # Dokumentfrequenz je Kategorie
    V=set(w for c in cls for w in cls[c]); return cls,n,V
def predict(model,tf):
    cls,n,V=model; tot=sum(n.values()); best=[]
    for c in cls:
        s=math.log(n[c]/tot)
        for w in tf:
            s+=math.log((cls[c][w]+0.5)/(n[c]+1))-math.log((sum(cls[k][w] for k in cls)+0.5)/(tot+1))*0
        best.append((s,c))
    best.sort(reverse=True); return best
# Leave-one-out gegen die vorhandenen Titel-Kategorien
ok=0
for i,d in enumerate(lab):
    m=train(lab[:i]+lab[i+1:]); p=predict(m,d[3])[0][1]; ok+=(p==d[2])
print(f'Übereinstimmung mit bisheriger Einordnung (Leave-one-out): {ok} von {len(lab)}')
m=train(lab); random.seed(3)
print('\nBeispiele aus „Stadtleben“ (Titel -> Vorschlag aus Volltext):')
for d in random.sample(stad,12):
    b=predict(m,d[3]); gap=b[0][0]-b[1][0]
    print(f' - {d[1][:70]} -> {b[0][1]} (Abstand {gap:.0f})')
