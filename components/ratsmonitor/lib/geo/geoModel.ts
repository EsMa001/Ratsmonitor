import type { MapData, MapLayerData } from "../../types";


export type BBox = [number, number, number, number];

export interface Layer {
  n: number;
  ags: string[];
  name: string[];
  bez: number[];
  lp: number[] | null;
  path: Path2D[];
  bb: BBox[];
  idx: Map<string, number>;
  grid: Map<string, number[]> | null;
}

export interface HierEntry {
  ags: string;
  name: string;
  sort: string;
  short?: string;
  type?: string;
  bez?: number;
  kreisfrei?: boolean;
  kids: HierEntry[];
}

export interface AreaInfo {
  name: string;
  meta: string;
  path: HierEntry[];
}

const KRS_BEZ = ["Landkreis", "Kreis", "Kreisfreie Stadt", "Stadtkreis"];
const GEM_BEZ = ["Gemeinde", "Stadt", "Gemeindefreies Gebiet"];

/** Dekodiert einen polyline-kodierten Arc (Google-Algorithmus, 10-m-Einheiten) */
export function decodeArc(s: string): Int32Array {
  const out: number[] = [];
  let i = 0;
  let x = 0;
  let y = 0;
  const n = s.length;
  while (i < n) {
    let r = 0;
    let sh = 0;
    let b: number;
    do {
      b = s.charCodeAt(i++) - 63;
      r |= (b & 31) << sh;
      sh += 5;
    } while (b >= 32);
    x += r & 1 ? ~(r >> 1) : r >> 1;
    r = 0;
    sh = 0;
    do {
      b = s.charCodeAt(i++) - 63;
      r |= (b & 31) << sh;
      sh += 5;
    } while (b >= 32);
    y += r & 1 ? ~(r >> 1) : r >> 1;
    out.push(x, y);
  }
  return Int32Array.from(out);
}

interface DistEntry {
  gem: Float64Array;
  krs: Float64Array;
  cache: Map<number, { set: Set<string>; kommunen: number }>;
}

/**
 * Geometrie und Gebietshierarchie (Bundesland > Kreis > Kommune).
 * Wird einmal aus den Kartendaten gebaut und von Karte, Ortserkennung und Filter gemeinsam genutzt.
 */
export class GeoModel {
  readonly data: MapData;
  readonly arcs: Int32Array[];
  readonly gem: Layer;
  readonly krs: Layer;
  readonly land: Layer;
  readonly mesh: Path2D[];
  readonly neighbours: Path2D;
  readonly germany: { path: Path2D; bb: BBox };
  readonly coveredGem: number[] = [];
  readonly lands: HierEntry[] = [];
  private readonly landMap = new Map<string, HierEntry>();
  private readonly krsMap = new Map<string, HierEntry>();
  private readonly gemMap = new Map<string, HierEntry>();
  private readonly hctx: CanvasRenderingContext2D;
  private readonly distCache = new Map<string, DistEntry>();

  constructor(data: MapData) {
    this.data = data;
    this.arcs = data.arcs.map(decodeArc);
    this.gem = this.buildLayer(data.gem);
    this.krs = this.buildLayer(data.krs);
    this.land = this.buildLayer(data.land);

    this.mesh = [new Path2D(), new Path2D(), new Path2D(), new Path2D()];
    this.arcs.forEach((a, i) => {
      const m = this.mesh[+data.ac[i]];
      m.moveTo(a[0], a[1]);
      for (let j = 2; j < a.length; j += 2) m.lineTo(a[j], a[j + 1]);
    });

    this.neighbours = new Path2D();
    for (const s of data.aus) {
      const a = decodeArc(s);
      this.neighbours.moveTo(a[0], a[1]);
      for (let j = 2; j < a.length; j += 2) this.neighbours.lineTo(a[j], a[j + 1]);
      this.neighbours.closePath();
    }

    const gp = new Path2D();
    const gbb: BBox = [Infinity, Infinity, -Infinity, -Infinity];
    for (let i = 0; i < this.land.n; i++) {
      gp.addPath(this.land.path[i]);
      const b = this.land.bb[i];
      gbb[0] = Math.min(gbb[0], b[0]);
      gbb[1] = Math.min(gbb[1], b[1]);
      gbb[2] = Math.max(gbb[2], b[2]);
      gbb[3] = Math.max(gbb[3], b[3]);
    }
    this.germany = { path: gp, bb: gbb };

    

    const ctx = document.createElement("canvas").getContext("2d");
    if (!ctx) throw new Error("Canvas 2D wird nicht unterstützt");
    this.hctx = ctx;

    this.buildHierarchy();
  }

