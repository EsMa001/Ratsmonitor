import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Frühere Adressen leiten auf die neuen Seitennamen um */
  async redirects() {
    return [
      { source: "/quellen", destination: "/datenabdeckung", permanent: true },
      { source: "/branchen/:slug", destination: "/anwender/:slug", permanent: true },
      { source: "/ueber-ratsmonitor", destination: "/funktionen/suche", permanent: true },
    ];
  },
};

export default nextConfig;
