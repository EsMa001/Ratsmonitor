/** Kurzes Klicken beim Einrasten (nur wo der Browser es erlaubt, iOS-Safari ignoriert es) */
export function tick() {
  try { navigator.vibrate?.(8); } catch { /* ohne Wirkung */ }
}
