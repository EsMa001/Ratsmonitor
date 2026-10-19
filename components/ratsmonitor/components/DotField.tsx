"use client";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useHydrated } from "../lib/useClient";

/* Nur auf der Startseite (App.tsx). Punktraster oben auf den Seiten: Punkte in Mausnähe ziehen sich leicht zur Maus (am stärksten im mittleren Abstand, ganz nah kaum, damit nichts springt),
   färben sich in Petrol (--rm-fill, Ton der Deutschlandkarte) und verblassen langsam, sodass die Maus eine Spur zieht; ein Klick schickt eine Schockwelle über das Raster.
   Nur mit Maus (pointer: fine) und ohne „Bewegung reduzieren“; sonst bleibt das CSS-Raster (body::before). Gezeichnet wird nur, solange sich etwas bewegt. */
const GAP = 22, H = 640, R = 150, PULL = 3, K = 0.12, DAMP = 0.8;
/* Nachleuchten je Frame, Schockwelle: Geschwindigkeit (px je Frame), Breite des Rings, Stoß, Reichweite */
const FADE = 0.975, WAVE_V = 9, WAVE_W = 46, WAVE_PUSH = 1.5, WAVE_MAX = 900;

export function DotField() {
  const client = useHydrated();
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const root = document.documentElement;
    if (!matchMedia("(pointer: fine)").matches || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    root.classList.add("rm-dotfield-on");
    let w = 0, cols = 0, rows = 0, ox = new Float32Array(0), oy = new Float32Array(0), vx = new Float32Array(0), vy = new Float32Array(0), glow = new Float32Array(0);
    const waves: { x: number; y: number; r: number }[] = [];
    let mx = -1e4, my = -1e4, raf = 0, color = "", strong = "", dpr = 1;
    const size = () => {
      dpr = window.devicePixelRatio || 1; w = Math.round(cv.getBoundingClientRect().width);
      cv.width = w * dpr; cv.height = H * dpr;
      cols = Math.ceil(w / GAP); rows = Math.ceil(H / GAP); const n = cols * rows;
      ox = new Float32Array(n); oy = new Float32Array(n); vx = new Float32Array(n); vy = new Float32Array(n); glow = new Float32Array(n);
      const cs = getComputedStyle(root);
      color = cs.getPropertyValue("--rm-dot").trim();
      strong = cs.getPropertyValue("--rm-fill").trim();
      draw();
    };
    const draw = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, H);
      let moving = false;
      for (const wv of waves) wv.r += WAVE_V;
      while (waves.length && waves[0].r > WAVE_MAX) waves.shift();
      if (waves.length) moving = true;
      for (let r = 0, i = 0; r < rows; r++) for (let c = 0; c < cols; c++, i++) {
        const x = c * GAP + GAP / 2, y = r * GAP + GAP / 2, dx = mx - x, dy = my - y, d = Math.hypot(dx, dy);
        /* Zug: 0 an der Maus und am Rand, höchstens PULL px bei halbem Abstand */
        const pull = d < R && d > 0.1 ? (4 * (d / R) * (1 - d / R) * PULL) / d : 0;
        for (const wv of waves) {
          const ex = x - wv.x, ey = y - wv.y, e = Math.hypot(ex, ey), band = 1 - Math.abs(e - wv.r) / WAVE_W;
          if (band > 0 && e > 0.1) { const p = band * WAVE_PUSH * (1 - wv.r / WAVE_MAX); vx[i] += (ex / e) * p; vy[i] += (ey / e) * p; glow[i] = Math.max(glow[i], band * (1 - wv.r / WAVE_MAX) * 0.9); }
        }
        vx[i] = (vx[i] + (dx * pull - ox[i]) * K) * DAMP; vy[i] = (vy[i] + (dy * pull - oy[i]) * K) * DAMP;
        ox[i] += vx[i]; oy[i] += vy[i];
        const near = d < R ? 1 - d / R : 0;
        glow[i] = Math.max(glow[i] * FADE, near * 0.8);
        if (Math.abs(vx[i]) + Math.abs(vy[i]) > 0.01 || glow[i] > 0.02) moving = true;
        const g = Math.min(1.4, glow[i]);
        const px = x + ox[i], py = y + oy[i], rad = 1.4 + g * 0.6;
        ctx.fillStyle = color; ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(px, py, rad, 0, 6.2832); ctx.fill();
        if (g > 0.02) { ctx.fillStyle = strong; ctx.globalAlpha = Math.min(0.8, g * 0.6); ctx.beginPath(); ctx.arc(px, py, rad, 0, 6.2832); ctx.fill(); }
      }
      ctx.globalAlpha = 1;
      raf = moving ? requestAnimationFrame(draw) : 0;
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(draw); };
    const move = (e: PointerEvent) => { if (e.pointerType !== "mouse") return; mx = e.pageX; my = e.pageY; kick(); };
    /* Welle nur auf freier Fläche: nicht in Kopfzeile, Menüs, Dialogen, nicht auf oder bis NEAR px neben Bedienelementen, und nicht, solange ein Menü offen ist (der Klick schließt es) */
    const QUIET = "header, nav, menu, dialog, [role=menu], [role=dialog], [role=listbox]";
    const CONTROL = "a, button, input, select, textarea, label, summary, [role=button], [role=tab], [role=link], [tabindex]:not([tabindex=\"-1\"]), [contenteditable]";
    const NEAR = 40;
    const nearControl = (x: number, y: number) => [...document.querySelectorAll(CONTROL)].some((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && x > r.left - NEAR && x < r.right + NEAR && y > r.top - NEAR && y < r.bottom + NEAR; });
    const down = (e: PointerEvent) => { if (e.pointerType !== "mouse" || e.pageY > H || (e.target instanceof Element && e.target.closest(QUIET)) || document.querySelector("[aria-expanded=true]") || nearControl(e.clientX, e.clientY)) return; waves.push({ x: e.pageX, y: e.pageY, r: 0 }); kick(); };
    const leave = () => { mx = -1e4; my = -1e4; kick(); };
    const theme = new MutationObserver(size);
    theme.observe(root, { attributes: true, attributeFilter: ["class"] });
    size();
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerdown", down, { passive: true });
    document.addEventListener("pointerleave", leave);
    const ro = new ResizeObserver(() => { if (Math.round(cv.getBoundingClientRect().width) !== w) size(); });
    ro.observe(cv);
    return () => { cancelAnimationFrame(raf); theme.disconnect(); root.classList.remove("rm-dotfield-on"); window.removeEventListener("pointermove", move); window.removeEventListener("pointerdown", down); document.removeEventListener("pointerleave", leave); ro.disconnect(); };
  }, [client]);
  if (!client) return null;
  return createPortal(<canvas ref={ref} aria-hidden="true" className="rm-dotfield" height={H} />, document.body);
}
