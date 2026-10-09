import type { NextConfig } from "next";

// Node-Betrieb (npm run build:node, RM_TARGET=node): eigenständiger Server unter dist/standalone/server.js.
// Für Cloudflare (npm run build) bleibt die Ausgabe wie bisher.
const nextConfig: NextConfig = {
  ...(process.env.RM_TARGET === "node" ? { output: "standalone" as const } : {}),
};

export default nextConfig;