  private buildLayer(src: MapLayerData): Layer {
    const n = src.g.length;
    const L: Layer = { n, ags: src.a, name: src.n, bez: src.b ?? [], lp: src.p ?? null, path: new Array(n), bb: new Array(n), idx: new Map(), grid: null };
    for (let i = 0; i < n; i++) {
      const p = new Path2D();
      const b: BBox = [Infinity, Infinity, -Infinity, -Infinity];
      for (const poly of src.g[i]) for (const ring of poly) this.ringTo(p, ring, b);
      L.path[i] = p;
      L.bb[i] = b;
      L.idx.set(src.a[i], i);
    }
    return L;
  }

  private ringTo(p: Path2D, ring: number[], b: BBox) {
    let first = true;
    for (const ai of ring) {
      const rev = ai < 0;
      const a = this.arcs[rev ? ~ai : ai];
      const n = a.length >> 1;
      for (let j = first ? 0 : 1; j < n; j++) {
        const t = rev ? n - 1 - j : j;
        const x = a[2 * t];
        const y = a[2 * t + 1];
        if (first && j === 0) p.moveTo(x, y);
        else p.lineTo(x, y);
        if (x < b[0]) b[0] = x;
        if (y < b[1]) b[1] = y;
        if (x > b[2]) b[2] = x;
        if (y > b[3]) b[3] = y;
      }
      first = false;
    }
    p.closePath();
  }

  private buildHierarchy() {
    const D = this.data;
    const byName = (a: HierEntry, b: HierEntry) => a.sort.localeCompare(b.sort, "de");
    D.land.a.forEach((a, i) => {
      const e: HierEntry = { ags: a, name: D.land.n[i], sort: D.land.n[i], kids: [] };
      this.landMap.set(a, e);
      this.lands.push(e);
    });
    D.krs.a.forEach((a, i) => {
      const b = D.krs.b?.[i] ?? 0;
      const e: HierEntry = {
        ags: a,
        name: (b === 0 ? "Landkreis " : b === 1 ? "Kreis " : "") + D.krs.n[i],
        short: D.krs.n[i],
        sort: D.krs.n[i],
        bez: b,
        type: KRS_BEZ[b],
        kreisfrei: b >= 2,
        kids: [],
      };
      this.krsMap.set(a, e);
      this.landMap.get(a.slice(0, 2))?.kids.push(e);
    });
    D.gem.a.forEach((a, i) => {
      const b = D.gem.b?.[i] ?? 0;
      const e: HierEntry = { ags: a, name: D.gem.n[i], sort: D.gem.n[i], bez: b, type: GEM_BEZ[b], kids: [] };
      this.gemMap.set(a, e);
      this.krsMap.get(a.slice(0, 5))?.kids.push(e);
    });
    this.lands.sort(byName);
    this.landMap.forEach((e) => e.kids.sort(byName));
    this.krsMap.forEach((e) => e.kids.sort(byName));
  }

  /* ---------- Hierarchie ---------- */
  get(ags: string): HierEntry | undefined {
    return ags.length === 2 ? this.landMap.get(ags) : ags.length === 5 ? this.krsMap.get(ags) : ags.length === 8 ? this.gemMap.get(ags) : undefined;
  }

  info(ags: string): AreaInfo {
    if (!ags) return { name: "Alle Gebiete", meta: "Deutschland", path: [] };
    const e = this.get(ags);
    if (!e) return { name: ags, meta: "", path: [] };
    const L = this.landMap.get(ags.slice(0, 2))!;
    if (ags.length === 2) return { name: e.name, meta: "Bundesland", path: [e] };
    const K = this.krsMap.get(ags.slice(0, 5))!;
    if (ags.length === 5) return { name: e.name, meta: `${e.type} · ${L.name}`, path: [L, e] };
    if (K.kreisfrei) return { name: e.name, meta: `${K.type} · ${L.name}`, path: [L, K] };
    return { name: e.name, meta: `${e.type} · ${K.name}`, path: [L, K, e] };
  }

  pathText(ags: string, reverse = false): string {
    const p = this.info(ags).path.map((x) => x.name);
    return (reverse ? p.reverse() : p).join(reverse ? ", " : " › ");
  }

  children(ags: string): HierEntry[] {
    return ags === "" ? this.lands : this.get(ags)?.kids ?? [];
  }

  /* ---------- Geometrie ---------- */
  layerOf(ags: string): Layer | null {
    return ags.length === 8 ? this.gem : ags.length === 5 ? this.krs : ags.length === 2 ? this.land : null;
  }

  bbox(ags: string): BBox | null {
    const L = this.layerOf(ags);
    const i = L?.idx.get(ags);
    return L && i != null ? L.bb[i] : null;
  }

