import re,sys
txt=open(sys.argv[1],encoding='utf8').read()
# Vorbereitung: Seitenfuß und Kopfzeilen entfernen (Zeilen, die auf jeder Seite wiederkehren), Umbrüche glätten
lines=[l.strip() for l in txt.splitlines()]
cnt={}
for l in lines: cnt[l]=cnt.get(l,0)+1
lines=[l for l in lines if l and cnt[l]<2 and not re.fullmatch(r'Seite \d+ von \d+',l)]
flat=re.sub(r'\s+',' ',' '.join(lines))
def sätze(s): return [x.strip() for x in re.split(r'(?<=[.“])\s+(?=[A-ZÄÖÜ„])',s) if x.strip()]
out=[]
# R1: Status – einzeln stehendes Großwort ENTWURF in den ersten Zeilen
if 'ENTWURF' in lines[:15]: out.append(('R1 Status','Entwurf'))
# R2: Anlass – Satz mit Auslösewort "Aufgrund" UND "erforderlich"
for s in sätze(flat):
    if re.search(r'\bAufgrund\b',s) and re.search(r'\berforderlich\b',s): out.append(('R2 Anlass',s)); break
# R3: Kern – Text in Anführungszeichen direkt nach "wird wie folgt neu gefasst"
m=re.search(r'wie folgt neu gefasst:\s*„(.+?)“',flat)
if m:
    for s in sätze(m.group(1)): out.append(('R3 Änderung',s))
# R4: Inkrafttreten – Absatz direkt nach der Überschrift "Inkrafttreten"
m=re.search(r'Inkrafttreten\s+(.+?)\s+§\s?\d',flat)
if m:
    for s in sätze(m.group(1)): out.append(('R4 Inkrafttreten',s))
for r,s in out: print(f'{r}: {s}')
