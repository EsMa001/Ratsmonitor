import { toggleFollow, useSavedArticles, type SavedArticle } from "../lib/savedArticles";
import { IconBell } from "./icons";

/** Glocke: bei Neuigkeiten zu diesem Vorgang benachrichtigen */
export function FollowButton({ article, size = 20, className = "" }: { article: Omit<SavedArticle, "savedAt" | "follow">; size?: number; className?: string }) {
  const on = !!useSavedArticles().find((a) => a.id === article.id)?.follow;
  return (
    <button
      type="button"
      aria-pressed={on}
      title={on ? "Benachrichtigungen zu diesem Vorgang ausschalten" : "Bei Neuigkeiten zu diesem Vorgang benachrichtigen"}
      aria-label={on ? "Benachrichtigungen ausschalten" : "Benachrichtigungen einschalten"}
      onClick={(e) => {
        e.stopPropagation();
        toggleFollow(article);
      }}
      className={`grid h-9 w-9 flex-none place-items-center rounded-lg text-teal-600 transition-colors hover:bg-teal-50 hover:text-teal-700 ${className}`}
    >
      <IconBell size={size} filled={on} />
    </button>
  );
}
