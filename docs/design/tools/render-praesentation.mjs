// node render-praesentation.mjs [datei.pptx] [ausgabeordner]   Standard: die Firmenpräsentation nach tmp/praesentation-vorschau
// Rendert eine pptx (aus pptxgenjs) als PNG je Folie mit den echten Plex-Schriften und meldet Textüberläufe.
// Unterstützt: Hintergrund (Farbe, Bild), Rechtecke, abgerundete Rechtecke, Ellipsen, Linien, Textfelder (auch Platzhalter
// aus dem Layout), Bilder, Diagramme nur als Rahmen. Nur zur Prüfung, keine vollständige Wiedergabe.
import { createRequire } from "node:module";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const AdmZip = require("adm-zip");
const sharp = require("sharp");
const opentype = require("opentype.js");

const [, , PPTX = join(resolve(dirname(fileURLToPath(import.meta.url)), "../../.."), "docs/design/praesentation/plenara-firmenpraesentation.pptx"), OUTDIR = join(resolve(dirname(fileURLToPath(import.meta.url)), "../../.."), "tmp/praesentation-vorschau")] = process.argv;
mkdirSync(OUTDIR, { recursive: true });
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const F = {
  r: opentype.parse(readFileSync(join(REPO, "public/fonts/IBMPlexSans-Regular.ttf")).buffer.slice(0)),
  b: opentype.parse(readFileSync(join(REPO, "public/fonts/IBMPlexSans-SemiBold.ttf")).buffer.slice(0)),
};
const DPI = 192, PX = DPI / 914400;
const zip = new AdmZip(PPTX);
const read = (p) => { const e = zip.getEntry(p); return e ? e.getData() : null; };
const xml = (p) => { const b = read(p); return b ? b.toString("utf8") : ""; };

// Theme-Farben
const theme = xml("ppt/theme/theme1.xml");
const themeColor = (name) => { const m = theme.match(new RegExp(`<a:${name}>\\s*<a:(?:srgbClr|sysClr)[^>]*?(?:val|lastClr)="([0-9A-Fa-f]{6})"`)); return m ? m[1] : "FF00FF"; };
const SCHEME = { tx1: "dk1", bg1: "lt1", tx2: "dk2", bg2: "lt2", dk1: "dk1", lt1: "lt1", dk2: "dk2", lt2: "lt2" };
for (const a of ["accent1", "accent2", "accent3", "accent4", "accent5", "accent6", "hlink", "folHlink"]) SCHEME[a] = a;
const warnings = [];

const attr = (s, name) => { const m = s && s.match(new RegExp(`(?:^|\\s)${name}="([^"]*)"`)); return m ? m[1] : undefined; };
const unesc = (t) => t.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
function color(frag) {
  if (!frag) return null;
  let m = frag.match(/<a:srgbClr val="([0-9A-Fa-f]{6})"\s*(\/>|>([\s\S]*?)<\/a:srgbClr>)/);
  let hex, inner;
  if (m) { hex = m[1]; inner = m[3] || ""; }
  else { m = frag.match(/<a:schemeClr val="(\w+)"\s*(\/>|>([\s\S]*?)<\/a:schemeClr>)/); if (!m) return null; hex = themeColor(SCHEME[m[1]] || m[1]); inner = m[3] || ""; }
  const a = inner.match(/<a:alpha val="(\d+)"/);
  return { hex, alpha: a ? +a[1] / 100000 : 1 };
}
const fillOf = (spPr) => { const noLn = spPr.replace(/<a:ln\b[\s\S]*?<\/a:ln>|<a:ln\b[^>]*\/>/g, ""); if (/<a:noFill\/>/.test(noLn.split("<a:prstGeom")[0] + noLn.split("</a:prstGeom>")[1] || "")) return null; const m = noLn.match(/<a:solidFill>([\s\S]*?)<\/a:solidFill>/); return m ? color(m[1]) : null; };
function lineOf(spPr) { const m = spPr.match(/<a:ln\b([^>]*)>([\s\S]*?)<\/a:ln>/); if (!m) return null; if (/<a:noFill\/>/.test(m[2])) return null; const c = m[2].match(/<a:solidFill>([\s\S]*?)<\/a:solidFill>/); const w = attr(m[1], "w"); return { color: c ? color(c[1]) : null, w: w ? +w * PX : 1 }; }
function xfrmOf(s) { const m = s.match(/<[ap]:xfrm([^>]*)>\s*<a:off x="(-?\d+)" y="(-?\d+)"\/>\s*<a:ext cx="(\d+)" cy="(\d+)"\/>/); if (!m) return null; return { x: +m[2] * PX, y: +m[3] * PX, w: +m[4] * PX, h: +m[5] * PX, flipV: /flipV="1"/.test(m[1]), flipH: /flipH="1"/.test(m[1]) }; }

