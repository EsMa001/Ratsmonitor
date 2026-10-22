# Schritt 5: multilingual-e5-small mit den eingeordneten Berichten nachtrainieren (requirements/modell-konzept.md) und danach
# alle Texte der Stichproben neu einbetten, im selben Format wie embed-big.mjs / embed.mjs (Float32, Schlüssel-Liste).
# Gelernt wird je einzelnem Text (Titel, Ergebnisse, PDF) mit den Fragen, die zu ihm passen; die Lernköpfe werden danach verworfen.
# Prüfberichte (set check) und der Abstimmungsteil (i % 7 == 0) bleiben draußen, damit train3/train4 ehrlich messen.
#   ~/code/ml-tools/venv/bin/python scripts/model/finetune.py [--epochs 3] [--steps N] [--suffix=-ft] [--out tmp/ml]
# (aus dem Projektordner; Python-Umgebung: python3 -m venv ~/code/ml-tools/venv && pip install torch transformers onnx onnxruntime)
import json, re, sys, time, argparse, random, os
import numpy as np, torch
from transformers import AutoTokenizer, AutoModel

ap = argparse.ArgumentParser()
ap.add_argument('--epochs', type=float, default=3)
ap.add_argument('--steps', type=int, default=0)       # nur Probelauf: nach N Schritten aufhören
ap.add_argument('--suffix', default='-ft')
ap.add_argument('--lr', type=float, default=3e-5)
ap.add_argument('--batch', type=int, default=16)
ap.add_argument('--maxlen', type=int, default=384)
ap.add_argument('--no-embed', action='store_true')
ap.add_argument('--out', default='tmp/ml')
a = ap.parse_args()
os.makedirs(a.out, exist_ok=True)
FX = 'tests/fixtures/'
dev = 'mps' if torch.backends.mps.is_available() else 'cpu'
torch.manual_seed(1); random.seed(1)
PLACEHOLDER = re.compile(r'^Öffentlich(?:er Tagesordnungspunkt| auf der Tagesordnung);|^In der Tagesordnung geführt|^Sitzung steht noch aus')

def texts_of(r):
    out = [('t', f"{r['title']} | Gremium: {r.get('committee') or ''}"[:500])]
    res = [e['result'] for e in r.get('events', []) if e.get('result') and not PLACEHOLDER.search(e['result'])]
    if res: out.append(('r', ' | '.join(res)[:500]))
    for p in r.get('pdfs', []):
        out.append((f"p.{p['i']}", f"{p['name']} | {(p.get('first') or '')[:900]} | {(p.get('decision') or '')[:300]}"))
    return out

big = json.load(open(FX + 'kern-big.json'))['rows']
ext = json.load(open(FX + 'kern-extra.json'))['rows']
KIND = ['subject', 'procedure', 'personal']
STATUS = ['announced', 'consulting', 'recommended', 'approved', 'rejected', 'postponed', 'info', 'unknown']
THEMES = ['bauen', 'finanzen', 'mobilitaet', 'bildung', 'umwelt', 'soziales', 'kultur', 'sicherheit', 'verwaltung', 'wirtschaft']
PROC = ['information', 'political', 'permit', 'planning', 'build', 'money', 'contract', 'other']
PS = ['aufstellung', 'fruehzeitig', 'entwurf', 'abwaegung', 'satzung', 'aufhebung', 'sonst']
DT = ['paper', 'bundle', 'attachment', 'result', 'minutes', 'session', 'other']
train_rows = [r for i, r in enumerate(big) if r.get('gold') and r.get('set') != 'check' and i % 7 != 0] + [r for r in ext if r.get('gold')]
SUBS = sorted({s for r in train_rows for s in r['gold'].get('subs') or []})
SSUBS = sorted({s for r in train_rows for s in r['gold'].get('subsubs') or []})
TASKS = {'k': KIND, 's': STATUS, 't': THEMES, 'p': PROC, 'v': ['ja'], 'l': PS, 'u': SUBS, 'uu': SSUBS, 'dt': DT, 'm': ['main', 'result']}
OFF = {}; n = 0
for k, cls in TASKS.items(): OFF[k] = n; n += len(cls)
NOUT = n

