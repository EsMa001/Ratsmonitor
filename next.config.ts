import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Die Seite „Über uns“ gibt es nicht mehr: alte Links führen zur Startseite */
  async redirects() {
    return [{ source: "/ueber-uns", destination: "/", permanent: true }];
  },
};

export default nextConfig;
