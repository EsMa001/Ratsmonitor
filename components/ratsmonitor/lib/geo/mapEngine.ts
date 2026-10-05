import type { Radius } from "../../types";
import { MAP_COLORS as C, colorForCoverage } from "../constants";
import type { BBox, GeoModel } from "./geoModel";

interface View {
  cx: number;
  cy: number;
  k: number; // Pixel je Dateneinheit (10 m)
}

export interface MapEngineCallbacks {
  /** Klick auf die Karte, "" = außerhalb einer Gemeinde */
  onSelect: (ags: string) => void;
  /** Gemeinde unter dem Mauszeiger (für den Tooltip), Bildschirmkoordinaten relativ zur Karte */
  onHover: (ags: string, x: number, y: number) => void;
  /** Nach jedem Neuzeichnen, z. B. um ein Popup neu zu positionieren */
  onViewChange: () => void;
  /** Gesperrte Karte wurde angetippt, gezoomt oder mit dem Mausrad bedient (Kartenmodus starten) */
  onUnlock?: () => void;
  /** Mausrad ohne Strg: Hinweis anzeigen */
  onWheelHint: () => void;
}

/**
 * Canvas-Karte aller Gemeinden: Choroplethen-Stufen, Umkreis, Auswahl und Hover.
 * Zwei Canvas-Ebenen (Basis und Overlay), beim Verschieben und Zoomen wird ein Schnappschuss
 * skaliert und nach 180 ms Ruhe vollständig neu gezeichnet.
 */
export type MapStyle = "flaechen" | "heat" | "blasen";

export class MapEngine {
  private geo: GeoModel;
  private cb: MapEngineCallbacks;
  private stage: HTMLElement | null = null;
  private base: HTMLCanvasElement | null = null;
  private over: HTMLCanvasElement | null = null;
  private bctx: CanvasRenderingContext2D | null = null;
  private octx: CanvasRenderingContext2D | null = null;
  private W = 0;
  private H = 0;
  private dpr = 1;
  private view: View | null = null;
  private drawnView: View | null = null;
  private snap: HTMLCanvasElement | null = null;
  private snapView: View | null = null;
  private anim = 0;
  private settleTimer = 0;
  private fastQueued = false;
  private drawQueued = false;
  private overQueued = false;
  private counts: Record<string, number> = {};
  private countsKey = "";
  private level: "city" | "district" = "city";
  private coverage: string[] = [];
  private area = "";
  private radius: Radius | null = null;
  private hoverAgs = "";
  private extHover = "";
  private cleanup: (() => void) | null = null;
  /** Kartenmodus: Mausrad zoomt ohne vorherigen Klick */
  private freeWheel = false;
  /** Trefferzahl je Gemeinde als Abzeichen unter dem Namen (nur im Kartenmodus) */
  private badges: Record<string, number> | null = null;
  /** Darstellung im Kartenmodus: Flächen einfärben, Heatmap oder Blasen je Gemeinde */
  private style: MapStyle = "flaechen";
  private heatCanvas: HTMLCanvasElement | null = null;

  setStyle(v: MapStyle) {
    if (v === this.style) return;
    this.style = v;
    this.requestDraw();
  }

  /** Gesperrt (normaler Modus): kein Verschieben, kein Hover; Tippen, Zwei-Finger-Zoom oder Mausrad entsperren */
  private locked = false;

  setLocked(v: boolean) {
    this.locked = v;
  }

  private unlock() {
    if (!this.locked) return;
    this.locked = false;
    this.cb.onUnlock?.();
  }

  constructor(geo: GeoModel, cb: MapEngineCallbacks) {
    this.geo = geo;
    this.cb = cb;
  }

  setCallbacks(cb: MapEngineCallbacks) {
    this.cb = cb;
  }

  /* ---------- Einbinden in das DOM ---------- */
  attach(stage: HTMLElement, base: HTMLCanvasElement, over: HTMLCanvasElement): () => void {
    this.stage = stage;
    this.base = base;
    this.over = over;
    this.bctx = base.getContext("2d");
    this.octx = over.getContext("2d");
    const ro = new ResizeObserver(() => this.resize());
    ro.observe(stage);
    const unbind = this.bindEvents(over);
    this.resize();
    this.cleanup = () => {
      ro.disconnect();
      unbind();
      cancelAnimationFrame(this.anim);
      clearTimeout(this.settleTimer);
    };
    return () => {
      this.cleanup?.();
      this.cleanup = null;
      this.stage = this.base = this.over = null;
      this.bctx = this.octx = null;
    };
  }

