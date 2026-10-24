/* Baut ein Video aus Kapiteln: node build-video.mjs <video> [--refresh] [--only 2,3] [--entwurf] [--parallel 3]   (im Ordner ~/code/video-tools starten, BASE = Adresse der App)
   <video> = docs/videos/videos/<video>.json: { "ausgabe": "dateiname", "karten": false (keine Kapitelseiten), "kapitel": [{ "kapitel": "suchen", "text": "kurz"|"lang" (kurz = kurz.txt, sonst nur die mit * markierten Kernsätze aus lang.txt), "parameter": { "thema": "Wärmeplanung" }, "format": "16x9" }] }
   Kapitel = docs/videos/kapitel/<id>/ mit kapitel.json (Titel, Icon, Stichpunkte, szenen), lang.txt (Sätze: "@szene.schritt Satz", Platzhalter {{fakt|format}}, {{p.thema|text}}).
   Szene = docs/videos/szenen/<id>/szene.mjs (Vertrag: docs/videos/SZENEN.md). Ein Clip wird nur aufgenommen, wenn er für Szene, Parameter und Format fehlt, veraltet ist oder mit --refresh.
   Ablauf: Texte und Fakten, Kapitelseiten, Ton (Zwischenspeicher), Clips, Zusammenbau, Gesamtvideo. Ergebnis: out-web/<video>/<ausgabe>.mp4/.vtt/.jpg (bisher nur Format 16x9 fürs Gesamtvideo) */
import { spawnSync, spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, existsSync, statSync, rmSync, readdirSync } from "node:fs";
import { fill } from "./fmt.mjs";
import { clipState } from "./status.mjs";
import { loadScene, resolveParams, clipKey } from "./key.mjs";
const T = new URL("./", import.meta.url).pathname, V = new URL("../", import.meta.url).pathname;
const [video, ...flags] = process.argv.slice(2);
if (!video) { console.log("Aufruf: node build-video.mjs <video> [--refresh] [--only 2,3]"); process.exit(1); }
const refresh = flags.includes("--refresh");
const THEME = JSON.parse(readFileSync(`${V}videos/${video}.json`, "utf8")).theme === "dunkel" ? "dunkel" : "";  /* Dunkle Fassung: dieselben Kapitel und Texte, App und Folien im Dark Mode */
process.env.VIDEO_THEME = THEME;
if (JSON.parse(readFileSync(`${V}videos/${video}.json`, "utf8")).bewegung === true) process.env.VIDEO_ZOOM = "1";  /* "bewegung": langsamer Zoom in den App-Aufnahmen */
const only = flags.includes("--only") ? flags[flags.indexOf("--only") + 1].split(",").map(Number) : null;
const def = JSON.parse(readFileSync(`${V}videos/${video}.json`, "utf8"));
const OUTNAME = (def.ausgabe || video) + (flags.includes("--entwurf") ? "-entwurf" : "");  /* Entwurf überschreibt das fertige Video nicht */
const O = `out-web/${video}`, pad = (n) => String(n).padStart(2, "0");
const factsFile = existsSync(`${V}facts.json`) ? JSON.parse(readFileSync(`${V}facts.json`, "utf8")) : { values: {} };
const facts = factsFile.values;
/* Produktvorteile (docs/produkt/vorteile.json) als {{v.<rang>|text}} */
const VP = `${V}../produkt/vorteile.json`;
if (existsSync(VP)) for (const v of JSON.parse(readFileSync(VP, "utf8")).vorteile) facts[`v.${v.rang}`] = v.titel;
const entwurf = flags.includes("--entwurf"); if (entwurf) process.env.VIDEO_ENTWURF = "1";  /* schnell: veryfast/crf 30, halbe Haltezeiten */
const jobs = Number(flags.includes("--parallel") ? flags[flags.indexOf("--parallel") + 1] : 3);
/* Ausgabe knapp: nur Warnungen, Fehler und die letzte Zeile jedes Schritts (spart Tokens beim Lesen) */
const show = (out) => { const l = out.split("\n").filter(Boolean); const w = l.filter((x) => /WARNUNG|ACHTUNG|fehlgeschlagen|Fehler/.test(x)); return [...new Set([...w, l.at(-1)])].filter(Boolean).join("\n"); };
const run = (cmd, args) => { const r = spawnSync(cmd, args, { encoding: "utf8", maxBuffer: 1 << 28 }); const out = (r.stdout || "") + (r.stderr || ""); if (out.trim()) console.log(show(out)); if (r.status) { console.error(`Fehler bei: ${cmd} ${args.join(" ")}\n${out.slice(-600)}`); process.exit(r.status); } };
const runAsync = (cmd, args) => new Promise((res) => { let out = ""; const c = spawn(cmd, args); c.stdout.on("data", (d) => (out += d)); c.stderr.on("data", (d) => (out += d)); c.on("close", (code) => { if (out.trim()) console.log(show(out)); if (code) console.error(`Fehler bei: ${cmd} ${args.join(" ")}\n${out.slice(-600)}`); res(code); }); });
mkdirSync(O, { recursive: true });
const chapters = [], zwischen = [];
/* Es gibt ein vollständiges Video (komplett.json). Kleinere Videos wählen nur Kapitel und Sätze daraus: Parameter und Format stehen allein dort, Texte allein in lang.txt (kein eigener Text je Video), damit keins vom vollständigen abweicht. */
/* Ausnahme "vorlage": "eigen" (Anwendervideos, videos/anwender-*.json): eigene Begriffe und Orte ("parameter" für das ganze Video,
   je Kapitel überschreibbar), aber dieselben Kapitel, Szenen und Sätze wie das vollständige Video; nicht Teil davon. */
