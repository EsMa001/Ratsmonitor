import { useCallback, useEffect, useState } from "react";
import { api, useMe } from "./account";
import { useClient } from "./useClient";

/** Favorit-Ort: im Konto (/api/me/settings: home), im Browser als Zwischenspeicher; ohne Anmeldung nur im Browser */
export type HomePlace = { ags: string; name: string };
const KEY = "plenara.meinOrt";
const readLocal = (): HomePlace | null => { try { const v = JSON.parse(localStorage.getItem(KEY) || "null"); return v?.ags && v?.name ? { ags: String(v.ags), name: String(v.name) } : null; } catch { return null; } };
const writeLocal = (v: HomePlace | null) => { try { if (v) localStorage.setItem(KEY, JSON.stringify(v)); else localStorage.removeItem(KEY); } catch { /* ohne Speicher geht es auch */ } };

/**
 * [Ort, setzen]. Beim Hydrieren null; danach der Browserwert, bei Anmeldung der Wert aus dem Konto. Hat das Konto noch keinen,
 * der Browser aber einen, geht dieser einmal ins Konto (bisher gemerkte Orte bleiben erhalten).
 */
export function useHomePlace(): [HomePlace | null, (v: HomePlace | null) => void] {
  const me = useMe();
  const uid = me.ready ? me.user?.id ?? "" : "";
  /* Browserwert erst nach dem Hydrieren (useClient), danach der Wert aus dem Konto oder die letzte Änderung */
  const stored = useClient(() => { try { return localStorage.getItem(KEY) || ""; } catch { return ""; } }, "");
  const [own, setHome] = useState<HomePlace | null | undefined>(undefined);
  const home = own !== undefined ? own : stored ? readLocal() : null;
  useEffect(() => {
    if (!uid) return;
    let live = true;
    api<{ home?: HomePlace | null }>("/api/me/settings").then((d) => {
      if (!live) return;
      if (d.home?.ags) { writeLocal(d.home); setHome(d.home); return; }
      const l = readLocal();
      if (l) api("/api/me/settings", { method: "PUT", body: { home: l } }).catch(() => {});
    }, () => {});
    return () => { live = false; };
  }, [uid]);
  const set = useCallback((v: HomePlace | null) => {
    writeLocal(v); setHome(v);
    if (uid) api("/api/me/settings", { method: "PUT", body: { home: v } }).catch(() => {});
  }, [uid]);
  return [home, set];
}
