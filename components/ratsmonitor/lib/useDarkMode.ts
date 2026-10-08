import { useEffect, useState } from "react";

const KEY = "rm-dark";
const EVT = "rm-dark-change";

/** Dunkler Modus (Klasse rm-dark auf <html>): gespeicherte Wahl, sonst die Systemeinstellung des Geräts */
function resolve(): boolean {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "1") return true;
    if (v === "0") return false;
  } catch { /* ohne Speicher: Systemeinstellung */ }
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function useDarkMode(): [boolean, (v: boolean) => void] {
  const [dark, setDarkState] = useState(false);
  useEffect(() => {
    const read = () => {
      const d = resolve();
      document.documentElement.classList.toggle("rm-dark", d);
      setDarkState(d);
    };
    read();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    window.addEventListener(EVT, read);
    mq.addEventListener("change", read);
    return () => {
      window.removeEventListener(EVT, read);
      mq.removeEventListener("change", read);
    };
  }, []);
  const set = (v: boolean) => {
    try { localStorage.setItem(KEY, v ? "1" : "0"); } catch { /* egal */ }
    setDarkState(v);
    window.dispatchEvent(new Event(EVT));
  };
  return [dark, set];
}
