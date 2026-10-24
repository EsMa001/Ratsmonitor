/* Auftakt vor dem ersten Kapitel ("auftakt": true in der Videodatei): echte, aktuelle Titel aus vielen Räten springen im Takt der Musik auf (84 Schläge je Minute, Sechzehntel),
   in der Mitte zählt die Zahl der Kommunen hoch, dann fliegt alles in eine Suchleiste zusammen; Schnitt auf die Startseite. Die Stimme spricht den ersten Satz der Einleitung.
   titles(BASE) holt die Titel aus der laufenden App (Suche als Gast, Sitzungen der letzten 30 Tage, je Kommune ein Titel, keine Parteinamen), html(spec, …) baut die Seite;
   folien.mjs ruft je Bild window.frame(Sekunde) auf. Titel werden nicht umformuliert, nur zu lange weggelassen. */
const TERMS = ["Wärmeplanung", "Spielplatz", "Radweg", "Bebauungsplan", "Feuerwehr", "Schwimmbad", "Kita", "Photovoltaik", "Glasfaser", "Grundschule", "Straßenbeleuchtung", "Friedhof", "Bürgerhaus", "Sportplatz", "Hochwasserschutz", "Windenergie", "Klimaschutz", "Parkplatz", "Dorfplatz", "Bauhof", "Jugendzentrum", "Hitzeschutz"];
const SKIP = /\b(AfD|SPD|CDU|CSU|FDP|Grünen?|Linke|BSW|Freie Wähler|Fraktion|Anfrage|Mitteilung|Antrag|hier:|TOP)\b|[A-ZÄÖÜ]{6,}/;
export const BEAT = 60 / 84, STEP = BEAT * 3 / 8;  /* punktierte Sechzehntel: ruhiger als Sechzehntel, noch im Takt */