const MASTER = JSON.parse(readFileSync(`${V}videos/komplett.json`, "utf8")), isMaster = video.replace(/-dunkel$/, "") === "komplett",  /* die dunkle Fassung spiegelt das vollständige Video */ eigen = def.vorlage === "eigen";
for (const [i, k0] of def.kapitel.entries()) {
  const mk = MASTER.kapitel.find((x) => x.kapitel === k0.kapitel);
  if (!mk) throw new Error(`Kapitel "${k0.kapitel}" steht nicht in komplett.json: erst dort aufnehmen`);
  if (!isMaster && !eigen && (k0.parameter || k0.format)) throw new Error(`Kapitel "${k0.kapitel}": Parameter und Format stehen nur in komplett.json`);
  const k = eigen ? { ...k0, parameter: { ...(mk.parameter || {}), ...(def.parameter || {}), ...(k0.parameter || {}) }, format: k0.format || mk.format } : { ...k0, parameter: mk.parameter, format: mk.format };
  const dir = `${V}kapitel/${k.kapitel}`, kj = JSON.parse(readFileSync(`${dir}/kapitel.json`, "utf8"));
  const want = k.text || "lang", file = `${dir}/lang.txt`;
  if (want !== "lang" && want !== "kurz") throw new Error(`Kapitel "${k.kapitel}": text muss "lang" oder "kurz" sein (kein eigener Text je Video); einzelne Sätze mit "saetze": [2, 4]`);
  const kernOnly = want === "kurz" && !k.saetze, sel = k.saetze && new Set(k.saetze);  /* kurz = die mit * markierten Kernsätze, saetze = Nummern der Sätze in lang.txt */
  if (!existsSync(file)) throw new Error(`Text fehlt: ${file}`);
  const thema = k.parameter?.thema || kj.thema || factsFile.thema, ort = k.parameter?.ort || factsFile.ort, set = factsFile.sets?.[thema];
  if (!set) throw new Error(`Keine Fakten für Thema "${thema}": THEMEN=... node facts.mjs ausführen`);
  const own = { ...factsFile.cov, ...set, "t.ort": set["t.orte"]?.[ort] ?? 0 };
  const thema2 = k.parameter?.thema2 || kj.thema2, set2 = thema2 && factsFile.sets?.[thema2];
  if (thema2 && !set2) throw new Error(`Keine Fakten für Thema "${thema2}": THEMEN=... node facts.mjs ausführen`);
  const needOrt = readFileSync(file, "utf8").includes("t.ort");
  if (needOrt && own["t.ort"] < 5) throw new Error(`${ort} hat nur ${own["t.ort"]} Einträge zu ${thema} (unter 5): anderen Ort oder anderes Thema für Kapitel ${k.kapitel} wählen`);
  const pf = { ...facts, ...own, ...(set2 ? Object.fromEntries(Object.entries(set2).map(([a, v]) => [a.replace(/^t\./, "u."), v])) : {}), "p.thema": thema, "p.ort": ort, ...(thema2 ? { "p.thema2": thema2 } : {}), ...Object.fromEntries(Object.entries(k.parameter || {}).map(([a, v]) => [`p.${a}`, v])) };
  const lines = [], beats = [], orig = [], kerne = []; let idx = 0;
  for (const raw of readFileSync(file, "utf8").split("\n")) {
    let l = raw.trim(); if (!l || l.startsWith("#")) continue;
    idx++;
    const kern = l.startsWith("*"); if (kern) l = l.slice(1).trim();
    if (kernOnly && !kern) continue;
    if (sel && !sel.has(idx)) continue;
    orig.push(idx); kerne.push(kern);
    const m = l.match(/^@([\w.,-]+) (.*)$/);
    lines.push(fill(m ? m[2] : l, pf)); beats.push(m ? m[1].split(",") : []);
  }
  /* "folie": "x" – vor dem Kapitel die Zwischenfolie plenara.X (xhtml in tools/auftakt.mjs); darüber spricht die Stimme den ersten Satz von x-atlas (Zahl der Auswertungen) */
  const zf = k0.folie === "x" ? fill(readFileSync(`${V}kapitel/x-atlas/lang.txt`, "utf8").split("\n").map((l) => l.trim()).find((l) => l && !l.startsWith("#")).replace(/^\*?@[\w.,-]+ /, ""), pf) : null;
  const nr = i + 1, n = pad(nr), format = k.format || "16x9", keys = {};
  for (const id of kj.szenen) { const sc = await loadScene(id); const own = Object.fromEntries(Object.entries(k.parameter || {}).filter(([a]) => a in (sc.parameter || {}))); const full = resolveParams(sc, own); keys[id] = { key: clipKey(id, sc, full, format, THEME), params: own, full, id }; }
  mkdirSync(`${O}/c${n}`, { recursive: true });
  /* Einblendungen: "satz" zählt die Sätze der Textdatei (auch die in der kurzen Fassung entfallenen); Platzhalter werden hier gefüllt */
  const eb = (kj.einblendungen || []).map((e) => ({ satz: orig.indexOf(e.satz), text: e.text && fill(e.text, pf), zahl: e.zahl && fill(e.zahl, pf), label: e.label && fill(e.label, pf) })).filter((e) => e.satz >= 0);
  if (def.karten === false) eb.unshift({ kapitel: true, text: kj.titel });  /* ohne Kapitelseiten: Titel kurz am Anfang eingeblendet */
  writeFileSync(`${O}/c${n}/einblendungen.json`, JSON.stringify(eb));
  writeFileSync(`${O}/c${n}/meta.json`, JSON.stringify({ id: k.kapitel, saetze: orig.map((nr, j) => ({ nr, kern: kerne[j] })) }));  /* für die Zeitdatei (timeline.json) und schneiden.mjs */
  writeFileSync(`${O}/c${n}.txt`, lines.join("\n") + "\n"); writeFileSync(`${O}/c${n}/beats.json`, JSON.stringify(beats));
  writeFileSync(`${O}/c${n}/clips.json`, JSON.stringify(Object.fromEntries(Object.entries(keys).map(([id, v]) => [id, v.key]))));
  if (zf) zwischen.push({ n, text: zf });
  chapters.push({ vorteile: kj.vorteile || [], nr, name: kj.titel, icon: kj.icon, title: kj.titel, bullets: kj.stichpunkte, keys, format });
}
writeFileSync(`${O}/chapters.json`, JSON.stringify(chapters, null, 1));
const karten = def.karten !== false;
if (karten) run("node", [`${T}cards.mjs`, O]);
/* 1. Ton für alle Kapitel (Zwischenspeicher), 2. fehlende Clips parallel aufnehmen, 3. Kapitel zusammensetzen */
const sel = chapters.filter((c) => !only || only.includes(c.nr));
for (const c of sel) { const n = pad(c.nr); run("python3", [`${T}speak.py`, `${O}/c${n}.txt`, `${O}/c${n}/audio.wav`, String(def.pause ?? 0.8), "0"]); }  /* "pause": Sekunden nach jedem Satz (Standard 0,8; das Kurzvideo spricht dichter) */
const todo = new Map();
for (const c of sel) for (const [id, { key, params, full }] of Object.entries(c.keys)) {
  if (todo.has(key)) continue;
  /* Clip gilt auch als veraltet, wenn er mit anderen Parametern aufgenommen wurde oder die Szene seitdem geändert wurde */
  const cf = `out-clips/${key}/clip.json`, cj = existsSync(cf) ? JSON.parse(readFileSync(cf, "utf8")) : null;
  const anders = cj && (JSON.stringify(Object.entries(cj.params || {}).sort()) !== JSON.stringify(Object.entries(full).sort()) || statSync(`${V}szenen/${id}/szene.mjs`).mtimeMs > Date.parse(cj.recorded));
  const st = clipState(key), neu = st.state === "fehlt" || st.state === "veraltet" || anders || refresh || (st.entwurf && !entwurf);  /* Entwurf-Clips gelten für das fertige Video nicht */
  if (neu) { const p = Object.entries(params).map(([a, b]) => `${a}=${b}`).join(","); const args = [`${T}rec-clip.mjs`, id, "--format", c.format, ...(THEME ? ["--theme", THEME] : [])]; todo.set(key, p ? [...args, "--p", p] : args); }
}
/* --nur <regex>: nur Clips dieser Szenen aufnehmen und danach aufhören (z. B. plenara.X gegen die Testinstanz: BASE=…:3005 VIDEO_ME=plus … --nur "^x-") */
const nurIdx = flags.indexOf("--nur"); if (nurIdx >= 0) { const re = new RegExp(flags[nurIdx + 1]); for (const [k, a] of todo) if (!re.test(a[1])) todo.delete(k); }
/* --ohne-aufnahme: vorhandene Clips verwenden, auch wenn sich die Oberfläche seitdem geändert hat (nicht aber die Szene) (z. B. plenara.X von der Testinstanz, wenn sich die Oberfläche seitdem geändert hat); fehlende sind ein Fehler */
if (flags.includes("--ohne-aufnahme")) { for (const [k, a] of [...todo]) { const cf = `out-clips/${k}/clip.json`; if (existsSync(cf) && Date.parse(JSON.parse(readFileSync(cf, "utf8")).recorded) > statSync(`${V}szenen/${a[1]}/szene.mjs`).mtimeMs) todo.delete(k); }  /* nur Clips, die neuer sind als ihre Szene */ if (todo.size) { console.error("Clips fehlen: " + [...todo.keys()].join(", ")); process.exit(1); } }
console.log(`Clips: ${todo.size} neu aufzunehmen (parallel ${jobs}), Rest wird wiederverwendet`);
const queue = [...todo.values()]; let bad = 0;
/* Gescheiterte Clips bis zu zweimal neu versuchen (lokal brechen schwere Seiten gelegentlich mit Zeitüberschreitung ab); fertige Clips bleiben ohnehin liegen */
const TRIES = 3;
await Promise.all(Array.from({ length: Math.min(jobs, queue.length) }, async () => { while (queue.length) { const job = queue.shift(); let failed = true; for (let t = 1; t <= TRIES && failed; t++) { if (t > 1) console.log(`Neuer Versuch ${t}/${TRIES}: ${job[1]}`); failed = !!(await runAsync("node", job)); } if (failed) bad++; } }));
if (bad) { console.error(`${bad} Clip(s) fehlgeschlagen, Abbruch`); process.exit(1); }
if (nurIdx >= 0) { console.log("Nur Aufnahmen (--nur), kein Zusammenbau"); process.exit(0); }
for (const c of sel) run("python3", [`${T}compose.py`, `${O}/c${pad(c.nr)}`, `c${pad(c.nr)}`]);
/* Titelfolie (kurz, ohne Ton), Vorteilsfolie mit Zusammenfassung, Schlussfolie mit Logo und Slogan (docs/produkt/slogan.json); abschaltbar mit "titel": false / "ende": false, Anzahl Vorteile mit "vorteileMax" (Standard 5, 0 = keine Vorteilsfolie) */
const slogan = JSON.parse(readFileSync(`${V}../produkt/slogan.json`, "utf8")), vt = existsSync(VP) ? JSON.parse(readFileSync(VP, "utf8")).vorteile : [];
const ranks = [...new Set(sel.flatMap((c) => c.vorteile))].sort((a, b) => a - b).slice(0, def.vorteileMax ?? 5);
const items = ranks.map((r) => vt.find((x) => x.rang === r)?.titel).filter(Boolean);
const spec = {};
/* Titel- und Schlussfolie sind gleich: Name, 1 s Pause, Slogan, 1 s Pause; gleiche Länge und gleiches Tempo der Animation */
const sag = ["Plenarra.", slogan.sprech].join("\n") + "\n";
const sagen = (dir) => { mkdirSync(`${O}/${dir}`, { recursive: true }); writeFileSync(`${O}/${dir}.txt`, sag); run("python3", [`${T}speak.py`, `${O}/${dir}.txt`, `${O}/${dir}/audio.wav`, "1.0", "0"]); return JSON.parse(readFileSync(`${O}/${dir}/audio.json`, "utf8")).total; };
const FOLIE_DELAY = 1.0;
/* "auftakt": true – vor dem ersten Kapitel echte Titel aus vielen Räten und die Zahl der Kommunen, die in eine Suchleiste fließen (tools/auftakt.mjs).
   Darüber spricht die Stimme den ersten Satz der Einleitung (lang.txt); im Kapitel lässt man ihn dann weg ("saetze" ohne 1). */
