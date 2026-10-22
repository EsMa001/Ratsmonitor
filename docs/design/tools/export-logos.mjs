// node export-logos.mjs  (vorher: npm install in docs/design/tools)
// Exportiert die Plenara-Logos aus der Geometrie von components/ratsmonitor/components/Brand.tsx
// als font-unabhängige SVGs (Schriftzug als Pfade, IBM Plex Sans Regular) und PNGs.
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const require = createRequire(import.meta.url);
const opentype = require("opentype.js");
const sharp = require("sharp");

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const OUT = join(REPO, "docs/design/logo");
mkdirSync(OUT, { recursive: true });

const TEAL = "#268478"; // Petrol „klar“ (--rm-fill, seit 17.10.2026)
const INK = "#18181b";
const DARK = "#191e1d";
const WHITE = "#ffffff";

const font = opentype.parse(require("node:fs").readFileSync(join(REPO, "public/fonts/IBMPlexSans-Regular.ttf")).buffer.slice(0));
const EM = 1000; // 1 em = 1000 Einheiten, Grundlinie bei y = 0

// Bildmarke: Punkte [cx, cy, r, Deckkraft] im viewBox 15..85, Bogen als Stiel
const PLENARA_P = [
  [78.0, 50.0, 3.6, 1], [75.9, 60.7, 3.6, 1], [69.8, 69.8, 3.6, 1], [60.7, 75.9, 3.6, 1], [50.0, 78.0, 3.6, 1], [39.3, 75.9, 3.6, 1], [30.2, 69.8, 3.6, 1],
  [24.1, 60.7, 3.6, 1], [50.0, 22.0, 3.6, 1], [60.7, 24.1, 3.6, 1], [69.8, 30.2, 3.6, 1], [75.9, 39.3, 3.6, 1],
  [67.0, 50.0, 3, 0.55], [63.8, 60.0, 3, 0.55], [55.3, 66.2, 3, 0.55], [44.7, 66.2, 3, 0.55], [36.2, 60.0, 3, 0.55], [33.0, 50.0, 3, 0.55],
  [36.2, 40.0, 3, 0.55], [44.7, 33.8, 3, 0.55], [55.3, 33.8, 3, 0.55], [63.8, 40.0, 3, 0.55],
];
const X_H = 1.06;
const X_SQUARES = [1, -1].flatMap((dx) =>
  [1, -1].flatMap((dy) => Array.from({ length: 6 }, (_, i) => [50 + dx * (18 + i * 10.5), 50 + dy * (18 + i * 10.5), Math.max(0.12, 0.85 - i * 0.13), Math.max(4, 6.5 - i * 0.5)])),
);

const f = (n) => Math.round(n * 100) / 100;

/** Bildmarke (p aus Sitzpunkten mit Bogen) bei x0, Box 0,66 em, Unterkante 0,07 em unter der Grundlinie. Gibt SVG und Breite. */
function mark(x0, color = TEAL) {
  const s = (0.66 * EM) / 70;
  const top = -(0.07 * EM) - 0.66 * EM;
  const X = (u) => f(x0 + (u - 15) * s);
  const Y = (v) => f(top + (v - 15) * s);
  const dots = PLENARA_P.map(([cx, cy, r, o]) => `<circle cx="${X(cx)}" cy="${Y(cy)}" r="${f(r * s)}" fill="${color}"${o < 1 ? ` fill-opacity="${o}"` : ""}/>`).join("");
  const arc = `<path d="M${X(22)} ${Y(108)}V${Y(50)}A${f(28 * s)} ${f(28 * s)} 0 0 1 ${X(38.2)} ${Y(24.6)}" stroke="${color}" stroke-width="${f(7 * s)}" fill="none" stroke-linecap="round"/>`;
  return { svg: dots + arc, width: 0.66 * EM, descent: (108 - 85) * s + 0.07 * EM, top };
}

/** Schriftzug „lenara“ als Pfad, Buchstabenabstand −0,015 em */
function word(x0, color = INK) {
  const opts = { kerning: true, letterSpacing: -0.015 };
  const path = font.getPath("lenara", x0, 0, EM, opts);
  path.fill = color;
  const width = font.getAdvanceWidth("lenara", EM, opts);
  return { svg: path.toSVG(2), width };
}