  private resize() {
    if (!this.stage || !this.base || !this.over) return;
    const r = this.stage.getBoundingClientRect();
    const nW = Math.round(r.width);
    const nH = Math.round(r.height);
    if (!nW || !nH) return; // ausgeblendet: Ansicht behalten
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    for (const c of [this.base, this.over]) {
      c.width = Math.round(nW * this.dpr);
      c.height = Math.round(nH * this.dpr);
    }
    const first = !this.view;
    this.W = nW;
    this.H = nH;
    this.view = first ? this.germanyView() : { ...this.view!, k: this.clampK(this.view!.k) };
    this.snapView = null;
    this.drawAll();
  }

  /* ---------- Zustand von außen ---------- */
  update(counts: Record<string, number>, area: string, radius: Radius | null, coverage:string[]=[], level:"city"|"district"="city") {
    this.level=level; this.coverage=coverage;
    this.geo.coveredGem.splice(0,this.geo.coveredGem.length,...coverage.map(a=>this.geo.gem.idx.get(a)).filter((i):i is number=>i!==undefined));
    const key = JSON.stringify([counts,coverage,level]);
    const changed = key !== this.countsKey;
    this.counts = counts;
    this.countsKey = key;
    this.area = area;
    this.radius = radius;
    if (changed) this.requestDraw();
    else this.requestOver();
  }

  /** Kartenmodus an/aus: freies Zoomen mit dem Mausrad und Trefferzahlen unter den Gemeindenamen */
  setExplore(on: boolean, badges: Record<string, number> | null) {
    const key = JSON.stringify(badges);
    const changed = on !== this.freeWheel || key !== JSON.stringify(this.badges);
    this.freeWheel = on;
    this.badges = on ? badges : null;
    if (changed) this.requestDraw();
  }

  setExternalHover(ags: string) {
    this.extHover = ags;
    this.requestOver();
  }

  /** Bildschirmposition des Beschriftungspunkts eines Gebiets */
  project(ags: string): { x: number; y: number; w: number; h: number } | null {
    const c = this.geo.center(ags);
    if (!c || !this.view) return null;
    const [x, y] = this.toScreen(c.x, c.y);
    return { x, y, w: this.W, h: this.H };
  }

  zoomBy(f: number) {
    if (!this.view) return;
    this.flyTo({ ...this.view, k: this.clampK(this.view.k * f) }, 250);
  }

  /** Fließend auf ein Gebiet zoomen, "" = ganz Deutschland */
  focusArea(ags: string) {
    if (!this.view) return;
    if (!ags) {
      this.flyTo(this.germanyView(), 700);
      return;
    }
    const b = this.geo.bbox(ags);
    if (!b) return;
    const mx = (b[2] - b[0]) * 0.06 + 200;
    const my = (b[3] - b[1]) * 0.06 + 200;
    this.flyTo(this.fitView([b[0] - mx, b[1] - my, b[2] + mx, b[3] + my], 40), 700);
  }

  /** Fließend auf mehrere Gebiete zoomen (z. B. alle Treffer); ohne Gebiete ganz Deutschland */
  focusMany(list: string[]) {
    if (!this.view) return;
    let bb: BBox | null = null;
    for (const ags of list) {
      const b = this.geo.bbox(ags);
      if (b) bb = bb ? [Math.min(bb[0], b[0]), Math.min(bb[1], b[1]), Math.max(bb[2], b[2]), Math.max(bb[3], b[3])] : [b[0], b[1], b[2], b[3]];
    }
    if (!bb) return this.focusArea("");
    const mx = (bb[2] - bb[0]) * 0.06 + 200;
    const my = (bb[3] - bb[1]) * 0.06 + 200;
    this.flyTo(this.fitView([bb[0] - mx, bb[1] - my, bb[2] + mx, bb[3] + my], 40), 700);
  }

  fitCircle(r: Radius, onlyIfNeeded = false) {
    if (!this.view) return;
    const R = Math.max(r.km * 100, 1500);
    const bb: BBox = [r.x - R, r.y - R, r.x + R, r.y + R];
    if (onlyIfNeeded) {
      const p0 = this.toScreen(bb[0], bb[3]);
      const p1 = this.toScreen(bb[2], bb[1]);
      if (p0[0] >= 0 && p0[1] >= 50 && p1[0] <= this.W && p1[1] <= this.H - 60) return;
    }
    this.flyTo(this.fitView(bb, 40));
  }

