/* Adresse des Auftritts für absolute Links (Link-Vorschau, canonical, Sitemap): SITE_URL, sonst die Domain ohne www (www leitet um) */
export const SITE_URL = (process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://plenara.de').replace(/\/$/, '');
