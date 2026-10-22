// Gemeinsame Vorlage für alle Plenara-Präsentationen: Thema, Layouts, Bausteine (docs/design/corporate-design.md, Abschnitt 11).
// Genutzt von build-praesentation.mjs und build-investoren.mjs; eine Präsentation je Prozess.
import { createRequire } from "node:module";
import { readFileSync, mkdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const pptxgen = require("pptxgenjs");
const sharp = require("sharp");
const opentype = require("opentype.js");
const AdmZip = require("adm-zip");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const Fi = require("react-icons/fi");

const TOOLS = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(TOOLS, "../../..");
const SHOTS = join(REPO, "docs/design/praesentation/screenshots");
const OUT_DIR = join(REPO, "docs/design/praesentation");
mkdirSync(OUT_DIR, { recursive: true });

/** Schreibt die Markenfarben in das Thema der fertigen Datei (pptxgenjs kann keine Themenfarben setzen). */
function applyTheme(file, theme) {
  const zip = new AdmZip(file);
  const entry = zip.getEntry("ppt/theme/theme1.xml");
  let x = entry.getData().toString("utf8");
  for (const [k, v] of Object.entries(theme.colors)) x = x.replace(new RegExp(`<a:${k}>[\\s\\S]*?</a:${k}>`), `<a:${k}><a:srgbClr val="${v}"/></a:${k}>`);
  x = x.replace(/<a:clrScheme name="[^"]*"/, `<a:clrScheme name="${theme.name}"`).replace(/<a:theme ([^>]*?)name="[^"]*"/, `<a:theme $1name="${theme.name}"`);
  zip.updateFile(entry, Buffer.from(x, "utf8"));
  zip.writeZip(file);
}

// ---------- Marke ----------
// Farbschema „Petrol klar“ (app/styles/tokens.css, seit 17.10.2026): Grau (zinc), Petrol, Dunkelblau (sky), Orange-Braun (amber)
const HEX = { ink: "18181B", dark: "191E1D", white: "FFFFFF", face: "F4F4F5", teal: "268478", tealDark: "1F7065", tealLight: "E6F3F1", grey: "52525B", greyLight: "A1A1AA", line: "E4E4E7", lineCard: "E4E4E7", sky: "0C4A6E", amber: "B45309", link: "29467A" };
const THEME = {
  name: "Plenara",
  headFontFace: "IBM Plex Sans SmBld",
  bodyFontFace: "IBM Plex Sans",
  colors: { dk1: HEX.ink, lt1: HEX.white, dk2: HEX.dark, lt2: HEX.face, accent1: HEX.teal, accent2: HEX.tealDark, accent3: HEX.grey, accent4: HEX.greyLight, accent5: HEX.tealLight, accent6: HEX.line, hlink: HEX.link, folHlink: HEX.link },
};
const SB = "IBM Plex Sans SmBld"; // SemiBold 600 für Hervorhebungen

const pres = new pptxgen();
pres.layout = "LAYOUT_16x9"; // 10 x 5,625 Zoll
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
pres.author = "plenara";
pres.company = "plenara";
pres.title = "Plenara Firmenpräsentation";
pres.subject = "Besser verstehen, was vor Ort beraten wird.";
const C = pres.SchemeColor;
const W = 10, H = 5.625;

// ---------- Textmaße mit den echten Schriften (für Höhen und Umbrüche) ----------
const fontOf = (bold) => opentype.parse(readFileSync(join(REPO, "public/fonts", bold ? "IBMPlexSans-SemiBold.ttf" : "IBMPlexSans-Regular.ttf")).buffer.slice(0));
const FONTS = { r: fontOf(false), b: fontOf(true) };
const widthIn = (s, pt, bold) => { const f = FONTS[bold ? "b" : "r"]; let w = 0; for (const ch of s) w += (f.charToGlyph(ch).advanceWidth || 0) * pt / f.unitsPerEm; return w / 72; };
function lineCount(text, pt, bold, wIn) {
  let n = 0;
  for (const para of String(text).split("\n")) {
    let line = "", lines = 1;
    for (const word of para.split(" ")) {
      const t = line ? line + " " + word : word;
      if (widthIn(t, pt, bold) <= wIn) line = t;
      else { lines++; line = word; }
    }
    n += lines;
  }
  return n;
}
const textH = (text, pt, bold, wIn, lh = 1.2) => (lineCount(text, pt, bold, wIn) * pt * lh) / 72;

// ---------- Bilder ----------
const b64 = (buf) => "image/png;base64," + buf.toString("base64");
const file = (p) => readFileSync(p);
const LOGO = { light: file(join(REPO, "docs/design/logo/plenara-logo.png")), dark: file(join(REPO, "docs/design/logo/plenara-logo-dunkel.png")), xDark: file(join(REPO, "docs/design/logo/plenara-x-logo-dunkel.png")), mark: file(join(REPO, "docs/design/logo/plenara-bildmarke.png")) };
const dims = async (buf) => { const m = await sharp(buf).metadata(); return m.width / m.height; };
const RATIO = { logo: await dims(LOGO.light), logoDark: await dims(LOGO.dark), xDark: await dims(LOGO.xDark), mark: await dims(LOGO.mark) };

async function dotGrid(bg, dot, alpha) {
  const dots = [];
  for (let y = 14; y < 1080; y += 28) for (let x = 14; x < 1920; x += 28) dots.push(`<circle cx="${x}" cy="${y}" r="1.7"/>`);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080"><rect width="1920" height="1080" fill="#${bg}"/><g fill="#${dot}" fill-opacity="${alpha}">${dots.join("")}</g></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}
const BG_DARK = await dotGrid(HEX.dark, HEX.teal, 0.32);

async function icon(name, color, px = 256) {
  const el = React.createElement(Fi[name], { size: px, color: "#" + color, strokeWidth: 1.75 });
  return sharp(Buffer.from(renderToStaticMarkup(el))).resize(px, px).png().toBuffer();
}
const ICON_NAMES = ["FiSearch", "FiBell", "FiBarChart2", "FiDownload", "FiFileText", "FiLayers", "FiCheckCircle", "FiTruck", "FiUsers", "FiMic", "FiHome", "FiClock", "FiFilter", "FiHash", "FiRadio", "FiMap", "FiGrid", "FiTool", "FiBriefcase", "FiWind", "FiSun", "FiThermometer", "FiBookOpen", "FiHeart", "FiShoppingCart", "FiNavigation", "FiShield", "FiEye", "FiTrendingUp", "FiUser", "FiDatabase", "FiBox", "FiGlobe"];
const ICONS = {};
await Promise.all(ICON_NAMES.map(async (name) => { ICONS[name + HEX.tealDark] = b64(await icon(name, HEX.tealDark)); }));
function ic(name, color = HEX.tealDark) {
  const k = name + color;
  if (!ICONS[k]) throw new Error("Symbol nicht vorbereitet: " + name);
  return ICONS[k];
}

/** Screenshot-Ausschnitt (Pixel im 2880x1800-Bild) als PNG */
async function shot(name, { left, top, width, height }) {
  const buf = await sharp(join(SHOTS, name + ".png")).extract({ left, top, width, height }).png().toBuffer();
  return { data: b64(buf), ratio: width / height };
}
const IMG = {
  karte: await shot("suche", { left: 640, top: 160, width: 2240, height: 1460 }),
  liste: await shot("suche-liste", { left: 0, top: 150, width: 2880, height: 1100 }),
  artikel: await shot("artikel", { left: 0, top: 150, width: 2880, height: 1640 }),
  alarme: await shot("alarme", { left: 0, top: 150, width: 2000, height: 1150 }),
  ausbreitung: await shot("x-ueber", { left: 1740, top: 200, width: 1100, height: 775 }),
  start: await shot("start", { left: 1560, top: 130, width: 1300, height: 1600 }),
};

// ---------- Layouts ----------
const FOOT_Y = 5.2;
pres.defineSlideMaster({
  title: "HELL",
  background: { color: HEX.white },
  objects: [
    { image: { x: 0.5, y: FOOT_Y + 0.02, w: 0.2 * RATIO.logo, h: 0.2, data: b64(LOGO.light) } },
    { placeholder: { options: { name: "eyebrow", type: "body", x: 0.5, y: 0.42, w: 9, h: 0.25, fontSize: 10, fontFace: SB, color: C.accent2, charSpacing: 2, margin: 0, valign: "top" }, text: "" } },
    { placeholder: { options: { name: "title", type: "title", x: 0.5, y: 0.68, w: 9, h: 0.6, fontSize: 24, color: C.text1, margin: 0, valign: "top" }, text: "" } },
  ],
  slideNumber: { x: 9.1, y: FOOT_Y, w: 0.4, h: 0.25, fontSize: 9, color: HEX.greyLight, align: "right" },
});
pres.defineSlideMaster({
  title: "DUNKEL",
  background: { data: b64(BG_DARK) },
  objects: [],
});
pres.defineSlideMaster({
  title: "TRENNER",
  background: { data: b64(BG_DARK) },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: 0.8, y: 2.2, w: 8.4, h: 0.8, fontSize: 36, color: C.background1, margin: 0, valign: "top" }, text: "" } },
    { placeholder: { options: { name: "sub", type: "body", x: 0.8, y: 3.05, w: 8.4, h: 0.5, fontSize: 16, color: C.accent4, margin: 0, valign: "top" }, text: "" } },
    { image: { x: 0.8, y: FOOT_Y, w: 0.22 * RATIO.logoDark, h: 0.22, data: b64(LOGO.dark) } },
  ],
});