export async function titles(BASE, n = 16) {
  const today = new Date(), from = new Date(today - 30 * 864e5), iso = (d) => d.toISOString().slice(0, 10);
  const out = [], seen = new Set();
  for (const t of TERMS) {
    const r = await fetch(`${BASE}/api/search?q=${encodeURIComponent(t)}&limit=10`).then((x) => (x.ok ? x.json() : { articles: [] })).catch(() => ({ articles: [] }));
    for (const a of (r.articles || []).filter((x) => x.date >= iso(from) && x.date <= iso(today) && x.title.length >= 18 && x.title.length <= 58 && !SKIP.test(x.title)).slice(0, 4)) {
      if (seen.has(a.gemeinde) || out.filter((x) => x.term === t).length >= 2) continue;
      seen.add(a.gemeinde); out.push({ term: t, t: a.title.trim(), g: (a.gremium || "").split(":").pop().trim(), o: a.gemeinde.replace(/^(Stadt|Gemeinde|Markt|Hansestadt) /, "") });
    }
    if (out.length >= n) break;
  }
  /* abwechselnd die Begriffe, damit nicht zwei Spielplätze nebeneinander aufspringen */
  const first = out.filter((x, i) => out.findIndex((y) => y.term === x.term) === i), rest = out.filter((x) => !first.includes(x));
  return [...first, ...rest].slice(0, n);
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
export function html(spec, { css, dark }) {
  /* 16 Plätze in 5 Reihen und 4 Spalten, die Mitte bleibt frei für den Zähler; leicht versetzt, damit es nicht wie eine Tabelle wirkt */
  const slots = [];
  for (let r = 0; r < 5; r++) for (let c = 0; c < 4; c++) if (!((r === 2 || r === 3) && (c === 1 || c === 2))) slots.push([22 + c * 312 + (r % 2 ? 26 : -6), 26 + r * 136 + (c % 2 ? 18 : 0)]);
  const order = [5, 10, 0, 15, 7, 2, 12, 9, 3, 14, 6, 1, 11, 4, 13, 8];
  const items = spec.items.slice(0, slots.length);
  const cards = items.map((it, i) => { const [x, y] = slots[order[i] % slots.length]; return `<div class=c data-i=${i} style="left:${x}px;top:${y}px"><b>${esc(it.t)}</b><span><i></i>${esc(it.g)} · ${esc(it.o)}</span></div>`; }).join("");
  return `<style>${css}
.c{position:absolute;width:286px;padding:14px 16px;border-radius:14px;background:${dark ? "#1e293b" : "#fff"};border:1px solid ${dark ? "#334155" : "#e2e8f0"};box-shadow:0 6px 22px rgba(15,23,42,${dark ? ".35" : ".08"});opacity:0;will-change:transform}
.c b{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-size:17px;font-weight:600;line-height:1.28;color:${dark ? "#f1f5f9" : "#0f172a"}}
.c span{display:flex;align-items:center;gap:7px;margin-top:8px;font-size:13px;color:${dark ? "#94a3b8" : "#64748b"};white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.c i{flex:none;width:7px;height:7px;border-radius:50%;background:#0d9488}
.z{position:absolute;left:0;right:0;top:262px;text-align:center}
.z .n{font-size:118px;font-weight:600;letter-spacing:-.03em;line-height:1;color:${dark ? "#2dd4bf" : "#0d9488"};font-variant-numeric:tabular-nums}
.z .l{margin-top:14px;font-size:26px;color:${dark ? "#cbd5e1" : "#334155"}}
.glow{position:absolute;left:340px;top:220px;width:600px;height:300px;border-radius:50%;background:radial-gradient(closest-side,${dark ? "rgba(19,26,42,.95)" : "rgba(255,255,255,.95)"},rgba(255,255,255,0))}
.p{position:absolute;border-radius:999px;background:${dark ? "#1e293b" : "#fff"};border:1px solid ${dark ? "#334155" : "#cbd5e1"};box-shadow:0 10px 40px rgba(13,148,136,.18);display:flex;align-items:center;padding:0 26px;overflow:hidden;opacity:0}
.p svg{flex:none}.p svg{margin-right:14px}.p em{font-style:normal;color:${dark ? "#64748b" : "#94a3b8"};white-space:nowrap}.p u{flex:none;width:2px;height:30px;background:#0d9488;text-decoration:none}</style>
<div class=glow id=g></div>${cards}
<div class=z id=z><div class=n id=n>0</div><div class=l>Kommunen. Jeden Tag neue Beratungen.</div></div>
<div class=p id=p><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0d9488" stroke-width="2.4" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg><u id=u></u><em id=e>Thema suchen</em></div>
<script>
const N=${Number(spec.count) || 0}, STEP=${STEP}, T0=${STEP * 2}, OUT=${spec.out}, D=${spec.dur};
const cs=[...document.querySelectorAll('.c')], ez=(x)=>1-Math.pow(1-Math.min(1,Math.max(0,x)),3), ei=(x)=>Math.pow(Math.min(1,Math.max(0,x)),2.2);
window.frame=(t)=>{
  cs.forEach((c,i)=>{ const a=T0+i*STEP, k=ez((t-a)/0.32), cx=640-(parseFloat(c.style.left)+143), cy=360-(parseFloat(c.style.top)+45);
    const o=ei((t-OUT-i*0.018)/0.55), drift=-(t-a)*6;
    c.style.opacity=String(Math.max(0,k*(1-o)));
    c.style.transform='translate('+(cx*o)+'px,'+(cy*o+(1-k)*18+drift*(1-o))+'px) scale('+((0.9+0.1*k)*(1-0.75*o))+')'; });
  const zn=ez((t-0.3)/3.6); document.getElementById('n').textContent=Math.round(N*zn).toLocaleString('de-DE');
  const zo=ez((t-0.15)/0.4)*(1-ei((t-OUT)/0.4)); document.getElementById('z').style.opacity=String(zo); document.getElementById('g').style.opacity=String(zo);
  /* Suchleiste erscheint in der Mitte und gleitet zum Schluss genau auf das Suchfeld der Startseite (16, 536, 460 × 48): nahtloser Schnitt */
  const pk=ez((t-OUT-0.35)/0.45), mv=ez((t-(D-0.55))/0.45), L=(a,b)=>a+(b-a)*mv, p=document.getElementById('p'), w=(140+500*pk);
  p.style.opacity=String(pk); p.style.width=L(w,460)+'px'; p.style.height=L(68,48)+'px'; p.style.left=L(640-w/2,16)+'px'; p.style.top=L(326,536)+'px'; p.style.paddingLeft=L(26,16)+'px';
  p.style.boxShadow='0 10px 40px rgba(13,148,136,'+(0.18*(1-mv))+')';
  const ic=p.querySelector('svg'); ic.style.width=L(26,0)+'px'; ic.style.marginRight=L(14,0)+'px'; ic.style.opacity=String(1-mv);
  const e=document.getElementById('e'); e.style.fontSize=L(24,16)+'px'; e.textContent=mv>0.5?'Thema suchen, z. B. Windkraft':'Thema suchen';
  document.getElementById('u').style.opacity=String(Math.floor(t/0.45)%2?0.15:1);
};
window.frame(0);
</script>`;
}

/* Zwischenfolie vor plenara.X ("folie": "x" am Kapitel): Wortmarke plenara.X, die Auswertungen springen als Kacheln im Takt auf, darüber der Zähler.
   Namen wie in der App (Seitentitel in pages/analytics/AnalyticsPages.tsx); bei neuen Auswertungen hier und im Satz in kapitel/x-einblicke/lang.txt nachziehen. */
export const X_NAMES = ["Themenatlas", "Projekte", "Trends", "Beschlusslage", "Vergleich", "Werte", "Gremien", "Themennetz", "Nachrichten", "Fraktionen", "Ausschreibungen"];
export function xhtml(spec, { css, dark }) {
  const chips = X_NAMES.map((n, i) => `<span class=k data-i=${i}>${esc(n)}</span>`).join("");
  return `<style>${css}
.w{position:absolute;left:0;right:0;top:150px;text-align:center;font-size:96px;font-weight:600;letter-spacing:-.03em;color:${dark ? "#f1f5f9" : "#0f172a"};opacity:0}.w b{color:${dark ? "#2dd4bf" : "#0d9488"}}
.n{position:absolute;left:0;right:0;top:278px;text-align:center;font-size:30px;color:${dark ? "#cbd5e1" : "#334155"};opacity:0}.n i{font-style:normal;font-weight:600;color:${dark ? "#2dd4bf" : "#0d9488"};font-variant-numeric:tabular-nums}
.g{position:absolute;left:140px;right:140px;top:370px;display:flex;flex-wrap:wrap;justify-content:center;gap:14px}
.k{padding:12px 22px;border-radius:999px;font-size:24px;background:${dark ? "#1e293b" : "#fff"};border:1px solid ${dark ? "#334155" : "#cbd5e1"};color:${dark ? "#e2e8f0" : "#0f172a"};box-shadow:0 6px 18px rgba(15,23,42,.07);opacity:0}
.k.on{background:#0d9488;border-color:#0d9488;color:#fff}</style>
<div class=w id=w>plenara<b>.X</b></div><div class=n id=n><i id=c>0</i> Auswertungen</div><div class=g>${chips}</div>
<script>
const STEP=${STEP}, D=${spec.dur}, ks=[...document.querySelectorAll('.k')], ez=(x)=>1-Math.pow(1-Math.min(1,Math.max(0,x)),3);
window.frame=(t)=>{
  const a=ez(t/0.5), out=ez((t-(D-0.35))/0.3); document.getElementById('w').style.opacity=String(a*(1-out)); document.getElementById('w').style.transform='scale('+(0.94+0.06*a)+')';
  document.getElementById('n').style.opacity=String(ez((t-0.3)/0.4)*(1-out));
  let shown=0; ks.forEach((k,i)=>{ const s=0.55+i*STEP*1.5, e=ez((t-s)/0.3); if(t>=s) shown=i+1; k.style.opacity=String(e*(1-out)); k.style.transform='translateY('+((1-e)*16)+'px) scale('+(0.9+0.1*e)+')';
    k.classList.toggle('on', t>=s && t<s+STEP*1.5); });
  document.getElementById('c').textContent=String(shown);
};
window.frame(0);
</script>`;
}