if (def.auftakt === true) {
  const { titles, STEP } = await import("./auftakt.mjs");
  const first = readFileSync(`${V}kapitel/einleitung/lang.txt`, "utf8").split("\n").map((l) => l.trim()).find((l) => l && !l.startsWith("#"));
  mkdirSync(`${O}/auftakt`, { recursive: true }); writeFileSync(`${O}/auftakt.txt`, fill(first.replace(/^\*?@[\w.,-]+ /, ""), facts) + "\n");
  run("python3", [`${T}speak.py`, `${O}/auftakt.txt`, `${O}/auftakt/audio.wav`, "0", "0"]);
  const said = JSON.parse(readFileSync(`${O}/auftakt/audio.json`, "utf8")).total, items = await titles(process.env.BASE || "http://localhost:5173");
  if (items.length < 12) throw new Error(`Auftakt: nur ${items.length} passende Titel gefunden (App erreichbar?)`);
  const out = +(Math.ceil((STEP * 2 + 15 * STEP + 0.35) / STEP) * STEP).toFixed(3);  /* Zusammenfliegen auf einem Sechzehntel nach dem letzten Titel */
  spec.auftakt = { items, count: facts["cov.municipalities"], out, dur: +Math.max(out + 1.45, 0.5 + said + 0.4).toFixed(2) };
}
if (def.titel !== false) spec.titel = { dur: +Math.max(7, FOLIE_DELAY + sagen("titel") + 1.0).toFixed(2) };  /* Titelfolie spricht Name und Slogan */
if (def.ende !== false) {
  if (items.length) { mkdirSync(`${O}/ende1`, { recursive: true }); writeFileSync(`${O}/ende1.txt`, ["Das bringt Ihnen Plenarra.", ...items].join("\n") + "\n"); run("python3", [`${T}speak.py`, `${O}/ende1.txt`, `${O}/ende1/audio.wav`, "0.5", "0"]); const a = JSON.parse(readFileSync(`${O}/ende1/audio.json`, "utf8")); spec.vorteile = { items, starts: a.sentences.slice(1).map((x) => +(x.start + 0.7).toFixed(2)), dur: +(a.total + 0.7 + 1.2).toFixed(2) }; }
  spec.schluss = { dur: +Math.max(7, FOLIE_DELAY + sagen("ende2") + 1.0).toFixed(2) };
}
writeFileSync(`${O}/folien.json`, JSON.stringify(spec));
for (const z of zwischen) { mkdirSync(`${O}/z${z.n}`, { recursive: true }); writeFileSync(`${O}/z${z.n}.txt`, z.text + "\n"); run("python3", [`${T}speak.py`, `${O}/z${z.n}.txt`, `${O}/z${z.n}/audio.wav`, "0", "0"]);
  const { STEP, X_NAMES } = await import("./auftakt.mjs"); const said = JSON.parse(readFileSync(`${O}/z${z.n}/audio.json`, "utf8")).total;
  (spec.zwischen ||= []).push({ n: z.n, dur: +Math.max(0.55 + X_NAMES.length * STEP * 1.5 + 0.9, 0.5 + said + 0.5).toFixed(2) }); }
