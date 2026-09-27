"""Import a completed blinded review CSV without changing the frozen sample."""
import csv,json,sys
from pathlib import Path
folder=Path(sys.argv[1] if len(sys.argv)>1 else 'tmp/label-study')
source=Path(sys.argv[2]) if len(sys.argv)>2 else folder/'referenzstichprobe.csv'
refs=json.loads((folder/'references.json').read_text()); by_id={r['id']:r for r in refs}
labels={r['id'] for r in json.loads((folder/'catalog.json').read_text())}
seen=set()
with source.open(newline='',encoding='utf-8-sig') as f:
 for row in csv.DictReader(f):
  key=row['id'];assert key in by_id and key not in seen,'Unbekannte oder doppelte Stichproben-ID';seen.add(key)
  assert row['input_hash']==by_id[key]['inputHash'],'Geänderter Originaltext'
  status=row['status'].strip();assert status in ('pending','adjudicated'),'Status muss pending oder adjudicated sein'
  if status=='adjudicated':
   primary=row['referenz_label'].strip();reviewer=row['pruefer'].strip();reason=row['begruendung'].strip()
   assert primary in labels and reviewer and reason,'Freigabe braucht gültiges Label, Prüfer und Begründung'
   by_id[key].update(primary=primary,reviewer=reviewer,reason=reason,status=status)
assert seen==set(by_id),'Stichprobe unvollständig; keine Zeilen entfernen'
(folder/'references.json.tmp').write_text(json.dumps(refs,ensure_ascii=False,indent=2))
(folder/'references.json.tmp').replace(folder/'references.json')
print(json.dumps({'reviewed':sum(r['status']=='adjudicated' for r in refs),'sample':len(refs)}))