  center(ags: string): { x: number; y: number } | null {
    const L = this.layerOf(ags);
    const i = L?.idx.get(ags);
    if (!L || i == null || !L.lp) return null;
    return { x: L.lp[2 * i], y: L.lp[2 * i + 1] };
  }

  /** Fläche der Bounding Box in km² (grobe Größe für die Ortserkennung) */
  areaSize(ags: string): number {
    const b = this.bbox(ags);
    return b ? ((b[2] - b[0]) * (b[3] - b[1])) / 1e4 : 0;
  }

  isPointIn(path: Path2D, x: number, y: number): boolean {
    return this.hctx.isPointInPath(path, x, y);
  }

  /** Gemeinde unter einem Kartenpunkt (Datenkoordinaten) */
  hit(x: number, y: number, level: "city" | "district" = "city"): string {
    const L = level === "district" ? this.krs : this.gem;
    const cs = 2000;
    if (!L.grid) {
      const g = new Map<string, number[]>();
      for (let i = 0; i < L.n; i++) {
        const b = L.bb[i];
        for (let gx = Math.floor(b[0] / cs); gx <= Math.floor(b[2] / cs); gx++)
          for (let gy = Math.floor(b[1] / cs); gy <= Math.floor(b[3] / cs); gy++) {
            const k = gx + "," + gy;
            let a = g.get(k);
            if (!a) g.set(k, (a = []));
            a.push(i);
          }
      }
      L.grid = g;
    }
    const cand = L.grid.get(Math.floor(x / cs) + "," + Math.floor(y / cs)) ?? [];
    for (const i of cand) {
      const b = L.bb[i];
      if (x < b[0] || x > b[2] || y < b[1] || y > b[3]) continue;
      if (this.hctx.isPointInPath(L.path[i], x, y)) return L.ags[i];
    }
    return "";
  }

  /* ---------- Umkreis ---------- */
  /** Kürzester Abstand jeder Gemeinde und jedes Kreises zum Mittelpunkt (0 = Mittelpunkt liegt im Gebiet) */
  distances(x: number, y: number): DistEntry {
    const key = x + "," + y;
    const hit = this.distCache.get(key);
    if (hit) return hit;
    const ad = new Float64Array(this.arcs.length);
    for (let i = 0; i < this.arcs.length; i++) {
      const a = this.arcs[i];
      let ax = a[0];
      let ay = a[1];
      let m = (ax - x) * (ax - x) + (ay - y) * (ay - y);
      for (let j = 2; j < a.length; j += 2) {
        const bx = a[j];
        const by = a[j + 1];
        const dx = bx - ax;
        const dy = by - ay;
        const l2 = dx * dx + dy * dy;
        let t = l2 ? ((x - ax) * dx + (y - ay) * dy) / l2 : 0;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const px = ax + t * dx - x;
        const py = ay + t * dy - y;
        const d = px * px + py * py;
        if (d < m) m = d;
        ax = bx;
        ay = by;
      }
      ad[i] = Math.sqrt(m);
    }
    const feat = (src: MapLayerData, L: Layer) => {
      const out = new Float64Array(L.n);
      for (let i = 0; i < L.n; i++) {
        let m = Infinity;
        for (const poly of src.g[i])
          for (const ring of poly)
            for (const ai of ring) {
              const d = ad[ai < 0 ? ~ai : ai];
              if (d < m) m = d;
            }
        const b = L.bb[i];
        if (x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3] && this.hctx.isPointInPath(L.path[i], x, y)) m = 0;
        out[i] = m;
      }
      return out;
    };
    const entry: DistEntry = { gem: feat(this.data.gem, this.gem), krs: feat(this.data.krs, this.krs), cache: new Map() };
    if (this.distCache.size >= 6) this.distCache.delete(this.distCache.keys().next().value as string);
    this.distCache.set(key, entry);
    return entry;
  }

  /** Alle Gemeinden, die ganz oder teilweise im Umkreis liegen */
  within(r: { x: number; y: number; km: number }): { set: Set<string>; kommunen: number } {
    const dist = this.distances(r.x, r.y);
    const R = r.km * 100;
    const cached = dist.cache.get(R);
    if (cached) return cached;
    const set = new Set<string>();
    let kommunen = 0;
    for (let i = 0; i < this.gem.n; i++)
      if (dist.gem[i] <= R) {
        set.add(this.gem.ags[i]);
        if (this.gem.bez[i] !== 2) kommunen++;
      }
    for(let i=0;i<this.krs.n;i++)if(dist.krs[i]<=R)set.add(this.krs.ags[i]);
    const res = { set, kommunen };
    if (dist.cache.size > 200) dist.cache.clear();
    dist.cache.set(R, res);
    return res;
  }
}