const rels = (p) => { const dir = p.replace(/[^/]+$/, ""), f = p.replace(/^.*\//, ""); const r = xml(dir + "_rels/" + f + ".rels"); const map = {}; for (const m of r.matchAll(/<Relationship\s+([^>]*)\/>/g)) { const id = attr(m[1], "Id"), t = attr(m[1], "Target"); map[id] = t.startsWith("/") ? t.slice(1) : t.startsWith("../") ? "ppt/" + t.slice(3) : dir + t; } return map; };

// Folienreihenfolge
const pres = xml("ppt/presentation.xml");
const sz = pres.match(/<p:sldSz cx="(\d+)" cy="(\d+)"/); const SW = +sz[1] * PX, SH = +sz[2] * PX;
const presRels = rels("ppt/presentation.xml");
const slides = [...pres.matchAll(/<p:sldId [^>]*r:id="(rId[0-9]+)"/g)].map((m) => presRels[m[1]]);

const face = (bold) => (bold ? F.b : F.r);
/** Pfaddaten selbst runden; opentype.js toPathData liefert bei manchen Werten NaN */
const r1 = (v) => (Math.round(v * 10) / 10).toString();
function pathData(path) {
  let d = "";
  for (const c of path.commands) {
    if (c.type === "M" || c.type === "L") d += `${c.type}${r1(c.x)} ${r1(c.y)}`;
    else if (c.type === "Q") d += `Q${r1(c.x1)} ${r1(c.y1)} ${r1(c.x)} ${r1(c.y)}`;
    else if (c.type === "C") d += `C${r1(c.x1)} ${r1(c.y1)} ${r1(c.x2)} ${r1(c.y2)} ${r1(c.x)} ${r1(c.y)}`;
    else if (c.type === "Z") d += "Z";
  }
  return d;
}
/** Glyphe für Glyphe (ohne GSUB), weil getPath/getAdvanceWidth bei Ligaturen NaN liefern */
function glyphRun(font, text, x, y, size, spc = 0) {
  let d = "", cx = x; const scale = size / font.unitsPerEm;
  for (const ch of text) {
    const g = font.charToGlyph(ch);
    if (y !== null && ch !== " ") d += pathData(g.getPath(cx, y, size));
    cx += (g.advanceWidth || 0) * scale + spc;
  }
  return { d, w: cx - x };
}
const adv = (t, pt, bold, spc = 0) => glyphRun(face(bold), t, 0, null, pt * DPI / 72, spc).w;

function paragraphs(txBody, defaults) {
  const out = [];
  for (const pm of txBody.matchAll(/<a:p>([\s\S]*?)<\/a:p>/g)) {
    const p = pm[1];
    const pPr = (p.match(/<a:pPr\b[^>]*(?:\/>|>[\s\S]*?<\/a:pPr>)/) || [""])[0];
    const algn = attr(pPr, "algn") || "l";
    const marL = (+attr(pPr, "marL") || 0) * PX, indent = (+attr(pPr, "indent") || 0) * PX;
    const bu = pPr.match(/<a:buChar char="([^"]*)"/); const buNone = /<a:buNone/.test(pPr);
    const spcAft = +(pPr.match(/<a:spcAft>\s*<a:spcPts val="(\d+)"/) || [0, 0])[1] / 100;
    const spcBef = +(pPr.match(/<a:spcBef>\s*<a:spcPts val="(\d+)"/) || [0, 0])[1] / 100;
    const lnPct = +(pPr.match(/<a:lnSpc>\s*<a:spcPct val="(\d+)"/) || [0, 100000])[1] / 100000;
    const runs = [];
    for (const rm of p.matchAll(/<a:r>([\s\S]*?)<\/a:r>|<a:br\/>|<a:fld\b[^>]*>([\s\S]*?)<\/a:fld>/g)) {
      if (rm[0] === "<a:br/>") { runs.push({ br: true }); continue; }
      const r = rm[1] || rm[2];
      const rPr = (r.match(/<a:rPr\b[^>]*(?:\/>|>[\s\S]*?<\/a:rPr>)/) || [""])[0];
      const sz = attr(rPr, "sz"); const b = attr(rPr, "b"); const cap = attr(rPr, "cap"); const spc = attr(rPr, "spc");
      const latin = (rPr.match(/<a:latin typeface="([^"]*)"/) || [])[1];
      const col = (rPr.match(/<a:solidFill>([\s\S]*?)<\/a:solidFill>/) || [])[1];
      let text = unesc((r.match(/<a:t>([\s\S]*?)<\/a:t>/) || ["", ""])[1]);
      if (rm[2]) text = text || "#";
      if (cap === "all") text = text.toUpperCase();
      const pt = sz ? +sz / 100 : defaults.pt;
      const bold = b === "1" || /SmBld|SemiBold|Bold/.test(latin || "") || (!latin && defaults.bold) || latin === "+mj-lt";
      runs.push({ text, pt, bold, color: col ? color(col) : defaults.color, spc: spc ? (+spc / 100) * DPI / 72 : 0 });
    }
    out.push({ algn, marL, indent, bullet: bu && !buNone ? bu[1] : null, spcAft, spcBef, lnPct, runs });
  }
  return out;
}

/** Zeilenumbruch je Absatz; gibt Zeilen [{segs:[{text,run}], w, h, asc}] */
function wrap(para, width) {
  const lines = []; let cur = []; let curW = 0;
  const push = () => { lines.push({ segs: cur, w: curW }); cur = []; curW = 0; };
  for (const run of para.runs) {
    if (run.br) { push(); continue; }
    const words = run.text.split(/(\s+)/);
    for (const w of words) {
      if (!w) continue;
      const ww = adv(w, run.pt, run.bold, run.spc);
      if (/^\s+$/.test(w)) { if (cur.length) { cur.push({ text: w, run, w: ww }); curW += ww; } continue; }
      if (curW + ww > width + 0.5 && cur.length) { while (cur.length && /^\s+$/.test(cur[cur.length - 1].text)) curW -= cur.pop().w; push(); }
      cur.push({ text: w, run, w: ww }); curW += ww;
    }
  }
  if (cur.length || !lines.length) push();
  for (const l of lines) { const pts = l.segs.map((s) => s.run.pt); const pt = pts.length ? Math.max(...pts) : ((para.runs.find((r) => r.pt) || {}).pt || 12); l.h = pt * DPI / 72 * 1.2 * para.lnPct; l.pt = pt; }
  return lines;
}

let svgText = [];
function drawText(sp, box, bodyPr, defaults, id) {
  const txBody = (sp.match(/<p:txBody>([\s\S]*?)<\/p:txBody>/) || [])[1];
  if (!txBody) return;
  const paras = paragraphs(txBody, defaults);
  if (!paras.some((p) => p.runs.some((r) => r.text && r.text.trim()))) return;
  const ins = (n, d) => (attr(bodyPr, n) !== undefined ? +attr(bodyPr, n) * PX : d * PX);
  const lI = ins("lIns", 91440), rI = ins("rIns", 91440), tI = ins("tIns", 45720), bI = ins("bIns", 45720);
  const anchor = attr(bodyPr, "anchor") || "t";
  const nowrap = attr(bodyPr, "wrap") === "none";
  const width = box.w - lI - rI;
  const blocks = paras.map((p) => ({ p, lines: wrap(p, nowrap ? 1e9 : width - p.marL) }));
  let total = 0;
  for (const b of blocks) total += b.p.spcBef * DPI / 72 + b.lines.reduce((a, l) => a + l.h, 0) + b.p.spcAft * DPI / 72;
  const avail = box.h - tI - bI;
  const sample = paras.flatMap((p) => p.runs.map((r) => r.text || "")).join(" ").trim().slice(0, 60);
  if (total > avail + 1.5) warnings.push(`${id}: Text läuft über (${(total / DPI).toFixed(2)}" nötig, ${(avail / DPI).toFixed(2)}" da): „${sample}“`);
  if (nowrap) for (const b of blocks) for (const l of b.lines) if (l.w > width + 1) warnings.push(`${id}: Zeile breiter als Feld: „${sample}“`);
  let y = box.y + tI + (anchor === "ctr" ? (avail - total) / 2 : anchor === "b" ? avail - total : 0);
  for (const { p, lines } of blocks) {
    y += p.spcBef * DPI / 72;
    lines.forEach((l, li) => {
      const f = face(false); const upm = f.unitsPerEm;
      const ascPx = (f.ascender / upm) * l.pt * DPI / 72, descPx = (-f.descender / upm) * l.pt * DPI / 72;
      const baseline = y + (l.h - (ascPx + descPx)) / 2 + ascPx;
      let x = box.x + lI + p.marL;
      if (p.algn === "ctr") x += (width - p.marL - l.w) / 2; else if (p.algn === "r") x += width - p.marL - l.w;
      if (p.bullet && li === 0 && l.segs.length) { const r = l.segs[0].run; svgText.push(pathSvg(glyphRun(face(r.bold), p.bullet, x + p.indent, baseline, r.pt * DPI / 72).d, r.color)); }
      for (const s of l.segs) {
        if (!/^\s+$/.test(s.text)) svgText.push(pathSvg(glyphRun(face(s.run.bold), s.text, x, baseline, s.run.pt * DPI / 72, s.run.spc).d, s.run.color));
        x += s.w;
      }
      y += l.h;
    });
    y += p.spcAft * DPI / 72;
  }
}
const pathSvg = (d, col) => { const c = col || { hex: "000000", alpha: 1 }; if (!d) return ""; if (/NaN/.test(d)) warnings.push("NaN im Pfad"); return `<path d="${d}" fill="#${c.hex}"${c.alpha < 1 ? ` fill-opacity="${c.alpha}"` : ""}/>`; };

function shapeSvg(sp, box, id) {
  const spPr = (sp.match(/<p:spPr>([\s\S]*?)<\/p:spPr>/) || ["", ""])[1];
  const prst = (spPr.match(/<a:prstGeom prst="(\w+)"/) || [])[1] || "rect";
  const fill = fillOf(spPr), ln = lineOf(spPr);
  const fa = fill ? `fill="#${fill.hex}"${fill.alpha < 1 ? ` fill-opacity="${fill.alpha}"` : ""}` : 'fill="none"';
  const la = ln && ln.color ? `stroke="#${ln.color.hex}" stroke-width="${Math.max(ln.w, 0.5)}"` : "";
  if (prst === "line") { const y1 = box.flipV ? box.y + box.h : box.y, y2 = box.flipV ? box.y : box.y + box.h; return `<line x1="${box.x}" y1="${y1}" x2="${box.x + box.w}" y2="${y2}" ${la || 'stroke="#000"'}/>`; }
  if (prst === "ellipse") return `<ellipse cx="${box.x + box.w / 2}" cy="${box.y + box.h / 2}" rx="${box.w / 2}" ry="${box.h / 2}" ${fa} ${la}/>`;
  let rx = 0;
  if (prst === "roundRect") { const adj = +(spPr.match(/<a:gd name="adj" fmla="val (\d+)"/) || [0, 16667])[1]; rx = (adj / 100000) * Math.min(box.w, box.h); }
  return `<rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" rx="${rx}" ${fa} ${la}/>`;
}

function bgSvg(part, partRels) {
  const bg = (part.match(/<p:bg>([\s\S]*?)<\/p:bg>/) || [])[1];
  if (!bg) return "";
  const blip = bg.match(/<a:blip r:embed="(rId[0-9]+)"/);
  if (blip) { const media = read(partRels[blip[1]]); return `<image x="0" y="0" width="${SW}" height="${SH}" preserveAspectRatio="none" href="data:image/png;base64,${media.toString("base64")}"/>`; }
  const c = color(bg);
  return c ? `<rect width="${SW}" height="${SH}" fill="#${c.hex}"/>` : "";
}

function layoutPlaceholders(layout) {
  const map = {};
  for (const m of layout.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)) {
    const sp = m[0]; const ph = sp.match(/<p:ph\b([^>]*)\/>/); if (!ph) continue;
    const type = attr(ph[1], "type") || "body", idx = attr(ph[1], "idx");
    const bodyPr = (sp.match(/<a:bodyPr\b[^>]*(?:\/>|>)/) || [""])[0];
    const def = sp.match(/<a:defRPr\b([^>]*)(?:\/>|>([\s\S]*?)<\/a:defRPr>)/);
    const dSz = def && attr(def[1], "sz"), dB = def && attr(def[1], "b"), dCol = def && def[2] && def[2].match(/<a:solidFill>([\s\S]*?)<\/a:solidFill>/);
    const latin = def && def[2] && (def[2].match(/<a:latin typeface="([^"]*)"/) || [])[1];
    const entry = { xfrm: xfrmOf(sp), bodyPr, defaults: { pt: dSz ? +dSz / 100 : 18, bold: dB === "1" || /SmBld/.test(latin || "") || type === "title", color: dCol ? color(dCol[1]) : { hex: "000000", alpha: 1 } } };
    map[type + "#" + idx] = entry; map[type] = map[type] || entry; if (idx) map["#" + idx] = entry;
  }
  return map;
}