  /* ---------- Ansicht ---------- */
  private clampK(k: number) {
    /* Höchstens so weit herauszoomen, dass Deutschland vollständig sichtbar ist */
    const bb = this.geo.germany.bb;
    const kmin = 0.92 * Math.min((this.W - 32) / Math.max(bb[2] - bb[0], 1), (this.H - 32) / Math.max(bb[3] - bb[1], 1));
    return Math.max(kmin, Math.min(0.6, k));
  }

  /** Deutschland passt gerade noch vollständig hinein (kleiner Rand, mittig) */
  private germanyView(): View {
    const bb = this.geo.germany.bb;
    const k = Math.min((this.W - 16) / Math.max(bb[2] - bb[0], 1), (this.H - 16) / Math.max(bb[3] - bb[1], 1));
    return { cx: (bb[0] + bb[2]) / 2, cy: (bb[1] + bb[3]) / 2, k };
  }

  private fitView(bb: BBox, pad?: number): View {
    const small = this.W < 640;
    const pt = small ? 64 : 24;
    const pb = small ? 64 : 72;
    const ps = pad ?? (small ? 16 : 28);
    const w = Math.max(bb[2] - bb[0], 1);
    const h = Math.max(bb[3] - bb[1], 1);
    const k = this.clampK(Math.min((this.W - 2 * ps) / w, (this.H - pt - pb) / h));
    return { cx: (bb[0] + bb[2]) / 2, cy: (bb[1] + bb[3]) / 2 + (pt - pb) / 2 / k, k };
  }

  private toData(sx: number, sy: number): [number, number] {
    const v = this.view!;
    return [(sx - this.W / 2) / v.k + v.cx, v.cy - (sy - this.H / 2) / v.k];
  }

  private toScreen(x: number, y: number): [number, number] {
    const v = this.view!;
    return [(x - v.cx) * v.k + this.W / 2, (v.cy - y) * v.k + this.H / 2];
  }

  private applyT(ctx: CanvasRenderingContext2D) {
    const v = this.view!;
    const k = v.k * this.dpr;
    ctx.setTransform(k, 0, 0, -k, (this.W / 2 - v.cx * v.k) * this.dpr, (this.H / 2 + v.cy * v.k) * this.dpr);
  }

  private inView(b: BBox) {
    const [x0, y1] = this.toData(0, 0);
    const [x1, y0] = this.toData(this.W, this.H);
    return !(b[2] < x0 || b[0] > x1 || b[3] < y0 || b[1] > y1);
  }

