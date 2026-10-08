/* Schneidet aus dem fertigen vollständigen Video (docs/videos/fassungen oder out-web/komplett) ein kürzeres Video, ohne Clips, Ton oder App:
   node schneiden.mjs --sekunden 60 [--kapitel einleitung,suchen,filter] [--name pitch-60] [--vorteile]    (im Ordner ~/code/video-tools starten)
   Nimmt Titel- und Schlussfolie (7 s) und je Kapitel zuerst die Kernsätze (* in lang.txt); passt es noch, kommen weitere Sätze dazu (Kapitel reihum), passt es nicht,
   fallen Kapitel am Ende weg. Zeiten stehen in der Zeitdatei (<ausgabe>.timeline.json). Ergebnis: out-web/schnitt/<name>.mp4 und .vtt. Die Teile blenden kurz über Weiß. */
import { homedir } from "node:os";
import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
const R = process.env.REPO || `${homedir()}/code/Ratsmonitor`, T = process.env.VIDEO_TOOLS || `${homedir()}/code/video-tools`;
const FF = createRequire(`${T}/package.json`)("ffmpeg-static");
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const ZIEL = Number(arg("--sekunden") || 60), WAHL = arg("--kapitel")?.split(","), NAME = arg("--name") || `schnitt-${ZIEL}s`, MIT_VORTEILE = process.argv.includes("--vorteile");
/* Quelle: neueste Fassung in Git, sonst der letzte Bau */
const fd = `${R}/docs/videos/fassungen`; let basis;
const fassungen = existsSync(fd) ? readdirSync(fd).filter((f) => f.endsWith(".timeline.json")).sort() : [];
if (fassungen.length) basis = `${fd}/${fassungen.at(-1).replace(".timeline.json", "")}`;
else { const m = JSON.parse(readFileSync(`${R}/docs/videos/videos/komplett.json`, "utf8")); basis = `out-web/komplett/${m.ausgabe || "komplett"}`; }
const TL = JSON.parse(readFileSync(`${basis}.timeline.json`, "utf8")), SRC = `${basis}.mp4`;
const folie = (n) => TL.folien.find((f) => f.name === n);
const LEAD = 0.4, TAIL = 0.5, ueber = 0.6;  /* Rand vor und nach einem Satz, Überlappung zum nächsten Satz */
const kap = TL.kapitel.filter((c) => !WAHL || WAHL.includes(c.id));
if (!kap.length) throw new Error("keine Kapitel gefunden (--kapitel mit Kapitel-IDs, z. B. einleitung,suchen,filter)");
const dauer = (S) => { let t = 0, last = null; for (const s of S) { const a = s.start - LEAD, b = s.ende + TAIL; t += last !== null && a - last < ueber ? Math.max(0, b - last) : b - a; last = b; } return t; };
const fest = (folie("titel")?.ende || 0) + (folie("schluss") ? folie("schluss").ende - folie("schluss").start : 0) + (MIT_VORTEILE && folie("vorteile") ? folie("vorteile").ende - folie("vorteile").start : 0);
let gew = kap.map((c) => c.saetze.filter((s) => s.kern));  /* je Kapitel gewählte Sätze */
const gesamt = () => fest + gew.reduce((a, S) => a + dauer(S), 0);
while (gew.length > 1 && gesamt() > ZIEL) { gew.pop(); kap.pop(); }  /* Kapitel am Ende weglassen */
for (let rund = 0, voll = false; !voll; rund++) {  /* weitere Sätze reihum, solange es passt */
  voll = true;
  for (const [i, c] of kap.entries()) {
    const frei = c.saetze.filter((s) => !gew[i].includes(s)); if (!frei.length) continue;
    const next = frei[0], probe = [...gew[i], next].sort((a, b) => a.start - b.start), neu = gesamt() - dauer(gew[i]) + dauer(probe);
    if (neu <= ZIEL) { gew[i] = probe; voll = false; }
  }
}
/* Teile (Sekunden im Quellvideo); benachbarte Sätze werden zusammengelegt */
const teile = [];
const add = (a, b, art) => teile.push({ a, b, art });
if (folie("titel")) add(folie("titel").start, folie("titel").ende, "folie");
const vtt = [];
for (const [i, c] of kap.entries()) {
  let cur = null;
  for (const s of gew[i]) {
    const a = Math.max(c.start, s.start - LEAD), b = Math.min(c.ende, s.ende + TAIL);
    if (cur && a - cur.b < ueber) { cur.b = Math.max(cur.b, b); cur.s.push(s); } else { cur = { a, b, art: "inhalt", s: [s] }; teile.push(cur); }
  }
}
if (MIT_VORTEILE && folie("vorteile")) add(folie("vorteile").start, folie("vorteile").ende, "folie");
if (folie("schluss")) add(folie("schluss").start, folie("schluss").ende, "folie");
const tmp = `out-web/schnitt/_${NAME}`; rmSync(tmp, { recursive: true, force: true }); mkdirSync(tmp, { recursive: true });
const run = (a) => { const r = spawnSync(FF, ["-y", "-loglevel", "error", ...a], { encoding: "utf8" }); if (r.status) { console.error(r.stderr.slice(-500)); process.exit(1); } };
const list = []; let t = 0; const ts = (x) => `${String(Math.floor(x / 3600)).padStart(2, "0")}:${String(Math.floor((x % 3600) / 60)).padStart(2, "0")}:${(x % 60).toFixed(3).padStart(6, "0")}`;
for (const [i, p] of teile.entries()) {
  const d = +(p.b - p.a).toFixed(3), f = `${tmp}/t${i}.mp4`;
  const vf = p.art === "folie" ? "fps=30,format=yuv420p" : `fps=30,format=yuv420p,fade=t=in:st=0:d=0.2:color=white,fade=t=out:st=${(d - 0.2).toFixed(2)}:d=0.2:color=white`;
  const af = p.art === "folie" ? "anull" : `afade=t=in:d=0.12,afade=t=out:st=${(d - 0.15).toFixed(2)}:d=0.15`;
  run(["-ss", String(p.a), "-t", String(d), "-i", SRC, "-vf", vf, "-af", af, "-ar", "22050", "-ac", "1", "-c:v", "libx264", "-crf", "23", "-preset", "medium", "-c:a", "aac", "-b:a", "96k", f]);
  list.push(`file '${process.cwd()}/${f}'`);
  for (const s of p.s || []) vtt.push(`${ts(t + (s.start - p.a))} --> ${ts(t + (s.ende - p.a) + 0.3)}\n${s.text}\n`);
  if (p.art === "folie") vtt.push(...[]);
  t += d;
}
writeFileSync(`${tmp}/list.txt`, list.join("\n"));
run(["-f", "concat", "-safe", "0", "-i", `${tmp}/list.txt`, "-c", "copy", "-movflags", "+faststart", `out-web/schnitt/${NAME}.mp4`]);
writeFileSync(`out-web/schnitt/${NAME}.vtt`, "WEBVTT\n\n" + vtt.join("\n"));
rmSync(tmp, { recursive: true, force: true });
console.log(`Schnitt ${NAME}: ${t.toFixed(1)} s (Ziel ${ZIEL} s) aus ${SRC.split("/").pop()}, ${kap.length} Kapitel, ${gew.reduce((a, S) => a + S.length, 0)} Sätze → out-web/schnitt/${NAME}.mp4`);
