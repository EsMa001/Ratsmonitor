/* Zerlegt ein Webinar-Skript in Kapitel: node prep.mjs <skript.txt> <out-ordner>   (im Ordner ~/code/video-tools starten)
   Schreibt <out>/cNN.txt (gesprochene Sätze) und <out>/chapters.json (Nummer, Titel, Kapitelseite). */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { fill } from "../clips/fmt.mjs";
const [src, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
/* Platzhalter {{schlüssel|format}} aus docs/videos/facts.json (node tools/clips/facts.mjs); Zeilen mit "@beat1,beat2 " am Anfang ordnen dem Satz Clip-Schritte zu (tools/clips/compose.py) */
const FP = fileURLToPath(new URL("../../facts.json", import.meta.url));
const facts = existsSync(FP) ? JSON.parse(readFileSync(FP, "utf8")).values : {};
const chapters = [];
for (const raw of readFileSync(src, "utf8").split("\n")) {
  const l = raw.trim();
  if (!l || l.startsWith("# ") || l === "#") continue;
  let m;
  if ((m = l.match(/^## (\d+) (.*)$/))) chapters.push({ nr: +m[1], name: m[2], lines: [] });
  else if ((m = l.match(/^\[VORHANDENES VIDEO \| (\d+) \| (.*)\]$/))) chapters.at(-1).video = { nn: m[1], name: m[2] };
  else if ((m = l.match(/^\[KAPITELSEITE \| Icon: (\w+) \| Titel: (.*?) \| Stichpunkte: (.*)\]$/))) Object.assign(chapters.at(-1), { icon: m[1], title: m[2], bullets: m[3].split(" · ") });
  else { const b = l.match(/^@([\w,-]+) (.*)$/); chapters.at(-1).lines.push(fill(b ? b[2] : l, facts)); (chapters.at(-1).beats ||= []).push(b ? b[1].split(",") : []); }
}
for (const c of chapters) { const n = String(c.nr).padStart(2, "0"); if (!c.lines.length) continue; writeFileSync(`${out}/c${n}.txt`, c.lines.join("\n") + "\n"); mkdirSync(`${out}/c${n}`, { recursive: true }); writeFileSync(`${out}/c${n}/beats.json`, JSON.stringify(c.beats)); }
writeFileSync(`${out}/chapters.json`, JSON.stringify(chapters.map(({ lines, beats, ...r }) => r), null, 1));
console.log(chapters.length, "Kapitel");