  private flyTo(target: View, dur = 450) {
    cancelAnimationFrame(this.anim);
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!this.view || reduce || dur === 0 || !this.W) {
      this.view = target;
      this.settle();
      return;
    }
    const s = { ...this.view };
    const t0 = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / dur);
      const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      this.view = { cx: s.cx + (target.cx - s.cx) * e, cy: s.cy + (target.cy - s.cy) * e, k: s.k * Math.pow(target.k / s.k, e) };
      if (t < 1) {
        this.interact(true);
        this.anim = requestAnimationFrame(step);
      } else this.settle();
    };
    this.anim = requestAnimationFrame(step);
  }

  /** Zoomen um einen Bildschirmpunkt (auch von außen: Zwei-Finger-Geste, die den Kartenmodus startet) */
  zoomAt(sx: number, sy: number, f: number) {
    const [x, y] = this.toData(sx, sy);
    const k = this.clampK(this.view!.k * f);
    this.view = { k, cx: x - (sx - this.W / 2) / k, cy: y + (sy - this.H / 2) / k };
    this.interact();
  }

  /* ---------- Zeichnen ---------- */
  private interact(now = false) {
    if (!this.snapView && this.drawnView && this.base) {
      if (!this.snap) this.snap = document.createElement("canvas");
      this.snap.width = this.base.width;
      this.snap.height = this.base.height;
      this.snap.getContext("2d")!.drawImage(this.base, 0, 0);
      this.snapView = { ...this.drawnView };
    }
    if (now) this.drawFast();
    else if (!this.fastQueued) {
      this.fastQueued = true;
      requestAnimationFrame(() => {
        this.fastQueued = false;
        this.drawFast();
      });
    }
    clearTimeout(this.settleTimer);
    this.settleTimer = window.setTimeout(() => this.settle(), 180);
  }

  private drawFast() {
    if (!this.snapView || !this.snap || !this.bctx || !this.base || !this.view) {
      this.drawAll();
      return;
    }
    const v = this.view;
    const sv = this.snapView;
    const s = v.k / sv.k;
    const tx = this.W / 2 - (this.W / 2) * s + (sv.cx - v.cx) * v.k;
    const ty = this.H / 2 - (this.H / 2) * s + (v.cy - sv.cy) * v.k;
    const ctx = this.bctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = C.ground;
    ctx.fillRect(0, 0, this.base.width, this.base.height);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.snap, tx * this.dpr, ty * this.dpr, this.snap.width * s, this.snap.height * s);
    this.drawOver();
  }

  private settle() {
    clearTimeout(this.settleTimer);
    this.snapView = null;
    this.drawAll();
  }

  private drawAll() {
    if (!this.W || !this.bctx || !this.octx || !this.view) return;
    if (this.snapView) {
      this.drawFast();
      return;
    }
    this.drawBase();
    this.drawOver();
  }

  private requestDraw() {
    if (this.drawQueued) return;
    this.drawQueued = true;
    requestAnimationFrame(() => {
      this.drawQueued = false;
      this.drawAll();
    });
  }

  private requestOver() {
    if (this.overQueued) return;
    this.overQueued = true;
    requestAnimationFrame(() => {
      this.overQueued = false;
      if (this.W && this.octx && this.view) this.drawOver();
    });
  }

  private drawBase() {
    const ctx = this.bctx!;
    const G = this.geo;
    const k = this.view!.k;
    const pxkm = k * 100;
    const px = (v: number) => v / k;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = C.ground;
    ctx.fillRect(0, 0, this.base!.width, this.base!.height);
    this.applyT(ctx);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.fillStyle = C.neighbour;
    ctx.fill(G.neighbours, "evenodd");
    ctx.strokeStyle = "#f1f3f5";
    ctx.lineWidth = px(1);
    ctx.stroke(G.neighbours);
    const fp = G.germany.path;
    /* Gebiete ohne Treffer in der Farbe der Landmasse außerhalb Deutschlands */
    ctx.fillStyle = C.neighbour;
    ctx.fill(fp);
    const L = this.level === "district" ? G.krs : G.gem;
    const points = this.badges && this.style !== "flaechen";
    if (this.filled()) for (const ags of this.coverage) {
      const i=L.idx.get(ags);if(i===undefined||!this.counts[L.ags[i]])continue;
      ctx.fillStyle = colorForCoverage(this.counts[L.ags[i]] || 0);
      ctx.fill(L.path[i]);
    }
    /* Alle Grenzen weiß: Gemeinden fein, Kreise mittel, Länder am kräftigsten */
    ctx.save();
    ctx.clip(fp);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = px(Math.max(0.35, Math.min(1.1, 0.25 + pxkm * 0.18)));
    ctx.stroke(G.mesh[0]);
    ctx.lineWidth = px(pxkm < 1.2 ? 0.9 : Math.min(2, 1.1 + pxkm * 0.08));
    ctx.stroke(G.mesh[1]);
    ctx.lineWidth = px(Math.min(3, 1.6 + pxkm * 0.12));
    ctx.stroke(G.mesh[2]);
    ctx.restore();
    ctx.strokeStyle = C.national;
    ctx.lineWidth = px(1.1);
    ctx.stroke(G.mesh[3]);
    if (points && this.style === "heat") this.drawHeat(ctx);
    this.drawLabels(ctx);
    /* Blasen über den Ortsnamen, damit die Zahlen lesbar bleiben */
    if (points && this.style === "blasen") this.drawBubbles(ctx);
    this.drawSums(ctx);
    this.drawnView = { ...this.view! };
  }

  /** Abzeichen wie in der Kopfzeile: Petrol-Pille mit weißer Zahl und weißem Rand */
  private pill(ctx: CanvasRenderingContext2D, n: number, x: number, y: number, fam: string) {
    const t = n > 9999 ? Math.round(n / 1000) + "k" : n.toLocaleString("de-DE");
    ctx.font = "600 12px " + fam;
    /* Immer ein Kreis, der mit der Zahl mitwächst */
    const bw = Math.max(20, ctx.measureText(t).width + 8);
    ctx.beginPath();
    ctx.arc(x, y, bw / 2, 0, Math.PI * 2);
    ctx.fillStyle = "#0d9488";
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.fillText(t, x, y + 0.5);
    return bw;
  }

  /** Flächen eingefärbt: in „Flächen“ immer, bei Blasen ab Gemeindeebene (dann steht jede Blase für genau eine Gemeinde) */
  private filled() {
    if (!this.badges || this.style === "flaechen") return true;
    return this.style === "blasen" && this.view!.k * 100 >= 3.2;
  }

  /** Bildschirmpunkte der Gemeinden mit Treffern (für Heatmap und Blasen) */
  private hitPoints() {
    const out: { ags: string; x: number; y: number; n: number }[] = [];
    for (const [ags, n] of Object.entries(this.badges ?? {})) {
      const c = n ? this.geo.center(ags) : null;
      if (c) {
        const [x, y] = this.toScreen(c.x, c.y);
        out.push({ ags, x, y, n });
      }
    }
    return out;
  }

  /** Heatmap: weiche Flecken je Gemeinde aufsummiert, dann eingefärbt (Petrol → Gelb → Rot) */
  private drawHeat(ctx: CanvasRenderingContext2D) {
    const pts = this.hitPoints();
    if (!pts.length) return;
    const max = Math.max(...pts.map((p) => p.n));
    const w = this.base!.width, h = this.base!.height, d = this.dpr;
    const off = (this.heatCanvas ??= document.createElement("canvas"));
    if (off.width !== w || off.height !== h) {
      off.width = w;
      off.height = h;
    }
    const o = off.getContext("2d", { willReadFrequently: true })!;
    o.setTransform(1, 0, 0, 1, 0, 0);
    o.clearRect(0, 0, w, h);
    /* Nah herangezoomt bleibt die Wärme innerhalb der Gemeindegrenze und füllt sie aus */
    const inside = this.view!.k * 100 >= 14;
    const G = this.geo.gem;
    for (const p of pts) {
      const i = inside ? G.idx.get(p.ags) : undefined;
      const b = i !== undefined ? G.bb[i] : null;
      /* Fleck so groß wie die Gemeinde (große Gemeinden größere Flecken), mindestens 16 px */
      const gi = G.idx.get(p.ags), gb = gi !== undefined ? G.bb[gi] : null;
      const size = gb ? Math.max(gb[2] - gb[0], gb[3] - gb[1]) * this.view!.k : 0;
      const r = (b ? Math.max(12, size / 1.4) : Math.max(16, Math.min(160, size * 0.9))) * d;
      const g = o.createRadialGradient(p.x * d, p.y * d, 0, p.x * d, p.y * d, r);
      /* Einzelner Fleck höchstens Orange; Rot entsteht erst, wo sich viele Treffer überlagern */
      const a = 0.15 + 0.55 * Math.sqrt(p.n / max);
      g.addColorStop(0, `rgba(0,0,0,${a})`);
      g.addColorStop(1, `rgba(0,0,0,${b ? a * 0.15 : 0})`);
      o.save();
      if (b) {
        this.applyT(o);
        o.clip(G.path[i!]);
        o.setTransform(1, 0, 0, 1, 0, 0);
      }
      o.fillStyle = g;
      o.fillRect(p.x * d - r, p.y * d - r, 2 * r, 2 * r);
      o.restore();
    }
    const img = o.getImageData(0, 0, w, h), px = img.data;
    const ramp = [[13, 148, 136], [250, 204, 21], [234, 88, 12], [220, 38, 38]];
    for (let i = 3; i < px.length; i += 4) {
      const v = px[i] / 255;
      if (!v) continue;
      const t = Math.min(0.999, v) * (ramp.length - 1), j = Math.floor(t), f = t - j;
      px[i - 3] = ramp[j][0] + (ramp[j + 1][0] - ramp[j][0]) * f;
      px[i - 2] = ramp[j][1] + (ramp[j + 1][1] - ramp[j][1]) * f;
      px[i - 1] = ramp[j][2] + (ramp[j + 1][2] - ramp[j][2]) * f;
      /* Ränder laufen weich aus (keine harten Scheiben), Kern bleibt leicht durchscheinend */
      px[i] = Math.min(215, Math.pow(v, 0.7) * 300);
    }
    o.putImageData(img, 0, 0);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(off, 0, 0);
    ctx.restore();
  }

  /** Treffer je Land, Kreis oder Gemeinde – je nach Zoomstufe zusammengefasst, mit Bildschirmposition */
  private aggregated() {
    const pxkm = this.view!.k * 100;
    const len = pxkm < 1.2 ? 2 : pxkm < 3.2 ? 5 : 8;
    const sums: Record<string, number> = {};
    for (const [ags, n] of Object.entries(this.badges ?? {})) if (n) sums[ags.slice(0, len)] = (sums[ags.slice(0, len)] || 0) + n;
    const out: { ags: string; n: number; x: number; y: number }[] = [];
    for (const [ags, n] of Object.entries(sums)) {
      const b = this.geo.bbox(ags);
      const c = this.geo.center(ags) ?? (b ? { x: (b[0] + b[2]) / 2, y: (b[1] + b[3]) / 2 } : null);
      if (!c) continue;
      const [x, y] = this.toScreen(c.x, c.y);
      out.push({ ags, n, x, y });
    }
    return out.sort((a, b) => b.n - a.n);
  }

  /** Blasen: Kreis je Gebiet (zusammengefasst wie die Zahlen), Fläche proportional zur Trefferzahl, Zahl in der Blase */
  private drawBubbles(ctx: CanvasRenderingContext2D) {
    const pts = this.aggregated();
    if (!pts.length) return;
    const max = pts[0].n;
    const fam = getComputedStyle(document.body).fontFamily;
    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "600 12px " + fam;
    /* Kleine zuletzt, damit sie auf großen Blasen sichtbar bleiben */
    for (const p of pts) {
      const t = p.n > 9999 ? Math.round(p.n / 1000) + "k" : p.n.toLocaleString("de-DE");
      /* Größte Blase wächst mit der Trefferzahl (bei wenigen Treffern klein), höchstens 40 px Radius */
      const r = Math.max(ctx.measureText(t).width / 2 + 6, Math.min(40, 10 + 3 * Math.sqrt(max)) * Math.sqrt(p.n / max));
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(13,148,136,0.78)";
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.fillText(t, p.x, p.y + 0.5);
    }
    ctx.restore();
  }

  /** Weit herausgezoomt: Trefferzahlen je Land bzw. Kreis zusammengefasst (Gemeinden haben ihre Zahl am Namen) */
  private drawSums(ctx: CanvasRenderingContext2D) {
    if (!this.badges || this.style === "blasen") return;
    const pxkm = this.view!.k * 100;
    if (pxkm >= 3.2) return;
    const len = pxkm < 1.2 ? 2 : 5;
    const sums: Record<string, number> = {};
    for (const [ags, n] of Object.entries(this.badges)) if (n) sums[ags.slice(0, len)] = (sums[ags.slice(0, len)] || 0) + n;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const fam = getComputedStyle(document.body).fontFamily;
    const placed: number[][] = [];
    /* Größte zuerst, damit sie bei Überlappung sichtbar bleiben */
    for (const [ags, n] of Object.entries(sums).sort((a, b) => b[1] - a[1])) {
      const b = this.geo.bbox(ags);
      const c = this.geo.center(ags) ?? (b ? { x: (b[0] + b[2]) / 2, y: (b[1] + b[3]) / 2 } : null);
      if (!c) continue;
      const [x, y] = this.toScreen(c.x, c.y);
      if (x < 0 || y < 0 || x > this.W || y > this.H) continue;
      const r = [x - 20, y - 20, x + 20, y + 20];
      if (placed.some((q) => !(r[2] < q[0] || r[0] > q[2] || r[3] < q[1] || r[1] > q[3]))) continue;
      placed.push(r);
      this.pill(ctx, n, x, y, fam);
    }
  }

  private drawLabels(ctx: CanvasRenderingContext2D) {
    const G = this.geo;
    const L = G.gem;
    const pxkm = this.view!.k * 100;
    if (pxkm < 3.2 || !L.lp) return;
    const showAll = pxkm >= 7;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    const cov = G.coveredGem;
    const covSet = new Set(cov);
    const cand = cov.slice();
    const placed: number[][] = [];
    const fam = getComputedStyle(document.body).fontFamily;
    if (showAll) for (let i = 0; i < L.n; i++) if (!covSet.has(i) && this.inView(L.bb[i])) cand.push(i);
    for (const i of cand) {
      const b = L.bb[i];
      if (!this.inView(b)) continue;
      const [sx, sy0] = this.toScreen(L.lp[2 * i], L.lp[2 * i + 1]);
      /* Blasen: Name über der Blase statt darunter versteckt */
      const sy = this.style === "blasen" && this.badges?.[L.ags[i]] ? sy0 - 24 : sy0;
      const strong = covSet.has(i);
      const label = L.name[i];
      /* Treffergebiete: weiße Schrift, wenn sie in die Fläche passt */
      ctx.font = "500 12px " + fam;
      const hit = this.filled() && this.style !== "blasen" && (this.counts[L.ags[i]] || 0) > 0 && (b[2] - b[0]) * this.view!.k > ctx.measureText(label).width * 1.2;
      const tw = ctx.measureText(label).width;
      if (!strong && (b[2] - b[0]) * this.view!.k < tw * 0.9) continue;
      const n = this.style === "blasen" ? 0 : this.badges?.[L.ags[i]] || 0;
      const r = [sx - tw / 2 - 3, sy - 8, sx + tw / 2 + 3, sy + (n ? 30 : 8)];
      if (placed.some((q) => !(r[2] < q[0] || r[0] > q[2] || r[3] < q[1] || r[1] > q[3]))) continue;
      placed.push(r);
      ctx.fillStyle = hit ? "#ffffff" : "#475569";
      ctx.fillText(label, sx, sy);
      if (n) this.pill(ctx, n, sx, sy + 19, fam);
    }
  }

  private drawOver() {
    const ctx = this.octx!;
    const over = this.over!;
    const G = this.geo;
    const k = this.view!.k;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, over.width, over.height);
    this.applyT(ctx);
    ctx.lineJoin = "round";
    if (this.radius) {
      const r = this.radius;
      const dist = G.distances(r.x, r.y);
      const R = r.km * 100;
      const L = G.gem;
      const inc: number[] = [];
      const exc: number[] = [];
      for (let i = 0; i < L.n; i++) {
        if (!this.inView(L.bb[i])) continue;
        (dist.gem[i] <= R ? inc : exc).push(i);
      }
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = C.dim;
      ctx.fillRect(0, 0, over.width, over.height);
      ctx.restore();
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "#000";
      if (exc.length < inc.length) {
        ctx.fill(G.germany.path);
        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = C.dim;
        for (const i of exc) ctx.fill(L.path[i]);
      } else {
        for (const i of inc) ctx.fill(L.path[i]);
      }
      ctx.globalCompositeOperation = "source-over";
      ctx.beginPath();
      ctx.arc(r.x, r.y, Math.max(R, 0.01), 0, Math.PI * 2);
      ctx.fillStyle = C.ringFill;
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,.9)";
      ctx.lineWidth = 4.5 / k;
      ctx.stroke();
      ctx.strokeStyle = C.ring;
      ctx.lineWidth = 2.5 / k;
      ctx.setLineDash([8 / k, 5 / k]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(r.x, r.y, 5 / k, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.strokeStyle = C.ringDot;
      ctx.lineWidth = 2.5 / k;
      ctx.stroke();
    }
    const hv = this.hoverAgs || this.extHover;
    if (hv && hv !== this.area) {
      const L = G.layerOf(hv);
      const i = L?.idx.get(hv);
      if (L && i != null) {
        ctx.fillStyle = C.hoverFill;
        ctx.fill(L.path[i]);
        ctx.strokeStyle = C.hover;
        ctx.lineWidth = 1.8 / k;
        ctx.stroke(L.path[i]);
      }
    }
    /* Ausgewähltes Gebiet ohne Umrandung: die Färbung genügt */
    this.cb.onViewChange();
  }

  /* ---------- Eingaben ---------- */
  private bindEvents(el: HTMLCanvasElement): () => void {
    const pointers = new Map<number, [number, number]>();
    let drag: { x: number; y: number; cx: number; cy: number; moved: boolean } | null = null;
    let pinch: { d: number; k: number } | null = null;
    let hoverRaf = 0;
    const rel = (e: PointerEvent | WheelEvent | MouseEvent): [number, number] => {
      const r = el.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    };
    const setHover = (h: string, x: number, y: number) => {
      if (this.badges && !this.badges[h]) h = "";
      if (this.stage && !drag?.moved) this.stage.style.cursor = h ? "pointer" : "";
      if (h !== this.hoverAgs) {
        this.hoverAgs = h;
        this.drawOver();
      }
      this.cb.onHover(h, x, y);
    };
    const down = (e: PointerEvent) => {
      if (!this.view) return;
      el.setPointerCapture(e.pointerId);
      const p = rel(e);
      pointers.set(e.pointerId, p);
      if (pointers.size === 1) drag = { x: p[0], y: p[1], cx: this.view.cx, cy: this.view.cy, moved: false };
      else if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), k: this.view.k };
        drag = null;
        /* Zwei-Finger-Zoom auf der gesperrten Karte: Kartenmodus starten, die Geste zoomt direkt weiter */
        this.unlock();
      }
    };
    const move = (e: PointerEvent) => {
      if (!this.view) return;
      const p = rel(e);
      if (pointers.has(e.pointerId)) pointers.set(e.pointerId, p);
      if (pinch && pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        this.zoomAt((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (pinch.k * d) / pinch.d / this.view.k);
        return;
      }
      if (drag && pointers.size === 1) {
        const dx = p[0] - drag.x;
        const dy = p[1] - drag.y;
        if (this.locked) {
          if (Math.hypot(dx, dy) > 4) drag.moved = true;
          return;
        }
        if (!drag.moved && Math.hypot(dx, dy) > 4) {
          drag.moved = true;
          if (this.stage) this.stage.style.cursor = "grabbing";
          this.cb.onHover("", 0, 0);
          cancelAnimationFrame(this.anim);
        }
        if (drag.moved) {
          this.view = { k: this.view.k, cx: drag.cx - dx / this.view.k, cy: drag.cy + dy / this.view.k };
          this.interact();
          return;
        }
      }
      if (e.pointerType === "touch" || this.locked) return;
      cancelAnimationFrame(hoverRaf);
      hoverRaf = requestAnimationFrame(() => {
        if (!this.view) return;
        const [x, y] = this.toData(p[0], p[1]);
        setHover(this.geo.hit(x, y, this.level), p[0], p[1]);
      });
    };
    const up = (e: PointerEvent) => {
      const p = rel(e);
      const wasDrag = drag?.moved;
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = null;
      if (drag && !wasDrag && pointers.size === 0 && this.view && this.locked) {
        this.unlock();
      } else if (drag && !wasDrag && pointers.size === 0 && this.view) {
        const [x, y] = this.toData(p[0], p[1]);
        const h = this.geo.hit(x, y, this.level);
        if (!this.badges || this.badges[h]) this.cb.onSelect(h);
      }
      if (pointers.size === 0) {
        drag = null;
        if (this.stage) this.stage.style.cursor = "";
      }
    };
    const cancel = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      drag = null;
      pinch = null;
      if (this.stage) this.stage.style.cursor = "";
    };
    const leave = () => {
      if (!drag) setHover("", 0, 0);
    };
    /* Nach einem Klick in die Karte zoomt das Mausrad ohne Taste; ein Klick außerhalb gibt das Scrollen der Seite zurück */
    let engaged = false;
    const engage = () => (engaged = true);
    const outside = (e: PointerEvent) => {
      if (!el.contains(e.target as Node)) engaged = false;
    };
    const wheel = (e: WheelEvent) => {
      if (this.locked) {
        e.preventDefault();
        this.unlock();
      }
      if (engaged || this.freeWheel || !this.locked || e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const p = rel(e);
        this.zoomAt(p[0], p[1], Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0022)));
      } else this.cb.onWheelHint();
    };
    const dbl = (e: MouseEvent) => {
      e.preventDefault();
      const p = rel(e);
      this.zoomAt(p[0], p[1], 2);
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointerdown", engage);
    document.addEventListener("pointerdown", outside);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", cancel);
    el.addEventListener("pointerleave", leave);
    el.addEventListener("wheel", wheel, { passive: false });
    el.addEventListener("dblclick", dbl);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointerdown", engage);
      document.removeEventListener("pointerdown", outside);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", cancel);
      el.removeEventListener("pointerleave", leave);
      el.removeEventListener("wheel", wheel);
      el.removeEventListener("dblclick", dbl);
      cancelAnimationFrame(hoverRaf);
    };
  }
}
