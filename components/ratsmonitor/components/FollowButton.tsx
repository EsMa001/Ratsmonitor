import { useEntitlements } from "../lib/entitlements";
import { toggleFollow, useSavedArticles, type SavedArticle } from "../lib/savedArticles";
import { IconBell } from "./icons";

/** Glocke: bei Neuigkeiten zu diesem Vorgang benachrichtigen */
export function FollowButton({ article, size = 20, className = "", label = false }: { article: Omit<SavedArticle, "savedAt" | "follow">; size?: number; className?: string; /** Beschriftung neben dem Symbol (am Desktop) */ label?: boolean }) {
  const hit = useSavedArticles().find((a) => a.id === article.id);
  const on = !!hit?.follow;
  const { allow } = useEntitlements();
  return (
    <button
      type="button"
      aria-pressed={on}
      title={on ? "Benachrichtigungen zu diesem Vorgang ausschalten" : "Bei Neuigkeiten zu diesem Vorgang benachrichtigen"}
      aria-label={on ? "Benachrichtigungen ausschalten" : "Benachrichtigungen einschalten"}
      onClick={(e) => {
        e.stopPropagation();
        if (on) return toggleFollow(article);
        /* Folgen speichert den Artikel mit: dafür muss auch ein Lesezeichen frei sein */
        if (!hit && !allow("bookmarks")) return;
        if (allow("notifications")) toggleFollow(article);
      }}
      className={`${label ? "inline-flex items-center gap-1.5 px-2" : "grid w-9 place-items-center"} h-9 flex-none rounded-lg text-teal-600 transition-colors hover:bg-teal-50 hover:text-teal-700 ${className}`}
    >
      <IconBell size={size} filled={on} />
      {label && <span className="hidden text-[14px] sm:inline">{on ? "Folge ich" : "Folgen"}</span>}
    </button>
  );
}
