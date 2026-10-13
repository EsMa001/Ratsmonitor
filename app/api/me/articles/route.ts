// Gemerkte Artikel des Kontos.
import {accountRoute} from '@/server/services/session';
import {articlesList,articlesWrite} from '@/server/accounts/account.mjs';
export const dynamic='force-dynamic';
export const GET=accountRoute(articlesList);
export const POST=accountRoute(articlesWrite);
export const PATCH=accountRoute(articlesWrite);
export const DELETE=accountRoute(articlesWrite);
