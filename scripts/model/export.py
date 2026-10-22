# Wandelt den nachtrainierten Encoder (scripts/model/finetune.py → <src>) in das Format um, das transformers.js lädt: ONNX, die
# Rechenschichten auf 8 Bit je Spalte verkleinert (die Wortliste bleibt genau; so liegt der Kosinus zu PyTorch bei 0,98 bis 0,99,
# ganz auf 8 Bit nur bei 0,91 bis 0,96). Die Wortzerlegung kommt aus dem Original Xenova/multilingual-e5-small (Ordner --tokenizer):
# die von PyTorch gespeicherte zerlegt in transformers.js das erste Wort anders.
#   ~/code/ml-tools/venv/bin/python scripts/model/export.py tmp/ml/ft-model tmp/model/encoder --tokenizer <Ordner mit tokenizer.json>
# Prüfung danach: node scripts/model/check-encoder.mjs (Einbettungen in Node gegen die von finetune.py)
import os, sys, shutil, argparse, torch
from transformers import AutoTokenizer, AutoModel
from onnxruntime.quantization import quantize_dynamic, QuantType
ap = argparse.ArgumentParser(); ap.add_argument('src'); ap.add_argument('dst'); ap.add_argument('--tokenizer', required=True); a = ap.parse_args()
tok = AutoTokenizer.from_pretrained(a.src); enc = AutoModel.from_pretrained(a.src, attn_implementation='eager').eval()
os.makedirs(os.path.join(a.dst, 'onnx'), exist_ok=True)
# Beispiel mit Auffüllung, damit die Maske im Rechenplan bleibt
T = tok(['query: Bebauungsplan Nr. 12 „Am Sportplatz“ – Satzungsbeschluss', 'query: Haushalt'], padding=True, return_tensors='pt')
class Wrap(torch.nn.Module):
    def __init__(s, m): super().__init__(); s.m = m
    def forward(s, input_ids, attention_mask): return s.m(input_ids=input_ids, attention_mask=attention_mask).last_hidden_state
full = os.path.join(a.dst, 'onnx', 'model.onnx')
torch.onnx.export(Wrap(enc), (T['input_ids'], T['attention_mask']), full, input_names=['input_ids', 'attention_mask'], output_names=['last_hidden_state'],
                  dynamic_axes={k: {0: 'batch', 1: 'seq'} for k in ['input_ids', 'attention_mask', 'last_hidden_state']}, opset_version=14, dynamo=False)
quantize_dynamic(full, os.path.join(a.dst, 'onnx', 'model_quantized.onnx'), weight_type=QuantType.QInt8, per_channel=True, op_types_to_quantize=['MatMul'])
os.remove(full)
shutil.copy(os.path.join(a.src, 'config.json'), a.dst)
for f in ['tokenizer.json', 'tokenizer_config.json']: shutil.copy(os.path.join(a.tokenizer, f), a.dst)
print('fertig', os.path.getsize(os.path.join(a.dst, 'onnx', 'model_quantized.onnx')) // 1000000, 'MB')
