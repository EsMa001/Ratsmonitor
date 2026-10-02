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
  /** Mausrad ohne Strg: Hinweis anzeigen */
  onWheelHint: () => void;
}

/**
 * Canvas-Karte aller Gemeinden: Choroplethen-Stufen, Umkreis, Auswahl und Hover.
 * Zwei Canvas-Ebenen (Basis und Overlay), beim Verschieben und Zoomen wird ein Schnappschuss
 * skaliert und nach 180 ms Ruhe vollständig neu gezeichnet.
 */
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
  private hatch: CanvasPattern | null = null;
  private hatchDpr = 0;
  private counts: Record<string, number> = {};
  private countsKey = "";
  private level: "city" | "district" = "city";
  private coverage: string[] = [];
  private area = "";
  private radius: Radius | null = null;
  private hoverAgs = "";
  private extHover = "";
  private cleanup: (() => void) | null = null;

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
    this.hatch = null;
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
    this.view = first ? this.fitView(this.geo.germany.bb) : { ...this.view!, k: this.clampK(this.view!.k) };
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
      this.flyTo(this.fitView(this.geo.germany.bb), 700);
      return;
    }
    const b = this.geo.bbox(ags);
    if (!b) return;
    const mx = (b[2] - b[0]) * 0.06 + 200;
    const my = (b[3] - b[1]) * 0.06 + 200;
    this.flyTo(this.fitView([b[0] - mx, b[1] - my, b[2] + mx, b[3] + my], 40), 700);
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

  private zoomAt(sx: number, sy: number, f: number) {
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

  private getHatch(): CanvasPattern {
    if (this.hatch && this.hatchDpr === this.dpr) return this.hatch;
    const s = Math.round(7 * this.dpr);
    const c = document.createElement("canvas");
    c.width = c.height = s;
    const x = c.getContext("2d")!;
    x.fillStyle = "#ffffff";
    x.fillRect(0, 0, s, s);
    x.strokeStyle = C.hatch;
    x.lineWidth = Math.max(1, this.dpr);
    x.beginPath();
    x.moveTo(-1, s + 1);
    x.lineTo(s + 1, -1);
    x.moveTo(-1, 1);
    x.lineTo(1, -1);
    x.moveTo(s - 1, s + 1);
    x.lineTo(s + 1, s - 1);
    x.stroke();
    this.hatch = this.bctx!.createPattern(c, "repeat")!;
    this.hatchDpr = this.dpr;
    return this.hatch;
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
    ctx.fillStyle = "#ffffff";
    ctx.fill(fp);
    const pat = this.getHatch();
    pat.setTransform(ctx.getTransform().inverse());
    ctx.fillStyle = pat;
    ctx.fill(fp);
    const L = this.level === "district" ? G.krs : G.gem;
    for (const ags of this.coverage) {
      const i=L.idx.get(ags);if(i===undefined||!this.counts[L.ags[i]])continue;
      ctx.fillStyle = colorForCoverage(this.counts[L.ags[i]] || 0);
      ctx.fill(L.path[i]);
    }
    if (pxkm >= 3) {
      ctx.strokeStyle = C.line;
      ctx.lineWidth = px(0.6);
      ctx.stroke(G.mesh[0]);
    }
    if (pxkm >= 1.2) {
      ctx.strokeStyle = C.line;
      ctx.lineWidth = px(0.7);
      ctx.stroke(G.mesh[1]);
    }
    ctx.strokeStyle = "#c3c9d1";
    ctx.lineWidth = px(1);
    ctx.stroke(G.mesh[2]);
    ctx.save();
    ctx.clip(fp);
    ctx.strokeStyle = pxkm < 1.2 ? "#b3bbc5" : pxkm < 4 ? "#8a94a0" : "#6f7985";
    ctx.lineWidth = px(Math.max(0.25, Math.min(1.1, 0.2 + pxkm * 0.18)));
    ctx.stroke(G.mesh[0]);
    ctx.strokeStyle = pxkm < 1.2 ? "#98a1ad" : "#5f6874";
    ctx.lineWidth = px(pxkm < 1.2 ? 0.5 : 1.2);
    ctx.stroke(G.mesh[1]);
    ctx.strokeStyle = "#4b5563";
    ctx.lineWidth = px(1.2);
    ctx.stroke(G.mesh[2]);
    ctx.restore();
    ctx.strokeStyle = C.national;
    ctx.lineWidth = px(1.1);
    ctx.stroke(G.mesh[3]);
    this.drawLabels(ctx);
    this.drawnView = { ...this.view! };
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
      const [sx, sy] = this.toScreen(L.lp[2 * i], L.lp[2 * i + 1]);
      const strong = covSet.has(i);
      ctx.font = (strong ? "600 12px " : "500 11px ") + fam;
      const label = L.name[i];
      const tw = ctx.measureText(label).width;
      if (!strong && (b[2] - b[0]) * this.view!.k < tw * 0.9) continue;
      const r = [sx - tw / 2 - 3, sy - 8, sx + tw / 2 + 3, sy + 8];
      if (placed.some((q) => !(r[2] < q[0] || r[0] > q[2] || r[3] < q[1] || r[1] > q[3]))) continue;
      placed.push(r);
      ctx.strokeStyle = "rgba(255,255,255,.92)";
      ctx.lineWidth = 3.5;
      ctx.strokeText(label, sx, sy);
      ctx.fillStyle = strong ? "#0f172a" : "#475569";
      ctx.fillText(label, sx, sy);
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
    if (this.area) {
      const L = G.layerOf(this.area);
      const i = L?.idx.get(this.area);
      if (L && i != null) {
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 5 / k;
        ctx.stroke(L.path[i]);
        ctx.strokeStyle = C.selection;
        ctx.lineWidth = 2.6 / k;
        ctx.stroke(L.path[i]);
      }
    }
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
      if (e.pointerType === "touch") return;
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
      if (drag && !wasDrag && pointers.size === 0 && this.view) {
        const [x, y] = this.toData(p[0], p[1]);
        this.cb.onSelect(this.geo.hit(x, y, this.level));
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
    const wheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
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
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", cancel);
    el.addEventListener("pointerleave", leave);
    el.addEventListener("wheel", wheel, { passive: false });
    el.addEventListener("dblclick", dbl);
    return () => {
      el.removeEventListener("pointerdown", down);
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
