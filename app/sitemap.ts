import type { MetadataRoute } from 'next';
import { SITE_URL } from './site-url';
import { BRANCHEN } from '@/components/ratsmonitor/info/content';

/* Öffentliche Seiten mit eigenem Text. Artikel (/beschluss/…) fehlen noch: das wären Hunderttausende Adressen, dafür bräuchte es
   eine Sitemap in Teilen aus der Datenbank. Neue öffentliche Seiten hier eintragen. */
const PAGES = ['/', '/suche', '/preise', '/funktionen/benachrichtigungen', '/datenabdeckung', '/faq', '/videos', '/kontakt', '/impressum', '/datenschutz', '/agb', '/widerruf'];

export default function sitemap(): MetadataRoute.Sitemap {
  return [...PAGES, ...BRANCHEN.map((b) => `/anwender/${b.slug}`)].map((path) => ({ url: SITE_URL + path, changeFrequency: path === '/' ? 'daily' : 'monthly' }));
}
