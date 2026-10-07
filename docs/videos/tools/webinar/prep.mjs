/* Zerlegt ein Webinar-Skript in Kapitel: node prep.mjs <skript.txt> <out-ordner>   (im Ordner ~/code/video-tools starten)
   Schreibt <out>/cNN.txt (gesprochene Sätze) und <out>/chapters.json (Nummer, Titel, Kapitelseite). */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
const [src, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const chapters = [];
for (const raw of readFileSync(src, "utf8").split("\n")) {
  const l = raw.trim();
  if (!l || l.startsWith("# ") || l === "#") continue;
  let m;
  if ((m = l.match(/^## (\d+) (.*)$/))) chapters.push({ nr: +m[1], name: m[2], lines: [] });
  else if ((m = l.match(/^\[VORHANDENES VIDEO \| (\d+) \| (.*)\]$/))) chapters.at(-1).video = { nn: m[1], name: m[2] };
  else if ((m = l.match(/^\[KAPITELSEITE \| Icon: (\w+) \| Titel: (.*?) \| Stichpunkte: (.*)\]$/))) Object.assign(chapters.at(-1), { icon: m[1], title: m[2], bullets: m[3].split(" · ") });
  else chapters.at(-1).lines.push(l);
}
for (const c of chapters) writeFileSync(`${out}/c${String(c.nr).padStart(2, "0")}.txt`, c.lines.join("\n") + "\n");
writeFileSync(`${out}/chapters.json`, JSON.stringify(chapters.map(({ lines, ...r }) => r), null, 1));
console.log(chapters.length, "Kapitel");
