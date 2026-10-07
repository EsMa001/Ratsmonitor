/* Baut ein Video aus einem Skript in einem Befehl: node build-video.mjs <skript.txt> <ordner> <name> [--refresh] [--only 3,5]
   (im Ordner ~/code/video-tools starten; BASE = Adresse der App; Ergebnis: out-web/<ordner>/<name>.mp4/.vtt/.jpg)
   Je Kapitel: [SZENE | id] = Clip (wird nur aufgenommen, wenn er fehlt, mit --refresh oder wenn er veraltet ist), [VORHANDENES VIDEO | NN | name] = fertiges Video aus public/videos.
   Ton kommt aus dem Zwischenspeicher (nur geänderte Sätze werden neu gesprochen). Ablauf: prep, Fakten, Ton, Clips, Zusammenbau, Kapitelseiten, Gesamtvideo. */
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { clipState } from "./clips/status.mjs";
const T = new URL("./", import.meta.url).pathname, R = new URL("../../../", import.meta.url).pathname;
const [script, dir, name, ...flags] = process.argv.slice(2);
if (!name) { console.log("Aufruf: node build-video.mjs <skript.txt> <ordner> <name> [--refresh] [--only 3,5]"); process.exit(1); }
const refresh = flags.includes("--refresh");
const only = flags.includes("--only") ? flags[flags.indexOf("--only") + 1].split(",").map(Number) : null;
const O = `out-web/${dir}`;
const run = (cmd, args, env = {}) => { const r = spawnSync(cmd, args, { stdio: "inherit", env: { ...process.env, ...env } }); if (r.status) { console.error(`Fehler bei: ${cmd} ${args.join(" ")}`); process.exit(r.status); } };
const pad = (n) => String(n).padStart(2, "0");

run("node", [`${T}webinar/prep.mjs`, script, O]);
run("node", [`${T}webinar/cards.mjs`, O]);
const chapters = JSON.parse(readFileSync(`${O}/chapters.json`, "utf8"));
const scenes = new Set();
for (const c of chapters) {
  if (only && !only.includes(c.nr)) continue;
  const n = pad(c.nr), d = `${O}/c${n}`;
  mkdirSync(d, { recursive: true });
  if (c.video) {
    const nn = c.video.nn;
    if (!existsSync(`out-web/${nn}/audio.json`)) { console.error(`Kapitel ${c.nr}: out-web/${nn}/audio.json fehlt (Satzzeiten des vorhandenen Videos)`); process.exit(1); }
    copyFileSync(`out-web/${nn}/audio.json`, `${d}/audio.json`); copyFileSync(`${R}public/videos/${c.video.name}.mp4`, `${d}/c${n}.mp4`);
    console.log(`Kapitel ${c.nr}: vorhandenes Video ${c.video.name}`); continue;
  }
  if (!c.scene) { console.error(`Kapitel ${c.nr} (${c.name}): weder [SZENE | id] noch [VORHANDENES VIDEO | …]`); process.exit(1); }
  run("python3", [`${T}speak.py`, `${O}/c${n}.txt`, `${d}/audio.wav`, "0.8", "0"]);
  const st = clipState(c.scene);
  if (!scenes.has(c.scene)) {
    scenes.add(c.scene);
    if (st.state === "fehlt" || st.state === "veraltet" || refresh) { console.log(`Clip ${c.scene}: ${refresh ? "neu (--refresh)" : st.state}, nehme auf`); run("node", [`${T}clips/rec-clip.mjs`, c.scene]); }
    else console.log(`Clip ${c.scene}: ${st.state}, wird wiederverwendet`);
  }
  run("python3", [`${T}clips/compose.py`, c.scene, d, `c${n}`]);
}
run("python3", [`${T}webinar/assemble.py`, dir, name]);
console.log(`Fertig: ${O}/${name}.mp4`);
