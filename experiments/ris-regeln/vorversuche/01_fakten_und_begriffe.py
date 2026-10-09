import json,re,sys,math,collections
t=json.load(open(sys.argv[1]))['topics']
docs={x['id']:x['sourceText'] for x in t if x.get('hasDocumentText') in (True,'True')}
x=docs[sys.argv[2]]
body=re.sub(r'[ \t]+',' ',x)
body=re.sub(r'-\n\s*','',body)          # Silbentrennung am Zeilenende
flat=re.sub(r'\s*\n\s*',' ',body)
# 1) Beträge
amt=re.findall(r'[–-]?\s?\d{1,3}(?:\.\d{3})*(?:,\d+)?\s?(?:Mio\.|Mrd\.|Millionen|Milliarden|Euro|€|T€|Tsd\.)(?:\s?€)?',flat)
print('BETRÄGE:',collections.Counter(a.strip() for a in amt).most_common(12))
print('PROZENT:',sorted(set(re.findall(r'\d+(?:,\d+)?\s?%',flat)))[:10])
print('PARAGRAPHEN:',sorted(set(re.findall(r'§\s?\d+[a-z]?(?:\s?Abs\.\s?\d+)?\s?\w*',flat)))[:6])
print('DATEN:',sorted(set(re.findall(r'\d{2}\.\d{2}\.\d{4}',flat))))
print('AKTENZEICHEN:',sorted(set(re.findall(r'[A-Z]/\d{4}/\d{4}',flat))))
# 2) Schlüsselbegriffe: tf-idf gegen die anderen Dokumente
tok=lambda s:[w.lower() for w in re.findall(r'[A-Za-zÄÖÜäöüß]{5,}',s)]
df=collections.Counter()
for d in docs.values(): df.update(set(tok(d)))
N=len(docs); tf=collections.Counter(tok(flat))
sc={w:c*math.log(N/df[w]) for w,c in tf.items() if c>=3}
print('BEGRIFFE:',[w for w,_ in sorted(sc.items(),key=lambda a:-a[1])[:12]])
# 3) Schlüsselsätze: Sätze mit Zahlen und Begriffen
sents=[s.strip() for s in re.split(r'(?<=[.!?])\s+(?=[A-ZÄÖÜ])',flat) if 40<len(s)<300]
def score(s):
    ws=tok(s); 
    return (sum(sc.get(w,0) for w in ws)/max(1,len(ws)))*(1.5 if re.search(r'\d',s) else 1)
top=sorted(sents,key=score,reverse=True)[:4]
print('SÄTZE:'); [print(' -',s) for s in sorted(top,key=sents.index)]
