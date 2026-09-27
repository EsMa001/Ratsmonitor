"""Fetch reproducible public NRW catalog inputs; Python 3 + PyYAML."""
from pathlib import Path
import json, urllib.request, urllib.parse
import yaml
root=Path(__file__).resolve().parents[1];tmp=root/'tmp';tmp.mkdir(exist_ok=True)
def get(url,path):
 with urllib.request.urlopen(url,timeout=120) as response: data=response.read(40_000_001)
 if len(data)>40_000_000:raise ValueError('Source too large')
 (tmp/path).write_bytes(data)
base='https://sgx.geodatenzentrum.de/'
query=dict(service='WFS',version='2.0.0',request='GetFeature',outputFormat='application/json',srsName='EPSG:4326')
flt='<Filter xmlns="http://www.opengis.net/ogc"><PropertyIsEqualTo><PropertyName>sn_l</PropertyName><Literal>05</Literal></PropertyIsEqualTo></Filter>'
get(base+'wfs_vg250?'+urllib.parse.urlencode({**query,'TYPENAMES':'vg250:vg250_gem','FILTER':flt}),'nrw-gemeinden.json')
get(base+'wfs_vg2500?'+urllib.parse.urlencode({**query,'TYPENAMES':'vg2500:vg2500_krs'}),'vg-krs.json')
get('https://raw.githubusercontent.com/OParl/resources/main/endpoints.yml','oparl-endpoints.yml')
entries=yaml.safe_load((tmp/'oparl-endpoints.yml').read_text())
(tmp/'oparl-endpoints.json').write_text(json.dumps(entries))
assert len(json.loads((tmp/'nrw-gemeinden.json').read_text())['features'])==396
print('NRW input files downloaded. Run python3 scripts/build-nrw.py next.')
