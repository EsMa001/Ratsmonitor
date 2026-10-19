import { useState } from "react";
import { copyText } from "../lib/clipboard";

/** Teilen-Menü des Geräts (iOS, Android), sonst Link in die Zwischenablage; ergibt, was geschah.
 *  Mit text: WhatsApp und Nachrichten zeigen so den Titel über dem Link (mit title allein kommt nur der Link). */
export async function shareLink(title: string, url: string): Promise<"shared" | "copied" | "failed"> {
  try {
    if (navigator.share) { await navigator.share({ title, text: title, url }); return "shared"; }
    return (await copyText(url)) ? "copied" : "failed";
  } catch { return "failed"; /* Teilen abgebrochen */ }
}

/** Link teilen: Teilen-Menü des Geräts, sonst Link in die Zwischenablage (kurz Haken als Bestätigung) */
export function ShareButton({ title, url, className = "", label = false }: { title: string; url: string; className?: string; /** Beschriftung neben dem Symbol (am Desktop) */ label?: boolean }) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    try {
      if (navigator.share) return await navigator.share({ title, text: title, url });
      if (!(await copyText(url))) return;
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* Teilen abgebrochen */
    }
  };
  return (
    <button
      type="button"
      onClick={share}
      title={copied ? "Link kopiert" : "Link teilen"}
      aria-label={copied ? "Link kopiert" : "Link teilen"}
      className={`${label ? "inline-flex items-center gap-1.5 px-2" : "grid w-9 place-items-center"} h-9 max-sm:h-11 max-sm:min-w-11 flex-none text-teal-700 transition-colors hover:text-teal-800 ${className}`}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {copied ? (
          <path d="m5 12.5 4.5 4.5L19 7.5" />
        ) : (
          <>
            <path d="M12 3v12" />
            <path d="m7.5 7.5 4.5-4.5 4.5 4.5" />
            <path d="M8 11H6.5A1.5 1.5 0 0 0 5 12.5v7A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5v-7a1.5 1.5 0 0 0-1.5-1.5H16" />
          </>
        )}
      </svg>
      {label && <span className="hidden text-[14px] sm:inline">{copied ? "Kopiert" : "Teilen"}</span>}
    </button>
  );
}
