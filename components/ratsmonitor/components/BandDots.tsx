"use client";
import { useEffect, useRef } from "react";

/* Weißes Punktraster im Kopfband (plenara.X, Info- und Kontoseiten), nach rechts kräftiger (Maske in CSS, .rm-banddots).
   Mit Maus: Punkte in der Nähe ziehen sich sanft zur Maus und leuchten kurz nach (zurückhaltender als auf der Startseite).
   Ohne Maus oder bei „Bewegung reduzieren“ bleibt das Raster ruhig. Gezeichnet wird nur, solange sich etwas bewegt. */
const GAP = 22, R = 110, PULL = 2, K = 0.12, DAMP = 0.8, FADE = 0.97;

export function BandDots() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current, host = cv?.parentElement;
    const ctx = cv?.getContext("2d");
    if (!cv || !host || !ctx) return;
    const live = matchMedia("(pointer: fine)").matches && !matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0, h = 0, cols = 0, rows = 0, dpr = 1, raf = 0, mx = -1e4, my = -1e4;
    let ox = new Float32Array(0), oy = new Float32Array(0), vx = new Float32Array(0), vy = new Float32Array(0), glow = new Float32Array(0);
    const size = () => {
      const r = host.getBoundingClientRect(); dpr = window.devicePixelRatio || 1; w = Math.round(r.width); h = Math.round(r.height);
      cv.width = w * dpr; cv.height = h * dpr;
      cols = Math.ceil(w / GAP); rows = Math.ceil(h / GAP); const n = cols * rows;
      ox = new Float32Array(n); oy = new Float32Array(n); vx = new Float32Array(n); vy = new Float32Array(n); glow = new Float32Array(n);
      draw();
    };
    const draw = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h); ctx.fillStyle = "#fff";
      let moving = false;
      for (let r = 0, i = 0; r < rows; r++) for (let c = 0; c < cols; c++, i++) {
        const x = c * GAP + GAP / 2, y = r * GAP + GAP / 2, dx = mx - x, dy = my - y, d = Math.hypot(dx, dy);
        const pull = d < R && d > 0.1 ? (4 * (d / R) * (1 - d / R) * PULL) / d : 0;
        vx[i] = (vx[i] + (dx * pull - ox[i]) * K) * DAMP; vy[i] = (vy[i] + (dy * pull - oy[i]) * K) * DAMP;
        ox[i] += vx[i]; oy[i] += vy[i];
        glow[i] = Math.max(glow[i] * FADE, d < R ? 1 - d / R : 0);
        if (Math.abs(vx[i]) + Math.abs(vy[i]) > 0.01 || glow[i] > 0.02) moving = true;
        ctx.globalAlpha = Math.min(1, 0.22 + glow[i] * 0.3);
        ctx.beginPath(); ctx.arc(x + ox[i], y + oy[i], 1.2 + glow[i] * 0.4, 0, 6.2832); ctx.fill();
      }
      raf = moving ? requestAnimationFrame(draw) : 0;
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(draw); };
    const move = (e: PointerEvent) => { if (e.pointerType !== "mouse") return; const r = host.getBoundingClientRect(); mx = e.clientX - r.left; my = e.clientY - r.top; kick(); };
    const leave = () => { mx = -1e4; my = -1e4; kick(); };
    const ro = new ResizeObserver(size);
    ro.observe(host);
    if (live) { host.addEventListener("pointermove", move, { passive: true }); host.addEventListener("pointerleave", leave); }
    return () => { cancelAnimationFrame(raf); ro.disconnect(); host.removeEventListener("pointermove", move); host.removeEventListener("pointerleave", leave); };
  }, []);
  return <canvas ref={ref} aria-hidden="true" className="rm-banddots" />;
}