/** Schlussquadrat 0,15 em auf der Grundlinie, 0,05 em Abstand */
function square(x0, color = TEAL) {
  const w = 0.15 * EM;
  return { svg: `<rect x="${f(x0 + 50)}" y="${-w}" width="${w}" height="${w}" fill="${color}"/>`, width: 50 + w };
}

/** X aus verblassenden Quadraten, Box 1,06 em, Mitte 0,075 em über der Grundlinie */
function xMark(x0, color = TEAL) {
  const box = X_H * EM;
  const left = x0 + 50;
  const top = -(box / 2 + 0.075 * EM);
  const s = box / 100;
  const sq = X_SQUARES.map(([x, y, o, w]) => `<rect x="${f(left + (x - w / 2) * s)}" y="${f(top + (y - w / 2) * s)}" width="${f(w * s)}" height="${f(w * s)}" fill="${color}" fill-opacity="${f(o)}"/>`).join("");
  const dot = 0.15 * EM;
  const c = `<rect x="${f(left + box / 2 - dot / 2)}" y="${f(top + box / 2 - dot / 2)}" width="${dot}" height="${dot}" fill="${color}"/>`;
  return { svg: sq + c, width: 50 + box, top, bottom: top + box };
}

function wrap(parts, { pad = 0.25 * EM, bg = null, top, bottom }) {
  const width = parts.reduce((a, p) => a + p.width, 0);
  const x = -pad, y = top - pad, w = width + 2 * pad, h = bottom - top + 2 * pad;
  const rect = bg ? `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="${bg}"/>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f(x)} ${f(y)} ${f(w)} ${f(h)}" width="${f(w)}" height="${f(h)}">${rect}${parts.map((p) => p.svg).join("")}</svg>`;
}

const ASC = -0.73 * EM; // Oberkante der Bildmarke
function logo({ dark = false, x = false } = {}) {
  const parts = [];
  let cx = 0;
  const m = mark(cx); parts.push(m); cx += m.width + 10;
  const w = word(cx, dark ? WHITE : INK); parts.push(w); cx += w.width;
  let bottom = m.descent;
  if (x) { const xm = xMark(cx); parts.push(xm); cx += xm.width; bottom = Math.max(bottom, xm.bottom); }
  else { const s = square(cx); parts.push(s); cx += s.width; }
  return wrap(parts, { bg: dark ? DARK : null, top: ASC, bottom });
}
function bildmarke({ dark = false } = {}) {
  const m = mark(0);
  return wrap([m], { pad: 0.2 * EM, bg: dark ? DARK : null, top: ASC, bottom: m.descent });
}

const files = {
  "plenara-logo.svg": logo(),
  "plenara-logo-dunkel.svg": logo({ dark: true }),
  "plenara-x-logo.svg": logo({ x: true }),
  "plenara-x-logo-dunkel.svg": logo({ x: true, dark: true }),
  "plenara-bildmarke.svg": bildmarke(),
  "plenara-bildmarke-dunkel.svg": bildmarke({ dark: true }),
};
for (const [name, svg] of Object.entries(files)) writeFileSync(join(OUT, name), svg);

// PNGs: Logos 2400 px breit, Bildmarke 1024 px, Profilbild quadratisch auf Weiß
const png = async (svg, name, { width, height, bg } = {}) => {
  let img = sharp(Buffer.from(svg), { density: 300 });
  if (width || height) img = img.resize({ width, height, fit: "contain", background: bg || { r: 0, g: 0, b: 0, alpha: 0 } });
  if (bg) img = img.flatten({ background: bg });
  await img.png().toFile(join(OUT, name));
};
await png(files["plenara-logo.svg"], "plenara-logo.png", { width: 2400 });
await png(files["plenara-logo-dunkel.svg"], "plenara-logo-dunkel.png", { width: 2400 });
await png(files["plenara-x-logo.svg"], "plenara-x-logo.png", { width: 2400 });
await png(files["plenara-x-logo-dunkel.svg"], "plenara-x-logo-dunkel.png", { width: 2400 });
await png(files["plenara-bildmarke.svg"], "plenara-bildmarke.png", { height: 1024 });
await png(bildmarke(), "plenara-profilbild.png", { width: 1024, height: 1024, bg: WHITE });
await png(bildmarke({ dark: true }), "plenara-profilbild-dunkel.png", { width: 1024, height: 1024, bg: DARK });
console.log("Logos geschrieben nach", OUT);