async function renderPart(part, partRels, phMap, isLayout, idPrefix) {
  const els = [];
  for (const m of part.matchAll(/<p:(sp|pic|graphicFrame|cxnSp)\b[\s\S]*?<\/p:\1>/g)) {
    const kind = m[1], sp = m[0];
    const ph = sp.match(/<p:ph\b([^>]*)\/>/);
    const name = attr((sp.match(/<p:cNvPr\b([^>]*)/) || [""])[1], "name") || kind;
    const id = `${idPrefix} ${name}`;
    if (isLayout && ph) continue; // leere Platzhalter des Layouts werden nicht gezeigt
    let box = xfrmOf(sp), bodyPr = (sp.match(/<a:bodyPr\b[^>]*(?:\/>|>)/) || [""])[0], defaults = { pt: 18, bold: false, color: { hex: "000000", alpha: 1 } };
    if (ph) {
      const type = attr(ph[1], "type") || "body", idx = attr(ph[1], "idx");
      const inh = phMap[type + "#" + idx] || phMap["#" + idx] || phMap[type];
      if (inh) { box = box || inh.xfrm; if (!attr(bodyPr, "anchor") && inh.bodyPr) bodyPr = inh.bodyPr + bodyPr; defaults = inh.defaults; }
    }
    if (!box) { warnings.push(`${id}: keine Position`); continue; }
    if (kind === "pic") {
      const blip = sp.match(/<a:blip r:embed="(rId[0-9]+)"/); const media = blip && read(partRels[blip[1]]);
      if (media) { const mime = partRels[blip[1]].endsWith(".jpg") || partRels[blip[1]].endsWith(".jpeg") ? "image/jpeg" : "image/png"; els.push(`<image x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" preserveAspectRatio="none" href="data:${mime};base64,${media.toString("base64")}"/>`); }
      continue;
    }
    if (kind === "graphicFrame") { const cm = sp.match(/<c:chart [^>]*r:id="(rId[0-9]+)"/); const cx = cm && partRels[cm[1]] ? xml(partRels[cm[1]]) : ""; if (cx) els.push(chartSvg(cx, box)); else els.push(`<rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" fill="#f4f4f5" stroke="#a1a1aa" stroke-dasharray="6 4"/>`); continue; }
    els.push(shapeSvg(sp, box, id));
    svgText = [];
    drawText(sp, box, bodyPr, defaults, id);
    els.push(...svgText);
  }
  return els.join("");
}