// ---------- Helfer ----------
let n = 0;
function slide(master, section, notes) {
  const s = pres.addSlide({ masterName: master, sectionTitle: section });
  n++;
  if (notes) s.addNotes(notes);
  return s;
}
function head(s, eyebrow, title) {
  s.addText(eyebrow.toUpperCase(), { placeholder: "eyebrow" });
  s.addText(title, { placeholder: "title" });
}
const T = (s, text, o) => s.addText(text, { isTextBox: true, margin: 0, fontSize: 13, color: C.text1, valign: "top", align: "left", ...o });
function card(s, x, y, w, h, o = {}) {
  s.addShape(pres.ShapeType.roundRect, { x, y, w, h, rectRadius: 0.1, fill: { color: o.fill || C.background2 }, line: { color: o.line || C.accent6, width: 0.75 }, ...(o.shadow ? { shadow: { type: "outer", color: HEX.ink, blur: 6, offset: 2, angle: 90, opacity: 0.08 } } : {}) });
}
function iconCircle(s, name, x, y, d = 0.44, { bg = C.accent5, fg = HEX.tealDark } = {}) {
  s.addShape(pres.ShapeType.ellipse, { x, y, w: d, h: d, fill: { color: bg }, line: { color: bg, width: 0 } });
  s.addImage({ data: ic(name, fg), x: x + d * 0.25, y: y + d * 0.25, w: d * 0.5, h: d * 0.5 });
}
/** Liste mit Teal-Quadrat, Überschrift (SemiBold) und Erläuterung; gibt die Endhöhe zurück */
function squareList(s, items, x, y, w, { gap = 0.22, headPt = 13, bodyPt = 11.5 } = {}) {
  let cy = y;
  for (const [h1, body] of items) {
    s.addShape(pres.ShapeType.rect, { x, y: cy + 0.06, w: 0.1, h: 0.1, fill: { color: C.accent1 }, line: { color: C.accent1, width: 0 } });
    const tx = x + 0.25, tw = w - 0.25;
    const hh = textH(h1, headPt, true, tw);
    T(s, h1, { x: tx, y: cy, w: tw, h: hh + 0.02, fontSize: headPt, fontFace: SB });
    cy += hh + 0.04;
    if (body) {
      const bh = textH(body, bodyPt, false, tw);
      T(s, body, { x: tx, y: cy, w: tw, h: bh + 0.02, fontSize: bodyPt, color: C.accent3 });
      cy += bh;
    }
    cy += gap;
  }
  return cy;
}
function stat(s, x, y, w, value, label, { size = 30, labelPt = 10.5, color = C.text1, labelColor = C.accent3 } = {}) {
  const vh = (size * 1.3) / 72;
  T(s, value, { x, y, w, h: vh, fontSize: size, fontFace: SB, color });
  const lh = textH(label, labelPt, false, w);
  T(s, label, { x, y: y + vh + 0.02, w, h: lh + 0.02, fontSize: labelPt, color: labelColor });
  return y + vh + 0.02 + lh;
}
function picture(s, img, x, y, w, { maxH, frame = true } = {}) {
  let h = w / img.ratio;
  if (maxH && h > maxH) { h = maxH; w = h * img.ratio; }
  if (frame) s.addShape(pres.ShapeType.roundRect, { x: x - 0.04, y: y - 0.04, w: w + 0.08, h: h + 0.08, rectRadius: 0.06, fill: { color: C.background1 }, line: { color: HEX.lineCard, width: 0.75 }, shadow: { type: "outer", color: HEX.ink, blur: 10, offset: 3, angle: 90, opacity: 0.1 } });
  s.addImage({ data: img.data, x, y, w, h });
  return { x, y, w, h };
}
const CHART_BASE = {
  chartColors: [HEX.teal],
  showLegend: false,
  showValue: true,
  dataLabelFontFace: "+mn-lt", dataLabelFontSize: 10, dataLabelColor: HEX.ink,
  catAxisLabelFontFace: "+mn-lt", catAxisLabelFontSize: 10, catAxisLabelColor: HEX.grey,
  valAxisLabelFontFace: "+mn-lt", valAxisLabelFontSize: 9, valAxisLabelColor: HEX.greyLight,
  valGridLine: { color: HEX.line, size: 0.5 }, catGridLine: { style: "none" },
  catAxisLineShow: false, valAxisLineShow: false,
  showTitle: true, titleFontFace: "+mj-lt", titleFontSize: 11, titleColor: HEX.ink, titleAlign: "left",
  barGapWidthPct: 55,
};


/** Schreibt die Datei und setzt die Themenfarben. */
export async function finish(out) {
  await pres.writeFile({ fileName: out });
  applyTheme(out, THEME);
  console.log("geschrieben:", out, "Folien:", n);
}
export const count = () => n;
export { pres, C, W, H, HEX, THEME, SB, b64, LOGO, RATIO, IMG, shot, ic, textH, widthIn, slide, head, T, card, iconCircle, squareList, stat, picture, CHART_BASE, OUT_DIR, join };
