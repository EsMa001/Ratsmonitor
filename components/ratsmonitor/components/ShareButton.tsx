import { useState } from "react";

/** Link teilen: Teilen-Menü des Geräts, sonst Link in die Zwischenablage (kurz Haken als Bestätigung) */
export function ShareButton({ title, url, className = "" }: { title: string; url: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    try {
      if (navigator.share) return await navigator.share({ title, url });
      await navigator.clipboard.writeText(url);
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
      className={`grid h-9 w-9 flex-none place-items-center text-teal-600 transition-colors hover:text-teal-800 ${className}`}
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
    </button>
  );
}