/** Einfache Balken- und Säulendiagramme aus der Chart-XML (nur zur Prüfung; Farben und Werte wie in der Datei) */
function chartSvg(chartXml, box) {
  const els = [];
  const col = (frag) => { const m = frag && frag.match(/<a:srgbClr val="([0-9A-Fa-f]{6})"/); return m ? m[1] : "268478"; };
  const vals = (frag, tag) => { const part = (frag.match(new RegExp("<c:" + tag + ">[\\s\\S]*?</c:" + tag + ">")) || [""])[0]; return [...part.matchAll(/<c:pt idx="(\d+)">\s*<c:v>([^<]*)<\/c:v>/g)].map((m) => unesc(m[2])); };
  const horizontal = /<c:barDir val="bar"/.test(chartXml);
  const series = [...chartXml.matchAll(/<c:ser>([\s\S]*?)<\/c:ser>/g)].map((m) => {
    const s = m[1];
    const dpt = {}; for (const d of s.matchAll(/<c:dPt>([\s\S]*?)<\/c:dPt>/g)) { const i = +(d[1].match(/<c:idx val="(\d+)"/) || [0, 0])[1]; dpt[i] = col(d[1]); }
    const sp = (s.replace(/<c:dPt>[\s\S]*?<\/c:dPt>/g, "").match(/<c:spPr>([\s\S]*?)<\/c:spPr>/) || [])[1];
    return { name: unesc(((s.match(/<c:tx>[\s\S]*?<c:v>([^<]*)<\/c:v>/) || [])[1] || "")), color: col(sp), dpt, cats: vals(s, "cat"), vals: vals(s, "val").map(Number) };
  });
  if (!series.length) return "";
  const title = unesc((chartXml.match(/<c:title>[\s\S]*?<a:t>([^<]*)<\/a:t>/) || [])[1] || "");
  const legend = /<c:legend>/.test(chartXml);
  const explicitMax = +(chartXml.match(/<c:max val="([\d.]+)"/) || [0, 0])[1];
  const max = explicitMax || Math.max(...series.flatMap((s) => s.vals)) * 1.18;
  const pt = (n) => (n * DPI) / 72;
  let top = box.y + pt(6);
  if (title) { els.push(pathSvg(glyphRun(F.b, title, box.x + pt(4), top + pt(11), pt(11)).d, { hex: "18181B", alpha: 1 })); top += pt(18); }
  const bottom = box.y + box.h - (legend ? pt(16) : pt(4));
  const cats = series[0].cats, n = cats.length, k = series.length;
  const label = (t, x, y, size, color, right = false) => { const r = glyphRun(F.r, t, 0, null, size); els.push(pathSvg(glyphRun(F.r, t, right ? x - r.w : x, y, size).d, { hex: color, alpha: 1 })); };
  if (horizontal) {
    const labelW = Math.min(box.w * 0.34, Math.max(...cats.map((c) => glyphRun(F.r, c, 0, null, pt(8)).w)) + pt(8));
    const x0 = box.x + labelW + pt(4), plotW = box.w - labelW - pt(44);
    const rowH = (bottom - top) / n, barH = (rowH * 0.7) / k;
    cats.forEach((c, i) => {
      const yc = top + rowH * i + rowH / 2;
      label(c, x0 - pt(6), yc + pt(3), pt(8), "52525B", true);
      series.forEach((s, j) => {
        const v = s.vals[i] || 0, w = (v / max) * plotW, y = yc - (k * barH) / 2 + j * barH;
        els.push(`<rect x="${x0}" y="${y}" width="${Math.max(w, 0)}" height="${barH - 1}" fill="#${s.dpt[i] || s.color}"/>`);
        label(String(v).replace(".", ","), x0 + w + pt(4), y + barH / 2 + pt(3), pt(8), "18181B");
      });
    });
  } else {
    const x0 = box.x + pt(6), plotW = box.w - pt(12), base = bottom - pt(16), plotH = base - top - pt(12);
    const colW = plotW / n, barW = (colW * 0.65) / k;
    cats.forEach((c, i) => {
      const xc = x0 + colW * i + colW / 2;
      const r = glyphRun(F.r, c, 0, null, pt(8)); label(c, xc - r.w / 2, base + pt(11), pt(8), "52525B");
      series.forEach((s, j) => {
        const v = s.vals[i] || 0, h = (v / max) * plotH, x = xc - (k * barW) / 2 + j * barW;
        els.push(`<rect x="${x}" y="${base - h}" width="${barW - 2}" height="${h}" fill="#${s.dpt[i] || s.color}"/>`);
        const lr = glyphRun(F.r, String(v), 0, null, pt(8)); label(String(v), x + barW / 2 - lr.w / 2, base - h - pt(3), pt(8), "18181B");
      });
    });
    if (legend) { let lx = box.x + pt(6); for (const s of series) { els.push(`<rect x="${lx}" y="${box.y + box.h - pt(11)}" width="${pt(8)}" height="${pt(8)}" fill="#${s.color}"/>`); label(s.name, lx + pt(11), box.y + box.h - pt(4), pt(8), "52525B"); lx += pt(11) + glyphRun(F.r, s.name, 0, null, pt(8)).w + pt(14); } }
  }
  return els.join("");
}

