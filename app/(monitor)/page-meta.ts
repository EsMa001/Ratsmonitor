import type { Metadata } from 'next';

/* Titel und Beschreibung je Seite, damit Suchmaschinen und Link-Vorschauen nicht überall „plenara“ zeigen */
/* path: Adresse der Seite (canonical und og:url, damit Varianten mit Parametern wie /suche?q=… als dieselbe Seite gelten);
   index false: Titel und Vorschau ja, aber nicht in Suchmaschinen (z. B. Anmelden) */
export function pageMeta(name: string, description: string, image = '/og.png', path?: string, index = true): Metadata {
  const title = `${name} · plenara`;
  return {
    title,
    description,
    ...(path ? { alternates: { canonical: path } } : {}),
    ...(index ? {} : { robots: { index: false, follow: true } }),
    openGraph: { type: 'website', locale: 'de_DE', siteName: 'plenara', title, description, ...(path ? { url: path } : {}), images: [{ url: image, width: 1200, height: 630 }] },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
  };
}

/* Seiten hinter der Anmeldung: eigener Titel, aber nicht für Suchmaschinen */
export function privateMeta(name: string): Metadata {
  return { title: `${name} · plenara`, robots: { index: false, follow: false } };
}
