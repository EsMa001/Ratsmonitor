from pathlib import Path
import json,re,unicodedata,math
root=Path(__file__).resolve().parents[1]
gems=json.loads((root/'tmp/nrw-gemeinden.json').read_text())['features']
kreise=[f for f in json.loads((root/'tmp/vg-krs.json').read_text())['features'] if f['properties']['sn_l']=='05' and f['properties']['bez']!='Kreisfreie Stadt']
print('Municipalities / districts',len(gems),len(kreise))
alias={'05558008':'billerbeck','05515000':'muenster','05558':'coesfeld','05566':'steinfurt','05554':'borken','05570':'warendorf','05562':'recklinghausen'}
idof=lambda ags:alias.get(ags,'nrw-'+ags)
regions=[]
for f in kreise:
 p=f['properties'];ags=p['ags'];regions.append(dict(id=idof(ags),name=p['bez']+' '+p['gen'],shortName=p['gen'],kind='district',district=idof(ags),ags=ags))
for f in gems:
 p=f['properties'];ags=p['ags'];district=next((r['id'] for r in regions if r['ags']==ags[:5]),None)
 regions.append(dict(id=idof(ags),name=p['bez']+' '+p['gen'],shortName=p['gen'],kind='city',district=district,ags=ags,municipalityType=p['bez'],independent=district is None))
regions.sort(key=lambda r:(r['id']!='billerbeck',r['shortName']))
(root/'shared/nrw-regions.json').write_text(json.dumps(regions,ensure_ascii=False,indent=2))
def norm(s):
 s=re.sub(r'^(Landeshauptstadt|Klingenstadt|Kolpingstadt|Kreisverwaltung|Stadt|Gemeinde|Kreis)\s+','',s,flags=re.I)
 return re.sub('[^a-z0-9]','',unicodedata.normalize('NFKD',s).encode('ascii','ignore').decode().lower())
endpoints=json.loads((root/'tmp/oparl-endpoints.json').read_text());sources=[]
for r in regions:
 matches=[e for e in endpoints if norm(e['title'])==norm(r['shortName']) and bool(re.match('Kreis|Landkreis',e['title']))==(r['kind']=='district')]
 if matches and r['id']!='muenster':
  e=sorted(matches,key=lambda e:('v1.1' not in e['url'],'sdnetrim' in e['url']))[0]
  sources.append(dict(id=r['id'],name=r['name'],kind=r['kind'],system=e['url'],method='oparl',registrySource='https://github.com/OParl/resources/blob/main/endpoints.yml',state='discovered'))
overrides=json.loads((root/'server/integrations/source-overrides.json').read_text())
for source in sources:source.update(overrides.get(source['id'],{}))
(root/'server/integrations/nrw-sources.json').write_text(json.dumps(sources,ensure_ascii=False,indent=2))
# Compute simplified SVG geometry from published coordinates, using existing projection.
print('Matched OParl sources:',len(sources));print([(s['name'],s['system']) for s in sources])
