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
