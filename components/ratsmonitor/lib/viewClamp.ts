/** Ansicht eines Netzes (Verschiebung und Zoom): der Mittelpunkt der Fläche liegt bei (x, y), k ist der Maßstab */
export type NetViewState = { x: number; y: number; k: number };
/** Umriss des Inhalts in Netz-Koordinaten (mit Rand für die Namen) */
export type NetBox = { x0: number; x1: number; y0: number; y1: number };

/**
 * Begrenzt Zoom und Verschieben auf das, was das Netz zeigt: nicht weiter hinaus als das ganze Netz (minK), und der Inhalt
 * verlässt die Fläche nie. Ist er (beim Maßstab k) kleiner als die Fläche, bleibt er in der Mitte.
 */
export function clampView(v: NetViewState, b: NetBox, w: number, h: number, minK: number, maxK = 4): NetViewState {
  const k = Math.max(minK, Math.min(maxK, v.k));
  const axis = (pos: number, lo: number, hi: number, size: number) => {
    if ((hi - lo) * k <= size) return -((lo + hi) / 2) * k;
    return Math.min(-size / 2 - lo * k, Math.max(size / 2 - hi * k, pos));
  };
  return { k, x: axis(v.x, b.x0, b.x1, w), y: axis(v.y, b.y0, b.y1, h) };
}
