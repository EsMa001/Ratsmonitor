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
def rdp(pts,eps=.22):
 if len(pts)<3:return pts
 a,b=pts[0],pts[-1];dx,dy=b[0]-a[0],b[1]-a[1];den=dx*dx+dy*dy
 dist=[]
 for x,y in pts[1:-1]:
  t=max(0,min(1,((x-a[0])*dx+(y-a[1])*dy)/den)) if den else 0
  dist.append(math.hypot(x-a[0]-t*dx,y-a[1]-t*dy))
 m=max(dist)
 if m<=eps:return [a,b]
 i=dist.index(m)+1;return rdp(pts[:i+1],eps)[:-1]+rdp(pts[i:],eps)
def shape(f):
 polygons=f['geometry']['coordinates'] if f['geometry']['type']=='MultiPolygon' else [f['geometry']['coordinates']]
 points=[];paths=[]
 for poly in polygons:
  for ring in poly:
   xy=[[(lon-5.6)*60,(55.2-lat)*96] for lon,lat in ring];points+=xy;simple=rdp(xy)
   if len(simple)<4:simple=xy
   paths.append(''.join(('M' if i==0 else 'L')+','.join(f'{v:.2f}' for v in p) for i,p in enumerate(simple))+'Z')
 xs=[p[0] for p in points];ys=[p[1] for p in points];bounds=[min(xs),min(ys),max(xs),max(ys)]
 return dict(path=''.join(paths),bounds=bounds,center=[(bounds[0]+bounds[2])/2,(bounds[1]+bounds[3])/2])
m=json.loads((root/'public/geo/germany.json').read_text());m['regions']=[]
for f in kreise+gems:
 ags=f['properties']['ags'];r=next(r for r in regions if r['ags']==ags);m['regions'].append(dict(id=r['id'],name=r['shortName'],ags=ags,kind=r['kind'],**shape(f)))
b=[min(r['bounds'][0] for r in m['regions'])-6,min(r['bounds'][1] for r in m['regions'])-6,max(r['bounds'][2] for r in m['regions'])+6,max(r['bounds'][3] for r in m['regions'])+6]
m['regionViewBox']=' '.join(map(str,[b[0],b[1],b[2]-b[0],b[3]-b[1]]));m['geometryDates']='Gemeinden VG250: Abruf 26.09.2026; Kreise/Länder VG2500: 31.12.2024'
(root/'public/geo/germany.json').write_text(json.dumps(m,ensure_ascii=False,separators=(',',':')))
print('Matched OParl sources:',len(sources));print([(s['name'],s['system']) for s in sources]);print('Geometry bytes:',(root/'public/geo/germany.json').stat().st_size)
