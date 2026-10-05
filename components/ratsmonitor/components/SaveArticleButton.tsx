import { useEntitlements } from "../lib/entitlements";
import { toggleSavedArticle, useSavedArticles, type SavedArticle } from "../lib/savedArticles";
import { IconBookmark } from "./icons";

/** Lesezeichen-Knopf für einen Artikel: speichert bzw. entfernt ihn aus „Gespeicherte Artikel“ */
export function SaveArticleButton({ article, size = 20, className = "", label = false }: { article: Omit<SavedArticle, "savedAt">; size?: number; className?: string; /** Beschriftung neben dem Symbol (am Desktop) */ label?: boolean }) {
  const saved = useSavedArticles().some((a) => a.id === article.id);
  const { allow } = useEntitlements();
  return (
    <button
      type="button"
      aria-pressed={saved}
      title={saved ? "Aus gespeicherten Artikeln entfernen" : "Artikel speichern"}
      aria-label={saved ? "Aus gespeicherten Artikeln entfernen" : "Artikel speichern"}
      onClick={(e) => {
        e.stopPropagation();
        /* Entfernen ist immer erlaubt; neu speichern nur innerhalb des Limits */
        if (saved || allow("bookmarks")) toggleSavedArticle(article);
      }}
      className={`${label ? "inline-flex items-center gap-1.5 px-2" : "grid w-9 place-items-center"} h-9 flex-none rounded-lg transition-colors ${saved ? "text-teal-600" : "text-teal-600 hover:bg-teal-50 hover:text-teal-700"} ${className}`}
    >
      <IconBookmark size={size} filled={saved} />
      {label && <span className="hidden text-[14px] sm:inline">{saved ? "Gespeichert" : "Speichern"}</span>}
    </button>
  );
}