def target(sets):
    y = np.zeros(NOUT, np.float32); m = np.zeros(NOUT, np.float32)
    for k, gold, on in sets:
        if not on: continue
        for j, c in enumerate(TASKS[k]):
            m[OFF[k] + j] = 1; y[OFF[k] + j] = 1 if c in gold else 0
    return y, m

ex = []
for r in train_rows:
    g = r['gold']; S = g.get('kind') == 'subject'
    rep = [('k', [g.get('kind')], True), ('t', g.get('themes') or [], S), ('p', [g.get('process')], S), ('v', ['ja'] if g.get('project') else [], S),
           ('l', [g.get('planstep')], S and bool(g.get('planstep'))), ('u', g.get('subs') or [], S), ('uu', g.get('subsubs') or [], S and bool(g.get('subs')))]
    for key, txt in texts_of(r):
        if key == 't': y, m = target(rep + [('s', [g.get('status')], True)])
        elif key == 'r': y, m = target([('s', [g.get('status')], True)])
        else:
            i = int(key[2:]); dts = g.get('doctypes') or []
            isMain, isRes = g.get('main') == i, g.get('result_doc') == i
            sets = [('dt', [dts[i]] if i < len(dts) else [], i < len(dts)), ('m', (['main'] if isMain else []) + (['result'] if isRes else []), True)]
            if isMain: sets += rep
            if isRes: sets += [('s', [g.get('status')], True)]
            y, m = target(sets)
        ex.append(('query: ' + txt, y, m))
# Zusatztitel der Themenversuche (ohne Titel, die wortgleich unter den Prüfberichten stehen)
check_titles = {r['title'].lower() for r in big if r.get('set') == 'check'}
SUBID = {}
for s in SUBS: SUBID.setdefault(s.split('.', 1)[1], []).append(s)
for name in ['theme-dev', 'theme-val', 'theme-test', 'theme-train-a', 'theme-train-b', 'theme-train-c', 'theme-check-a']:
    for r in json.load(open(FX + name + '.json'))['rows']:
        g = r.get('gold')
        if not g or str(r['title']).lower() in check_titles: continue
        subs = [x for s in g.get('subs') or [] for x in SUBID.get(s, []) if x.split('.')[0] in (g.get('themes') or [])]
        y, m = target([('t', g.get('themes') or [], True), ('u', subs, True)])
        ex.append(('query: ' + str(r['title'])[:300], y, m))
print('Lernbeispiele', len(ex), 'Ausgänge', NOUT, 'Gerät', dev, flush=True)

tok = AutoTokenizer.from_pretrained('intfloat/multilingual-e5-small')
enc = AutoModel.from_pretrained('intfloat/multilingual-e5-small').to(dev)
head = torch.nn.Linear(384, NOUT).to(dev)
# Wortliste (250.000 × 384) bleibt fest: spart Speicher und Lernzustand, gelernt werden die zwölf Schichten
enc.embeddings.word_embeddings.weight.requires_grad_(False)
enc.gradient_checkpointing_enable()
def pool(out, att):
    h = out.last_hidden_state * att.unsqueeze(-1)
    return h.sum(1) / att.sum(1, keepdim=True)
