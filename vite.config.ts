import { fileURLToPath } from "node:url";
import vinext from "vinext";
import { defineConfig, type Plugin } from "vite";
import hostingConfig from "./.openai/hosting.json";
import { readExecutionProfile } from "./scripts/execution-profile.mjs";
import { sites } from "./build/sites-vite-plugin";
import { todoDev } from "./build/todo-dev-plugin.mjs";

const SITE_CREATOR_PLACEHOLDER_DATABASE_ID =
  "00000000-0000-4000-8000-000000000000";

const { d1, r2 } = hostingConfig;

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";
const managedLinux = readExecutionProfile() === "managed-linux";

const localBindingConfig = {
  main: "vinext/server/fetch-handler",
  compatibility_flags: ["nodejs_compat"],
  d1_databases: d1
    ? [
        {
          binding: d1,
          database_name: "site-creator-d1",
          database_id: SITE_CREATOR_PLACEHOLDER_DATABASE_ID,
        },
      ]
    : [],
  r2_buckets: r2
    ? [
        {
          binding: r2,
          bucket_name: "site-creator-r2",
        },
      ]
    : [],
};

// Node-Betrieb (eigener Server statt Cloudflare): `npm run build:node` setzt RM_TARGET=node.
// Dann ohne Cloudflare-Plugin; 'cloudflare:workers' zeigt auf server/node/cloudflare-workers.mjs, das `env.DB`
// über node:sqlite aus DATABASE_FILE öffnet. Der lokale Dev-Server (npm run dev) bleibt unverändert bei Miniflare.
const nodeTarget = process.env.RM_TARGET === "node";

// Fehler im gebauten Browser-Paket (beide Builds, nicht im Dev-Server): vinexts Link lädt die Navigation mit
// import("./navigation.js") und liest daraus navigateClientSide. Der Bundler legt das Modul in einen gemeinsamen
// Paketteil, dessen Exporte anders heißen; navigateClientSide ist dann undefined und Klicks auf Links tun nichts.
// Statisch importiert bleibt die Verbindung erhalten. Dasselbe gilt für die übrigen relativen import() in link.js
// (Vorladen von Seiten: app-elements, headers …). Prüfung: scripts/check-client-navigation.mjs.
function vinextStaticNavigation(): Plugin {
  return {
    name: "rm-vinext-static-navigation",
    apply: "build",
    transform(code: string, id: string) {
      if (!/[\\/]vinext[\\/]dist[\\/]shims[\\/]link\.js$/.test(id.split("?")[0])) return null;
      if (!code.includes('import("./navigation.js")')) {
        this.error("vinext/shims/link.js lädt die Navigation nicht mehr wie erwartet; rm-vinext-static-navigation prüfen.");
      }
      const specifiers: string[] = [];
      const body = code.replace(/\bimport\("(\.\.?\/[^"]+\.js)"\)/g, (_match, specifier: string) => {
        let index = specifiers.indexOf(specifier);
        if (index === -1) index = specifiers.push(specifier) - 1;
        return `Promise.resolve(__rmStatic${index})`;
      });
      const imports = specifiers.map((specifier, index) => `import * as __rmStatic${index} from "${specifier}";`).join("\n");
      return { code: `${imports}\n${body}`, map: null };
    },
  };
}

export default defineConfig(async ({ command }) => {
  if (nodeTarget) {
    // Nur bauen: Im Dev-Modus wäre import.meta.env.DEV wahr, und jeder Besucher wäre Admin (admin-access.mjs).
    if (command !== "build") throw new Error("RM_TARGET=node ist nur für den Bau gedacht (npm run build:node).");
    return {
      resolve: {
        alias: {
          "cloudflare:workers": fileURLToPath(new URL("./server/node/cloudflare-workers.mjs", import.meta.url)),
        },
      },
      plugins: [vinextStaticNavigation(), vinext()],
    };
  }

  // Use Miniflare's local Request.cf placeholder unless fetching is requested.
  process.env.CLOUDFLARE_CF_FETCH_ENABLED ??= "false";
  process.env.WRANGLER_SEND_METRICS ??= "false";

  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.WRANGLER_REGISTRY_PATH ??= ".wrangler/dev-registry";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    server: {
      // Vite aktiviert das Weiterleiten von Browser-Konsolenfehlern automatisch, wenn der
      // Dev-Server von einem KI-Agenten gestartet wurde. Ist der HMR-WebSocket dann (noch)
      // nicht verbunden, wirft das Weiterleiten selbst einen Fehler, der wiederum
      // weitergeleitet wird: Endlosschleife "can't access property 'send' of undefined".
      forwardConsole: false,
      ...(managedLinux ? { host: "0.0.0.0", allowedHosts: ["terminal.local"] } : {}),
      // Lokales Handy-Testen im WLAN: RM_DEV_HOST=0.0.0.0 node scripts/run-framework.mjs dev
      ...(process.env.RM_DEV_HOST ? { host: process.env.RM_DEV_HOST } : {}),
      // Arbeitsdateien der Quellensuche (tmp/), der erzeugte Lückenatlas (dashboard/) und Berichte (requirements/)
      // sind kein Code. Ihre Änderungen lösten Neuladevorgänge aus, nach denen der Worker hängen blieb
      // ("Network connection lost", /admin antwortete erst nach einer Minute oder mit 500).
      watch: {
        ignored: ["**/tmp/**", "**/dashboard/**", "**/requirements/**"],
        ...(isCodexSeatbeltSandbox ? { useFsEvents: false, usePolling: true } : {}),
      },
    },
    plugins: [
      todoDev(),
      vinextStaticNavigation(),
      vinext(),
      sites({ mockAuth: !managedLinux }),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        inspectorPort: false,
        config: localBindingConfig,
      }),
    ],
  };
});
