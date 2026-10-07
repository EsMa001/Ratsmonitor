/* Liest Text aus einem Bild (statt das Bild anzusehen, spart Tokens): node ocr.mjs <bild.png|jpg> [mehr Bilder ...]   (im Ordner ~/code/video-tools starten)
   Deutsch, tesseract.js (läuft lokal; beim ersten Mal lädt es die Sprachdaten). Gibt je Bild den erkannten Text aus. */
import { homedir } from "node:os";
const TOOLS = process.env.VIDEO_TOOLS || `${homedir()}/code/video-tools`;
const { createWorker } = await import(`${TOOLS}/node_modules/tesseract.js/src/index.js`);
const w = await createWorker("deu", 1, { cachePath: `${TOOLS}/cache/tesseract` });
for (const f of process.argv.slice(2)) { const { data } = await w.recognize(f); console.log(`## ${f}\n${data.text.trim()}`); }
await w.terminate();
