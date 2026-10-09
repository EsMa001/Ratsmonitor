import json,re,sys,collections
t=json.load(open(sys.argv[1]))['topics']
def flat(x): return re.sub(r'\s+',' ',re.sub(r'-\n\s*','',x))
ZAHL=r'(?:ein|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn|\d+)'
R={
 'Einrichtung':r'\b(?:Kindertageseinrichtung|Kindertagesstätte|Kita|Grundschule|Gesamtschule|Förderschule|Realschule|Gymnasium|Berufskolleg|Familiengrundschulzentrum|Familienzentrum|Sporthalle|OGS|Offene Ganztagsschule)\b',
 'Größe':r'\b'+ZAHL+r'[- ]?(?:gruppig\w*|zügig\w*)|\b\d+\s+(?:Plätze|Kinder|Schülerinnen|Schüler|Klassen|Gruppen)\b',
 'Träger':r'\b(?:CVJM|DRK|AWO|Caritas|Diakonie|[A-ZÄÖÜ][\w-]+(?:\s[A-ZÄÖÜ][\w-]+){0,3}\s(?:gGmbH|e\.\s?V\.|GmbH))',
 'Zeitraum':r'\b(?:Kitajahr|Schuljahr)\s\d{4}/\d{2,4}',
 'Recht':r'\b(?:KiBiz|SchulG(?: NRW)?|SGB\s[IVX]+|§\s?\d+[a-z]?\s(?:KiBiz|SchulG|SGB\s[IVX]+|BGB))',
 'Verfahren':r'\b(?:Errichtungsbeschluss|Trägervergabe|Anmeldeverfahren|Bedarfsplanung|Kindertagesbetreuungsbericht|Raumprogramm|Fertigbauklasse\w*)',
}
def run(x):
    f=flat(x)
    return {k:collections.Counter(m.strip() for m in re.findall(p,f) if isinstance(m,str) and m.strip()).most_common(5) for k,p in R.items()}
ex=[y for y in t if y['id']=='papers-vo-2004056483'][0]
print('BEISPIEL:',ex['title'][:70])
for k,v in run(ex['sourceText']).items(): print(f' {k}:',[a for a,_ in v])
docs=[y for y in t if y['category']=='Bildung & Familie' and y.get('hasDocumentText') in (True,'True')]
print('\nTREFFER über',len(docs),'Dokumente der Kategorie:')
hit=collections.Counter(); n=0
for y in docs:
    r=run(y['sourceText']); n+=1
    for k,v in r.items():
        if v: hit[k]+=1
for k in R: print(f' {k}: {hit[k]} von {n}')