opt = torch.optim.AdamW([{'params': [p for p in enc.parameters() if p.requires_grad], 'lr': a.lr}, {'params': head.parameters(), 'lr': 1e-3}], weight_decay=0.01)
# nach Länge sortierte Pakete (weniger Auffüllen), Reihenfolge der Pakete gemischt
order = sorted(range(len(ex)), key=lambda i: len(ex[i][0]))
# Wenige feste Formen (die Grafikeinheit legt je Form einen Rechenplan an und behält ihn): Länge in Stufen von 64 Wortstücken,
# je Stufe eine feste Paketgröße mit etwa TOKENS Wortstücken
TOKENS = a.batch * 128
lens = [len(t) for t in tok([e[0] for e in ex], truncation=True, max_length=a.maxlen)['input_ids']]
BUCK = {}
for i in order: BUCK.setdefault(min(a.maxlen, -(-lens[i] // 64) * 64), []).append(i)
batches = []
for L, ids in BUCK.items():
    n = max(1, TOKENS // L); batches += [(L, ids[k:k + n]) for k in range(0, len(ids), n)]
steps = int(len(batches) * a.epochs) if not a.steps else a.steps
print('Pakete', len(batches), 'Schritte', steps, flush=True)
sched = torch.optim.lr_scheduler.LambdaLR(opt, lambda s: min(1, (s + 1) / 200) * max(0.05, 1 - s / steps))
enc.train(); t0 = time.time(); step = 0; run = 0
while step < steps:
    random.shuffle(batches)
    for L, b in batches:
        if step >= steps: break
        T = tok([ex[i][0] for i in b], padding='max_length', truncation=True, max_length=L, return_tensors='pt').to(dev)
        y = torch.tensor(np.stack([ex[i][1] for i in b])).to(dev); m = torch.tensor(np.stack([ex[i][2] for i in b])).to(dev)
        e = torch.nn.functional.normalize(pool(enc(**T), T['attention_mask']), dim=-1) * 20
        loss = (torch.nn.functional.binary_cross_entropy_with_logits(head(e), y, reduction='none') * m).sum() / m.sum().clamp(min=1)
        opt.zero_grad(); loss.backward(); torch.nn.utils.clip_grad_norm_(enc.parameters(), 1.0); opt.step(); sched.step(); step += 1
        if dev == 'mps' and step % 10 == 0: torch.mps.empty_cache()
        run = 0.98 * run + 0.02 * loss.item() if step > 1 else loss.item()
        if step % 100 == 0 or step == steps: print(f'Schritt {step}/{steps} Verlust {run:.4f} {time.time() - t0:.0f} s', flush=True)
MD = os.path.join(a.out, 'ft-model' if a.suffix == '-ft' else 'ft-model' + a.suffix); os.makedirs(MD, exist_ok=True); enc.save_pretrained(MD); tok.save_pretrained(MD)
print('gelernt in', round(time.time() - t0), 's', flush=True)
if a.no_embed: sys.exit()

@torch.no_grad()
def embed(items, out):
    enc.eval(); X = np.zeros((len(items), 384), np.float32); t1 = time.time()
    lens = [len(t) for t in tok(['query: ' + t for _, t in items], truncation=True, max_length=512)['input_ids']]; B = {}
    for i, n in enumerate(lens): B.setdefault(min(512, -(-n // 64) * 64), []).append(i)
    for L, ids in B.items():
        n = max(1, 8192 // L)
        for k in range(0, len(ids), n):
            b = ids[k:k + n]
            T = tok(['query: ' + items[i][1] for i in b], padding='max_length', truncation=True, max_length=L, return_tensors='pt').to(dev)
            X[b] = torch.nn.functional.normalize(pool(enc(**T), T['attention_mask']), dim=-1).cpu().numpy()
        if dev == 'mps': torch.mps.empty_cache()
    X.tofile(os.path.join(a.out, out + '.bin')); json.dump([k for k, _ in items], open(os.path.join(a.out, out + '.json'), 'w'))
    print('eingebettet', out, len(items), round(time.time() - t1), 's', flush=True)

def rows_items(rows):
    return [(k[0] + str(i) if k in ('t', 'r') else f"p{i}.{k[2:]}", t) for i, r in enumerate(rows) for k, t in texts_of(r)]
embed(rows_items(big), 'big-emb' + a.suffix)
embed(rows_items(ext), 'extra-emb' + a.suffix)
titles = []
for name in ['theme-dev', 'theme-val', 'theme-test', 'theme-train-a', 'theme-train-b', 'theme-train-c', 'theme-check-a']:
    for i, r in enumerate(json.load(open(FX + name + '.json'))['rows']): titles.append((f'{name}:{i}', str(r['title'])[:300]))
embed(titles, 'emb' + a.suffix)
