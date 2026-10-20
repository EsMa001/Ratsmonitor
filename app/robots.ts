import type { MetadataRoute } from 'next';
import { SITE_URL } from './site-url';

/* Suchmaschinen: öffentliche Seiten ja, Konto, Anmeldung, Administration und Schnittstellen nein.
   Solange Caddy „X-Robots-Tag: noindex“ setzt (Testphase), wird trotzdem nichts aufgenommen. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/konto', '/anmelden', '/api/'] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
