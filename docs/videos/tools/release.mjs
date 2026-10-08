/* Legt eine Fassung des vollständigen Videos in Git ab: node release.mjs   (im Ordner ~/code/video-tools starten, nach build-video.mjs komplett)
   Kopiert out-web/komplett/<ausgabe>.mp4, .vtt und .timeline.json nach docs/videos/fassungen/<ausgabe>-<Datum-Uhrzeit>.* und behält nur die neueste Fassung
   (ältere werden gelöscht; in der Git-Historie bleiben sie, deshalb nur freigegebene Fassungen ablegen, nicht jeden Bau). */
import { copyFileSync, mkdirSync, readdirSync, rmSync, readFileSync } from "node:fs";
const R = new URL("../../../", import.meta.url).pathname, DIR = `${R}docs/videos/fassungen`, O = "out-web/komplett";
const def = JSON.parse(readFileSync(`${R}docs/videos/videos/komplett.json`, "utf8")), name = def.ausgabe || "komplett";
const d = new Date(), pad = (n) => String(n).padStart(2, "0"), stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
mkdirSync(DIR, { recursive: true });
for (const ext of ["mp4", "vtt", "timeline.json"]) copyFileSync(`${O}/${name}.${ext}`, `${DIR}/${name}-${stamp}.${ext}`);
const alle = [...new Set(readdirSync(DIR).filter((f) => f.startsWith(name + "-")).map((f) => f.slice(0, f.indexOf(".")))) ].sort();
for (const alt of alle.slice(0, -1)) for (const ext of ["mp4", "vtt", "timeline.json"]) rmSync(`${DIR}/${alt}.${ext}`, { force: true });
console.log(`Fassung ${name}-${stamp} abgelegt, ${1} Fassung in docs/videos/fassungen (ältere gelöscht)`);