const index = [];
for (let i = 0; i < slides.length; i++) {
  const sPath = slides[i], sRels = rels(sPath), s = xml(sPath);
  const lPath = Object.values(sRels).find((t) => t.includes("slideLayout")), lRels = rels(lPath), l = xml(lPath);
  const phMap = layoutPlaceholders(l);
  const parts = [`<rect width="${SW}" height="${SH}" fill="#ffffff"/>`, bgSvg(l, lRels), bgSvg(s, sRels), await renderPart(l, lRels, {}, true, `Folie ${i + 1} (Layout)`), await renderPart(s, sRels, phMap, false, `Folie ${i + 1}`)];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SW}" height="${SH}" viewBox="0 0 ${SW} ${SH}">${parts.join("")}</svg>`;
  const file = join(OUTDIR, `slide-${String(i + 1).padStart(2, "0")}.png`);
  await sharp(Buffer.from(svg)).png().toFile(file);
  index.push(file);
}
// Übersichtsbögen mit 6 Folien
for (let i = 0; i < index.length; i += 6) {
  const tiles = await Promise.all(index.slice(i, i + 6).map((f) => sharp(f).resize(640, 360).toBuffer()));
  await sharp({ create: { width: 1920 + 20, height: 720 + 10, channels: 3, background: "#cbd5e1" } })
    .composite(tiles.map((input, k) => ({ input, left: (k % 3) * 650, top: Math.floor(k / 3) * 370 })))
    .jpeg({ quality: 85 }).toFile(join(OUTDIR, `bogen-${i / 6 + 1}.jpg`));
}
writeFileSync(join(OUTDIR, "warnungen.txt"), warnings.join("\n"));
console.log(`${index.length} Folien gerendert nach ${OUTDIR}; ${warnings.length} Warnungen`);
for (const w of warnings) console.log("  " + w);