writeFileSync(`${O}/folien.json`, JSON.stringify(spec));  /* mit den Zwischenfolien neu schreiben */
for (const f of readdirSync(O)) if (/^f-(auftakt|titel|vorteile|schluss|z\d+)\.mp4$/.test(f)) rmSync(`${O}/${f}`, { force: true });  /* abgeschaltete Folien früherer Bauten nicht mitnehmen */  /* abgeschaltete Folien früherer Bauten nicht mitnehmen */
if (Object.keys(spec).length) run("node", [`${T}folien.mjs`, O]);
/* Einblendungen nur auf Wunsch ("einblendungen": true in der Videodatei); sonst alte Dateien entfernen */
if (def.einblendungen === true) run("node", [`${T}einblendungen.mjs`, O]);
else for (const c of chapters) rmSync(`${O}/c${pad(c.nr)}/overlays.json`, { force: true });
run("python3", [`${T}assemble.py`, video, OUTNAME, "3", ...(karten ? [] : ["keine"])]);
/* "musik": true mischt leise, selbst erzeugte Musik unter (tools/musik.py, braucht numpy und scipy im venv) */
if (def.musik === true) run("./venv/bin/python", [`${T}musik.py`, `${O}/${OUTNAME}.mp4`]);
run("python3", [`${T}check.py`, `${O}/${OUTNAME}.mp4`]);
console.log(`Fertig: ${O}/${OUTNAME}.mp4`);
