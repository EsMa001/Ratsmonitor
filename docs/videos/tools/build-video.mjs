/* Baut ein Video aus Kapiteln: node build-video.mjs <video> [--refresh] [--only 2,3]   (im Ordner ~/code/video-tools starten, BASE = Adresse der App)
   <video> = docs/videos/videos/<video>.json: { "ausgabe": "dateiname", "karten": false (keine Kapitelseiten), "kapitel": [{ "kapitel": "suchen", "text": "kurz"|"lang" (kurz = kurz.txt, sonst nur die mit * markierten Kernsätze aus lang.txt), "parameter": { "thema": "Wärmeplanung" }, "format": "16x9" }] }
   Kapitel = docs/videos/kapitel/<id>/ mit kapitel.json (Titel, Icon, Stichpunkte, szenen), kurz.txt / lang.txt (Sätze: "@szene.schritt Satz", Platzhalter {{fakt|format}}, {{p.thema|text}}).
   Szene = docs/videos/szenen/<id>/szene.mjs (Vertrag: docs/videos/SZENEN.md). Ein Clip wird nur aufgenommen, wenn er für Szene, Parameter und Format fehlt, veraltet ist oder mit --refresh.
   Ablauf: Texte und Fakten, Kapitelseiten, Ton (Zwischenspeicher), Clips, Zusammenbau, Gesamtvideo. Ergebnis: out-web/<video>/<ausgabe>.mp4/.vtt/.jpg (bisher nur Format 16x9 fürs Gesamtvideo) */
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { fill } from "./fmt.mjs";
import { clipState } from "./status.mjs";
import { loadScene, resolveParams, clipKey } from "./key.mjs";
const T = new URL("./", import.meta.url).pathname, V = new URL("../", import.meta.url).pathname;
const [video, ...flags] = process.argv.slice(2);
if (!video) { console.log("Aufruf: node build-video.mjs <video> [--refresh] [--only 2,3]"); process.exit(1); }
const refresh = flags.includes("--refresh");
const only = flags.includes("--only") ? flags[flags.indexOf("--only") + 1].split(",").map(Number) : null;
const def = JSON.parse(readFileSync(`${V}videos/${video}.json`, "utf8"));
const O = `out-web/${video}`, pad = (n) => String(n).padStart(2, "0");
const factsFile = existsSync(`${V}facts.json`) ? JSON.parse(readFileSync(`${V}facts.json`, "utf8")) : { values: {} };
const facts = factsFile.values;
/* Produktvorteile (docs/produkt/vorteile.json) als {{v.<rang>|text}} */
const VP = `${V}../produkt/vorteile.json`;
if (existsSync(VP)) for (const v of JSON.parse(readFileSync(VP, "utf8")).vorteile) facts[`v.${v.rang}`] = v.titel;
const run = (cmd, args) => { const r = spawnSync(cmd, args, { stdio: "inherit" }); if (r.status) { console.error(`Fehler bei: ${cmd} ${args.join(" ")}`); process.exit(r.status); } };
mkdirSync(O, { recursive: true });
const chapters = [];
for (const [i, k] of def.kapitel.entries()) {
  const dir = `${V}kapitel/${k.kapitel}`, kj = JSON.parse(readFileSync(`${dir}/kapitel.json`, "utf8"));
  const want = k.text || "lang", eigen = existsSync(`${dir}/${want}.txt`), file = eigen ? `${dir}/${want}.txt` : `${dir}/lang.txt`;
  /* "kurz" ohne eigene kurz.txt: nur die mit * markierten Kernsätze aus lang.txt */
  const kernOnly = want === "kurz" && !eigen;
  if (!existsSync(file)) throw new Error(`Text fehlt: ${file}`);
  const thema = k.parameter?.thema || kj.thema || factsFile.thema, ort = k.parameter?.ort || factsFile.ort, set = factsFile.sets?.[thema];
  if (!set) throw new Error(`Keine Fakten für Thema "${thema}": THEMEN=... node facts.mjs ausführen`);
  const own = { ...factsFile.cov, ...set, "t.ort": set["t.orte"]?.[ort] ?? 0 };
  const thema2 = k.parameter?.thema2 || kj.thema2, set2 = thema2 && factsFile.sets?.[thema2];
  if (thema2 && !set2) throw new Error(`Keine Fakten für Thema "${thema2}": THEMEN=... node facts.mjs ausführen`);
  const needOrt = readFileSync(file, "utf8").includes("t.ort");
  if (needOrt && own["t.ort"] < 5) throw new Error(`${ort} hat nur ${own["t.ort"]} Einträge zu ${thema} (unter 5): anderen Ort oder anderes Thema für Kapitel ${k.kapitel} wählen`);
  const pf = { ...facts, ...own, ...(set2 ? Object.fromEntries(Object.entries(set2).map(([a, v]) => [a.replace(/^t\./, "u."), v])) : {}), "p.thema": thema, "p.ort": ort, ...(thema2 ? { "p.thema2": thema2 } : {}), ...Object.fromEntries(Object.entries(k.parameter || {}).map(([a, v]) => [`p.${a}`, v])) };
  const lines = [], beats = [];
  for (const raw of readFileSync(file, "utf8").split("\n")) {
    let l = raw.trim(); if (!l || l.startsWith("#")) continue;
    const kern = l.startsWith("*"); if (kern) l = l.slice(1).trim();
    if (kernOnly && !kern) continue;
    const m = l.match(/^@([\w.,-]+) (.*)$/);
    lines.push(fill(m ? m[2] : l, pf)); beats.push(m ? m[1].split(",") : []);
  }
  const nr = i + 1, n = pad(nr), format = k.format || "16x9", keys = {};
  for (const id of kj.szenen) { const sc = await loadScene(id); const own = Object.fromEntries(Object.entries(k.parameter || {}).filter(([a]) => a in (sc.parameter || {}))); keys[id] = { key: clipKey(id, sc, resolveParams(sc, own), format), params: own }; }
  mkdirSync(`${O}/c${n}`, { recursive: true });
  writeFileSync(`${O}/c${n}.txt`, lines.join("\n") + "\n"); writeFileSync(`${O}/c${n}/beats.json`, JSON.stringify(beats));
  writeFileSync(`${O}/c${n}/clips.json`, JSON.stringify(Object.fromEntries(Object.entries(keys).map(([id, v]) => [id, v.key]))));
  chapters.push({ nr, name: kj.titel, icon: kj.icon, title: kj.titel, bullets: kj.stichpunkte, keys, format });
}
writeFileSync(`${O}/chapters.json`, JSON.stringify(chapters, null, 1));
const karten = def.karten !== false;
if (karten) run("node", [`${T}cards.mjs`, O]);
const done = new Set();
for (const c of chapters) {
  if (only && !only.includes(c.nr)) continue;
  const n = pad(c.nr), d = `${O}/c${n}`;
  run("python3", [`${T}speak.py`, `${O}/c${n}.txt`, `${d}/audio.wav`, "0.8", "0"]);
  for (const [id, { key, params }] of Object.entries(c.keys)) {
    if (done.has(key)) continue; done.add(key);
    const st = clipState(key);
    if (st.state === "fehlt" || st.state === "veraltet" || refresh) {
      console.log(`Clip ${key}: ${refresh ? "neu (--refresh)" : st.state}, nehme auf`);
      const args = [`${T}rec-clip.mjs`, id, "--format", c.format]; const p = Object.entries(params).map(([a, b]) => `${a}=${b}`).join(",");
      run("node", p ? [...args, "--p", p] : args);
    } else console.log(`Clip ${key}: ${st.state}, wird wiederverwendet`);
  }
  run("python3", [`${T}compose.py`, d, `c${n}`]);
}
run("python3", [`${T}assemble.py`, video, def.ausgabe || video, "3", ...(karten ? [] : ["keine"])]);
run("python3", [`${T}check.py`, `${O}/${def.ausgabe || video}.mp4`]);
console.log(`Fertig: ${O}/${def.ausgabe || video}.mp4`);
