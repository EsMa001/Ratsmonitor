/* Gemeinsame Hilfen: Szene laden, Parameter und Format auflösen, Schlüssel des Clips bilden. */
export const FORMATS = { "16x9": { w: 1280, h: 720, out: "1280:720" }, "1x1": { w: 900, h: 900, out: "1080:1080" }, "9x16": { w: 450, h: 800, out: "1080:1920" } };
export async function loadScene(id) {
  const s = (await import(new URL(`../szenen/${id}/szene.mjs`, import.meta.url))).default;
  if (!s || !s.beats) throw new Error(`Szene ${id}: szene.mjs muss { meta, parameter, start, ende, setup, beats } exportieren`);
  return s;
}
export const resolveParams = (scene, over = {}) => ({ ...(scene.parameter || {}), ...over });
/* Schlüssel = Szene, plus Format und abweichende Parameter (dasselbe Thema oder Format wird nur einmal aufgenommen) */
export function clipKey(id, scene, params = {}, format = "16x9") {
  const diff = Object.entries(params).filter(([k, v]) => (scene.parameter || {})[k] !== v).sort(([a], [b]) => a.localeCompare(b));
  const slug = (s) => String(s).toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return [id, format !== "16x9" ? format : "", ...diff.map(([k, v]) => `${k}-${slug(v)}`)].filter(Boolean).join("@");
}
