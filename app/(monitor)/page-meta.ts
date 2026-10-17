import type { Metadata } from 'next';

/* Titel und Beschreibung je Seite, damit Suchmaschinen und Link-Vorschauen nicht überall „plenara“ zeigen */
export function pageMeta(name: string, description: string): Metadata {
  const title = `${name} · plenara`;
  return {
    title,
    description,
    openGraph: { type: 'website', locale: 'de_DE', siteName: 'plenara', title, description, images: [{ url: '/og.png', width: 1200, height: 630 }] },
    twitter: { card: 'summary_large_image', title, description, images: ['/og.png'] },
  };
}
