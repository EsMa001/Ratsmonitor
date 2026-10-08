import type { TopicDetail } from "@/shared/types";
import { STATUS, formatDate } from "@/shared/types";
import { download, makeCsv, makeXlsx } from "./xlsx";

export interface ArticleExport {
  t: TopicDetail;
  place: string;
  /** Unterlagen ohne OParl-Rohdaten */
  docs: { title?: string; url: string }[];
  events: TopicDetail["events"];
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const slug = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "vorgang";

/** Tabelle: Eckdaten, dann Verlauf, dann Unterlagen (je Abschnitt eine Kopfzeile) */
function table({ t, place, docs, events }: ArticleExport): string[][] {
  const status = STATUS[t.status]?.label ?? "";
  const link = `${window.location.origin}/beschluss/${t.id}`;
  return [
    ["Feld", "Wert", "", ""],
    ["Titel", t.title, "", ""],
    ["Originaltitel", t.officialTitle, "", ""],
    ["Gebiet", place, "", ""],
    ["Gremium", t.committee || "", "", ""],
    ["Sitzung", formatDate(t.eventDate), "", ""],
    ["Vorlage", t.reference || "", "", ""],
    ["Stand", status, "", ""],
    ["Kurzfassung", t.shortSummary || "", "", ""],
    ["Link", link, "", ""],
    ["", "", "", ""],
    ["Verlauf: Datum", "Gremium", "Stand", "Link"],
    ...events.map((e) => [formatDate(e.date), e.committee || "", STATUS[e.status]?.label ?? "", e.url || ""]),
    ["", "", "", ""],
    ["Unterlage", "Link", "", ""],
    ...docs.map((d) => [d.title || "Dokument", d.url, "", ""]),
  ];
}

export function exportArticleTable(a: ArticleExport, format: "csv" | "xlsx") {
  const rows = table(a);
  download(format === "xlsx" ? makeXlsx(rows, "Vorgang") : makeCsv(rows), `${slug(a.t.title)}.${format}`);
}

/**
 * Drucken: druckfertige Seite mit Logo in neuem Fenster, der Druckdialog öffnet sich direkt.
 * Das Logo wird aus der Kopfzeile übernommen, damit immer die aktuelle Marke erscheint.
 */
export function printArticle({ t, place, docs, events }: ArticleExport) {
  const logo = document.querySelector("header .rm-logo")?.outerHTML ?? "";
  const status = STATUS[t.status]?.label ?? "";
  const link = `${window.location.origin}/beschluss/${t.id}`;
  const facts: [string, string][] = [["Gebiet", place], ["Gremium", t.committee || "–"], ["Sitzung", formatDate(t.eventDate)], ["Vorlage", t.reference || "–"], ["Stand", status], ["Quellenstand", formatDate(t.updatedAt)]];
  const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>${esc(t.title)}</title>
<style>
@page{size:A4;margin:18mm 16mm}
*{box-sizing:border-box}body{margin:0;font-family:'IBM Plex Sans',system-ui,sans-serif;color:#0f172a;font-size:11pt;line-height:1.5}
header{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #e2e8f0;padding-bottom:10px;margin-bottom:22px}
header .rm-logo{font-size:22px;display:flex;align-items:center;gap:6px;color:#0f172a}header .rm-logo svg{height:26px;width:auto}
header small{color:#64748b;font-size:9pt}
.meta{color:#64748b;font-size:10pt}.meta b{color:#0d9488;font-weight:400}
h1{font-size:18pt;line-height:1.2;margin:6px 0 8px;font-weight:600}
.lead{color:#64748b;font-size:11pt;margin:0 0 18px}
dl{display:grid;grid-template-columns:repeat(3,1fr);gap:8px 18px;border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;padding:12px 0;margin:0 0 20px}
dt{color:#64748b;font-size:8.5pt}dd{margin:0}
h2{font-size:12pt;margin:20px 0 8px;font-weight:600}
p{margin:0 0 8px}
ol{list-style:none;margin:0;padding:0;border-left:1px solid #e2e8f0}
ol li{position:relative;padding:0 0 10px 16px}ol li:before{content:"";position:absolute;left:-4px;top:6px;width:7px;height:7px;border-radius:50%;background:#cbd5e1}
ol li:last-child:before{background:#0d9488}
.d{color:#64748b;font-size:9.5pt}
ul{margin:0;padding:0;list-style:none}ul li{border-bottom:1px solid #e2e8f0;padding:6px 0}ul a{color:#0f172a;text-decoration:none}ul .u{display:block;color:#64748b;font-size:8.5pt;word-break:break-all}
footer{margin-top:26px;border-top:1px solid #e2e8f0;padding-top:8px;color:#64748b;font-size:8.5pt}
</style></head><body>
<header>${logo}<small>Stand ${new Date().toLocaleDateString("de-DE")}</small></header>
<div class="meta">${esc(place)} · ${esc(t.category || "")} · <b>${esc(status)}</b></div>
<h1>${esc(t.title)}</h1>
<p class="lead">${esc(t.shortSummary || "")}</p>
<dl>${facts.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>
${t.longSummary?.length ? `<h2>Worum es geht</h2>${t.longSummary.map((p) => `<p>${esc(p)}</p>`).join("")}` : ""}
${events.length ? `<h2>Verlauf</h2><ol>${events.map((e) => `<li><span class="d">${esc(formatDate(e.date))}</span> · <b>${esc(e.committee || "Gremium nicht dokumentiert")}</b> · ${esc(STATUS[e.status]?.label ?? "")}</li>`).join("")}</ol>` : ""}
${docs.length ? `<h2>Originalunterlagen</h2><ul>${docs.map((d) => `<li><a href="${esc(d.url)}">${esc(d.title || "Dokument")}</a><span class="u">${esc(d.url)}</span></li>`).join("")}</ul>` : ""}
<footer>Originaltitel: ${esc(t.officialTitle || "")}<br>Online: ${esc(link)}</footer>
<script>document.fonts.ready.then(()=>setTimeout(()=>print(),150))<\/script>
</body></html>`;
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.open();
  w.document.write(html);
  w.document.close();
  return true;
}

const b64 = (buf: ArrayBuffer) => {
  let bin = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};
const fetchB64 = async (url: string) => b64(await (await fetch(url)).arrayBuffer());

/** SVG als PNG rastern; der Ausschnitt wird um überstehende Teile erweitert (overflow: visible) */
async function svgPng(svg: SVGSVGElement): Promise<{ data: string; dx: number; dy: number; w: number; h: number } | null> {
  const rect = svg.getBoundingClientRect();
  const vb = svg.viewBox.baseVal;
  if (!vb || !vb.width) return null;
  const bb = svg.getBBox(), pad = 6;
  const x = Math.min(vb.x, bb.x - pad), y = Math.min(vb.y, bb.y - pad);
  const x2 = Math.max(vb.x + vb.width, bb.x + bb.width + pad), y2 = Math.max(vb.y + vb.height, bb.y + bb.height + pad);
  const ppu = rect.width / vb.width; // Pixel je SVG-Einheit
  const w = (x2 - x) * ppu, h = (y2 - y) * ppu, scale = 8;
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("viewBox", `${x} ${y} ${x2 - x} ${y2 - y}`);
  clone.setAttribute("width", String(w * scale));
  clone.setAttribute("height", String(h * scale));
  clone.removeAttribute("style");
  const img = new Image();
  img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(new XMLSerializer().serializeToString(clone));
  try {
    await img.decode();
    const c = document.createElement("canvas");
    c.width = Math.ceil(w * scale);
    c.height = Math.ceil(h * scale);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return { data: c.toDataURL("image/png"), dx: (x - vb.x) * ppu + rect.left, dy: (y - vb.y) * ppu + rect.top, w, h };
  } catch {
    return null;
  }
}

/**
 * Logo der Kopfzeile ins PDF zeichnen, aus seinen Teilen: Bildmarken als scharfe Bilder,
 * Schriftzug als echte Schrift (IBM Plex), farbige Quadrate als Flächen. Positionen und Farben
 * kommen aus dem Layout der Seite, damit das Logo exakt so aussieht wie in der Kopfzeile.
 * Gibt die Breite in mm zurück.
 */
async function drawLogo(pdf: import("jspdf").jsPDF, x0: number, y0: number, heightMm: number): Promise<number> {
  const src = document.querySelector("header .rm-logo");
  if (!src) return 0;
  /* Unsichtbare Kopie außerhalb des Bildschirms; der Schriftzug ist dort immer sichtbar (auch am Handy) */
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;left:-10000px;top:0;white-space:nowrap";
  const clone = src.cloneNode(true) as HTMLElement;
  clone.style.display = "inline-flex";
  host.appendChild(clone);
  document.body.appendChild(host);
  clone.querySelectorAll<HTMLElement>(".rm-logo__text").forEach((el) => (el.style.cssText += ";position:static;width:auto;height:auto;overflow:visible;clip:auto"));
  try {
    /* Grundlinie je Text: unsichtbare Marke direkt vor dem Text */
    const walker = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT);
    const texts: Text[] = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) if ((n as Text).data.trim()) texts.push(n as Text);
    const marks = texts.map((t) => {
      const m = document.createElement("span");
      m.style.cssText = "display:inline-block;width:0;height:0;vertical-align:baseline";
      t.parentNode!.insertBefore(m, t);
      return m;
    });
    const box = clone.getBoundingClientRect();
    const k = heightMm / box.height; // mm je Pixel
    let right = 0;
    for (const svg of clone.querySelectorAll("svg")) {
      const r = await svgPng(svg);
      if (!r) continue;
      pdf.addImage(r.data, "PNG", x0 + (r.dx - box.left) * k, y0 + (r.dy - box.top) * k, r.w * k, r.h * k);
      right = Math.max(right, (r.dx - box.left + r.w) * k);
    }
    texts.forEach((t, i) => {
      const cs = getComputedStyle(t.parentElement!);
      const range = document.createRange();
      range.selectNodeContents(t);
      const r = range.getBoundingClientRect();
      const base = marks[i].getBoundingClientRect().top;
      const [cr, cg, cb] = (cs.color.match(/\d+/g) ?? ["15", "23", "42"]).map(Number);
      pdf.setFont("Plex", Number(cs.fontWeight) >= 600 ? "bold" : "normal");
      pdf.setFontSize((parseFloat(cs.fontSize) * k) / 0.3528);
      pdf.setTextColor(cr, cg, cb);
      pdf.text(t.data, x0 + (r.left - box.left) * k, y0 + (base - box.top) * k, { baseline: "alphabetic" });
      right = Math.max(right, (r.right - box.left) * k);
    });
    /* Farbige Quadrate (z. B. der Punkt bei „plenara■“) */
    clone.querySelectorAll<HTMLElement>("span").forEach((el) => {
      const bg = getComputedStyle(el).backgroundColor;
      if (el.childNodes.length || !bg || bg === "rgba(0, 0, 0, 0)" || bg === "transparent") return;
      const r = el.getBoundingClientRect();
      const [cr, cg, cb] = (bg.match(/\d+/g) ?? []).map(Number);
      pdf.setFillColor(cr, cg, cb);
      pdf.rect(x0 + (r.left - box.left) * k, y0 + (r.top - box.top) * k, r.width * k, r.height * k, "F");
      right = Math.max(right, (r.right - box.left) * k);
    });
    return right;
  } finally {
    host.remove();
  }
}

type RGB = [number, number, number];
const INK: RGB = [15, 23, 42], GREY: RGB = [100, 116, 139], TEAL: RGB = [13, 148, 136], LINE: RGB = [226, 232, 240], DOT: RGB = [203, 213, 225];

/**
 * Echtes PDF (A4) im Aufbau der Detailseite: Kopf mit Logo, Titel und Kurzfassung,
 * links Inhalt, Verlauf und Originalunterlagen, rechts „Auf einen Blick“.
 * Satz: IBM Plex Sans eingebettet, Blocksatz im Fließtext, feste Zeilenabstände, Seitenzahlen.
 */
export async function exportArticlePdf({ t, place, docs, events }: ArticleExport) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const [reg, semi] = await Promise.all([fetchB64("/fonts/IBMPlexSans-Regular.ttf"), fetchB64("/fonts/IBMPlexSans-SemiBold.ttf")]);
  pdf.addFileToVFS("Plex-R.ttf", reg);
  pdf.addFont("Plex-R.ttf", "Plex", "normal");
  pdf.addFileToVFS("Plex-S.ttf", semi);
  pdf.addFont("Plex-S.ttf", "Plex", "bold");

  const PW = 210, PH = 297, ML = 20, MR = 20, TOP = 18, BOTTOM = PH - 20;
  const W = PW - ML - MR;
  const SIDE = 46, GAP = 9, MAIN = W - SIDE - GAP; // Hauptspalte und Seitenspalte wie auf der Website
  const pt = (n: number) => n * 0.3528; // Punkt in mm
  let y = TOP;

  const font = (size: number, bold = false, color: RGB = INK) => {
    pdf.setFont("Plex", bold ? "bold" : "normal");
    pdf.setFontSize(size);
    pdf.setTextColor(...color);
  };
  const newPage = () => {
    pdf.addPage();
    y = TOP + 6;
  };
  const room = (h: number) => {
    if (y + h > BOTTOM) newPage();
  };
  /* Absatz mit festem Zeilenabstand; justify = Blocksatz (letzte Zeile linksbündig) */
  const para = (text: string, size: number, opts: { x?: number; width?: number; bold?: boolean; color?: RGB; lead?: number; justify?: boolean } = {}) => {
    const { x = ML, width = MAIN, bold = false, color = INK, lead = 1.45, justify = false } = opts;
    font(size, bold, color);
    const lines = pdf.splitTextToSize(text, width) as string[];
    const lh = pt(size) * lead;
    lines.forEach((l, i) => {
      room(lh);
      const last = i === lines.length - 1;
      if (justify && !last && l.includes(" ")) pdf.text(l, x, y + pt(size) * 0.82, { align: "justify", maxWidth: width });
      else pdf.text(l, x, y + pt(size) * 0.82);
      y += lh;
    });
  };
  const rule = (x = ML, width = W) => {
    pdf.setDrawColor(...LINE);
    pdf.setLineWidth(0.25);
    pdf.line(x, y, x + width, y);
  };
  const heading = (s: string) => {
    room(16);
    y += 7;
    para(s, 12.5, { bold: true, lead: 1.2 });
    y += 2.5;
  };
  /* Dokument-Symbol wie auf der Website: Blatt mit Eselsohr und zwei Zeilen */
  const docIcon = (x: number, top: number) => {
    pdf.setDrawColor(...TEAL);
    pdf.setLineWidth(0.35);
    const w = 4.2, h = 5.4, f = 1.4;
    pdf.lines([[w - f, 0], [f, f], [0, h - f], [-w, 0], [0, -h]], x, top, [1, 1], "S", true);
    pdf.line(x + w - f, top, x + w - f, top + f);
    pdf.line(x + w - f, top + f, x + w, top + f);
    pdf.line(x + 1, top + 2.8, x + w - 1, top + 2.8);
    pdf.line(x + 1, top + 3.9, x + w - 1, top + 3.9);
  };

  /* Kopf: Logo links (aus Teilen gezeichnet), Datum rechts, feine Linie */
  await drawLogo(pdf, ML, y, 8.5);
  font(8, false, GREY);
  pdf.text(`Stand ${new Date().toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" })}`, PW - MR, y + 5, { align: "right" });
  y += 12;
  rule();
  y += 8;

  /* Ort · Thema · Stand, Titel, Kurzfassung */
  const status = STATUS[t.status]?.label ?? "";
  const meta = [place, t.category].filter(Boolean).join(" · ") + " · ";
  font(9, false, GREY);
  pdf.text(meta, ML, y + 3);
  font(9, false, TEAL);
  pdf.text(status, ML + pdf.getTextWidth(meta), y + 3);
  y += 7;
  para(t.title, 20, { bold: true, width: W, lead: 1.18 });
  y += 2.5;
  if (t.shortSummary) para(t.shortSummary, 11.5, { width: W * 0.88, color: GREY, lead: 1.45 });
  y += 6;
  rule();
  y += 8;

  /* Seitenspalte „Auf einen Blick“ (nur erste Seite), mit Linie links */
  const sideX = ML + MAIN + GAP;
  const sideTop = y;
  const facts: [string, string][] = [["Sitzung", formatDate(t.eventDate)], ["Gremium", t.committee || "Nicht dokumentiert"], ["Vorlage", t.reference || "Nicht dokumentiert"], ["Gebiet", place || "Unbekannt"], ["Stand", status], ["Quellenstand", formatDate(t.updatedAt)]];
  let sy = sideTop;
  font(12.5, true);
  pdf.text("Auf einen Blick", sideX + 4, sy + 4.2);
  sy += 10;
  for (const [k, v] of facts) {
    font(7.5, false, GREY);
    pdf.text(k, sideX + 4, sy + 2.6);
    sy += 4;
    font(9.5, false, INK);
    const lines = pdf.splitTextToSize(v, SIDE - 4) as string[];
    lines.forEach((l) => {
      pdf.text(l, sideX + 4, sy + 3.2);
      sy += pt(9.5) * 1.4;
    });
    sy += 2.5;
  }
  pdf.setDrawColor(...LINE);
  pdf.setLineWidth(0.25);
  pdf.line(sideX, sideTop, sideX, sy);

  /* Hauptspalte */
  y = sideTop;
  para(t.contentAnalysis?.status === "completed" ? "Inhaltszusammenfassung" : "Worum es geht", 12.5, { bold: true, lead: 1.2 });
  y += 2.5;
  for (const p of t.longSummary ?? []) {
    para(p, 10.5, { justify: true, lead: 1.5 });
    y += 2.2;
  }
  if (STATUS[t.status]?.description) {
    const top = y + 1;
    y += 1;
    para(STATUS[t.status].description, 9.5, { x: ML + 4, width: MAIN - 4, color: GREY, lead: 1.45 });
    pdf.setDrawColor(...TEAL);
    pdf.setLineWidth(0.6);
    pdf.line(ML + 0.3, top, ML + 0.3, y);
  }

  /* Verlauf: senkrechte Linie mit Punkten, jüngster Schritt in Petrol */
  if (events.length) {
    heading("Verlauf");
    events.forEach((e, i) => {
      const last = i === events.length - 1;
      room(11);
      const top = y;
      font(9, false, GREY);
      pdf.text(formatDate(e.date), ML + 6, y + 3.2);
      const dw = pdf.getTextWidth(formatDate(e.date)) + 2.5;
      font(9.5, true, INK);
      const com = e.committee || "Gremium nicht dokumentiert";
      const comLines = pdf.splitTextToSize(com, MAIN - 6 - dw) as string[];
      pdf.text(comLines[0], ML + 6 + dw, y + 3.2);
      y += 4.6;
      font(9, false, last ? TEAL : GREY);
      pdf.text(STATUS[e.status]?.label ?? "Stand offen", ML + 6, y + 3);
      y += 6;
      pdf.setFillColor(...(last ? TEAL : DOT));
      pdf.circle(ML + 1.6, top + 2.2, 1.15, "F");
      if (!last) {
        pdf.setDrawColor(...LINE);
        pdf.setLineWidth(0.3);
        pdf.line(ML + 1.6, top + 3.6, ML + 1.6, y + 1);
      }
    });
  }

  /* Originalunterlagen: Symbol, Titel als Link, Pfeil; Linien dazwischen */
  if (docs.length) {
    heading("Originalunterlagen");
    if (t.officialTitle) {
      para(`Originaltitel: ${t.officialTitle}`, 8.5, { color: GREY, lead: 1.4 });
      y += 2;
    }
    rule(ML, MAIN);
    for (const d of docs) {
      font(10, false, INK);
      /* Lange Titel umbrechen (höchstens drei Zeilen) statt abschneiden */
      const lines = (pdf.splitTextToSize(d.title || "Dokument", MAIN - 14) as string[]).slice(0, 3);
      const lh = pt(10) * 1.35;
      room(4 + lines.length * lh + 4);
      const top = y;
      docIcon(ML + 0.5, top + 2.2);
      font(10, false, INK);
      lines.forEach((l, i) => pdf.textWithLink(l, ML + 8, top + 5.8 + i * lh, { url: d.url }));
      font(10, false, TEAL);
      pdf.textWithLink("↗", ML + MAIN - 3, top + 5.8, { url: d.url });
      y = top + 4 + lines.length * lh + 4.3;
      rule(ML, MAIN);
    }
  }

  /* Fußzeile jeder Seite: Link zum Vorgang links, Seitenzahl rechts */
  const link = `${window.location.origin}/beschluss/${t.id}`;
  const n = pdf.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    pdf.setPage(i);
    pdf.setDrawColor(...LINE);
    pdf.setLineWidth(0.25);
    pdf.line(ML, PH - 14, PW - MR, PH - 14);
    font(7.5, false, GREY);
    pdf.textWithLink(link, ML, PH - 10, { url: link });
    pdf.text(`Seite ${i} von ${n}`, PW - MR, PH - 10, { align: "right" });
  }
  pdf.setProperties({ title: t.title, subject: [place, status].filter(Boolean).join(" · "), creator: document.title.split(" · ")[0] });
  pdf.save(`${slug(t.title)}.pdf`);
}
